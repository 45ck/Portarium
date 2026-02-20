import { describe, expect, it, vi } from 'vitest';

import { getAgentWorkItems } from './get-agent-work-items.js';
import type {
  AuthorizationPort,
  MachineRegistryStore,
  WorkItemStore,
} from '../ports/index.js';
import { toAppContext } from '../common/context.js';
import { TenantId, WorkspaceId, WorkItemId, UserId } from '../../domain/primitives/index.js';
import type { AgentConfigV1 } from '../../domain/machines/machine-registration-v1.js';
import type { WorkItemV1 } from '../../domain/work-items/index.js';

function makeCtx(workspaceId = 'ws-1') {
  return toAppContext({
    tenantId: workspaceId,
    principalId: 'user-1',
    correlationId: 'corr-1',
    roles: ['operator'],
  });
}

const FIXTURE_AGENT: AgentConfigV1 = {
  schemaVersion: 1,
  agentId: 'agent-1' as AgentConfigV1['agentId'],
  workspaceId: 'ws-1' as AgentConfigV1['workspaceId'],
  machineId: 'machine-1' as AgentConfigV1['machineId'],
  displayName: 'Test Agent',
  capabilities: [{ capability: 'run:workflow' as any }],
  policyTier: 'Auto',
  allowedTools: ['classify'],
  registeredAtIso: '2026-02-20T00:00:00.000Z',
};

const FIXTURE_WORK_ITEM: WorkItemV1 = {
  schemaVersion: 1,
  workItemId: WorkItemId('wi-1'),
  workspaceId: WorkspaceId('ws-1'),
  createdAtIso: '2026-02-20T00:00:00.000Z',
  createdByUserId: UserId('user-1'),
  title: 'Test work item',
  status: 'Open',
};

function createDeps(overrides?: { allowed?: boolean; agentExists?: boolean }) {
  const authorization: AuthorizationPort = {
    isAllowed: vi.fn(async () => overrides?.allowed ?? true),
  };

  const machineRegistryStore: MachineRegistryStore = {
    getMachineRegistrationById: vi.fn(async () => null),
    saveMachineRegistration: vi.fn(async () => {}),
    getAgentConfigById: vi.fn(async () =>
      (overrides?.agentExists ?? true) ? FIXTURE_AGENT : null,
    ),
    saveAgentConfig: vi.fn(async () => {}),
    updateMachineHeartbeat: vi.fn(async () => true),
    updateAgentHeartbeat: vi.fn(async () => true),
  };

  const workItemStore: WorkItemStore = {
    getWorkItemById: vi.fn(async () => null),
    listWorkItems: vi.fn(async () => ({
      items: [FIXTURE_WORK_ITEM],
    })),
    saveWorkItem: vi.fn(async () => {}),
  };

  return { deps: { authorization, workItemStore, machineRegistryStore } };
}

describe('getAgentWorkItems', () => {
  it('returns work items for a valid agent', async () => {
    const { deps } = createDeps();
    const result = await getAgentWorkItems(deps, makeCtx('ws-1'), {
      workspaceId: 'ws-1',
      agentId: 'agent-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.agentId).toBe('agent-1');
    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0]!.workItemId).toBe('wi-1');
  });

  it('returns NotFound when agent does not exist', async () => {
    const { deps } = createDeps({ agentExists: false });
    const result = await getAgentWorkItems(deps, makeCtx('ws-1'), {
      workspaceId: 'ws-1',
      agentId: 'agent-missing',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('NotFound');
  });

  it('returns Forbidden when authorization fails', async () => {
    const { deps } = createDeps({ allowed: false });
    const result = await getAgentWorkItems(deps, makeCtx('ws-1'), {
      workspaceId: 'ws-1',
      agentId: 'agent-1',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Forbidden');
  });

  it('rejects empty workspaceId', async () => {
    const { deps } = createDeps();
    const result = await getAgentWorkItems(deps, makeCtx('ws-1'), {
      workspaceId: '',
      agentId: 'agent-1',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toContain('workspaceId');
  });

  it('rejects empty agentId', async () => {
    const { deps } = createDeps();
    const result = await getAgentWorkItems(deps, makeCtx('ws-1'), {
      workspaceId: 'ws-1',
      agentId: '',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toContain('agentId');
  });

  it('rejects invalid status filter', async () => {
    const { deps } = createDeps();
    const result = await getAgentWorkItems(deps, makeCtx('ws-1'), {
      workspaceId: 'ws-1',
      agentId: 'agent-1',
      status: 'invalid',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toContain('status');
  });

  it('passes through limit and cursor to store', async () => {
    const { deps } = createDeps();
    const result = await getAgentWorkItems(deps, makeCtx('ws-1'), {
      workspaceId: 'ws-1',
      agentId: 'agent-1',
      limit: 10,
      cursor: 'abc',
    });

    expect(result.ok).toBe(true);
    expect(deps.workItemStore.listWorkItems).toHaveBeenCalledWith(
      TenantId('ws-1'),
      WorkspaceId('ws-1'),
      expect.objectContaining({ limit: 10, cursor: 'abc' }),
    );
  });
});
