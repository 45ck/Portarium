import { describe, expect, it, vi } from 'vitest';

import { parseRunV1 } from '../../domain/runs/run-v1.js';
import { toAppContext } from '../common/context.js';
import type { AuthorizationPort, RunQueryStore } from '../ports/index.js';
import { listRuns } from './list-runs.js';

const RUN = parseRunV1({
  schemaVersion: 1,
  runId: 'run-1',
  workspaceId: 'ws-1',
  workflowId: 'wf-1',
  correlationId: 'cor-1',
  executionTier: 'HumanApprove',
  initiatedByUserId: 'user-1',
  status: 'Running',
  createdAtIso: '2026-02-20T00:00:00.000Z',
  startedAtIso: '2026-02-20T00:00:01.000Z',
});

describe('listRuns', () => {
  it('returns runs page for valid filters', async () => {
    const authorization: AuthorizationPort = {
      isAllowed: vi.fn(async () => true),
    };
    const runStore: RunQueryStore = {
      listRuns: vi.fn(async () => ({ items: [RUN], nextCursor: 'run-1' })),
    };

    const result = await listRuns(
      { authorization, runStore },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'user-1',
        correlationId: 'cor-1',
        roles: ['operator'],
      }),
      {
        workspaceId: 'ws-1',
        status: 'Running',
        workflowId: 'wf-1',
        initiatedByUserId: 'user-1',
        correlationId: 'cor-1',
        limit: 10,
        cursor: 'run-0',
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.nextCursor).toBe('run-1');
  });

  it('rejects invalid status values', async () => {
    const authorization: AuthorizationPort = {
      isAllowed: vi.fn(async () => true),
    };
    const runStore: RunQueryStore = {
      listRuns: vi.fn(async () => ({ items: [] })),
    };

    const result = await listRuns(
      { authorization, runStore },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'user-1',
        correlationId: 'cor-1',
        roles: ['operator'],
      }),
      { workspaceId: 'ws-1', status: 'Invalid' as never },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('ValidationFailed');
  });

  it('returns forbidden when caller lacks run:read', async () => {
    const authorization: AuthorizationPort = {
      isAllowed: vi.fn(async () => false),
    };
    const runStore: RunQueryStore = {
      listRuns: vi.fn(async () => ({ items: [] })),
    };

    const result = await listRuns(
      { authorization, runStore },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'user-1',
        correlationId: 'cor-1',
        roles: ['auditor'],
      }),
      { workspaceId: 'ws-1' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Forbidden');
  });
});
