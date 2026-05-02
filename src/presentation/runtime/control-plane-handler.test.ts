import { afterEach, describe, expect, it } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { err, ok } from '../../application/common/result.js';
import { InMemoryEvidenceLog } from '../../infrastructure/stores/in-memory-evidence-log.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import {
  buildInMemoryHumanTaskStore,
  buildInMemoryWorkforceMemberStore,
  buildInMemoryWorkforceQueueStore,
} from './control-plane-handler.bootstrap.js';
import { InMemoryCockpitWebSessionStore } from './cockpit-web-session.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

type Role = 'admin' | 'operator' | 'approver' | 'auditor';
type HandlerDeps = Parameters<typeof createControlPlaneHandler>[0];

function makeCtx(
  roles: readonly Role[] = ['admin'],
  scopes: readonly string[] = [],
  capabilities: readonly string[] = [],
  tenantId = 'tenant-1',
  principalId = 'user-1',
) {
  return toAppContext({
    tenantId,
    principalId,
    roles,
    scopes,
    capabilities,
    correlationId: 'corr-1',
  });
}

function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  const evidenceLog = new InMemoryEvidenceLog();
  return {
    authentication: {
      authenticateBearerToken: async () => ok(makeCtx()),
    },
    authorization: {
      isAllowed: async () => true,
    },
    workspaceStore: {
      getWorkspaceById: async () => null,
      getWorkspaceByName: async () => null,
      saveWorkspace: async () => undefined,
    },
    runStore: {
      getRunById: async () => null,
      saveRun: async () => undefined,
    },
    workforceMemberStore: buildInMemoryWorkforceMemberStore('workspace-1'),
    workforceQueueStore: buildInMemoryWorkforceQueueStore('workspace-1'),
    humanTaskStore: buildInMemoryHumanTaskStore('workspace-1'),
    evidenceLog,
    evidenceQueryStore: evidenceLog,
    ...overrides,
  };
}

async function startWith(deps: HandlerDeps): Promise<void> {
  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(deps),
  });
}

