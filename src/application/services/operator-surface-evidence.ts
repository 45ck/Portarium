import type { EvidenceActor, EvidenceCategory } from '../../domain/evidence/evidence-entry-v1.js';
import type {
  OperatorSurfaceLifecycleStatus,
  OperatorSurfaceV1,
} from '../../domain/operator-surfaces/index.js';
import { EvidenceId, type EvidenceId as EvidenceIdType } from '../../domain/primitives/index.js';
import type { EvidenceEntryAppendInput } from '../ports/index.js';

export type OperatorSurfaceEvidenceEvent = 'proposed' | 'approved' | 'rendered' | 'used';

const OPERATOR_SURFACE_CATEGORY: EvidenceCategory = 'OperatorSurface';

export type OperatorSurfaceEvidenceParams = Readonly<{
  surface: OperatorSurfaceV1;
  event: OperatorSurfaceEvidenceEvent;
  evidenceId: string;
  occurredAtIso: string;
  actor: EvidenceActor;
}>;

export type OperatorSurfaceEvidenceArtifact = Readonly<{
  evidenceId: EvidenceIdType;
  evidence: EvidenceEntryAppendInput;
}>;

export function buildOperatorSurfaceEvidenceEntry(
  params: OperatorSurfaceEvidenceParams,
): OperatorSurfaceEvidenceArtifact {
  const evidenceId = EvidenceId(params.evidenceId);
  const { surface } = params;
  return {
    evidenceId,
    evidence: {
      schemaVersion: 1,
      evidenceId,
      workspaceId: surface.workspaceId,
      correlationId: surface.correlationId,
      occurredAtIso: params.occurredAtIso,
      category: OPERATOR_SURFACE_CATEGORY,
      summary: buildSummary(surface, params.event),
      actor: params.actor,
      links: {
        runId: surface.context.runId,
        ...(surface.context.kind === 'Approval' ? { approvalId: surface.context.approvalId } : {}),
      },
      payloadRefs: [
        {
          kind: 'Snapshot',
          uri: `portarium://operator-surfaces/${String(surface.surfaceId)}/${params.event}`,
          contentType: 'application/vnd.portarium.operator-surface+json;version=1',
        },
      ],
    },
  };
}

export function lifecycleStatusForOperatorSurfaceEvidenceEvent(
  event: OperatorSurfaceEvidenceEvent,
): OperatorSurfaceLifecycleStatus {
  switch (event) {
    case 'proposed':
      return 'Proposed';
    case 'approved':
      return 'Approved';
    case 'rendered':
      return 'Rendered';
    case 'used':
      return 'Used';
  }
}

function buildSummary(surface: OperatorSurfaceV1, event: OperatorSurfaceEvidenceEvent): string {
  const eventLabel = event === 'used' ? 'used by an operator' : `${event}`;
  return `Operator surface ${String(surface.surfaceId)} (${surface.surfaceKind}: ${surface.title}) ${eventLabel}.`;
}
