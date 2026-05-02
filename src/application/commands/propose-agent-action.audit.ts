import {
  EvidenceId,
  EventId,
  type CorrelationId,
  type EvidenceId as EvidenceIdType,
} from '../../domain/primitives/index.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import type { EvidenceEntryAppendInput } from '../ports/index.js';
import type {
  AgentActionGovernanceEvaluation,
  ParsedProposeAgentActionInput,
} from './propose-agent-action.helpers.js';

export type AgentActionAuditArtifacts = Readonly<{
  proposalId: string;
  evidenceId: EvidenceIdType;
  event: DomainEventV1;
  evidence: EvidenceEntryAppendInput;
}>;

function buildAgentActionEvidence(params: {
  proposalId: string;
  evidenceId: string;
  occurredAtIso: string;
  input: ParsedProposeAgentActionInput;
  evaluation: AgentActionGovernanceEvaluation;
  actorUserId: ParsedProposeAgentActionInput['requestedByUserId'];
  correlationId: CorrelationId;
}): EvidenceEntryAppendInput {
  const { proposalId, evidenceId, occurredAtIso, input, evaluation, actorUserId, correlationId } =
    params;

  return {
    schemaVersion: 1,
    evidenceId: EvidenceId(evidenceId),
    workspaceId: input.workspaceId,
    correlationId,
    occurredAtIso,
    category: 'Policy',
    summary: buildEvidenceSummary({ proposalId, input, evaluation }),
    actor: { kind: 'User', userId: actorUserId },
    links: {
      externalRefs: [
        {
          sorName: 'PortariumAgentActions',
          portFamily: 'ItsmItOps',
          externalId: input.agentId,
          externalType: 'Agent',
        },
        ...(input.machineId
          ? [
              {
                sorName: 'PortariumMachineRegistry',
                portFamily: 'ItsmItOps' as const,
                externalId: input.machineId,
                externalType: 'Machine',
              },
            ]
          : []),
      ],
    },
    payloadRefs: [
      {
        kind: 'Snapshot',
        uri: `portarium://agent-action-proposals/${proposalId}`,
        contentType: 'application/json',
      },
    ],
  };
}

function buildAgentActionPolicyEvent(params: {
  proposalId: string;
  evidenceId: string;
  eventId: string;
  occurredAtIso: string;
  input: ParsedProposeAgentActionInput;
  evaluation: AgentActionGovernanceEvaluation;
  workspaceId: ParsedProposeAgentActionInput['workspaceId'];
  correlationId: CorrelationId;
  actorUserId: ParsedProposeAgentActionInput['requestedByUserId'];
}): DomainEventV1 {
  const {
    proposalId,
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
    eventId: EventId(eventId),
    eventType: 'AgentActionProposed',
    aggregateKind: 'AgentActionProposal',
    aggregateId: proposalId,
    occurredAtIso,
    workspaceId,
    correlationId,
    actorUserId,
    payload: {
      agentId: input.agentId,
      machineId: input.machineId,
      actionKind: input.actionKind,
      toolName: input.toolName,
      executionTier: input.executionTier,
      rationale: input.rationale,
      decision: evaluation.decision,
      toolCategory: evaluation.toolClassification.category,
      toolMinimumTier: evaluation.toolClassification.minimumTier,
      policyDecision: evaluation.policyEvaluation.decision,
      policyIds: evaluation.policyEvaluation.evaluatedPolicyIds,
      violationKinds: evaluation.policyEvaluation.violations.map((v) => v.kind),
      ...(evaluation.outboundCompliance
        ? {
            outboundCompliance: {
              decision: evaluation.outboundCompliance.decision,
              channel: evaluation.outboundCompliance.channel,
              purpose: evaluation.outboundCompliance.purpose,
              deferredUntilIso: evaluation.outboundCompliance.deferredUntilIso,
              rationales: evaluation.outboundCompliance.rationales,
            },
          }
        : {}),
      evidenceId: EvidenceId(evidenceId),
    },
  };
}

function buildEvidenceSummary(params: {
  proposalId: string;
  input: ParsedProposeAgentActionInput;
  evaluation: AgentActionGovernanceEvaluation;
}): string {
  const compliance = params.evaluation.outboundCompliance
    ? ` Outbound compliance ${params.evaluation.outboundCompliance.decision}: ${params.evaluation.outboundCompliance.rationales.map((rationale) => rationale.code).join(', ')}.`
    : '';
  return `Agent action proposal ${params.proposalId} (${params.input.actionKind}:${params.input.toolName}) evaluated as ${params.evaluation.decision}.${compliance}`;
}

export function buildAgentActionAuditArtifacts(params: {
  proposalId: string;
  evidenceId: string;
  eventId: string;
  occurredAtIso: string;
  input: ParsedProposeAgentActionInput;
  evaluation: AgentActionGovernanceEvaluation;
  workspaceId: ParsedProposeAgentActionInput['workspaceId'];
  correlationId: CorrelationId;
  actorUserId: ParsedProposeAgentActionInput['requestedByUserId'];
}): AgentActionAuditArtifacts {
  const { proposalId, evidenceId, eventId, occurredAtIso, input, evaluation } = params;

  return {
    proposalId,
    evidenceId: EvidenceId(evidenceId),
    evidence: buildAgentActionEvidence({
      proposalId,
      evidenceId,
      occurredAtIso,
      input,
      evaluation,
      actorUserId: params.actorUserId,
      correlationId: params.correlationId,
    }),
    event: buildAgentActionPolicyEvent({
      proposalId,
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
