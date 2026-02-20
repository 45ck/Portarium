import { describe, expect, it, vi } from 'vitest';

import { CorrelationId, RunId, TenantId } from '../../domain/primitives/index.js';
import { parseWorkflowTriggerV1, type WorkflowTriggerV1 } from '../../domain/schedule/index.js';
import {
  TriggerExecutionRouter,
  type TriggerExecutionPlaneAdapter,
} from './trigger-execution-router.js';

function makeTrigger(overrides: Partial<WorkflowTriggerV1> = {}): WorkflowTriggerV1 {
  return parseWorkflowTriggerV1({
    schemaVersion: 1,
    triggerDefinitionId: 'trig-1',
    workspaceId: 'ws-1',
    workflowId: 'wf-1',
    kind: 'DomainEvent',
    config: { eventType: 'RunStarted' },
    active: true,
    createdAtIso: '2026-02-20T00:00:00.000Z',
    ...overrides,
  });
}

function makeAdapter(): TriggerExecutionPlaneAdapter {
  return {
    dispatchTrigger: vi.fn(async () => undefined),
  };
}

function makeRoutingContext() {
  return {
    tenantId: TenantId('tenant-1'),
    runId: RunId('run-1'),
    correlationId: CorrelationId('corr-1'),
  };
}

describe('TriggerExecutionRouter', () => {
  it('routes DomainEvent triggers to Activepieces', async () => {
    const activepieces = makeAdapter();
    const langflow = makeAdapter();
    const manual = makeAdapter();
    const router = new TriggerExecutionRouter({ activepieces, langflow, manual });

    const result = await router.routeAtWorkflowStart({
      trigger: makeTrigger(),
      ...makeRoutingContext(),
      payload: { source: 'domain-event' },
    });

    expect(result).toEqual({ plane: 'Activepieces', flowRef: 'RunStarted' });
    expect(activepieces.dispatchTrigger).toHaveBeenCalledTimes(1);
    expect(activepieces.dispatchTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerKind: 'DomainEvent',
        flowRef: 'RunStarted',
        tenantId: 'tenant-1',
        correlationId: 'corr-1',
      }),
    );
    expect(langflow.dispatchTrigger).not.toHaveBeenCalled();
    expect(manual.dispatchTrigger).not.toHaveBeenCalled();
  });

  it('routes Webhook triggers to Activepieces', async () => {
    const activepieces = makeAdapter();
    const router = new TriggerExecutionRouter({
      activepieces,
      langflow: makeAdapter(),
      manual: makeAdapter(),
    });

    const result = await router.routeAtWorkflowStart({
      trigger: makeTrigger({
        kind: 'Webhook',
        config: { endpointPath: '/hooks/workflow-start' },
      }),
      ...makeRoutingContext(),
    });

    expect(result).toEqual({ plane: 'Activepieces', flowRef: '/hooks/workflow-start' });
    expect(activepieces.dispatchTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerKind: 'Webhook',
        flowRef: '/hooks/workflow-start',
      }),
    );
  });

  it('routes Cron triggers to Langflow', async () => {
    const langflow = makeAdapter();
    const router = new TriggerExecutionRouter({
      activepieces: makeAdapter(),
      langflow,
      manual: makeAdapter(),
    });

    const result = await router.routeAtWorkflowStart({
      trigger: makeTrigger({
        kind: 'Cron',
        config: { expression: '0 * * * *' },
      }),
      ...makeRoutingContext(),
    });

    expect(result).toEqual({ plane: 'Langflow', flowRef: '0 * * * *' });
    expect(langflow.dispatchTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerKind: 'Cron',
        flowRef: '0 * * * *',
      }),
    );
  });

  it('routes Manual triggers to Manual plane and defaults flowRef to manual', async () => {
    const manual = makeAdapter();
    const router = new TriggerExecutionRouter({
      activepieces: makeAdapter(),
      langflow: makeAdapter(),
      manual,
    });

    const result = await router.routeAtWorkflowStart({
      trigger: makeTrigger({
        kind: 'Manual',
        config: {},
      }),
      ...makeRoutingContext(),
    });

    expect(result).toEqual({ plane: 'Manual', flowRef: 'manual' });
    expect(manual.dispatchTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerKind: 'Manual',
        flowRef: 'manual',
      }),
    );
  });

  it('supports configurable routing table overrides', async () => {
    const langflow = makeAdapter();
    const router = new TriggerExecutionRouter({
      activepieces: makeAdapter(),
      langflow,
      manual: makeAdapter(),
      routingTable: {
        DomainEvent: 'Langflow',
      },
    });

    const result = await router.routeAtWorkflowStart({
      trigger: makeTrigger(),
      ...makeRoutingContext(),
    });

    expect(result).toEqual({ plane: 'Langflow', flowRef: 'RunStarted' });
    expect(langflow.dispatchTrigger).toHaveBeenCalledTimes(1);
  });
});
