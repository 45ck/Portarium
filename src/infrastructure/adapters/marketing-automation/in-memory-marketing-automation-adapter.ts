import type { CampaignV1 } from '../../../domain/canonical/campaign-v1.js';
import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../../domain/canonical/party-v1.js';
import { CampaignId, PartyId } from '../../../domain/primitives/index.js';
import type {
  MarketingAutomationAdapterPort,
  MarketingAutomationExecuteInputV1,
  MarketingAutomationExecuteOutputV1,
} from '../../../application/ports/marketing-automation-adapter.js';
import { MARKETING_AUTOMATION_OPERATIONS_V1 } from '../../../application/ports/marketing-automation-adapter.js';

const OPERATION_SET = new Set<string>(MARKETING_AUTOMATION_OPERATIONS_V1);

type TenantExternalRef = Readonly<{
  tenantId: MarketingAutomationExecuteInputV1['tenantId'];
  externalRef: ExternalObjectRef;
}>;

type CampaignStatsEntry = Readonly<{
  tenantId: MarketingAutomationExecuteInputV1['tenantId'];
  campaignId: string;
  externalRef: ExternalObjectRef;
}>;

type FormSubmissionEntry = Readonly<{
  tenantId: MarketingAutomationExecuteInputV1['tenantId'];
  formId: string;
  externalRef: ExternalObjectRef;
}>;

type ListMembershipEntry = Readonly<{
  tenantId: MarketingAutomationExecuteInputV1['tenantId'];
  listId: string;
  contactId: string;
}>;

type InMemoryMarketingAutomationAdapterSeed = Readonly<{
  contacts?: readonly PartyV1[];
  lists?: readonly TenantExternalRef[];
  campaigns?: readonly CampaignV1[];
  campaignStats?: readonly CampaignStatsEntry[];
  automations?: readonly TenantExternalRef[];
  forms?: readonly TenantExternalRef[];
  formSubmissions?: readonly FormSubmissionEntry[];
  listMemberships?: readonly ListMembershipEntry[];
}>;

type InMemoryMarketingAutomationAdapterParams = Readonly<{
  seed?: InMemoryMarketingAutomationAdapterSeed;
  now?: () => Date;
}>;

