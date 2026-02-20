import { describe, expect, it, vi } from 'vitest';

import { parseAdapterRegistrationV1 } from '../../domain/adapters/adapter-registration-v1.js';
import { parseWorkflowV1 } from '../../domain/workflows/workflow-v1.js';
import { toAppContext } from '../common/context.js';
import type {
  AdapterRegistrationStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  IdempotencyStore,
  RunStore,
  UnitOfWork,
  WorkflowOrchestrator,
  WorkflowStore,
} from '../ports/index.js';
import type { TriggerExecutionRouterPort } from '../services/trigger-execution-router.js';
import { startWorkflow, type StartWorkflowDeps } from './start-workflow.js';

const WORKFLOW = parseWorkflowV1({
  schemaVersion: 1,
  workflowId: 'wf-1',
  workspaceId: 'ws-1',
  name: 'Onboard',
  version: 1,
  active: true,
  executionTier: 'Auto',
  actions: [
    {
      actionId: 'act-1',
      order: 1,
      portFamily: 'ItsmItOps',
      operation: 'workflow:simulate',
    },
  ],
});

const ADAPTER_REGISTRATION = parseAdapterRegistrationV1({
  schemaVersion: 1,
  adapterId: 'adapter-itsm-1',
  workspaceId: 'ws-1',
  providerSlug: 'service-now',
  portFamily: 'ItsmItOps',
  enabled: true,
  capabilityMatrix: [{ operation: 'workflow:simulate', requiresAuth: true }],
  executionPolicy: {
    tenantIsolationMode: 'PerTenantWorker',
    egressAllowlist: ['https://api.service-now.example'],
    credentialScope: 'capabilityMatrix',
    sandboxVerified: true,
    sandboxAvailable: true,
  },
});

function buildDeps(triggerRouter?: TriggerExecutionRouterPort): StartWorkflowDeps {
  let sequence = 1;
  const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => true) };
  const clock: Clock = { nowIso: vi.fn(() => '2026-02-17T00:01:00.000Z') };
  const idGenerator: IdGenerator = {
    generateId: vi.fn(() => `id-${sequence++}`),
  };
  const idempotency: IdempotencyStore = {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
  };
  const unitOfWork: UnitOfWork = { execute: vi.fn(async (fn) => fn()) };
  const workflowStore: WorkflowStore = {
    getWorkflowById: vi.fn(async () => WORKFLOW),
    listWorkflowsByName: vi.fn(async () => [WORKFLOW]),
  };
  const adapterRegistrationStore: AdapterRegistrationStore = {
    listByWorkspace: vi.fn(async () => [ADAPTER_REGISTRATION]),
  };
  const runStore: RunStore = {
    getRunById: vi.fn(async () => null),
    saveRun: vi.fn(async () => undefined),
  };
  const orchestrator: WorkflowOrchestrator = {
    startRun: vi.fn(async () => undefined),
  };
  const eventPublisher: EventPublisher = {
    publish: vi.fn(async () => undefined),
  };

  return {
    authorization,
    clock,
    idGenerator,
    idempotency,
    unitOfWork,
    workflowStore,
    adapterRegistrationStore,
    runStore,
    orchestrator,
    eventPublisher,
    ...(triggerRouter ? { triggerRouter } : {}),
  };
}

describe('startWorkflow trigger routing integration', () => {
  it('routes trigger execution at workflow start when triggerRouter is configured', async () => {
    const triggerRouter: TriggerExecutionRouterPort = {
      routeAtWorkflowStart: vi.fn(async () => ({
        plane: 'Activepieces' as const,
        flowRef: 'RunStarted',
      })),
    };

    const result = await startWorkflow(
      buildDeps(triggerRouter),
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        idempotencyKey: 'req-trigger-route',
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
        trigger: {
          schemaVersion: 1,
          triggerDefinitionId: 'trig-1',
          workspaceId: 'ws-1',
          workflowId: 'wf-1',
          kind: 'DomainEvent',
          config: { eventType: 'RunStarted' },
          active: true,
          createdAtIso: '2026-02-20T00:00:00.000Z',
        },
      },
    );

    expect(result.ok).toBe(true);
    expect(triggerRouter.routeAtWorkflowStart).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        correlationId: 'corr-1',
        payload: {
          workflowId: 'wf-1',
          workspaceId: 'ws-1',
        },
      }),
    );
  });

  it('rejects trigger payload when trigger identifiers do not match command identifiers', async () => {
    const triggerRouter: TriggerExecutionRouterPort = {
      routeAtWorkflowStart: vi.fn(async () => ({
        plane: 'Activepieces' as const,
        flowRef: 'RunStarted',
      })),
    };

    const result = await startWorkflow(
      buildDeps(triggerRouter),
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        idempotencyKey: 'req-trigger-mismatch',
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
        trigger: {
          schemaVersion: 1,
          triggerDefinitionId: 'trig-1',
          workspaceId: 'ws-other',
          workflowId: 'wf-1',
          kind: 'DomainEvent',
          config: { eventType: 'RunStarted' },
          active: true,
          createdAtIso: '2026-02-20T00:00:00.000Z',
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected validation failure.');
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toContain('trigger workspaceId/workflowId must match');
    expect(triggerRouter.routeAtWorkflowStart).not.toHaveBeenCalled();
  });
});
