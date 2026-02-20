import type { CampaignV1 } from '../../../domain/canonical/campaign-v1.js';
import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import { CampaignId } from '../../../domain/primitives/index.js';
import type {
  AdsPlatformsAdapterPort,
  AdsPlatformsExecuteInputV1,
  AdsPlatformsExecuteOutputV1,
} from '../../../application/ports/ads-platforms-adapter.js';
import { ADS_PLATFORMS_OPERATIONS_V1 } from '../../../application/ports/ads-platforms-adapter.js';

const OPERATION_SET = new Set<string>(ADS_PLATFORMS_OPERATIONS_V1);

type TenantExternalRef = Readonly<{
  tenantId: AdsPlatformsExecuteInputV1['tenantId'];
  externalRef: ExternalObjectRef;
}>;

type InMemoryAdsPlatformsAdapterSeed = Readonly<{
  campaigns?: readonly CampaignV1[];
  adGroups?: readonly TenantExternalRef[];
  ads?: readonly TenantExternalRef[];
  audiences?: readonly TenantExternalRef[];
  budgets?: readonly TenantExternalRef[];
  keywords?: readonly TenantExternalRef[];
}>;

type InMemoryAdsPlatformsAdapterParams = Readonly<{
  seed?: InMemoryAdsPlatformsAdapterSeed;
  now?: () => Date;
}>;

