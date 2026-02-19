import type { DocumentV1 } from '../../domain/canonical/document-v1.js';
import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { TicketV1 } from '../../domain/canonical/ticket-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const COMPLIANCE_GRC_OPERATIONS_V1 = [
  'listControls',
  'getControl',
  'createControl',
  'updateControlStatus',
  'listRisks',
  'getRisk',
  'createRisk',
  'assessRisk',
  'listPolicies',
  'getPolicy',
  'createPolicy',
  'publishPolicy',
  'listAudits',
  'getAudit',
  'createAudit',
  'listFindings',
  'createFinding',
  'listEvidenceRequests',
  'uploadEvidence',
  'listFrameworks',
  'getFramework',
  'mapControlToFramework',
] as const;

export type ComplianceGrcOperationV1 = (typeof COMPLIANCE_GRC_OPERATIONS_V1)[number];

export type ComplianceGrcOperationResultV1 =
  | Readonly<{ kind: 'ticket'; ticket: TicketV1 }>
  | Readonly<{ kind: 'tickets'; tickets: readonly TicketV1[] }>
  | Readonly<{ kind: 'document'; document: DocumentV1 }>
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: ComplianceGrcOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type ComplianceGrcExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: ComplianceGrcOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type ComplianceGrcExecuteOutputV1 =
  | Readonly<{ ok: true; result: ComplianceGrcOperationResultV1 }>
  | Readonly<{
      ok: false;
      error:
        | 'unsupported_operation'
        | 'not_found'
        | 'validation_error'
        | 'provider_error';
      message: string;
    }>;

export interface ComplianceGrcAdapterPort {
  execute(input: ComplianceGrcExecuteInputV1): Promise<ComplianceGrcExecuteOutputV1>;
}
