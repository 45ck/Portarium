import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TenantId } from '../../domain/primitives/index.js';
import { parseWorkflowV1 } from '../../domain/workflows/workflow-v1.js';
import { toAppContext } from '../common/context.js';
import { APP_ACTIONS } from '../common/actions.js';
import {
  type AuthorizationPort,
  type Clock,
  type EventPublisher,
  type IdGenerator,
  type IdempotencyStore,
  type RunStore,
  type UnitOfWork,
  type WorkflowOrchestrator,
  type WorkflowStore,
} from '../ports/index.js';
import { startWorkflow } from './start-workflow.js';

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

describe('startWorkflow', () => {
  let authorization: AuthorizationPort;
  let clock: Clock;
  let idGenerator: IdGenerator;
  let idempotency: IdempotencyStore;
  let unitOfWork: UnitOfWork;
  let workflowStore: WorkflowStore;
  let runStore: RunStore;
  let orchestrator: WorkflowOrchestrator;
  let eventPublisher: EventPublisher;

  beforeEach(() => {
    authorization = { isAllowed: vi.fn(async () => true) };
    clock = { nowIso: vi.fn(() => '2026-02-17T00:01:00.000Z') };
    let sequence = 1;
    idGenerator = {
      generateId: vi.fn(() => `id-${sequence++}`),
    };
    idempotency = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
    };
    unitOfWork = { execute: vi.fn(async (fn) => fn()) };
    workflowStore = {
      getWorkflowById: vi.fn(async () => WORKFLOW),
    };
    runStore = {
      getRunById: vi.fn(async () => null),
      saveRun: vi.fn(async () => undefined),
    };
    orchestrator = {
      startRun: vi.fn(async () => undefined),
    };
    eventPublisher = {
      publish: vi.fn(async () => undefined),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts a run, stores state, and emits an event', async () => {
    const result = await startWorkflow(
      {
        authorization,
        clock,
        idGenerator,
        idempotency,
        unitOfWork,
        workflowStore,
        runStore,
        orchestrator,
        eventPublisher,
      },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        idempotencyKey: 'req-1',
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success response.');
    }
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
    const cachedRun = { runId: 'run-cached' as const };
    idempotency.get = vi.fn(async () => cachedRun) as IdempotencyStore['get'];

    const result = await startWorkflow(
      {
        authorization,
        clock,
        idGenerator,
        idempotency,
        unitOfWork,
        workflowStore,
        runStore,
        orchestrator,
        eventPublisher,
      },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        idempotencyKey: 'req-1',
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success response.');
    }
    expect(result.value.runId).toBe('run-cached');
    expect(runStore.saveRun).not.toHaveBeenCalled();
    expect(orchestrator.startRun).not.toHaveBeenCalled();
  });

  it('requires run:start authorisation', async () => {
    authorization.isAllowed = vi.fn(async () => false);
    const result = await startWorkflow(
      {
        authorization,
        clock,
        idGenerator,
        idempotency,
        unitOfWork,
        workflowStore,
        runStore,
        orchestrator,
        eventPublisher,
      },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['auditor'],
      }),
      {
        idempotencyKey: 'req-1',
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected forbidden response.');
    }
    expect(result.error.kind).toBe('Forbidden');
    expect(authorization.isAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TenantId('tenant-1') }),
      APP_ACTIONS.runStart,
    );
  });

  it('rejects empty timestamp from clock', async () => {
    clock.nowIso = vi.fn(() => '');
    const result = await startWorkflow(
      {
        authorization,
        clock,
        idGenerator,
        idempotency,
        unitOfWork,
        workflowStore,
        runStore,
        orchestrator,
        eventPublisher,
      },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        idempotencyKey: 'req-1',
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected dependency failure response.');
    }
    expect(result.error.kind).toBe('DependencyFailure');
  });

  it('rejects empty generated run identifier', async () => {
    idGenerator.generateId = vi.fn(() => '');
    const result = await startWorkflow(
      {
        authorization,
        clock,
        idGenerator,
        idempotency,
        unitOfWork,
        workflowStore,
        runStore,
        orchestrator,
        eventPublisher,
      },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        idempotencyKey: 'req-1',
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected dependency failure response.');
    }
    expect(result.error.kind).toBe('DependencyFailure');
  });

  it('rejects empty generated event identifier', async () => {
    idGenerator.generateId = vi.fn().mockReturnValueOnce('run-1').mockReturnValueOnce('');

    const result = await startWorkflow(
      {
        authorization,
        clock,
        idGenerator,
        idempotency,
        unitOfWork,
        workflowStore,
        runStore,
        orchestrator,
        eventPublisher,
      },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        idempotencyKey: 'req-1',
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected dependency failure response.');
    }
    expect(result.error.kind).toBe('DependencyFailure');
  });

  it('passes idempotencyKey to orchestrator for Temporal-level deduplication', async () => {
    const result = await startWorkflow(
      {
        authorization,
        clock,
        idGenerator,
        idempotency,
        unitOfWork,
        workflowStore,
        runStore,
        orchestrator,
        eventPublisher,
      },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        idempotencyKey: 'req-concurrent',
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
      },
    );

    expect(result.ok).toBe(true);
    expect(orchestrator.startRun).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'req-concurrent' }),
    );
  });
});
