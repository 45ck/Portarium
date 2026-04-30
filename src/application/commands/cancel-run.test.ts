import { describe, expect, it, vi } from 'vitest';

import { toAppContext } from '../common/context.js';
import { APP_ACTIONS } from '../common/actions.js';
import type {
  AuthorizationPort,
  Clock,
  EvidenceLogPort,
  IdGenerator,
  RunStore,
  UnitOfWork,
} from '../ports/index.js';
import { cancelRun, type CancelRunDeps } from './cancel-run.js';
import {
  CorrelationId,
  HashSha256,
  RunId,
  TenantId,
  UserId,
  WorkflowId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type { RunV1 } from '../../domain/runs/index.js';

const CTX = toAppContext({
  tenantId: 'tenant-1',
  principalId: 'user-1',
  roles: ['operator'],
  correlationId: 'corr-1',
});

const RUN: RunV1 = {
  schemaVersion: 1,
  runId: RunId('run-1'),
  workspaceId: WorkspaceId('ws-1'),
  workflowId: WorkflowId('wf-1'),
  correlationId: CorrelationId('corr-run-1'),
  executionTier: 'HumanApprove',
  initiatedByUserId: UserId('user-creator'),
  status: 'Running',
  createdAtIso: '2026-04-30T00:00:00.000Z',
  startedAtIso: '2026-04-30T00:01:00.000Z',
};

function makeDeps(overrides: Partial<CancelRunDeps> = {}): CancelRunDeps {
  const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => true) };
  const runStore: RunStore = {
    getRunById: vi.fn(async () => RUN),
    saveRun: vi.fn(async () => undefined),
  };
  const unitOfWork: UnitOfWork = { execute: vi.fn(async (fn) => fn()) };
  const clock: Clock = { nowIso: vi.fn(() => '2026-04-30T02:00:00.000Z') };
  const idGenerator: IdGenerator = { generateId: vi.fn(() => 'ev-1') };
  const evidenceLog: EvidenceLogPort = {
    appendEntry: vi.fn(async (_tenantId, entry) => ({
      ...entry,
      previousHash: undefined,
      hashSha256: HashSha256('hash-1'),
    })),
  };
  return { authorization, runStore, unitOfWork, clock, idGenerator, evidenceLog, ...overrides };
}

describe('cancelRun', () => {
  it('cancels an active run, persists it, and records evidence', async () => {
    const deps = makeDeps();

    const result = await cancelRun(deps, CTX, {
      workspaceId: 'ws-1',
      runId: 'run-1',
      rationale: 'Operator requested stop.',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success result.');
    expect(result.value.status).toBe('Cancelled');
    expect(result.value.endedAtIso).toBe('2026-04-30T02:00:00.000Z');
    expect(deps.authorization.isAllowed).toHaveBeenCalledWith(CTX, APP_ACTIONS.runIntervene);
    expect(deps.runStore.saveRun).toHaveBeenCalledWith(
      TenantId('tenant-1'),
      expect.objectContaining({ status: 'Cancelled' }),
    );
    expect(deps.evidenceLog?.appendEntry).toHaveBeenCalledWith(
      TenantId('tenant-1'),
      expect.objectContaining({
        category: 'System',
        links: { runId: RunId('run-1') },
      }),
    );
  });

  it('allows cancelling a pending run', async () => {
    const deps = makeDeps({
      runStore: {
        getRunById: vi.fn(async () => ({ ...RUN, status: 'Pending' as const })),
        saveRun: vi.fn(async () => undefined),
      },
    });

    const result = await cancelRun(deps, CTX, {
      workspaceId: 'ws-1',
      runId: 'run-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success result.');
    expect(result.value.status).toBe('Cancelled');
  });

  it('is idempotent for an already-cancelled run', async () => {
    const cancelledRun = {
      ...RUN,
      status: 'Cancelled',
      endedAtIso: '2026-04-30T01:30:00.000Z',
    } satisfies RunV1;
    const deps = makeDeps({
      runStore: {
        getRunById: vi.fn(async () => cancelledRun),
        saveRun: vi.fn(async () => undefined),
      },
    });

    const result = await cancelRun(deps, CTX, {
      workspaceId: 'ws-1',
      runId: 'run-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success result.');
    expect(result.value).toEqual(cancelledRun);
    expect(deps.evidenceLog?.appendEntry).not.toHaveBeenCalled();
  });

  it('rejects terminal non-cancelled runs', async () => {
    const deps = makeDeps({
      runStore: {
        getRunById: vi.fn(async () => ({ ...RUN, status: 'Succeeded' }) satisfies RunV1),
        saveRun: vi.fn(async () => undefined),
      },
    });

    const result = await cancelRun(deps, CTX, {
      workspaceId: 'ws-1',
      runId: 'run-1',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('Conflict');
  });
});
