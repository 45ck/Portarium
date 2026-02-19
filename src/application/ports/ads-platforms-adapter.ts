import type { CampaignV1 } from '../../domain/canonical/campaign-v1.js';
import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const ADS_PLATFORMS_OPERATIONS_V1 = [
  'listCampaigns',
  'getCampaign',
  'createCampaign',
  'updateCampaign',
  'pauseCampaign',
  'listAdGroups',
  'getAdGroup',
  'createAdGroup',
  'listAds',
  'getAd',
  'createAd',
  'getCampaignStats',
  'getAdGroupStats',
  'getAdStats',
  'listAudiences',
  'createAudience',
  'getBudget',
  'updateBudget',
  'listKeywords',
] as const;

export type AdsPlatformsOperationV1 = (typeof ADS_PLATFORMS_OPERATIONS_V1)[number];

export type AdsPlatformsOperationResultV1 =
  | Readonly<{ kind: 'campaign'; campaign: CampaignV1 }>
  | Readonly<{ kind: 'campaigns'; campaigns: readonly CampaignV1[] }>
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: AdsPlatformsOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type AdsPlatformsExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: AdsPlatformsOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type AdsPlatformsExecuteOutputV1 =
  | Readonly<{ ok: true; result: AdsPlatformsOperationResultV1 }>
  | Readonly<{
      ok: false;
      error:
        | 'unsupported_operation'
        | 'not_found'
        | 'validation_error'
        | 'provider_error';
      message: string;
    }>;

export interface AdsPlatformsAdapterPort {
  execute(input: AdsPlatformsExecuteInputV1): Promise<AdsPlatformsExecuteOutputV1>;
}