describe('createControlPlaneHandler', () => {
  it('routes GET workspace to application query and returns Problem Details on not found', async () => {
    await startWith(makeDeps());
    const res = await fetch(`http://${handle!.host}:${handle!.port}/v1/workspaces/ws-1`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
    expect(res.headers.get('traceparent')).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i);
    const body = (await res.json()) as { type: string; status: number };
    expect(body.type).toMatch(/not-found/);
    expect(body.status).toBe(404);
  });

  it('authenticates cockpit extension context via cookie-backed web session when bearer auth is absent', async () => {
    const cockpitWebSessionStore = new InMemoryCockpitWebSessionStore();
    const record = cockpitWebSessionStore.create({
      ctx: makeCtx(['operator', 'auditor'], ['extensions.read'], ['objects:read']),
      ttlMs: 5 * 60 * 1000,
      nowMs: Date.parse('2026-04-30T02:00:00.000Z'),
    });

    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () =>
            err({ kind: 'Unauthorized' as const, message: 'Missing token.' }),
        },
        cockpitWebSessionStore,
        clock: () => new Date('2026-04-30T02:00:30.000Z'),
      }),
    );

    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/tenant-1/cockpit/extension-context`,
      {
        headers: {
          cookie: `portarium_cockpit_session=${encodeURIComponent(record.sessionId)}`,
        },
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { principalId: string; availablePersonas: string[] };
    expect(body.principalId).toBe('user-1');
    expect(body.availablePersonas).toEqual(['Operator', 'Auditor']);
  });

  it('rejects cookie-authenticated mutations without the same-origin request marker', async () => {
    const cockpitWebSessionStore = new InMemoryCockpitWebSessionStore();
    const record = cockpitWebSessionStore.create({
      ctx: makeCtx(['admin']),
      ttlMs: 5 * 60 * 1000,
      nowMs: Date.parse('2026-04-30T02:00:00.000Z'),
    });

    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () =>
            err({ kind: 'Unauthorized' as const, message: 'Missing token.' }),
        },
        cockpitWebSessionStore,
        clock: () => new Date('2026-04-30T02:00:30.000Z'),
      }),
    );

    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/tenant-1/intents:plan`,
      {
        method: 'POST',
        headers: {
          cookie: `portarium_cockpit_session=${encodeURIComponent(record.sessionId)}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ triggerText: 'Create a runbook' }),
      },
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toContain('X-Portarium-Request');
  });

  it('allows cookie-authenticated mutations when the same-origin request marker is present', async () => {
    const cockpitWebSessionStore = new InMemoryCockpitWebSessionStore();
    const record = cockpitWebSessionStore.create({
      ctx: makeCtx(['admin']),
      ttlMs: 5 * 60 * 1000,
      nowMs: Date.parse('2026-04-30T02:00:00.000Z'),
    });

    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () =>
            err({ kind: 'Unauthorized' as const, message: 'Missing token.' }),
        },
        cockpitWebSessionStore,
        clock: () => new Date('2026-04-30T02:00:30.000Z'),
      }),
    );

    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/tenant-1/intents:plan`,
      {
        method: 'POST',
        headers: {
          cookie: `portarium_cockpit_session=${encodeURIComponent(record.sessionId)}`,
          'content-type': 'application/json',
          'x-portarium-request': 'true',
        },
        body: JSON.stringify({ triggerText: 'Create a runbook' }),
      },
    );

    expect(res.status).toBe(200);
  });

  it('returns generic cockpit extension context from the authenticated principal', async () => {
    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () =>
            ok(makeCtx(['operator', 'auditor'], ['extensions.read'], ['objects:read'])),
        },
        clock: () => new Date('2026-04-30T02:00:00.000Z'),
      }),
    );

    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/tenant-1/cockpit/extension-context`,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toMatch(/^"[a-f0-9]{12}"$/);
    const body = (await res.json()) as {
      schemaVersion: number;
      workspaceId: string;
      principalId: string;
      persona: string;
      availablePersonas: string[];
      availableCapabilities: string[];
      availableApiScopes: string[];
      availablePrivacyClasses: string[];
      activePackIds: string[];
      quarantinedExtensionIds: string[];
      emergencyDisabledExtensionIds: string[];
      hostContract: unknown;
      issuedAtIso: string;
      expiresAtIso: string;
    };
    expect(body).toEqual({
      schemaVersion: 1,
      workspaceId: 'tenant-1',
      principalId: 'user-1',
      persona: 'Operator',
      availablePersonas: ['Operator', 'Auditor'],
      availableCapabilities: ['objects:read'],
      availableApiScopes: ['extensions.read'],
      availablePrivacyClasses: [],
      activePackIds: [],
      quarantinedExtensionIds: [],
      emergencyDisabledExtensionIds: [],
      hostContract: {
        schemaVersion: 1,
        browserEgress: 'host-api-origins-only',
        credentialAccess: 'none',
        failureMode: 'fail-closed',
        dataQueries: [
          expect.objectContaining({
            id: 'cockpit.extensionContext.get',
            kind: 'data-query',
            pathTemplate: '/v1/workspaces/{workspaceId}/cockpit/extension-context',
            requiredApiScopes: ['extensions.read'],
            requiredAppActions: ['workspace:read'],
            failClosed: true,
          }),
        ],
        governedCommandRequests: [],
      },
      issuedAtIso: '2026-04-30T02:00:00.000Z',
      expiresAtIso: '2026-04-30T02:05:00.000Z',
    });
  });

  it('advertises only configured, authorized, effectively scoped backend plugin surfaces', async () => {
    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () =>
            ok(
              makeCtx(
                ['operator'],
                ['extensions.read', 'approvals.read', 'evidence.read', 'agent-actions.propose'],
                ['objects:read'],
              ),
            ),
        },
        cockpitExtensionActivationSource: {
          getActivationState: async () => ({
            activePackIds: ['example.pack'],
            quarantinedExtensionIds: [],
            emergencyDisabledExtensionIds: [],
            availableCapabilities: [],
            availableApiScopes: [
              'extensions.read',
              'approvals.read',
              'evidence.read',
              'agent-actions.propose',
            ],
          }),
        },
        approvalQueryStore: {
          listApprovals: async () => ({ items: [] }),
        },
        approvalStore: {
          getApprovalById: async () => null,
          saveApproval: async () => undefined,
        },
        policyStore: {
          getPolicyById: async () => null,
          savePolicy: async () => undefined,
        },
        eventPublisher: {
          publish: async () => undefined,
        },
      }),
    );

    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/tenant-1/cockpit/extension-context`,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      hostContract: {
        dataQueries: { id: string; failClosed: boolean }[];
        governedCommandRequests: {
          id: string;
          policySemantics: string;
          approvalSemantics: string;
          evidenceSemantics: string;
          failClosed: boolean;
        }[];
      };
    };
    expect(body.hostContract.dataQueries.map((query) => query.id)).toEqual([
      'cockpit.extensionContext.get',
      'approvals.list',
      'evidence.list',
    ]);
    expect(body.hostContract.dataQueries.every((query) => query.failClosed)).toBe(true);
    expect(body.hostContract.governedCommandRequests).toEqual([
      expect.objectContaining({
        id: 'agentActions.propose',
        policySemantics: 'policy-approval-evidence-required',
        approvalSemantics: 'policy-determined',
        evidenceSemantics: 'evidence-required-before-response',
        failClosed: true,
      }),
    ]);
  });

  it('fails closed by omitting governed commands when governance dependencies are unavailable', async () => {
    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () =>
            ok(makeCtx(['operator'], ['extensions.read', 'agent-actions.propose'])),
        },
        cockpitExtensionActivationSource: {
          getActivationState: async () => ({
            activePackIds: ['example.pack'],
            quarantinedExtensionIds: [],
            emergencyDisabledExtensionIds: [],
            availableApiScopes: ['extensions.read', 'agent-actions.propose'],
          }),
        },
      }),
    );

    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/tenant-1/cockpit/extension-context`,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      hostContract: { governedCommandRequests: unknown[] };
    };
    expect(body.hostContract.governedCommandRequests).toEqual([]);
  });

  it('fails closed when cockpit extension activation cannot be resolved', async () => {
    await startWith(
      makeDeps({
        cockpitExtensionActivationSource: {
          getActivationState: async () => {
            throw new Error('activation source unavailable');
          },
        },
      }),
    );

    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/tenant-1/cockpit/extension-context`,
    );

    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
    const body = (await res.json()) as { type: string; detail: string };
    expect(body.type).toMatch(/service-unavailable/);
    expect(body.detail).toContain('denied by default');
  });

  it('returns active and quarantined extension ids from the activation source', async () => {
    const queries: unknown[] = [];
    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () =>
            ok(makeCtx(['admin'], ['extensions.read'], ['objects:read'])),
        },
        cockpitExtensionActivationSource: {
          getActivationState: async (query) => {
            queries.push(query);
            return {
              activePackIds: ['example.pack', ' example.pack ', 'quarantined.pack'],
              quarantinedExtensionIds: ['quarantined.extension', ''],
              emergencyDisabledExtensionIds: ['disabled.extension', ' disabled.extension '],
              availableCapabilities: ['extension.route:read', 'objects:read'],
              availableApiScopes: ['extensions.read', 'workspace.read'],
              availablePrivacyClasses: ['internal', 'restricted'],
            };
          },
        },
        clock: () => new Date('2026-04-30T02:00:00.000Z'),
      }),
    );

    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/tenant-1/cockpit/extension-context`,
      {
        headers: {
          'x-correlation-id': 'corr-fixed',
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        },
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      activePackIds: string[];
      quarantinedExtensionIds: string[];
      emergencyDisabledExtensionIds: string[];
      availableCapabilities: string[];
      availableApiScopes: string[];
      availablePrivacyClasses: string[];
    };
    expect(body.activePackIds).toEqual(['example.pack', 'quarantined.pack']);
    expect(body.quarantinedExtensionIds).toEqual(['quarantined.extension']);
    expect(body.emergencyDisabledExtensionIds).toEqual(['disabled.extension']);
    expect(body.availableCapabilities).toEqual(['objects:read', 'extension.route:read']);
    expect(body.availableApiScopes).toEqual(['extensions.read']);
    expect(body.availablePrivacyClasses).toEqual(['internal', 'restricted']);
    expect(queries).toEqual([
      expect.objectContaining({
        workspaceId: 'tenant-1',
        principalId: 'user-1',
        roles: ['admin'],
        scopes: ['extensions.read'],
        correlationId: 'corr-fixed',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      }),
    ]);
  });

  it('does not expand API scopes beyond the authenticated token', async () => {
    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () =>
            ok(makeCtx(['admin'], ['extensions.read'], ['objects:read'])),
        },
        cockpitExtensionActivationSource: {
          getActivationState: async () => ({
            activePackIds: ['example.pack'],
            quarantinedExtensionIds: [],
            emergencyDisabledExtensionIds: [],
            availableCapabilities: [],
            availableApiScopes: ['approvals.read'],
          }),
        },
      }),
    );

    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/tenant-1/cockpit/extension-context`,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { availableApiScopes: string[] };
    expect(body.availableApiScopes).toEqual([]);
  });

  it('honors weak and multi-value If-None-Match on cockpit extension context', async () => {
    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () =>
            ok(makeCtx(['operator'], ['extensions.read'], ['objects:read'])),
        },
        clock: () => new Date('2026-04-30T02:00:00.000Z'),
      }),
    );

    const first = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/tenant-1/cockpit/extension-context`,
    );
    const etag = first.headers.get('ETag');
    expect(etag).toMatch(/^"[a-f0-9]{12}"$/);

    const second = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/tenant-1/cockpit/extension-context`,
      { headers: { 'If-None-Match': `"other", W/${etag}` } },
    );

    expect(second.status).toBe(304);
  });

  it('denies cockpit extension context when the requested workspace is outside token scope', async () => {
    let activationSourceCalls = 0;
    await startWith(
      makeDeps({
        cockpitExtensionActivationSource: {
          getActivationState: async () => {
            activationSourceCalls += 1;
            return { activePackIds: ['example.pack'], quarantinedExtensionIds: [] };
          },
        },
      }),
    );

    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/workspace-2/cockpit/extension-context`,
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as { type: string; status: number };
    expect(body.type).toMatch(/forbidden/);
    expect(body.status).toBe(403);
    expect(activationSourceCalls).toBe(0);
  });

  it('denies cockpit extension context before activation lookup when authentication fails', async () => {
    let activationSourceCalls = 0;
    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () =>
            err({ kind: 'Unauthorized' as const, message: 'Missing token.' }),
        },
        cockpitExtensionActivationSource: {
          getActivationState: async () => {
            activationSourceCalls += 1;
            return { activePackIds: ['example.pack'], quarantinedExtensionIds: [] };
          },
        },
      }),
    );

    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/tenant-1/cockpit/extension-context`,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { type: string; status: number };
    expect(body.type).toMatch(/unauthorized/);
    expect(body.status).toBe(401);
    expect(activationSourceCalls).toBe(0);
  });

  it('routes GET run to application query and returns Problem Details on unauthorized', async () => {
    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () =>
            err({ kind: 'Unauthorized' as const, message: 'Missing token.' }),
        },
      }),
    );
    const res = await fetch(`http://${handle!.host}:${handle!.port}/v1/workspaces/ws-1/runs/run-1`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { type: string; status: number; title: string };
    expect(body.type).toMatch(/unauthorized/);
    expect(body.status).toBe(401);
    expect(body.title).toBe('Unauthorized');
  });

  it('returns Problem Details not-found for unknown routes', async () => {
    await startWith(makeDeps());
    const res = await fetch(`http://${handle!.host}:${handle!.port}/v1/nope`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toBe('Route not found.');
  });

  it('maps ValidationFailed to 400 and preserves x-correlation-id when provided', async () => {
    await startWith(makeDeps());
    const res = await fetch(`http://${handle!.host}:${handle!.port}/v1/workspaces/%20`, {
      headers: {
        'x-correlation-id': 'corr-fixed',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        tracestate: 'vendor=value',
      },
    });
    expect(res.status).toBe(422);
    expect(res.headers.get('x-correlation-id')).toBe('corr-fixed');
    expect(res.headers.get('traceparent')).toBe(
      '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    );
    expect(res.headers.get('tracestate')).toBe('vendor=value');
    const body = (await res.json()) as { type: string; status: number };
    expect(body.type).toMatch(/validation-failed/);
    expect(body.status).toBe(422);
  });

  it('maps Forbidden to 403', async () => {
    await startWith(
      makeDeps({
        authorization: { isAllowed: async () => false },
      }),
    );
    const res = await fetch(`http://${handle!.host}:${handle!.port}/v1/workspaces/ws-1`);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { type: string; status: number };
    expect(body.type).toMatch(/forbidden/);
    expect(body.status).toBe(403);
  });

  it('plans a natural language intent without creating worktrees', async () => {
    await startWith(
      makeDeps({
        clock: () => new Date('2026-04-29T00:00:00.000Z'),
      }),
    );
    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/ws-1/intents:plan`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerText: 'Add approval queue summary; add mobile tests',
          constraints: ['Do not create worktrees before approval'],
        }),
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      intent: { normalizedGoal: string };
      proposals: { executionTier: string; specRef: string }[];
      artifact: { markdown: string };
    };
    expect(body.intent.normalizedGoal).toBe('Add approval queue summary; add mobile tests');
    expect(body.proposals).toHaveLength(2);
    expect(body.proposals[0]?.executionTier).toBe('HumanApprove');
    expect(body.proposals[0]?.specRef).toContain('build-plan.md');
    expect(body.artifact.markdown).toContain('before any worktree is created');
  });

  it('returns 500 Problem Details when a dependency throws', async () => {
    await startWith(
      makeDeps({
        authentication: { authenticateBearerToken: async () => Promise.reject(new Error('boom')) },
      }),
    );
    const res = await fetch(`http://${handle!.host}:${handle!.port}/v1/workspaces/ws-1`);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { type: string; status: number; detail: string };
    expect(body.type).toMatch(/internal/);
    expect(body.status).toBe(500);
    expect(body.detail).not.toContain('boom');
    expect(body.detail).toMatch(/correlation ID/i);
  });

  it('lists workforce members with contract query filters', async () => {
    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () => ok(makeCtx(['operator'], [], [], 'workspace-1')),
        },
      }),
    );
    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/workspace-1/workforce?capability=operations.approval&availability=available`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { workforceMemberId: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.workforceMemberId).toBe('wm-1');
  });

  it('denies workforce availability patch from an unlinked operator', async () => {
    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () =>
            ok(makeCtx(['operator'], [], [], 'workspace-1', 'user-2')),
        },
      }),
    );
    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/workspace-1/workforce/wm-1/availability`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ availabilityStatus: 'offline' }),
      },
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe('Forbidden');
  });

  it('allows admin to patch workforce availability', async () => {
    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () => ok(makeCtx(['admin'], [], [], 'workspace-1')),
        },
      }),
    );
    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/workspace-1/workforce/wm-1/availability`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ availabilityStatus: 'offline' }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { availabilityStatus: string; workforceMemberId: string };
    expect(body.workforceMemberId).toBe('wm-1');
    expect(body.availabilityStatus).toBe('offline');
  });

  it('lists human tasks with assignee/status filters', async () => {
    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () => ok(makeCtx(['operator'], [], [], 'workspace-1')),
        },
      }),
    );
    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/workspace-1/human-tasks?assigneeId=wm-1&status=assigned`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { humanTaskId: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.humanTaskId).toBe('ht-1');
  });

  it('completes human task and emits evidence visible in evidence list', async () => {
    await startWith(
      makeDeps({
        authentication: {
          authenticateBearerToken: async () => ok(makeCtx(['operator'], [], [], 'workspace-1')),
        },
      }),
    );
    const completeRes = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/workspace-1/human-tasks/ht-1/complete`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ completionNote: 'Done' }),
      },
    );
    expect(completeRes.status).toBe(200);
    const completed = (await completeRes.json()) as { status: string; evidenceAnchorId?: string };
    expect(completed.status).toBe('completed');
    expect(typeof completed.evidenceAnchorId).toBe('string');
    const evidenceRes = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/workspace-1/evidence?category=Action`,
    );
    expect(evidenceRes.status).toBe(200);
    const evidenceBody = (await evidenceRes.json()) as { items: { evidenceId: string }[] };
    expect(
      evidenceBody.items.some((entry) => entry.evidenceId === completed.evidenceAnchorId),
    ).toBe(true);
  });

  it('lists location events in a bounded playback window with filters', async () => {
    // Pin clock to 2026-02-21 so the seed data (2026-02-20) stays within the 30-day retention window.
    await startWith(
      makeDeps({
        authentication: { authenticateBearerToken: async () => ok(makeCtx(['operator'])) },
        clock: () => new Date('2026-02-21T00:00:00.000Z'),
      }),
    );
    // Use dates relative to now so seed data (1 hour ago) falls inside the
    // 30-day retention window enforced by the telemetry boundary.
    const now = new Date();
    const from = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
    const to = now; // now
    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/workspace-1/location-events?fromIso=${from.toISOString()}&toIso=${to.toISOString()}&sourceType=SLAM&siteId=site-a&floorId=floor-1&limit=1`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { locationEventId: string; sourceType: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.locationEventId).toBe('loc-evt-1');
    expect(body.items[0]!.sourceType).toBe('SLAM');
  });

  it('serves location stream endpoint as text/event-stream with stale semantics metadata', async () => {
    await startWith(
      makeDeps({
        authentication: { authenticateBearerToken: async () => ok(makeCtx(['operator'])) },
      }),
    );
    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/workspace-1/location-events:stream?assetId=asset-1&purpose=operations`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/i);
    const text = await res.text();
    expect(text).toContain('event: stream-metadata');
    expect(text).toContain('event: location');
    expect(text).toContain('staleAfterSeconds');
  });

  it('lists map layers and enforces tenant isolation by workspace route', async () => {
    await startWith(
      makeDeps({
        authentication: { authenticateBearerToken: async () => ok(makeCtx(['operator'])) },
      }),
    );
    const res = await fetch(
      `http://${handle!.host}:${handle!.port}/v1/workspaces/workspace-2/map-layers?version=1`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { tenantId: string; mapLayerId: string; version: number }[];
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.tenantId).toBe('workspace-2');
    expect(body.items[0]!.mapLayerId).toBe('ml-ws2-floor1');
    expect(body.items[0]!.version).toBe(1);
  });
});
