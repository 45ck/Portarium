import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseAdapterRegistrationV1 } from '../../domain/adapters/adapter-registration-v1.js';
import { parseRunV1 } from '../../domain/runs/index.js';
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
import { createRun, type CreateRunDeps } from './create-run.js';

const WORKFLOW = parseWorkflowV1({
  schemaVersion: 1,
  workflowId: 'wf-1',
  workspaceId: 'ws-1',
  name: 'Onboard',
  version: 1,
  active: true,
  executionTier: 'Auto',
  actions: [
    { actionId: 'act-1', order: 1, portFamily: 'ItsmItOps', operation: 'workflow:simulate' },
  ],
});

const RUN = parseRunV1({
  schemaVersion: 1,
  runId: 'id-1',
  workspaceId: 'ws-1',
  workflowId: 'wf-1',
  correlationId: 'corr-1',
  executionTier: 'Auto',
  initiatedByUserId: 'user-1',
  status: 'Pending',
  createdAtIso: '2026-02-17T00:01:00.000Z',
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

describe('createRun', () => {
  let authorization: AuthorizationPort;
  let clock: Clock;
  let idGenerator: IdGenerator;
  let idempotency: IdempotencyStore;
  let unitOfWork: UnitOfWork;
  let workflowStore: WorkflowStore;
  let adapterRegistrationStore: AdapterRegistrationStore;
  let runStore: RunStore;
  let orchestrator: WorkflowOrchestrator;
  let eventPublisher: EventPublisher;

  beforeEach(() => {
    authorization = { isAllowed: vi.fn(async () => true) };
    clock = { nowIso: vi.fn(() => '2026-02-17T00:01:00.000Z') };
    let sequence = 1;
    idGenerator = { generateId: vi.fn(() => `id-${sequence++}`) };
    idempotency = { get: vi.fn(async () => null), set: vi.fn(async () => undefined) };
    unitOfWork = { execute: vi.fn(async (fn) => fn()) };
    workflowStore = {
      getWorkflowById: vi.fn(async () => WORKFLOW),
      listWorkflowsByName: vi.fn(async () => [WORKFLOW]),
    };
    adapterRegistrationStore = { listByWorkspace: vi.fn(async () => [ADAPTER_REGISTRATION]) };
    runStore = {
      getRunById: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(RUN),
      saveRun: vi.fn(async () => undefined),
    };
    orchestrator = { startRun: vi.fn(async () => undefined) };
    eventPublisher = { publish: vi.fn(async () => undefined) };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeDeps(overrides: Partial<CreateRunDeps> = {}): CreateRunDeps {
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
      ...overrides,
    };
  }

  it('returns the created run after starting the workflow', async () => {
    const result = await createRun(
      makeDeps(),
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
        idempotencyKey: 'req-1',
        parameters: { ticketId: 'INC-1' },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success result.');
    expect(result.value).toEqual(RUN);
  });

  it('rejects non-object parameters before starting', async () => {
    const result = await createRun(
      makeDeps(),
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
        idempotencyKey: 'req-1',
        parameters: [] as unknown as Record<string, unknown>,
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('ValidationFailed');
  });

  it('fails when the run cannot be reloaded after start', async () => {
    const deps = makeDeps({
      runStore: {
        getRunById: vi.fn(async () => null),
        saveRun: vi.fn(async () => undefined),
      },
    });

    const result = await createRun(
      deps,
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
        idempotencyKey: 'req-1',
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('DependencyFailure');
  });
});