function readString(payload: Readonly<Record<string, unknown>> | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export class InMemoryMarketingAutomationAdapter implements MarketingAutomationAdapterPort {
  readonly #now: () => Date;
  readonly #contacts: PartyV1[];
  readonly #lists: TenantExternalRef[];
  readonly #campaigns: CampaignV1[];
  readonly #campaignStats: CampaignStatsEntry[];
  readonly #automations: TenantExternalRef[];
  readonly #forms: TenantExternalRef[];
  readonly #formSubmissions: FormSubmissionEntry[];
  readonly #listMemberships: ListMembershipEntry[];
  #contactSequence: number;
  #campaignSequence: number;
  #statsSequence: number;
  #triggerSequence: number;

  public constructor(params?: InMemoryMarketingAutomationAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#contacts = [...(params?.seed?.contacts ?? [])];
    this.#lists = [...(params?.seed?.lists ?? [])];
    this.#campaigns = [...(params?.seed?.campaigns ?? [])];
    this.#campaignStats = [...(params?.seed?.campaignStats ?? [])];
    this.#automations = [...(params?.seed?.automations ?? [])];
    this.#forms = [...(params?.seed?.forms ?? [])];
    this.#formSubmissions = [...(params?.seed?.formSubmissions ?? [])];
    this.#listMemberships = [...(params?.seed?.listMemberships ?? [])];
    this.#contactSequence = this.#contacts.length;
    this.#campaignSequence = this.#campaigns.length;
    this.#statsSequence = this.#campaignStats.length;
    this.#triggerSequence = 0;
  }

  public async execute(
    input: MarketingAutomationExecuteInputV1,
  ): Promise<MarketingAutomationExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported MarketingAutomation operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'listContacts':
        return { ok: true, result: { kind: 'parties', parties: this.#listContacts(input) } };
      case 'getContact':
        return this.#getContact(input);
      case 'createContact':
        return this.#createContact(input);
      case 'updateContact':
        return this.#updateContact(input);
      case 'listLists':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#lists, input) },
        };
      case 'getList':
        return this.#getList(input);
      case 'addContactToList':
        return this.#addContactToList(input);
      case 'removeContactFromList':
        return this.#removeContactFromList(input);
      case 'listCampaigns':
        return { ok: true, result: { kind: 'campaigns', campaigns: this.#listCampaigns(input) } };
      case 'getCampaign':
        return this.#getCampaign(input);
      case 'createCampaign':
        return this.#createCampaign(input);
      case 'sendCampaign':
        return this.#sendCampaign(input);
      case 'getCampaignStats':
        return this.#getCampaignStats(input);
      case 'listAutomations':
        return {
          ok: true,
          result: {
            kind: 'externalRefs',
            externalRefs: this.#listTenantRefs(this.#automations, input),
          },
        };
      case 'getAutomation':
        return this.#getAutomation(input);
      case 'triggerAutomation':
        return this.#triggerAutomation(input);
      case 'listForms':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#forms, input) },
        };
      case 'getFormSubmissions':
        return this.#getFormSubmissions(input);
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported MarketingAutomation operation: ${String(input.operation)}.`,
        };
    }
  }

  #listContacts(input: MarketingAutomationExecuteInputV1): readonly PartyV1[] {
    return this.#contacts.filter((contact) => contact.tenantId === input.tenantId);
  }

  #getContact(input: MarketingAutomationExecuteInputV1): MarketingAutomationExecuteOutputV1 {
    const contactId = readString(input.payload, 'contactId');
    if (contactId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'contactId is required for getContact.',
      };
    }
    const contact = this.#contacts.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.partyId === contactId,
    );
    if (contact === undefined) {
      return { ok: false, error: 'not_found', message: `Contact ${contactId} was not found.` };
    }
    return { ok: true, result: { kind: 'party', party: contact } };
  }

  #createContact(input: MarketingAutomationExecuteInputV1): MarketingAutomationExecuteOutputV1 {
    const displayName = readString(input.payload, 'displayName');
    if (displayName === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'displayName is required for createContact.',
      };
    }

    const contact: PartyV1 = {
      partyId: PartyId(`contact-${++this.#contactSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      displayName,
      roles: ['lead'],
      ...(typeof input.payload?.['email'] === 'string' ? { email: input.payload['email'] } : {}),
      ...(typeof input.payload?.['phone'] === 'string' ? { phone: input.payload['phone'] } : {}),
    };
    this.#contacts.push(contact);
    return { ok: true, result: { kind: 'party', party: contact } };
  }

  #updateContact(input: MarketingAutomationExecuteInputV1): MarketingAutomationExecuteOutputV1 {
    const contactId = readString(input.payload, 'contactId');
    if (contactId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'contactId is required for updateContact.',
      };
    }
    const index = this.#contacts.findIndex(
      (candidate) => candidate.tenantId === input.tenantId && candidate.partyId === contactId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Contact ${contactId} was not found.` };
    }

    const current = this.#contacts[index]!;
    const next: PartyV1 = {
      ...current,
      ...(typeof input.payload?.['displayName'] === 'string'
        ? { displayName: input.payload['displayName'] }
        : {}),
      ...(typeof input.payload?.['email'] === 'string' ? { email: input.payload['email'] } : {}),
      ...(typeof input.payload?.['phone'] === 'string' ? { phone: input.payload['phone'] } : {}),
    };
    this.#contacts[index] = next;
    return { ok: true, result: { kind: 'party', party: next } };
  }

  #getList(input: MarketingAutomationExecuteInputV1): MarketingAutomationExecuteOutputV1 {
    return this.#getTenantRef(input, this.#lists, 'listId', 'List', 'getList');
  }

  #addContactToList(input: MarketingAutomationExecuteInputV1): MarketingAutomationExecuteOutputV1 {
    const contactId = readString(input.payload, 'contactId');
    if (contactId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'contactId is required for addContactToList.',
      };
    }
    const listId = readString(input.payload, 'listId');
    if (listId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'listId is required for addContactToList.',
      };
    }

    const contact = this.#contacts.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.partyId === contactId,
    );
    if (contact === undefined) {
      return { ok: false, error: 'not_found', message: `Contact ${contactId} was not found.` };
    }
    const list = this.#lists.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.externalRef.externalId === listId,
    );
    if (list === undefined) {
      return { ok: false, error: 'not_found', message: `List ${listId} was not found.` };
    }

    const exists = this.#listMemberships.some(
      (membership) =>
        membership.tenantId === input.tenantId &&
        membership.listId === listId &&
        membership.contactId === contactId,
    );
    if (!exists) {
      this.#listMemberships.push({ tenantId: input.tenantId, listId, contactId });
    }
    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  #removeContactFromList(input: MarketingAutomationExecuteInputV1): MarketingAutomationExecuteOutputV1 {
    const contactId = readString(input.payload, 'contactId');
    if (contactId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'contactId is required for removeContactFromList.',
      };
    }
    const listId = readString(input.payload, 'listId');
    if (listId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'listId is required for removeContactFromList.',
      };
    }

    const index = this.#listMemberships.findIndex(
      (membership) =>
        membership.tenantId === input.tenantId &&
        membership.listId === listId &&
        membership.contactId === contactId,
    );
    if (index < 0) {
      return {
        ok: false,
        error: 'not_found',
        message: `List membership for contact ${contactId} and list ${listId} was not found.`,
      };
    }
    this.#listMemberships.splice(index, 1);
    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  #listCampaigns(input: MarketingAutomationExecuteInputV1): readonly CampaignV1[] {
    return this.#campaigns.filter((campaign) => campaign.tenantId === input.tenantId);
  }

  #getCampaign(input: MarketingAutomationExecuteInputV1): MarketingAutomationExecuteOutputV1 {
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

  #createCampaign(input: MarketingAutomationExecuteInputV1): MarketingAutomationExecuteOutputV1 {
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

  #sendCampaign(input: MarketingAutomationExecuteInputV1): MarketingAutomationExecuteOutputV1 {
    const campaignId = readString(input.payload, 'campaignId');
    if (campaignId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'campaignId is required for sendCampaign.',
      };
    }
    const index = this.#campaigns.findIndex(
      (candidate) => candidate.tenantId === input.tenantId && candidate.campaignId === campaignId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Campaign ${campaignId} was not found.` };
    }

    const updated: CampaignV1 = { ...this.#campaigns[index]!, status: 'active' };
    this.#campaigns[index] = updated;
    return { ok: true, result: { kind: 'campaign', campaign: updated } };
  }

  #getCampaignStats(input: MarketingAutomationExecuteInputV1): MarketingAutomationExecuteOutputV1 {
    const campaignId = readString(input.payload, 'campaignId');
    if (campaignId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'campaignId is required for getCampaignStats.',
      };
    }
    const campaign = this.#campaigns.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.campaignId === campaignId,
    );
    if (campaign === undefined) {
      return { ok: false, error: 'not_found', message: `Campaign ${campaignId} was not found.` };
    }

    const existing = this.#campaignStats.find(
      (entry) => entry.tenantId === input.tenantId && entry.campaignId === campaignId,
    );
    if (existing !== undefined) {
      return { ok: true, result: { kind: 'externalRef', externalRef: existing.externalRef } };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'MarketingSuite',
      portFamily: 'MarketingAutomation',
      externalId: `campaign-stats-${++this.#statsSequence}`,
      externalType: 'campaign_stats',
      displayLabel: `Campaign stats for ${campaign.name}`,
      deepLinkUrl: `https://marketing.example/campaigns/${campaignId}/stats`,
    };
    this.#campaignStats.push({ tenantId: input.tenantId, campaignId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #getAutomation(input: MarketingAutomationExecuteInputV1): MarketingAutomationExecuteOutputV1 {
    return this.#getTenantRef(input, this.#automations, 'automationId', 'Automation', 'getAutomation');
  }

  #triggerAutomation(input: MarketingAutomationExecuteInputV1): MarketingAutomationExecuteOutputV1 {
    const automationId = readString(input.payload, 'automationId');
    if (automationId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'automationId is required for triggerAutomation.',
      };
    }
    const automation = this.#automations.find(
      (candidate) =>
        candidate.tenantId === input.tenantId && candidate.externalRef.externalId === automationId,
    );
    if (automation === undefined) {
      return { ok: false, error: 'not_found', message: `Automation ${automationId} was not found.` };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'MarketingSuite',
      portFamily: 'MarketingAutomation',
      externalId: `automation-run-${++this.#triggerSequence}`,
      externalType: 'automation_run',
      displayLabel: `Automation trigger for ${automation.externalRef.displayLabel ?? automationId}`,
      deepLinkUrl: `https://marketing.example/automations/${automationId}/runs/${this.#triggerSequence}?at=${encodeURIComponent(
        this.#now().toISOString(),
      )}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #getFormSubmissions(input: MarketingAutomationExecuteInputV1): MarketingAutomationExecuteOutputV1 {
    const formId = readString(input.payload, 'formId');
    if (formId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'formId is required for getFormSubmissions.',
      };
    }
    const form = this.#forms.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.externalRef.externalId === formId,
    );
    if (form === undefined) {
      return { ok: false, error: 'not_found', message: `Form ${formId} was not found.` };
    }
    void form;

    return {
      ok: true,
      result: {
        kind: 'externalRefs',
        externalRefs: this.#formSubmissions
          .filter((entry) => entry.tenantId === input.tenantId && entry.formId === formId)
          .map((entry) => entry.externalRef),
      },
    };
  }

  #listTenantRefs(
    source: readonly TenantExternalRef[],
    input: MarketingAutomationExecuteInputV1,
  ): readonly ExternalObjectRef[] {
    return source
      .filter((entry) => entry.tenantId === input.tenantId)
      .map((entry) => entry.externalRef);
  }

  #getTenantRef(
    input: MarketingAutomationExecuteInputV1,
    source: readonly TenantExternalRef[],
    key: string,
    label: string,
    operationName: string,
  ): MarketingAutomationExecuteOutputV1 {
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
    tenantId: MarketingAutomationExecuteInputV1['tenantId'],
  ): InMemoryMarketingAutomationAdapterSeed {
    return {
      contacts: [
        {
          partyId: PartyId('contact-1000'),
          tenantId,
          schemaVersion: 1,
          displayName: 'Default Lead',
          email: 'lead@example.com',
          roles: ['lead'],
        },
      ],
      lists: [
        {
          tenantId,
          externalRef: {
            sorName: 'MarketingSuite',
            portFamily: 'MarketingAutomation',
            externalId: 'list-1000',
            externalType: 'audience_list',
            displayLabel: 'Default Audience',
          },
        },
      ],
      campaigns: [
        {
          campaignId: CampaignId('campaign-1000'),
          tenantId,
          schemaVersion: 1,
          name: 'Launch Nurture',
          status: 'draft',
          channelType: 'email',
        },
      ],
      campaignStats: [
        {
          tenantId,
          campaignId: 'campaign-1000',
          externalRef: {
            sorName: 'MarketingSuite',
            portFamily: 'MarketingAutomation',
            externalId: 'campaign-stats-1000',
            externalType: 'campaign_stats',
            displayLabel: 'Launch Nurture stats',
          },
        },
      ],
      automations: [
        {
          tenantId,
          externalRef: {
            sorName: 'MarketingSuite',
            portFamily: 'MarketingAutomation',
            externalId: 'automation-1000',
            externalType: 'automation',
            displayLabel: 'Lead Welcome Flow',
          },
        },
      ],
      forms: [
        {
          tenantId,
          externalRef: {
            sorName: 'MarketingSuite',
            portFamily: 'MarketingAutomation',
            externalId: 'form-1000',
            externalType: 'form',
            displayLabel: 'Newsletter Sign-up',
          },
        },
      ],
      formSubmissions: [
        {
          tenantId,
          formId: 'form-1000',
          externalRef: {
            sorName: 'MarketingSuite',
            portFamily: 'MarketingAutomation',
            externalId: 'submission-1000',
            externalType: 'form_submission',
            displayLabel: 'Submission #1000',
          },
        },
      ],
      listMemberships: [
        {
          tenantId,
          listId: 'list-1000',
          contactId: 'contact-1000',
        },
      ],
    };
  }
}
