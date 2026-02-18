import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_TEMPORAL_NAMESPACE,
  DEFAULT_TEMPORAL_TASK_QUEUE,
  PORTARIUM_WORKFLOW_TYPE,
  TemporalWorkflowOrchestrator,
} from './temporal-workflow-orchestrator.js';
import {
  CorrelationId,
  RunId,
  TenantId,
  UserId,
  WorkflowId,
} from '../../domain/primitives/index.js';
import { parseWorkflowV1 } from '../../domain/workflows/workflow-v1.js';

const WORKFLOW_DEF = parseWorkflowV1({
  schemaVersion: 1,
  workflowId: 'wf-1',
  workspaceId: 'ws-1',
  name: 'stub',
  version: 1,
  active: true,
  executionTier: 'Auto',
  actions: [
    {
      actionId: 'act-1',
      order: 1,
      portFamily: 'ItsmItOps',
      operation: 'workflow:noop',
    },
  ],
});

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

function makeStubWorkflowHandle() {
  return { workflowId: 'stub' };
}

function makeStubClient(overrides: Record<string, unknown> = {}) {
  return {
    workflow: {
      start: vi.fn(async () => makeStubWorkflowHandle()),
    },
    connection: {
      close: vi.fn(async () => undefined),
    },
    ...overrides,
  };
}

