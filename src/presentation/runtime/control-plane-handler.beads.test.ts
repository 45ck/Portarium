import { afterEach, describe, expect, it } from 'vitest';
import { ok } from '../../application/common/result.js';
import { toAppContext } from '../../application/common/context.js';
import type { BeadDiffHunk } from '../../application/ports/index.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import { startHealthServer, type HealthServerHandle } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

type HandlerDeps = Parameters<typeof createControlPlaneHandler>[0];

const HUNKS: readonly BeadDiffHunk[] = [
  {
    hunkId: 'bead-0976:proposal',
    filePath: 'issues/bead-0976/proposal.md',
    changeType: 'modified',
    oldStart: 1,
    oldCount: 1,
    newStart: 1,
    newCount: 2,
    lines: [
      { op: 'context', oldLineNumber: 1, newLineNumber: 1, content: '# bead-0976' },
      { op: 'add', newLineNumber: 2, content: 'Approval surface: Cockpit diff review' },
    ],
  },
  {
    hunkId: 'bead-0976:policy',
    filePath: 'policies/bead-0976.json',
    changeType: 'added',
    oldStart: 0,
    oldCount: 0,
    newStart: 1,
    newCount: 1,
    lines: [{ op: 'add', newLineNumber: 1, content: '{ "requiresApproval": true }' }],
  },
];

function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    authentication: {
      authenticateBearerToken: async () =>
        ok(
          toAppContext({
            tenantId: 'ws-test',
            principalId: 'user-1',
            roles: ['admin'],
            correlationId: 'corr-1',
          }),
        ),
    },
    authorization: { isAllowed: async () => true },
    workspaceStore: {
      getWorkspaceById: async () => null,
      getWorkspaceByName: async () => null,
      saveWorkspace: async () => undefined,
    },
    runStore: {
      getRunById: async () => null,
      saveRun: async () => undefined,
    },
    beadDiffStore: {
      getBeadDiff: async () => HUNKS,
    },
    ...overrides,
  };
}

async function startWith(deps: HandlerDeps): Promise<string> {
  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(deps),
  });
  return `http://127.0.0.1:${handle.port}`;
}

describe('GET /v1/workspaces/:workspaceId/beads/:beadId/diff', () => {
  it('returns approval diff hunks for an authenticated reader', async () => {
    const base = await startWith(makeDeps());
    const res = await fetch(`${base}/v1/workspaces/ws-test/beads/bead-0976/diff`, {
      headers: { authorization: 'Bearer test-token' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      hunkId: 'bead-0976:proposal',
      filePath: 'issues/bead-0976/proposal.md',
      changeType: 'modified',
    });
    expect(body[0]?.['lines']).toEqual(
      expect.arrayContaining([expect.objectContaining({ op: 'add' })]),
    );
  });

  it('returns 501 when bead diff lookup is unavailable', async () => {
    const { beadDiffStore, ...depsWithoutBeadDiffStore } = makeDeps();
    expect(beadDiffStore).toBeDefined();

    const base = await startWith(depsWithoutBeadDiffStore);
    const res = await fetch(`${base}/v1/workspaces/ws-test/beads/bead-0976/diff`, {
      headers: { authorization: 'Bearer test-token' },
    });

    expect(res.status).toBe(501);
  });

  it('returns 401 when authentication fails', async () => {
    const base = await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () => ({
            ok: false as const,
            error: { kind: 'Unauthorized' as const, message: 'No token' },
          }),
        },
      }),
    );

    const res = await fetch(`${base}/v1/workspaces/ws-test/beads/bead-0976/diff`);
    expect(res.status).toBe(401);
  });

  it('rejects unsafe bead identifiers', async () => {
    const base = await startWith(makeDeps());
    const res = await fetch(
      `${base}/v1/workspaces/ws-test/beads/${encodeURIComponent('../x')}/diff`,
      {
        headers: { authorization: 'Bearer test-token' },
      },
    );

    expect(res.status).toBe(422);
  });

  it('returns 404 when no diff exists for the bead', async () => {
    const base = await startWith(
      makeDeps({
        beadDiffStore: {
          getBeadDiff: async () => null,
        },
      }),
    );

    const res = await fetch(`${base}/v1/workspaces/ws-test/beads/bead-missing/diff`, {
      headers: { authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(404);
  });
});
