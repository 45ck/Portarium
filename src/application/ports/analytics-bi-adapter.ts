import type { DocumentV1 } from '../../domain/canonical/document-v1.js';
import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../domain/canonical/party-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const ANALYTICS_BI_OPERATIONS_V1 = [
  'listDashboards',
  'getDashboard',
  'listReports',
  'getReport',
  'runQuery',
  'getQueryResults',
  'listDataSources',
  'getDataSource',
  'createDataSource',
  'listDatasets',
  'getDataset',
  'refreshDataset',
  'listMetrics',
  'exportReport',
  'listUsers',
  'shareReport',
] as const;

export type AnalyticsBiOperationV1 = (typeof ANALYTICS_BI_OPERATIONS_V1)[number];

export type AnalyticsBiOperationResultV1 =
  | Readonly<{ kind: 'party'; party: PartyV1 }>
  | Readonly<{ kind: 'parties'; parties: readonly PartyV1[] }>
  | Readonly<{ kind: 'document'; document: DocumentV1 }>
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: AnalyticsBiOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type AnalyticsBiExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: AnalyticsBiOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type AnalyticsBiExecuteOutputV1 =
  | Readonly<{ ok: true; result: AnalyticsBiOperationResultV1 }>
  | Readonly<{
      ok: false;
      error:
        | 'unsupported_operation'
        | 'not_found'
        | 'validation_error'
        | 'provider_error';
      message: string;
    }>;

export interface AnalyticsBiAdapterPort {
  execute(input: AnalyticsBiExecuteInputV1): Promise<AnalyticsBiExecuteOutputV1>;
}
