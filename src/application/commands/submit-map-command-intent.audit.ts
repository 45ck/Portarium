import {
  EvidenceId,
  type CorrelationId,
  type EvidenceId as EvidenceIdType,
} from '../../domain/primitives/index.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import type { EvidenceEntryAppendInput } from '../ports/index.js';
import type { PolicyEvaluationResultV1 } from '../../domain/services/index.js';
import type { ParsedSubmitMapCommandIntentInput } from './submit-map-command-intent.helpers.js';

export type MapCommandAuditArtifacts = Readonly<{
  commandIntentId: string;
  evidenceId: EvidenceIdType;
  event: DomainEventV1;
  evidence: EvidenceEntryAppendInput;
}>;

function buildMapCommandEvidence(params: {
  commandIntentId: string;
  evidenceId: string;
  occurredAtIso: string;
  input: ParsedSubmitMapCommandIntentInput;
  decision: PolicyEvaluationResultV1['decision'];
  actorUserId: ParsedSubmitMapCommandIntentInput['requestedByUserId'];
  correlationId: CorrelationId;
}): EvidenceEntryAppendInput {
  const {
    commandIntentId,
    evidenceId,
    occurredAtIso,
    input,
    decision,
    actorUserId,
    correlationId,
  } = params;
  const mapRefId = `${input.mapContext.siteId}:${input.mapContext.floorId ?? 'all'}:${input.mapContext.zoneId ?? 'all'}`;
  const approvingActors = input.approvingActorUserIds.map((id) => id.toString()).join(',');

  return {
    schemaVersion: 1,
    evidenceId: EvidenceId(evidenceId),
    workspaceId: input.workspaceId,
    correlationId,
    occurredAtIso,
    category: 'Policy',
    summary: `Map command intent ${commandIntentId} (${input.commandKind}) evaluated as ${decision}.`,
    actor: { kind: 'User', userId: actorUserId },
    links: {
      externalRefs: [
        {
          sorName: 'PortariumMap',
          portFamily: 'RoboticsActuation',
          externalId: mapRefId,
          externalType: 'MapContext',
          ...(input.mapContext.mapLayerId
            ? { displayLabel: `layer:${input.mapContext.mapLayerId}` }
            : {}),
        },
        {
          sorName: 'PortariumFleet',
          portFamily: 'RoboticsActuation',
          externalId: input.robotId,
          externalType: 'Robot',
        },
        ...(approvingActors
          ? [
              {
                sorName: 'PortariumApprovals',
                portFamily: 'RoboticsActuation' as const,
                externalId: approvingActors,
                externalType: 'ApprovingActors',
              },
            ]
          : []),
      ],
    },
    payloadRefs: [
      {
        kind: 'Snapshot',
        uri: `portarium://map-command-intents/${commandIntentId}`,
        contentType: 'application/json',
      },
    ],
  };
}

function buildMapCommandPolicyEvent(params: {
  commandIntentId: string;
  evidenceId: string;
  eventId: string;
  occurredAtIso: string;
  input: ParsedSubmitMapCommandIntentInput;
  evaluation: PolicyEvaluationResultV1;
  workspaceId: ParsedSubmitMapCommandIntentInput['workspaceId'];
  correlationId: CorrelationId;
  actorUserId: ParsedSubmitMapCommandIntentInput['requestedByUserId'];
}): DomainEventV1 {
  const {
    commandIntentId,
    evidenceId,
    eventId,
    occurredAtIso,
    input,
    evaluation,
    workspaceId,
    correlationId,
    actorUserId,
  } = params;

  return {
    schemaVersion: 1,
    eventId,
    eventType: 'PolicyEvaluated',
    aggregateKind: 'MapCommandIntent',
    aggregateId: commandIntentId,
    occurredAtIso,
    workspaceId,
    correlationId,
    actorUserId,
    payload: {
      commandKind: input.commandKind,
      robotId: input.robotId,
      rationale: input.rationale,
      executionTier: input.executionTier,
      policyDecision: evaluation.decision,
      policyIds: evaluation.evaluatedPolicyIds,
      violationKinds: evaluation.violations.map((violation) => violation.kind),
      safetyTierRecommendation: evaluation.safetyTierRecommendation,
      mapContext: input.mapContext,
      approvingActorUserIds: input.approvingActorUserIds,
      evidenceId: EvidenceId(evidenceId),
    },
  };
}

export function buildMapCommandAuditArtifacts(params: {
  commandIntentId: string;
  evidenceId: string;
  eventId: string;
  occurredAtIso: string;
  input: ParsedSubmitMapCommandIntentInput;
  evaluation: PolicyEvaluationResultV1;
  workspaceId: ParsedSubmitMapCommandIntentInput['workspaceId'];
  correlationId: CorrelationId;
  actorUserId: ParsedSubmitMapCommandIntentInput['requestedByUserId'];
}): MapCommandAuditArtifacts {
  const { commandIntentId, evidenceId, eventId, occurredAtIso, input, evaluation } = params;

  return {
    commandIntentId,
    evidenceId: EvidenceId(evidenceId),
    evidence: buildMapCommandEvidence({
      commandIntentId,
      evidenceId,
      occurredAtIso,
      input,
      decision: evaluation.decision,
      actorUserId: params.actorUserId,
      correlationId: params.correlationId,
    }),
    event: buildMapCommandPolicyEvent({
      commandIntentId,
      evidenceId,
      eventId,
      occurredAtIso,
      input,
      evaluation,
      workspaceId: params.workspaceId,
      correlationId: params.correlationId,
      actorUserId: params.actorUserId,
    }),
  };
}
