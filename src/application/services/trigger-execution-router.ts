import type {
  CorrelationId,
  RunId,
  TenantId,
} from '../../domain/primitives/index.js';
import type {
  CronSchedule,
  DomainEventTriggerConfig,
  ManualTriggerConfig,
  TriggerKind,
  WebhookTriggerConfig,
  WorkflowTriggerV1,
} from '../../domain/schedule/index.js';

export type TriggerExecutionPlane = 'Activepieces' | 'Langflow' | 'Manual';

export type TriggerRoutingResult = Readonly<{
  plane: TriggerExecutionPlane;
  flowRef: string;
}>;

export type TriggerRoutingInput = Readonly<{
  trigger: WorkflowTriggerV1;
  tenantId: TenantId;
  runId: RunId;
  correlationId: CorrelationId;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type TriggerDispatchInput = Readonly<{
  triggerDefinitionId: string;
  workflowId: string;
  workspaceId: string;
  triggerKind: TriggerKind;
  tenantId: TenantId;
  runId: RunId;
  correlationId: CorrelationId;
  flowRef: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export interface TriggerExecutionPlaneAdapter {
  dispatchTrigger(input: TriggerDispatchInput): Promise<void>;
}

export interface TriggerExecutionRouterPort {
  routeAtWorkflowStart(input: TriggerRoutingInput): Promise<TriggerRoutingResult>;
}

type TriggerRoutingTable = Readonly<Record<TriggerKind, TriggerExecutionPlane>>;

const DEFAULT_TRIGGER_ROUTING_TABLE: TriggerRoutingTable = {
  Cron: 'Langflow',
  Webhook: 'Activepieces',
  DomainEvent: 'Activepieces',
  Manual: 'Manual',
} as const;

export interface TriggerExecutionRouterDeps {
  activepieces: TriggerExecutionPlaneAdapter;
  langflow: TriggerExecutionPlaneAdapter;
  manual: TriggerExecutionPlaneAdapter;
  routingTable?: Partial<TriggerRoutingTable>;
}

export class TriggerExecutionRouter implements TriggerExecutionRouterPort {
  readonly #activepieces: TriggerExecutionPlaneAdapter;
  readonly #langflow: TriggerExecutionPlaneAdapter;
  readonly #manual: TriggerExecutionPlaneAdapter;
  readonly #routingTable: TriggerRoutingTable;

  public constructor(deps: TriggerExecutionRouterDeps) {
    this.#activepieces = deps.activepieces;
    this.#langflow = deps.langflow;
    this.#manual = deps.manual;
    this.#routingTable = {
      ...DEFAULT_TRIGGER_ROUTING_TABLE,
      ...(deps.routingTable ?? {}),
    };
  }

  public async routeAtWorkflowStart(input: TriggerRoutingInput): Promise<TriggerRoutingResult> {
    const flowRef = flowRefFromTrigger(input.trigger);
    const plane = this.#routingTable[input.trigger.kind];
    const adapter = this.#adapterForPlane(plane);

    await adapter.dispatchTrigger({
      triggerDefinitionId: String(input.trigger.triggerDefinitionId),
      workflowId: String(input.trigger.workflowId),
      workspaceId: String(input.trigger.workspaceId),
      triggerKind: input.trigger.kind,
      tenantId: input.tenantId,
      runId: input.runId,
      correlationId: input.correlationId,
      flowRef,
      payload: {
        ...(input.payload ?? {}),
        triggerKind: input.trigger.kind,
      },
    });

    return { plane, flowRef };
  }

  #adapterForPlane(plane: TriggerExecutionPlane): TriggerExecutionPlaneAdapter {
    switch (plane) {
      case 'Activepieces':
        return this.#activepieces;
      case 'Langflow':
        return this.#langflow;
      case 'Manual':
        return this.#manual;
    }
  }
}

function flowRefFromTrigger(trigger: WorkflowTriggerV1): string {
  switch (trigger.kind) {
    case 'Cron':
      return nonEmpty(
        (trigger.config as CronSchedule).expression,
        'Cron trigger expression must be non-empty.',
      );
    case 'Webhook':
      return nonEmpty(
        (trigger.config as WebhookTriggerConfig).endpointPath,
        'Webhook trigger endpointPath must be non-empty.',
      );
    case 'DomainEvent':
      return nonEmpty(
        (trigger.config as DomainEventTriggerConfig).eventType,
        'DomainEvent trigger eventType must be non-empty.',
      );
    case 'Manual': {
      const label = (trigger.config as ManualTriggerConfig).label;
      return label === undefined ? 'manual' : nonEmpty(label, 'Manual trigger label must be non-empty.');
    }
  }
}

function nonEmpty(value: string, message: string): string {
  if (value.trim() === '') {
    throw new Error(message);
  }
  return value;
}
