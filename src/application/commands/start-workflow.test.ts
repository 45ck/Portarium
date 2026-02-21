import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseAdapterRegistrationV1 } from '../../domain/adapters/adapter-registration-v1.js';
import { TenantId } from '../../domain/primitives/index.js';
import { parseRunV1 } from '../../domain/runs/index.js';
import { parseWorkflowV1 } from '../../domain/workflows/workflow-v1.js';
import { APP_ACTIONS } from '../common/actions.js';
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
import {
  startWorkflow,
  type StartWorkflowDeps,
  type StartWorkflowInput,
} from './start-workflow.js';

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

describe('startWorkflow', () => {
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
    runStore = { getRunById: vi.fn(async () => null), saveRun: vi.fn(async () => undefined) };
    orchestrator = { startRun: vi.fn(async () => undefined) };
    eventPublisher = { publish: vi.fn(async () => undefined) };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  type AppContextInput = Parameters<typeof toAppContext>[0];
  const defaultInput: StartWorkflowInput = {
    idempotencyKey: 'req-1',
    workspaceId: 'ws-1',
    workflowId: 'wf-1',
  };

  function makeDeps(overrides: Partial<StartWorkflowDeps> = {}): StartWorkflowDeps {
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

  function makeCtx(overrides: Partial<AppContextInput> = {}): ReturnType<typeof toAppContext> {
    return toAppContext({
      tenantId: 'tenant-1',
      principalId: 'user-1',
      correlationId: 'corr-1',
      roles: ['operator'],
      ...overrides,
    });
  }

  function makeInput(overrides: Partial<StartWorkflowInput> = {}): StartWorkflowInput {
    return { ...defaultInput, ...overrides };
  }

  async function invoke(
    args: {
      deps?: Partial<StartWorkflowDeps>;
      ctx?: Partial<AppContextInput>;
      input?: Partial<StartWorkflowInput>;
    } = {},
  ) {
    return startWorkflow(makeDeps(args.deps), makeCtx(args.ctx), makeInput(args.input));
  }

  it('starts a run, stores state, and emits an event', async () => {
    const result = await invoke();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success response.');
    expect(result.value.runId.startsWith('id-')).toBe(true);
    expect(runStore.saveRun).toHaveBeenCalledTimes(1);
    expect(orchestrator.startRun).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
    const published = (eventPublisher.publish as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as Record<string, unknown>;
    expect(published['specversion']).toBe('1.0');
    expect(published['type']).toBe('com.portarium.run.RunStarted');
    expect(published['tenantid']).toBe('tenant-1');
    expect(published['correlationid']).toBe('corr-1');
    expect(published['source']).toBe('portarium.control-plane.workflow-runtime');
  });

  it('replays from idempotency cache', async () => {
    idempotency.get = vi.fn(async () => ({
      runId: 'run-cached' as const,
    })) as IdempotencyStore['get'];
    const result = await invoke();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success response.');
    expect(result.value.runId).toBe('run-cached');
    expect(runStore.saveRun).not.toHaveBeenCalled();
    expect(orchestrator.startRun).not.toHaveBeenCalled();
  });

  it('requires run:start authorisation', async () => {
    authorization.isAllowed = vi.fn(async () => false);
    const result = await invoke({ ctx: { roles: ['auditor'] } });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected forbidden response.');
    expect(result.error.kind).toBe('Forbidden');
    expect(authorization.isAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TenantId('tenant-1') }),
      APP_ACTIONS.runStart,
    );
  });

  it('rejects empty timestamp from clock', async () => {
    clock.nowIso = vi.fn(() => '');
    const result = await invoke();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected dependency failure response.');
    expect(result.error.kind).toBe('DependencyFailure');
  });

  it('rejects empty generated run identifier', async () => {
    idGenerator.generateId = vi.fn(() => '');
    const result = await invoke();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected dependency failure response.');
    expect(result.error.kind).toBe('DependencyFailure');
  });

  it('rejects empty generated event identifier', async () => {
    idGenerator.generateId = vi.fn().mockReturnValueOnce('run-1').mockReturnValueOnce('');
    const result = await invoke();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected dependency failure response.');
    expect(result.error.kind).toBe('DependencyFailure');
  });

  it('passes idempotencyKey to orchestrator for Temporal-level deduplication', async () => {
    const result = await invoke({ input: { idempotencyKey: 'req-concurrent' } });
    expect(result.ok).toBe(true);
    expect(orchestrator.startRun).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'req-concurrent' }),
    );
  });

  it('propagates traceparent and tracestate into orchestrator input', async () => {
    const result = await invoke({
      input: { idempotencyKey: 'req-trace' },
      ctx: {
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        tracestate: 'vendor=value',
      },
    });
    expect(result.ok).toBe(true);
    expect(orchestrator.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        tracestate: 'vendor=value',
      }),
    );
  });

  it('rejects starts when workflow versioning has multiple active versions', async () => {
    workflowStore.listWorkflowsByName = vi.fn(async () => [
      WORKFLOW,
      parseWorkflowV1({ ...WORKFLOW, workflowId: 'wf-2', version: 2, active: true }),
    ]);
    const result = await invoke({ input: { idempotencyKey: 'req-version-conflict' } });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected conflict response.');
    expect(result.error.kind).toBe('Conflict');
    expect(result.error.message).toContain('multiple active versions');
  });

  it('rejects starts when selected workflow is not the active head version', async () => {
    workflowStore.listWorkflowsByName = vi.fn(async () => [
      parseWorkflowV1({ ...WORKFLOW, workflowId: 'wf-1', version: 1, active: false }),
      parseWorkflowV1({ ...WORKFLOW, workflowId: 'wf-2', version: 2, active: true }),
    ]);
    const result = await invoke({ input: { idempotencyKey: 'req-stale-workflow' } });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected conflict response.');
    expect(result.error.kind).toBe('Conflict');
    expect(result.error.message).toContain('not currently active');
  });

  it('rejects starts when no active adapter exists for a required port family', async () => {
    adapterRegistrationStore.listByWorkspace = vi.fn(async () => []);
    const result = await invoke({ input: { idempotencyKey: 'req-no-adapter' } });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected conflict response.');
    expect(result.error.kind).toBe('Conflict');
    expect(result.error.message).toContain('no active adapter');
  });

  it('rejects starts when multiple active adapters exist for the same port family', async () => {
    adapterRegistrationStore.listByWorkspace = vi.fn(async () => [
      ADAPTER_REGISTRATION,
      parseAdapterRegistrationV1({
        ...ADAPTER_REGISTRATION,
        adapterId: 'adapter-itsm-2',
        providerSlug: 'freshservice',
      }),
    ]);
    const result = await invoke({ input: { idempotencyKey: 'req-multi-adapter' } });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected conflict response.');
    expect(result.error.kind).toBe('Conflict');
    expect(result.error.message).toContain('multiple active adapters');
  });

  it('rejects starts when generated run id already exists', async () => {
    runStore.getRunById = vi.fn(async () =>
      parseRunV1({
        schemaVersion: 1,
        runId: 'id-1',
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
        correlationId: 'corr-existing',
        executionTier: 'Auto',
        initiatedByUserId: 'user-existing',
        status: 'Pending',
        createdAtIso: '2026-02-16T00:00:00.000Z',
      }),
    );
    const result = await invoke({ input: { idempotencyKey: 'req-run-conflict' } });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected conflict response.');
    expect(result.error.kind).toBe('Conflict');
    expect(result.error.message).toContain('already exists');
  });
});
