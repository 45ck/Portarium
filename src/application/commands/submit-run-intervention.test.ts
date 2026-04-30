import { describe, expect, it, vi } from 'vitest';

import { toAppContext } from '../common/context.js';
import { APP_ACTIONS } from '../common/actions.js';
import type { AuthorizationPort, EvidenceLogPort, RunStore } from '../ports/index.js';
import {
  submitRunIntervention,
  type SubmitRunInterventionDeps,
  type SubmitRunInterventionInput,
} from './submit-run-intervention.js';
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
};

function makeDeps(overrides: Partial<SubmitRunInterventionDeps> = {}): SubmitRunInterventionDeps {
  const runStore: RunStore = {
    getRunById: vi.fn(async () => RUN),
    saveRun: vi.fn(async () => undefined),
  };
  const evidenceLog: EvidenceLogPort = {
    appendEntry: vi.fn(async (_tenantId, entry) => ({
      ...entry,
      previousHash: undefined,
      hashSha256: HashSha256('hash-1'),
    })),
  };
  const authorization: AuthorizationPort = {
    isAllowed: vi.fn(async () => true),
  };
  return {
    authorization,
    runStore,
    evidenceLog,
    clock: { nowIso: () => '2026-04-30T01:00:00.000Z' },
    idGenerator: { generateId: () => 'ev-1' },
    ...overrides,
  };
}

function input(overrides: Partial<SubmitRunInterventionInput> = {}): SubmitRunInterventionInput {
  return {
    workspaceId: 'ws-1',
    runId: 'run-1',
    interventionType: 'pause',
    rationale: 'Need operator review.',
    surface: 'steering',
    authoritySource: 'run-charter',
    effect: 'current-run-effect',
    ...overrides,
  };
}

describe('submitRunIntervention', () => {
  it('authorizes with run:intervene and records pause evidence', async () => {
    const deps = makeDeps();

    const result = await submitRunIntervention(deps, CTX, input());

    expect(result.ok).toBe(true);
    expect(deps.authorization.isAllowed).toHaveBeenCalledWith(CTX, APP_ACTIONS.runIntervene);
    expect(deps.runStore.saveRun).toHaveBeenCalledWith(
      TenantId('tenant-1'),
      expect.objectContaining({ status: 'Paused', controlState: 'blocked' }),
    );
    expect(deps.evidenceLog.appendEntry).toHaveBeenCalledWith(
      TenantId('tenant-1'),
      expect.objectContaining({
        category: 'Action',
        summary: expect.stringContaining('pause:'),
        links: { runId: RunId('run-1') },
      }),
    );
  });

  it('rejects forbidden callers before loading the run', async () => {
    const deps = makeDeps({
      authorization: { isAllowed: vi.fn(async () => false) },
    });

    const result = await submitRunIntervention(deps, CTX, input());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('Forbidden');
    expect(deps.runStore.getRunById).not.toHaveBeenCalled();
  });

  it('validates intervention type, rationale, and target requirements', async () => {
    const deps = makeDeps();

    const result = await submitRunIntervention(
      deps,
      CTX,
      input({ interventionType: 'handoff', rationale: 'short' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('ValidationFailed');
      if (result.error.kind === 'ValidationFailed') {
        expect(result.error.errors?.map((error) => error.field)).toEqual(['rationale', 'target']);
      }
    }
  });

  it.each([
    ['freeze', 'Paused', 'frozen'],
    ['request-more-evidence', 'Paused', 'blocked'],
    ['sandbox', 'Paused', 'degraded'],
    ['emergency-disable', 'Paused', 'frozen'],
  ] as const)('maps %s to %s and %s', async (interventionType, status, controlState) => {
    const deps = makeDeps();

    const result = await submitRunIntervention(
      deps,
      CTX,
      input({ interventionType, authoritySource: 'policy-rule' }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(expect.objectContaining({ status, controlState }));
  });

  it('resumes paused runs and clears control posture', async () => {
    const deps = makeDeps({
      runStore: {
        getRunById: vi.fn(
          async () => ({ ...RUN, status: 'Paused', controlState: 'blocked' }) satisfies RunV1,
        ),
        saveRun: vi.fn(async () => undefined),
      },
    });

    const result = await submitRunIntervention(deps, CTX, input({ interventionType: 'resume' }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('Running');
      expect(result.value.controlState).toBeUndefined();
    }
  });

  it('annotates terminal runs without state change', async () => {
    const deps = makeDeps({
      runStore: {
        getRunById: vi.fn(async () => ({ ...RUN, status: 'Succeeded' }) satisfies RunV1),
        saveRun: vi.fn(async () => undefined),
      },
    });

    const result = await submitRunIntervention(
      deps,
      CTX,
      input({ interventionType: 'annotate', effect: 'context-only' }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('Succeeded');
    expect(deps.evidenceLog.appendEntry).toHaveBeenCalledWith(
      TenantId('tenant-1'),
      expect.objectContaining({ category: 'System' }),
    );
  });

  it('rejects effectful interventions for terminal runs', async () => {
    const deps = makeDeps({
      runStore: {
        getRunById: vi.fn(async () => ({ ...RUN, status: 'Cancelled' }) satisfies RunV1),
        saveRun: vi.fn(async () => undefined),
      },
    });

    const result = await submitRunIntervention(deps, CTX, input({ interventionType: 'freeze' }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('Conflict');
    expect(deps.evidenceLog.appendEntry).not.toHaveBeenCalled();
  });

  it('returns dependency failure when evidence cannot be appended', async () => {
    const deps = makeDeps({
      evidenceLog: { appendEntry: vi.fn(async () => Promise.reject(new Error('down'))) },
    });

    const result = await submitRunIntervention(deps, CTX, input());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('DependencyFailure');
  });
});
