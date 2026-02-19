import type { CampaignV1 } from '../../domain/canonical/campaign-v1.js';
import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../domain/canonical/party-v1.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const MARKETING_AUTOMATION_OPERATIONS_V1 = [
  'listContacts',
  'getContact',
  'createContact',
  'updateContact',
  'listLists',
  'getList',
  'addContactToList',
  'removeContactFromList',
  'listCampaigns',
  'getCampaign',
  'createCampaign',
  'sendCampaign',
  'getCampaignStats',
  'listAutomations',
  'getAutomation',
  'triggerAutomation',
  'listForms',
  'getFormSubmissions',
] as const;

export type MarketingAutomationOperationV1 = (typeof MARKETING_AUTOMATION_OPERATIONS_V1)[number];

export type MarketingAutomationOperationResultV1 =
  | Readonly<{ kind: 'party'; party: PartyV1 }>
  | Readonly<{ kind: 'parties'; parties: readonly PartyV1[] }>
  | Readonly<{ kind: 'campaign'; campaign: CampaignV1 }>
  | Readonly<{ kind: 'campaigns'; campaigns: readonly CampaignV1[] }>
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: MarketingAutomationOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type MarketingAutomationExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: MarketingAutomationOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type MarketingAutomationExecuteOutputV1 =
  | Readonly<{ ok: true; result: MarketingAutomationOperationResultV1 }>
  | Readonly<{
      ok: false;
      error:
        | 'unsupported_operation'
        | 'not_found'
        | 'validation_error'
        | 'provider_error';
      message: string;
    }>;

export interface MarketingAutomationAdapterPort {
  execute(input: MarketingAutomationExecuteInputV1): Promise<MarketingAutomationExecuteOutputV1>;
}
