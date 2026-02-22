import { randomUUID } from 'node:crypto';

import type { EvidenceLogPort, EvidencePayloadStorePort } from '../../application/ports/index.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import {
  ApprovalId,
  CorrelationId,
  EvidenceId,
  RunId,
  TenantId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';

type SupportedApprovalEventType =
  | 'ApprovalRequested'
  | 'ApprovalGranted'
  | 'ApprovalDenied'
  | 'ApprovalChangesRequested';

type ApprovalEvidencePayload = Readonly<{
  eventType: SupportedApprovalEventType;
  approvalId: string;
  runId: string;
  actorId: string;
  timestamp: string;
  decision?: string;
  rationale?: string;
}>;

export interface ApprovalEvidenceHooksDeps {
  evidenceLog: EvidenceLogPort;
  payloadStore: EvidencePayloadStorePort;
  payloadBucket?: string;
  retentionDays?: number;
}

const DEFAULT_PAYLOAD_BUCKET = 'evidence';
const DEFAULT_RETENTION_DAYS = 2555; // 7 years for compliance

export class ApprovalEvidenceHooks {
  readonly #deps: ApprovalEvidenceHooksDeps;

  public constructor(deps: ApprovalEvidenceHooksDeps) {
    this.#deps = deps;
  }

  public async record(event: DomainEventV1): Promise<void> {
    if (!isSupportedEvent(event.eventType)) return;
    const parsed = parseApprovalEvidencePayload(event, event.eventType);

    const location = {
      bucket: this.#deps.payloadBucket ?? DEFAULT_PAYLOAD_BUCKET,
      key: buildPayloadKey(event.workspaceId, parsed.approvalId, event.eventId),
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
      category: 'Approval',
      summary: buildSummary(event.eventType, parsed),
      actor: event.actorUserId
        ? { kind: 'User', userId: UserId(event.actorUserId) }
        : { kind: 'System' },
      links: {
        runId: RunId(parsed.runId),
        approvalId: ApprovalId(parsed.approvalId),
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
): eventType is SupportedApprovalEventType {
  return (
    eventType === 'ApprovalRequested' ||
    eventType === 'ApprovalGranted' ||
    eventType === 'ApprovalDenied' ||
    eventType === 'ApprovalChangesRequested'
  );
}

function buildSummary(
  eventType: SupportedApprovalEventType,
  parsed: ApprovalEvidencePayload,
): string {
  const base = `${eventType} for approval ${parsed.approvalId}`;
  if (parsed.decision) return `${base} — decision: ${parsed.decision}`;
  return base;
}

function buildPayloadKey(workspaceId: string, approvalId: string, eventId: string): string {
  return `workspaces/${encodeURIComponent(workspaceId)}/approvals/${encodeURIComponent(approvalId)}/${encodeURIComponent(eventId)}.json`;
}

function parseApprovalEvidencePayload(
  event: DomainEventV1,
  eventType: SupportedApprovalEventType,
): ApprovalEvidencePayload {
  const payload = isRecord(event.payload) ? event.payload : {};
  const approvalId = asNonEmptyString(payload['approvalId']) ?? event.aggregateId;
  const runId = asNonEmptyString(payload['runId']);
  if (!approvalId || !runId) {
    throw new Error(`Approval evidence payload missing required fields for ${eventType}.`);
  }

  const actorId =
    event.actorUserId ??
    asNonEmptyString(payload['requestedByUserId']) ??
    asNonEmptyString(payload['decidedByUserId']) ??
    'system';
  const decision = asNonEmptyString(payload['status']);
  const rationale = asNonEmptyString(payload['rationale']);

  return {
    eventType,
    approvalId,
    runId,
    actorId,
    timestamp: event.occurredAtIso,
    ...(decision ? { decision } : {}),
    ...(rationale ? { rationale } : {}),
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