function readString(payload: Readonly<Record<string, unknown>> | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(payload: Readonly<Record<string, unknown>> | undefined, key: string): number | null {
  const value = payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export class InMemoryAdsPlatformsAdapter implements AdsPlatformsAdapterPort {
  readonly #now: () => Date;
  readonly #campaigns: CampaignV1[];
  readonly #adGroups: TenantExternalRef[];
  readonly #ads: TenantExternalRef[];
  readonly #audiences: TenantExternalRef[];
  readonly #budgets: TenantExternalRef[];
  readonly #keywords: TenantExternalRef[];
  #campaignSequence: number;
  #adGroupSequence: number;
  #adSequence: number;
  #audienceSequence: number;
  #statsSequence: number;

  public constructor(params?: InMemoryAdsPlatformsAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#campaigns = [...(params?.seed?.campaigns ?? [])];
    this.#adGroups = [...(params?.seed?.adGroups ?? [])];
    this.#ads = [...(params?.seed?.ads ?? [])];
    this.#audiences = [...(params?.seed?.audiences ?? [])];
    this.#budgets = [...(params?.seed?.budgets ?? [])];
    this.#keywords = [...(params?.seed?.keywords ?? [])];
    this.#campaignSequence = this.#campaigns.length;
    this.#adGroupSequence = this.#adGroups.length;
    this.#adSequence = this.#ads.length;
    this.#audienceSequence = this.#audiences.length;
    this.#statsSequence = 0;
  }

  public async execute(input: AdsPlatformsExecuteInputV1): Promise<AdsPlatformsExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported AdsPlatforms operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'listCampaigns':
        return { ok: true, result: { kind: 'campaigns', campaigns: this.#listCampaigns(input) } };
      case 'getCampaign':
        return this.#getCampaign(input);
      case 'createCampaign':
        return this.#createCampaign(input);
      case 'updateCampaign':
        return this.#updateCampaign(input);
      case 'pauseCampaign':
        return this.#pauseCampaign(input);
      case 'listAdGroups':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#adGroups, input) },
        };
      case 'getAdGroup':
        return this.#getTenantRef(input, this.#adGroups, 'adGroupId', 'Ad group', 'getAdGroup');
      case 'createAdGroup':
        return this.#createAdGroup(input);
      case 'listAds':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#ads, input) },
        };
      case 'getAd':
        return this.#getTenantRef(input, this.#ads, 'adId', 'Ad', 'getAd');
      case 'createAd':
        return this.#createAd(input);
      case 'getCampaignStats':
        return this.#statsOperation(input, 'campaignId', 'Campaign');
      case 'getAdGroupStats':
        return this.#statsOperation(input, 'adGroupId', 'Ad group');
      case 'getAdStats':
        return this.#statsOperation(input, 'adId', 'Ad');
      case 'listAudiences':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#audiences, input) },
        };
      case 'createAudience':
        return this.#createAudience(input);
      case 'getBudget':
        return this.#getTenantRef(input, this.#budgets, 'budgetId', 'Budget', 'getBudget');
      case 'updateBudget':
        return this.#updateBudget(input);
      case 'listKeywords':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#keywords, input) },
        };
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported AdsPlatforms operation: ${String(input.operation)}.`,
        };
    }
  }

  #listCampaigns(input: AdsPlatformsExecuteInputV1): readonly CampaignV1[] {
    return this.#campaigns.filter((campaign) => campaign.tenantId === input.tenantId);
  }

  #getCampaign(input: AdsPlatformsExecuteInputV1): AdsPlatformsExecuteOutputV1 {
    const campaignId = readString(input.payload, 'campaignId');
    if (campaignId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'campaignId is required for getCampaign.',
      };
    }
    const campaign = this.#campaigns.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.campaignId === campaignId,
    );
    if (campaign === undefined) {
      return { ok: false, error: 'not_found', message: `Campaign ${campaignId} was not found.` };
    }
    return { ok: true, result: { kind: 'campaign', campaign } };
  }

  #createCampaign(input: AdsPlatformsExecuteInputV1): AdsPlatformsExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createCampaign.',
      };
    }
    const campaign: CampaignV1 = {
      campaignId: CampaignId(`campaign-${++this.#campaignSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      name,
      status: 'draft',
      ...(typeof input.payload?.['channelType'] === 'string'
        ? { channelType: input.payload['channelType'] }
        : {}),
    };
    this.#campaigns.push(campaign);
    return { ok: true, result: { kind: 'campaign', campaign } };
  }

  #updateCampaign(input: AdsPlatformsExecuteInputV1): AdsPlatformsExecuteOutputV1 {
    const campaignId = readString(input.payload, 'campaignId');
    if (campaignId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'campaignId is required for updateCampaign.',
      };
    }
    const index = this.#campaigns.findIndex(
      (candidate) => candidate.tenantId === input.tenantId && candidate.campaignId === campaignId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Campaign ${campaignId} was not found.` };
    }

    const current = this.#campaigns[index]!;
    const next: CampaignV1 = {
      ...current,
      ...(typeof input.payload?.['name'] === 'string' ? { name: input.payload['name'] } : {}),
      ...(typeof input.payload?.['channelType'] === 'string'
        ? { channelType: input.payload['channelType'] }
        : {}),
      ...(typeof input.payload?.['status'] === 'string'
        ? { status: input.payload['status'] as CampaignV1['status'] }
        : {}),
    };
    this.#campaigns[index] = next;
    return { ok: true, result: { kind: 'campaign', campaign: next } };
  }

  #pauseCampaign(input: AdsPlatformsExecuteInputV1): AdsPlatformsExecuteOutputV1 {
    const campaignId = readString(input.payload, 'campaignId');
    if (campaignId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'campaignId is required for pauseCampaign.',
      };
    }
    const index = this.#campaigns.findIndex(
      (candidate) => candidate.tenantId === input.tenantId && candidate.campaignId === campaignId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Campaign ${campaignId} was not found.` };
    }
    const paused: CampaignV1 = { ...this.#campaigns[index]!, status: 'paused' };
    this.#campaigns[index] = paused;
    return { ok: true, result: { kind: 'campaign', campaign: paused } };
  }

  #createAdGroup(input: AdsPlatformsExecuteInputV1): AdsPlatformsExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createAdGroup.',
      };
    }
    const externalRef: ExternalObjectRef = {
      sorName: 'AdsSuite',
      portFamily: 'AdsPlatforms',
      externalId: `ad-group-${++this.#adGroupSequence}`,
      externalType: 'ad_group',
      displayLabel: name,
    };
    this.#adGroups.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #createAd(input: AdsPlatformsExecuteInputV1): AdsPlatformsExecuteOutputV1 {
    const headline = readString(input.payload, 'headline');
    if (headline === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'headline is required for createAd.',
      };
    }
    const externalRef: ExternalObjectRef = {
      sorName: 'AdsSuite',
      portFamily: 'AdsPlatforms',
      externalId: `ad-${++this.#adSequence}`,
      externalType: 'ad',
      displayLabel: headline,
    };
    this.#ads.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #statsOperation(
    input: AdsPlatformsExecuteInputV1,
    key: 'campaignId' | 'adGroupId' | 'adId',
    label: 'Campaign' | 'Ad group' | 'Ad',
  ): AdsPlatformsExecuteOutputV1 {
    const ref = readString(input.payload, key);
    if (ref === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: `${key} is required for ${input.operation}.`,
      };
    }
    const period =
      typeof input.payload?.['period'] === 'string' && input.payload['period'].length > 0
        ? (input.payload['period'])
        : 'last_30_days';
    const externalRef: ExternalObjectRef = {
      sorName: 'AdsSuite',
      portFamily: 'AdsPlatforms',
      externalId: `stats-${++this.#statsSequence}`,
      externalType: 'performance_stats',
      displayLabel: `${label} stats for ${ref} (${period})`,
      deepLinkUrl: `https://ads.example/stats/${encodeURIComponent(ref)}?period=${encodeURIComponent(
        period,
      )}&at=${encodeURIComponent(this.#now().toISOString())}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #createAudience(input: AdsPlatformsExecuteInputV1): AdsPlatformsExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createAudience.',
      };
    }
    const externalRef: ExternalObjectRef = {
      sorName: 'AdsSuite',
      portFamily: 'AdsPlatforms',
      externalId: `audience-${++this.#audienceSequence}`,
      externalType: 'audience',
      displayLabel: name,
    };
    this.#audiences.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #updateBudget(input: AdsPlatformsExecuteInputV1): AdsPlatformsExecuteOutputV1 {
    const budgetId = readString(input.payload, 'budgetId');
    if (budgetId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'budgetId is required for updateBudget.',
      };
    }
    const amount = readNumber(input.payload, 'amount');
    if (amount === null || amount < 0) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'amount must be a non-negative number for updateBudget.',
      };
    }
    const index = this.#budgets.findIndex(
      (budget) => budget.tenantId === input.tenantId && budget.externalRef.externalId === budgetId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Budget ${budgetId} was not found.` };
    }
    const current = this.#budgets[index]!;
    const updatedRef: ExternalObjectRef = {
      ...current.externalRef,
      displayLabel: `Budget ${budgetId}: ${amount.toFixed(2)}`,
      deepLinkUrl: `https://ads.example/budgets/${budgetId}`,
    };
    this.#budgets[index] = { tenantId: input.tenantId, externalRef: updatedRef };
    return { ok: true, result: { kind: 'externalRef', externalRef: updatedRef } };
  }

  #listTenantRefs(
    source: readonly TenantExternalRef[],
    input: AdsPlatformsExecuteInputV1,
  ): readonly ExternalObjectRef[] {
    return source
      .filter((entry) => entry.tenantId === input.tenantId)
      .map((entry) => entry.externalRef);
  }

  #getTenantRef(
    input: AdsPlatformsExecuteInputV1,
    source: readonly TenantExternalRef[],
    key: string,
    label: string,
    operationName: string,
  ): AdsPlatformsExecuteOutputV1 {
    const externalId = readString(input.payload, key);
    if (externalId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: `${key} is required for ${operationName}.`,
      };
    }
    const found = source.find(
      (entry) =>
        entry.tenantId === input.tenantId && entry.externalRef.externalId === externalId,
    );
    if (found === undefined) {
      return { ok: false, error: 'not_found', message: `${label} ${externalId} was not found.` };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef: found.externalRef } };
  }

  public static seedMinimal(
    tenantId: AdsPlatformsExecuteInputV1['tenantId'],
  ): InMemoryAdsPlatformsAdapterSeed {
    return {
      campaigns: [
        {
          campaignId: CampaignId('campaign-1000'),
          tenantId,
          schemaVersion: 1,
          name: 'Search Launch',
          status: 'active',
          channelType: 'search',
        },
      ],
      adGroups: [
        {
          tenantId,
          externalRef: {
            sorName: 'AdsSuite',
            portFamily: 'AdsPlatforms',
            externalId: 'ad-group-1000',
            externalType: 'ad_group',
            displayLabel: 'Core Keywords',
          },
        },
      ],
      ads: [
        {
          tenantId,
          externalRef: {
            sorName: 'AdsSuite',
            portFamily: 'AdsPlatforms',
            externalId: 'ad-1000',
            externalType: 'ad',
            displayLabel: 'Portarium Workflow Ad',
          },
        },
      ],
      audiences: [
        {
          tenantId,
          externalRef: {
            sorName: 'AdsSuite',
            portFamily: 'AdsPlatforms',
            externalId: 'audience-1000',
            externalType: 'audience',
            displayLabel: 'Ops Leaders',
          },
        },
      ],
      budgets: [
        {
          tenantId,
          externalRef: {
            sorName: 'AdsSuite',
            portFamily: 'AdsPlatforms',
            externalId: 'budget-1000',
            externalType: 'budget',
            displayLabel: 'Budget budget-1000: 1000.00',
          },
        },
      ],
      keywords: [
        {
          tenantId,
          externalRef: {
            sorName: 'AdsSuite',
            portFamily: 'AdsPlatforms',
            externalId: 'keyword-1000',
            externalType: 'keyword',
            displayLabel: 'workflow automation',
          },
        },
      ],
    };
  }
}
