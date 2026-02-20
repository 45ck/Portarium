import { randomUUID } from 'node:crypto';

import type { EvidenceLogPort, EvidencePayloadStorePort } from '../../application/ports/index.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import {
  CorrelationId,
  EvidenceId,
  RunId,
  TenantId,
  UserId,
  WorkItemId,
  WorkspaceId,
} from '../../domain/primitives/index.js';

type SupportedHumanTaskEventType = 'HumanTaskAssigned' | 'HumanTaskCompleted';

type HumanTaskEvidencePayload = Readonly<{
  eventType: SupportedHumanTaskEventType;
  humanTaskId: string;
  workItemId: string;
  runId: string;
  stepId: string;
  actorId: string;
  timestamp: string;
  completionNotes?: string;
}>;

export interface HumanTaskEvidenceHooksDeps {
  evidenceLog: EvidenceLogPort;
  payloadStore: EvidencePayloadStorePort;
  payloadBucket?: string;
  retentionDays?: number;
}

const DEFAULT_PAYLOAD_BUCKET = 'evidence';
const DEFAULT_RETENTION_DAYS = 365;

export class HumanTaskEvidenceHooks {
  readonly #deps: HumanTaskEvidenceHooksDeps;

  public constructor(deps: HumanTaskEvidenceHooksDeps) {
    this.#deps = deps;
  }

  public async record(event: DomainEventV1): Promise<void> {
    if (!isSupportedEvent(event.eventType)) return;
    const parsed = parseHumanTaskEvidencePayload(event);
    const location = {
      bucket: this.#deps.payloadBucket ?? DEFAULT_PAYLOAD_BUCKET,
      key: buildPayloadKey(event.workspaceId, parsed.humanTaskId, event.eventId),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(parsed));
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
      summary: `${event.eventType} evidence for human task ${parsed.humanTaskId}.`,
      actor: event.actorUserId
        ? { kind: 'User', userId: UserId(event.actorUserId) }
        : { kind: 'System' },
      links: {
        runId: RunId(parsed.runId),
        workItemId: WorkItemId(parsed.workItemId),
      },
      payloadRefs: [
        {
          kind: 'Snapshot',
          uri: `evidence://${location.bucket}/${location.key}`,
          contentType: 'application/json',
        },
      ],
    });
  }
}

function isSupportedEvent(
  eventType: DomainEventV1['eventType'],
): eventType is SupportedHumanTaskEventType {
  return eventType === 'HumanTaskAssigned' || eventType === 'HumanTaskCompleted';
}

function buildPayloadKey(workspaceId: string, humanTaskId: string, eventId: string): string {
  return `workspaces/${encodeURIComponent(workspaceId)}/human-tasks/${encodeURIComponent(humanTaskId)}/${encodeURIComponent(eventId)}.json`;
}

function parseHumanTaskEvidencePayload(event: DomainEventV1): HumanTaskEvidencePayload {
  const payload = isRecord(event.payload) ? event.payload : {};
  const humanTaskId = asNonEmptyString(payload['humanTaskId']) ?? event.aggregateId;
  const workItemId = asNonEmptyString(payload['workItemId']);
  const runId = asNonEmptyString(payload['runId']);
  const stepId = asNonEmptyString(payload['stepId']);
  if (!workItemId || !runId || !stepId) {
    throw new Error(`HumanTask evidence payload missing required fields for ${event.eventType}.`);
  }

  const actorId = event.actorUserId ?? 'system';
  const completionNotes =
    asNonEmptyString(payload['completionNotes']) ?? asNonEmptyString(payload['completionNote']);
  return {
    eventType: event.eventType as SupportedHumanTaskEventType,
    humanTaskId,
    workItemId,
    runId,
    stepId,
    actorId,
    timestamp: event.occurredAtIso,
    ...(completionNotes ? { completionNotes } : {}),
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