function makeStubConnection() {
  return { close: vi.fn(async () => undefined) };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('module constants', () => {
  it('PORTARIUM_WORKFLOW_TYPE is correct', () => {
    expect(PORTARIUM_WORKFLOW_TYPE).toBe('portariumRun');
  });

  it('DEFAULT_TEMPORAL_NAMESPACE is correct', () => {
    expect(DEFAULT_TEMPORAL_NAMESPACE).toBe('default');
  });

  it('DEFAULT_TEMPORAL_TASK_QUEUE is correct', () => {
    expect(DEFAULT_TEMPORAL_TASK_QUEUE).toBe('portarium-runs');
  });
});

// ---------------------------------------------------------------------------
// startRun — guard before connect
// ---------------------------------------------------------------------------

describe('TemporalWorkflowOrchestrator.startRun', () => {
  it('throws if called before connect()', async () => {
    const orchestrator = new TemporalWorkflowOrchestrator();
    await expect(
      orchestrator.startRun({
        runId: RunId('run-1'),
        tenantId: TenantId('tenant-1'),
        workflowId: WorkflowId('wf-1'),
        workflow: WORKFLOW_DEF,
        initiatedByUserId: UserId('user-1'),
        correlationId: CorrelationId('corr-1'),
        executionTier: 'Auto',
        idempotencyKey: 'req-1',
      }),
    ).rejects.toThrow(/connect\(\) must be called before startRun/i);
  });

  it('uses tenantId/idempotencyKey as Temporal workflowId', async () => {
    const stubClient = makeStubClient();
    const orchestrator = new TemporalWorkflowOrchestrator({
      namespace: 'test-ns',
      taskQueue: 'test-queue',
    });

    (orchestrator as unknown as Record<string, unknown>)['client'] = stubClient;

    await orchestrator.startRun({
      runId: RunId('run-42'),
      tenantId: TenantId('tenant-acme'),
      workflowId: WorkflowId('wf-onboard'),
      workflow: WORKFLOW_DEF,
      initiatedByUserId: UserId('user-7'),
      correlationId: CorrelationId('corr-xyz'),
      executionTier: 'HumanApprove',
      idempotencyKey: 'req-abc',
    });

    expect(stubClient.workflow.start).toHaveBeenCalledWith(
      PORTARIUM_WORKFLOW_TYPE,
      expect.objectContaining({
        workflowId: 'tenant-acme/req-abc',
        taskQueue: 'test-queue',
        args: [
          expect.objectContaining({
            runId: 'run-42',
            tenantId: 'tenant-acme',
            workflowId: 'wf-onboard',
            workflow: WORKFLOW_DEF,
            initiatedByUserId: 'user-7',
            correlationId: 'corr-xyz',
            executionTier: 'HumanApprove',
          }),
        ],
      }),
    );
  });

  it('treats WorkflowExecutionAlreadyStartedError as idempotent success', async () => {
    const alreadyStartedError = Object.assign(new Error('already started'), {
      name: 'WorkflowExecutionAlreadyStartedError',
    });
    const stubClient = makeStubClient({
      workflow: {
        start: vi.fn(async () => {
          throw alreadyStartedError;
        }),
      },
    });
    const orchestrator = new TemporalWorkflowOrchestrator();
    (orchestrator as unknown as Record<string, unknown>)['client'] = stubClient;

    // Should resolve, not reject
    await expect(
      orchestrator.startRun({
        runId: RunId('run-1'),
        tenantId: TenantId('tenant-1'),
        workflowId: WorkflowId('wf-1'),
        workflow: WORKFLOW_DEF,
        initiatedByUserId: UserId('user-1'),
        correlationId: CorrelationId('corr-1'),
        executionTier: 'Auto',
        idempotencyKey: 'req-1',
      }),
    ).resolves.toBeUndefined();
  });

  it('re-throws non-AlreadyStarted errors from workflow.start', async () => {
    const networkError = new Error('connection refused');
    const stubClient = makeStubClient({
      workflow: {
        start: vi.fn(async () => {
          throw networkError;
        }),
      },
    });
    const orchestrator = new TemporalWorkflowOrchestrator();
    (orchestrator as unknown as Record<string, unknown>)['client'] = stubClient;

    await expect(
      orchestrator.startRun({
        runId: RunId('run-1'),
        tenantId: TenantId('tenant-1'),
        workflowId: WorkflowId('wf-1'),
        workflow: WORKFLOW_DEF,
        initiatedByUserId: UserId('user-1'),
        correlationId: CorrelationId('corr-1'),
        executionTier: 'Auto',
        idempotencyKey: 'req-1',
      }),
    ).rejects.toThrow('connection refused');
  });
});

// ---------------------------------------------------------------------------
// close
// ---------------------------------------------------------------------------

describe('TemporalWorkflowOrchestrator.close', () => {
  it('is a no-op when called before connect()', async () => {
    const orchestrator = new TemporalWorkflowOrchestrator();
    await expect(orchestrator.close()).resolves.toBeUndefined();
  });

  it('calls connection.close() when client is connected', async () => {
    const stubClient = makeStubClient();
    const orchestrator = new TemporalWorkflowOrchestrator();

    (orchestrator as unknown as Record<string, unknown>)['client'] = stubClient;

    await orchestrator.close();

    expect(stubClient.connection.close).toHaveBeenCalledTimes(1);
  });

  it('nullifies client after close to prevent reuse', async () => {
    const stubClient = makeStubClient();
    const orchestrator = new TemporalWorkflowOrchestrator();

    (orchestrator as unknown as Record<string, unknown>)['client'] = stubClient;

    await orchestrator.close();

    // Client is nullified — startRun should throw again
    await expect(
      orchestrator.startRun({
        runId: RunId('run-1'),
        tenantId: TenantId('t-1'),
        workflowId: WorkflowId('wf-1'),
        workflow: WORKFLOW_DEF,
        initiatedByUserId: UserId('u-1'),
        correlationId: CorrelationId('c-1'),
        executionTier: 'Auto',
        idempotencyKey: 'req-1',
      }),
    ).rejects.toThrow(/connect\(\) must be called before startRun/i);
  });
});

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

describe('TemporalWorkflowOrchestrator config defaults', () => {
  it('uses default address, namespace, and taskQueue when config is omitted', () => {
    const orchestrator = new TemporalWorkflowOrchestrator();
    const inner = orchestrator as unknown as Record<string, unknown>;

    expect(inner['address']).toBe('127.0.0.1:7233');
    expect(inner['namespace']).toBe(DEFAULT_TEMPORAL_NAMESPACE);
    expect(inner['taskQueue']).toBe(DEFAULT_TEMPORAL_TASK_QUEUE);
  });

  it('respects custom config values', () => {
    const orchestrator = new TemporalWorkflowOrchestrator({
      address: 'temporal.prod:7233',
      namespace: 'portarium-prod',
      taskQueue: 'prod-runs',
    });
    const inner = orchestrator as unknown as Record<string, unknown>;

    expect(inner['address']).toBe('temporal.prod:7233');
    expect(inner['namespace']).toBe('portarium-prod');
    expect(inner['taskQueue']).toBe('prod-runs');
  });
});

// Keep makeStubConnection referenced to avoid lint warning
void makeStubConnection;
