import type {
  CrmSalesAdapterPort,
  CrmSalesExecuteInputV1,
  CrmSalesExecuteOutputV1,
} from '../../../../application/ports/crm-sales-adapter.js';
import { CRM_SALES_OPERATIONS_V1 } from '../../../../application/ports/crm-sales-adapter.js';
import { InMemoryCrmSalesAdapter } from '../in-memory-crm-sales-adapter.js';
import {
  SalesforceApiError,
  SalesforceAuthError,
  SalesforceClient,
  type SalesforceClientConfig,
  type SalesforceClientDeps,
} from './salesforce-client.js';
import {
  mapAccount,
  mapContact,
  mapContentNote,
  mapOpportunity,
  mapTask,
  toSalesforceAccountPayload,
  toSalesforceContactPayload,
  toSalesforceOpportunityPayload,
  toSalesforceTaskPayload,
  type SalesforceAccount,
  type SalesforceContact,
  type SalesforceContentNote,
  type SalesforceOpportunity,
  type SalesforceTask,
} from './salesforce-field-mapper.js';

const OPERATION_SET = new Set<string>(CRM_SALES_OPERATIONS_V1);

function readString(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export class SalesforceCrmAdapter implements CrmSalesAdapterPort {
  readonly #client: SalesforceClient;

  public constructor(config: SalesforceClientConfig, deps?: SalesforceClientDeps) {
    this.#client = new SalesforceClient(config, deps);
  }

  public static createStub(): CrmSalesAdapterPort {
    return new InMemoryCrmSalesAdapter();
  }

  public async execute(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported CrmSales operation: ${String(input.operation)}.`,
      };
    }

    try {
      return await this.#dispatch(input);
    } catch (error: unknown) {
      if (error instanceof SalesforceApiError) {
        return { ok: false, error: error.errorType, message: error.message };
      }
      if (error instanceof SalesforceAuthError) {
        return { ok: false, error: 'provider_error', message: error.message };
      }
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { ok: false, error: 'provider_error', message: msg };
    }
  }

  async #dispatch(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    switch (input.operation) {
      case 'listContacts':
        return this.#listContacts(input);
      case 'getContact':
        return this.#getContact(input);
      case 'createContact':
        return this.#createContact(input);
      case 'updateContact':
        return this.#updateContact(input);
      case 'listCompanies':
        return this.#listCompanies(input);
      case 'getCompany':
        return this.#getCompany(input);
      case 'createCompany':
        return this.#createCompany(input);
      case 'listOpportunities':
        return this.#listOpportunities(input);
      case 'getOpportunity':
        return this.#getOpportunity(input);
      case 'createOpportunity':
        return this.#createOpportunity(input);
      case 'updateOpportunityStage':
        return this.#updateOpportunityStage(input);
      case 'listPipelines':
        return this.#listPipelines(input);
      case 'listActivities':
        return this.#listActivities(input);
      case 'createActivity':
        return this.#createActivity(input);
      case 'listNotes':
        return this.#listNotes(input);
      case 'createNote':
        return this.#createNote(input);
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported CrmSales operation: ${String(input.operation)}.`,
        };
    }
  }

  async #listContacts(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    const records = await this.#client.query<SalesforceContact>(
      'SELECT Id, Name, FirstName, LastName, Email, Phone, AccountId FROM Contact LIMIT 200',
    );
    return {
      ok: true,
      result: { kind: 'parties', parties: records.map((r) => mapContact(input.tenantId, r)) },
    };
  }

  async #getContact(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    const partyId = readString(input.payload, 'partyId');
    if (partyId === null) {
      return { ok: false, error: 'validation_error', message: 'partyId is required for getContact.' };
    }
    const record = await this.#client.getRecord<SalesforceContact>('Contact', partyId, [
      'Id', 'Name', 'FirstName', 'LastName', 'Email', 'Phone', 'AccountId',
    ]);
    return { ok: true, result: { kind: 'party', party: mapContact(input.tenantId, record) } };
  }

  async #createContact(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    const displayName = readString(input.payload, 'displayName');
    if (displayName === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'displayName is required for createContact.',
      };
    }
    const sfPayload = toSalesforceContactPayload(input.payload ?? {});
    const id = await this.#client.createRecord('Contact', sfPayload);
    const record = await this.#client.getRecord<SalesforceContact>('Contact', id, [
      'Id', 'Name', 'FirstName', 'LastName', 'Email', 'Phone', 'AccountId',
    ]);
    return { ok: true, result: { kind: 'party', party: mapContact(input.tenantId, record) } };
  }

  async #updateContact(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    const partyId = readString(input.payload, 'partyId');
    if (partyId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'partyId is required for updateContact.',
      };
    }
    const sfPayload = toSalesforceContactPayload(input.payload ?? {});
    await this.#client.updateRecord('Contact', partyId, sfPayload);
    const record = await this.#client.getRecord<SalesforceContact>('Contact', partyId, [
      'Id', 'Name', 'FirstName', 'LastName', 'Email', 'Phone', 'AccountId',
    ]);
    return { ok: true, result: { kind: 'party', party: mapContact(input.tenantId, record) } };
  }

  async #listCompanies(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    const records = await this.#client.query<SalesforceAccount>(
      'SELECT Id, Name, Phone, Website FROM Account LIMIT 200',
    );
    return {
      ok: true,
      result: { kind: 'parties', parties: records.map((r) => mapAccount(input.tenantId, r)) },
    };
  }

  async #getCompany(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    const partyId = readString(input.payload, 'partyId');
    if (partyId === null) {
      return { ok: false, error: 'validation_error', message: 'partyId is required for getCompany.' };
    }
    const record = await this.#client.getRecord<SalesforceAccount>('Account', partyId, [
      'Id', 'Name', 'Phone', 'Website',
    ]);
    return { ok: true, result: { kind: 'party', party: mapAccount(input.tenantId, record) } };
  }

  async #createCompany(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    const displayName = readString(input.payload, 'displayName');
    if (displayName === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'displayName is required for createCompany.',
      };
    }
    const sfPayload = toSalesforceAccountPayload(input.payload ?? {});
    const id = await this.#client.createRecord('Account', sfPayload);
    const record = await this.#client.getRecord<SalesforceAccount>('Account', id, [
      'Id', 'Name', 'Phone', 'Website',
    ]);
    return { ok: true, result: { kind: 'party', party: mapAccount(input.tenantId, record) } };
  }

  async #listOpportunities(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    const records = await this.#client.query<SalesforceOpportunity>(
      'SELECT Id, Name, StageName, Amount, CloseDate, Probability, AccountId FROM Opportunity LIMIT 200',
    );
    return {
      ok: true,
      result: {
        kind: 'opportunities',
        opportunities: records.map((r) => mapOpportunity(input.tenantId, r)),
      },
    };
  }

  async #getOpportunity(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    const opportunityId = readString(input.payload, 'opportunityId');
    if (opportunityId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'opportunityId is required for getOpportunity.',
      };
    }
    const record = await this.#client.getRecord<SalesforceOpportunity>(
      'Opportunity',
      opportunityId,
      ['Id', 'Name', 'StageName', 'Amount', 'CloseDate', 'Probability', 'AccountId'],
    );
    return {
      ok: true,
      result: { kind: 'opportunity', opportunity: mapOpportunity(input.tenantId, record) },
    };
  }

  async #createOpportunity(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createOpportunity.',
      };
    }
    const sfPayload = toSalesforceOpportunityPayload(input.payload ?? {});
    const id = await this.#client.createRecord('Opportunity', sfPayload);
    const record = await this.#client.getRecord<SalesforceOpportunity>('Opportunity', id, [
      'Id', 'Name', 'StageName', 'Amount', 'CloseDate', 'Probability', 'AccountId',
    ]);
    return {
      ok: true,
      result: { kind: 'opportunity', opportunity: mapOpportunity(input.tenantId, record) },
    };
  }

  async #updateOpportunityStage(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    const opportunityId = readString(input.payload, 'opportunityId');
    if (opportunityId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'opportunityId is required for updateOpportunityStage.',
      };
    }
    const stage = readString(input.payload, 'stage');
    if (stage === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'stage is required for updateOpportunityStage.',
      };
    }
    await this.#client.updateRecord('Opportunity', opportunityId, { StageName: stage });
    const record = await this.#client.getRecord<SalesforceOpportunity>(
      'Opportunity',
      opportunityId,
      ['Id', 'Name', 'StageName', 'Amount', 'CloseDate', 'Probability', 'AccountId'],
    );
    return {
      ok: true,
      result: { kind: 'opportunity', opportunity: mapOpportunity(input.tenantId, record) },
    };
  }

  async #listPipelines(_input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    // Salesforce doesn't have a native Pipeline object; return stage picklist values as externalRefs
    const records = await this.#client.query<{ ApiName: string; Label: string; MasterLabel: string }>(
      "SELECT ApiName, Label, MasterLabel FROM OpportunityStage WHERE IsActive = true",
    );
    return {
      ok: true,
      result: {
        kind: 'externalRefs',
        externalRefs: records.map((r) => ({
          sorName: 'Salesforce',
          portFamily: 'CrmSales' as const,
          externalId: r.ApiName,
          externalType: 'OpportunityStage',
          displayLabel: r.MasterLabel ?? r.Label,
        })),
      },
    };
  }

  async #listActivities(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    const records = await this.#client.query<SalesforceTask>(
      'SELECT Id, Subject, Status, OwnerId, ActivityDate FROM Task LIMIT 200',
    );
    return {
      ok: true,
      result: { kind: 'tasks', tasks: records.map((r) => mapTask(input.tenantId, r)) },
    };
  }

  async #createActivity(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    const title = readString(input.payload, 'title');
    if (title === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'title is required for createActivity.',
      };
    }
    const sfPayload = toSalesforceTaskPayload(input.payload ?? {});
    const id = await this.#client.createRecord('Task', sfPayload);
    const record = await this.#client.getRecord<SalesforceTask>('Task', id, [
      'Id', 'Subject', 'Status', 'OwnerId', 'ActivityDate',
    ]);
    return { ok: true, result: { kind: 'task', task: mapTask(input.tenantId, record) } };
  }

  async #listNotes(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    const records = await this.#client.query<SalesforceContentNote>(
      'SELECT Id, Title, FileType, ContentSize, CreatedDate FROM ContentNote LIMIT 200',
    );
    return {
      ok: true,
      result: {
        kind: 'documents',
        documents: records.map((r) => mapContentNote(input.tenantId, r)),
      },
    };
  }

  async #createNote(input: CrmSalesExecuteInputV1): Promise<CrmSalesExecuteOutputV1> {
    const title = readString(input.payload, 'title');
    if (title === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'title is required for createNote.',
      };
    }
    const content = typeof input.payload?.['content'] === 'string'
      ? input.payload['content']
      : '';
    const base64Content = Buffer.from(content).toString('base64');
    const id = await this.#client.createRecord('ContentNote', {
      Title: title,
      Content: base64Content,
    });
    const record = await this.#client.getRecord<SalesforceContentNote>('ContentNote', id, [
      'Id', 'Title', 'FileType', 'ContentSize', 'CreatedDate',
    ]);
    return {
      ok: true,
      result: { kind: 'document', document: mapContentNote(input.tenantId, record) },
    };
  }
}
