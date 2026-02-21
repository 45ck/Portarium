import { randomUUID } from 'node:crypto';

import { createPortariumCloudEvent } from '../../application/events/cloudevent.js';
import type {
  EvidenceLogPort,
  EvidencePayloadStorePort,
  EventPublisher,
} from '../../application/ports/index.js';
import {
  AGENT_CLOUD_EVENT_SOURCE,
  AGENT_CLOUD_EVENT_TYPES,
} from '../../domain/event-stream/agent-events-v1.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import {
  ActionId,
  CorrelationId,
  EvidenceId,
  RunId,
  TenantId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';

type SupportedAgentActionEventType = 'ActionDispatched' | 'ActionCompleted' | 'ActionFailed';

type AgentActionEvidencePayload = Readonly<{
  eventType: SupportedAgentActionEventType;
  runId: string;
  actionId: string;
  machineId?: string;
  agentId?: string;
  toolName?: string;
  status?: string;
  errorMessage?: string;
  timestamp: string;
}>;

type AgentActionEvidenceOptionalPayload = Pick<
  AgentActionEvidencePayload,
  'machineId' | 'agentId' | 'toolName' | 'status' | 'errorMessage'
>;

export interface AgentActionEvidenceHooksDeps {
  evidenceLog: EvidenceLogPort;
  payloadStore: EvidencePayloadStorePort;
  eventPublisher: EventPublisher;
  payloadBucket?: string;
  retentionDays?: number;
}

const DEFAULT_PAYLOAD_BUCKET = 'evidence';
const DEFAULT_RETENTION_DAYS = 365;

export class AgentActionEvidenceHooks {
  readonly #deps: AgentActionEvidenceHooksDeps;

  public constructor(deps: AgentActionEvidenceHooksDeps) {
    this.#deps = deps;
  }

  public async record(event: DomainEventV1): Promise<void> {
    const eventType = event.eventType;
    if (!isSupportedEvent(eventType)) return;

    const payload = parseAgentActionEvidencePayload(event, eventType);
    const location = {
      bucket: this.#deps.payloadBucket ?? DEFAULT_PAYLOAD_BUCKET,
      key: buildPayloadKey(event.workspaceId, payload.runId, payload.actionId, event.eventId),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    await this.#deps.payloadStore.put({ location, bytes });

    const retentionDays = this.#deps.retentionDays ?? DEFAULT_RETENTION_DAYS;
    const retainUntilIso = new Date(
      Date.parse(event.occurredAtIso) + retentionDays * 86_400_000,
    ).toISOString();
    await this.#deps.payloadStore.applyWormControls({
      location,
      retentionSchedule: {
        retentionClass: 'Compliance',
        retainUntilIso,
      },
    });

    const evidenceId = EvidenceId(`evi-${randomUUID()}`);
    await this.#deps.evidenceLog.appendEntry(TenantId(event.workspaceId), {
      schemaVersion: 1,
      evidenceId,
      workspaceId: WorkspaceId(event.workspaceId),
      correlationId: CorrelationId(event.correlationId),
      occurredAtIso: event.occurredAtIso,
      category: 'Action',
      summary: `${eventType} evidence for action ${payload.actionId}.`,
      actor: event.actorUserId
        ? { kind: 'User', userId: UserId(event.actorUserId) }
        : { kind: 'System' },
      links: {
        runId: RunId(payload.runId),
      },
      payloadRefs: [
        {
          kind: 'Snapshot',
          uri: `evidence://${location.bucket}/${location.key}`,
          contentType: 'application/json',
        },
      ],
    });

    await this.#deps.eventPublisher.publish(
      createPortariumCloudEvent({
        source: AGENT_CLOUD_EVENT_SOURCE,
        eventType: eventTypeToCloudEventType(eventType),
        eventId: event.eventId,
        tenantId: event.workspaceId,
        correlationId: event.correlationId,
        subject: `runs/${payload.runId}/actions/${payload.actionId}`,
        occurredAtIso: event.occurredAtIso,
        runId: RunId(payload.runId),
        actionId: ActionId(payload.actionId),
        data: payload,
      }),
    );
  }
}

function isSupportedEvent(
  eventType: DomainEventV1['eventType'],
): eventType is SupportedAgentActionEventType {
  return (
    eventType === 'ActionDispatched' ||
    eventType === 'ActionCompleted' ||
    eventType === 'ActionFailed'
  );
}

function eventTypeToCloudEventType(
  eventType: SupportedAgentActionEventType,
): (typeof AGENT_CLOUD_EVENT_TYPES)[SupportedAgentActionEventType] {
  return AGENT_CLOUD_EVENT_TYPES[eventType];
}

function buildPayloadKey(
  workspaceId: string,
  runId: string,
  actionId: string,
  eventId: string,
): string {
  return `workspaces/${encodeURIComponent(workspaceId)}/runs/${encodeURIComponent(runId)}/agent-actions/${encodeURIComponent(actionId)}/${encodeURIComponent(eventId)}.json`;
}

function parseAgentActionEvidencePayload(
  event: DomainEventV1,
  eventType: SupportedAgentActionEventType,
): AgentActionEvidencePayload {
  const payload = isRecord(event.payload) ? event.payload : {};
  const { runId, actionId } = parseRunAndActionIds(event, payload);

  return {
    eventType,
    runId,
    actionId,
    ...parseOptionalEvidenceFields(payload),
    timestamp: event.occurredAtIso,
  };
}

function parseRunAndActionIds(
  event: DomainEventV1,
  payload: Record<string, unknown>,
): Readonly<{ runId: string; actionId: string }> {
  const runId = asNonEmptyString(payload['runId']) ?? event.aggregateId;
  const actionId = asNonEmptyString(payload['actionId']) ?? asNonEmptyString(payload['stepId']);
  if (runId && actionId) return { runId, actionId };
  throw new Error(`Agent action payload missing required runId/actionId for ${event.eventType}.`);
}

function parseOptionalEvidenceFields(payload: Record<string, unknown>): AgentActionEvidenceOptionalPayload {
  const machineId = asNonEmptyString(payload['machineId']);
  const agentId = asNonEmptyString(payload['agentId']);
  const toolName = asNonEmptyString(payload['toolName']);
  const status = asNonEmptyString(payload['status']);
  const errorMessage = asNonEmptyString(payload['errorMessage']) ?? asNonEmptyString(payload['error']);
  return {
    ...(machineId ? { machineId } : {}),
    ...(agentId ? { agentId } : {}),
    ...(toolName ? { toolName } : {}),
    ...(status ? { status } : {}),
    ...(errorMessage ? { errorMessage } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
