import { describe, expect, it, vi } from 'vitest';

import { TenantId } from '../../../../domain/primitives/index.js';
import { SalesforceCrmAdapter } from './salesforce-crm-adapter.js';
import type { SalesforceClientConfig } from './salesforce-client.js';

const TENANT = TenantId('tenant-sf-test');

const CONFIG: SalesforceClientConfig = {
  instanceUrl: 'https://test.salesforce.com',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  apiVersion: 'v58.0',
};

interface MockResponse {
  status: number;
  ok: boolean;
  body: unknown;
}

function createStubFetch(responses: MockResponse[]) {
  let callIndex = 0;
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const response = responses[callIndex] ?? responses[responses.length - 1]!;
    callIndex++;
    return {
      ok: response.ok,
      status: response.status,
      json: async () => response.body,
    } as Response;
  });
}

function tokenResponse(): MockResponse {
  return {
    status: 200,
    ok: true,
    body: {
      access_token: 'test-token-123',
      instance_url: 'https://test.salesforce.com',
      token_type: 'Bearer',
    },
  };
}

function queryResponse<T>(records: T[]): MockResponse {
  return {
    status: 200,
    ok: true,
    body: { totalSize: records.length, done: true, records },
  };
}

function recordResponse<T>(record: T): MockResponse {
  return { status: 200, ok: true, body: record };
}

function createResponse(id: string): MockResponse {
  return { status: 201, ok: true, body: { id, success: true, errors: [] } };
}

function patchResponse(): MockResponse {
  return { status: 204, ok: true, body: null };
}

function errorResponse(status: number, errorCode: string, message: string): MockResponse {
  return { status, ok: false, body: [{ errorCode, message }] };
}

describe('SalesforceCrmAdapter', () => {
  describe('listContacts', () => {
    it('queries and maps contacts', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        queryResponse([
          { Id: '003xx000001', Name: 'Alice Smith', Email: 'alice@example.com', Phone: '555-0100' },
          { Id: '003xx000002', Name: 'Bob Jones', Email: 'bob@example.com' },
        ]),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({ tenantId: TENANT, operation: 'listContacts' });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'parties') return;
      expect(result.result.parties).toHaveLength(2);
      expect(result.result.parties[0]!.displayName).toBe('Alice Smith');
      expect(result.result.parties[0]!.email).toBe('alice@example.com');
      expect(result.result.parties[0]!.roles).toEqual(['contact']);
      expect(result.result.parties[0]!.externalRefs?.[0]?.sorName).toBe('Salesforce');
    });
  });

  describe('getContact', () => {
    it('fetches a single contact by ID', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        recordResponse({ Id: '003xx000001', Name: 'Alice Smith', Email: 'alice@example.com' }),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({
        tenantId: TENANT,
        operation: 'getContact',
        payload: { partyId: '003xx000001' },
      });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'party') return;
      expect(result.result.party.partyId).toBe('003xx000001');
      expect(result.result.party.displayName).toBe('Alice Smith');
    });

    it('returns validation_error when partyId is missing', async () => {
      const stubFetch = createStubFetch([]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({
        tenantId: TENANT,
        operation: 'getContact',
        payload: {},
      });
      expect(result).toEqual({
        ok: false,
        error: 'validation_error',
        message: 'partyId is required for getContact.',
      });
    });

    it('returns not_found for 404', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        errorResponse(404, 'NOT_FOUND', 'Contact not found'),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({
        tenantId: TENANT,
        operation: 'getContact',
        payload: { partyId: '003xx999999' },
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('not_found');
    });
  });

  describe('createContact', () => {
    it('creates a contact and returns the result', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        createResponse('003xx000099'),
        recordResponse({ Id: '003xx000099', Name: 'New Contact', Email: 'new@example.com' }),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({
        tenantId: TENANT,
        operation: 'createContact',
        payload: { displayName: 'New Contact', email: 'new@example.com' },
      });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'party') return;
      expect(result.result.party.partyId).toBe('003xx000099');
    });

    it('validates displayName is required', async () => {
      const stubFetch = createStubFetch([]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({
        tenantId: TENANT,
        operation: 'createContact',
        payload: {},
      });
      expect(result).toEqual({
        ok: false,
        error: 'validation_error',
        message: 'displayName is required for createContact.',
      });
    });
  });

  describe('updateContact', () => {
    it('updates and re-fetches the contact', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        patchResponse(),
        recordResponse({ Id: '003xx000001', Name: 'Updated Name', Email: 'alice@example.com' }),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({
        tenantId: TENANT,
        operation: 'updateContact',
        payload: { partyId: '003xx000001', displayName: 'Updated Name' },
      });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'party') return;
      expect(result.result.party.displayName).toBe('Updated Name');
    });
  });

  describe('listCompanies', () => {
    it('queries and maps accounts', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        queryResponse([
          { Id: '001xx000001', Name: 'Acme Corp', Phone: '555-0001' },
        ]),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({ tenantId: TENANT, operation: 'listCompanies' });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'parties') return;
      expect(result.result.parties).toHaveLength(1);
      expect(result.result.parties[0]!.roles).toEqual(['org']);
    });
  });

  describe('getCompany', () => {
    it('fetches a single account', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        recordResponse({ Id: '001xx000001', Name: 'Acme Corp' }),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({
        tenantId: TENANT,
        operation: 'getCompany',
        payload: { partyId: '001xx000001' },
      });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'party') return;
      expect(result.result.party.displayName).toBe('Acme Corp');
    });
  });

  describe('createCompany', () => {
    it('creates an account', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        createResponse('001xx000099'),
        recordResponse({ Id: '001xx000099', Name: 'NewCo' }),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({
        tenantId: TENANT,
        operation: 'createCompany',
        payload: { displayName: 'NewCo' },
      });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'party') return;
      expect(result.result.party.partyId).toBe('001xx000099');
    });
  });

  describe('listOpportunities', () => {
    it('queries and maps opportunities', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        queryResponse([
          { Id: '006xx000001', Name: 'Big Deal', StageName: 'Proposal', Amount: 50000 },
        ]),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({ tenantId: TENANT, operation: 'listOpportunities' });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'opportunities') return;
      expect(result.result.opportunities).toHaveLength(1);
      expect(result.result.opportunities[0]!.stage).toBe('Proposal');
      expect(result.result.opportunities[0]!.amount).toBe(50000);
    });
  });

  describe('getOpportunity', () => {
    it('fetches a single opportunity', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        recordResponse({
          Id: '006xx000001',
          Name: 'Big Deal',
          StageName: 'Closed Won',
          Amount: 50000,
        }),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({
        tenantId: TENANT,
        operation: 'getOpportunity',
        payload: { opportunityId: '006xx000001' },
      });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'opportunity') return;
      expect(result.result.opportunity.name).toBe('Big Deal');
    });
  });

  describe('createOpportunity', () => {
    it('creates an opportunity', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        createResponse('006xx000099'),
        recordResponse({
          Id: '006xx000099',
          Name: 'New Opp',
          StageName: 'Qualification',
          Amount: 10000,
        }),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({
        tenantId: TENANT,
        operation: 'createOpportunity',
        payload: { name: 'New Opp', stage: 'Qualification', amount: 10000 },
      });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'opportunity') return;
      expect(result.result.opportunity.opportunityId).toBe('006xx000099');
    });
  });

  describe('updateOpportunityStage', () => {
    it('updates stage and returns updated opportunity', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        patchResponse(),
        recordResponse({
          Id: '006xx000001',
          Name: 'Big Deal',
          StageName: 'Closed Won',
        }),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({
        tenantId: TENANT,
        operation: 'updateOpportunityStage',
        payload: { opportunityId: '006xx000001', stage: 'Closed Won' },
      });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'opportunity') return;
      expect(result.result.opportunity.stage).toBe('Closed Won');
    });

    it('validates required fields', async () => {
      const stubFetch = createStubFetch([]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const noOppId = await adapter.execute({
        tenantId: TENANT,
        operation: 'updateOpportunityStage',
        payload: { stage: 'Closed Won' },
      });
      expect(noOppId).toEqual({
        ok: false,
        error: 'validation_error',
        message: 'opportunityId is required for updateOpportunityStage.',
      });

      const noStage = await adapter.execute({
        tenantId: TENANT,
        operation: 'updateOpportunityStage',
        payload: { opportunityId: '006xx000001' },
      });
      expect(noStage).toEqual({
        ok: false,
        error: 'validation_error',
        message: 'stage is required for updateOpportunityStage.',
      });
    });
  });

  describe('listPipelines', () => {
    it('queries OpportunityStage and maps to externalRefs', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        queryResponse([
          { ApiName: 'Prospecting', Label: 'Prospecting', MasterLabel: 'Prospecting' },
          { ApiName: 'Closed_Won', Label: 'Closed Won', MasterLabel: 'Closed Won' },
        ]),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({ tenantId: TENANT, operation: 'listPipelines' });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'externalRefs') return;
      expect(result.result.externalRefs).toHaveLength(2);
      expect(result.result.externalRefs[0]!.externalType).toBe('OpportunityStage');
    });
  });

  describe('listActivities', () => {
    it('queries and maps tasks', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        queryResponse([
          { Id: '00Txx000001', Subject: 'Follow up call', Status: 'Not Started' },
        ]),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({ tenantId: TENANT, operation: 'listActivities' });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'tasks') return;
      expect(result.result.tasks).toHaveLength(1);
      expect(result.result.tasks[0]!.status).toBe('todo');
    });
  });

  describe('createActivity', () => {
    it('creates a task', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        createResponse('00Txx000099'),
        recordResponse({ Id: '00Txx000099', Subject: 'New Task', Status: 'In Progress' }),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({
        tenantId: TENANT,
        operation: 'createActivity',
        payload: { title: 'New Task', status: 'in_progress' },
      });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'task') return;
      expect(result.result.task.status).toBe('in_progress');
    });
  });

  describe('listNotes', () => {
    it('queries and maps content notes', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        queryResponse([
          {
            Id: '069xx000001',
            Title: 'Meeting Notes',
            FileType: 'SNOTE',
            ContentSize: 1024,
            CreatedDate: '2026-01-15T10:30:00.000Z',
          },
        ]),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({ tenantId: TENANT, operation: 'listNotes' });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'documents') return;
      expect(result.result.documents).toHaveLength(1);
      expect(result.result.documents[0]!.mimeType).toBe('text/html');
    });
  });

  describe('createNote', () => {
    it('creates a content note', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        createResponse('069xx000099'),
        recordResponse({
          Id: '069xx000099',
          Title: 'New Note',
          FileType: 'SNOTE',
          ContentSize: 256,
          CreatedDate: '2026-03-30T12:00:00.000Z',
        }),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({
        tenantId: TENANT,
        operation: 'createNote',
        payload: { title: 'New Note', content: 'Hello world' },
      });
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'document') return;
      expect(result.result.document.title).toBe('New Note');
    });
  });

  describe('unsupported operations', () => {
    it('rejects unknown operations', async () => {
      const stubFetch = createStubFetch([]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({
        tenantId: TENANT,
        operation: 'bogusOp' as unknown as 'listContacts',
      });
      expect(result).toEqual({
        ok: false,
        error: 'unsupported_operation',
        message: 'Unsupported CrmSales operation: bogusOp.',
      });
    });
  });

  describe('error handling', () => {
    it('maps validation errors from Salesforce', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        errorResponse(400, 'REQUIRED_FIELD_MISSING', 'Required field LastName is missing'),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({
        tenantId: TENANT,
        operation: 'createContact',
        payload: { displayName: 'Test' },
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
    });

    it('maps auth errors', async () => {
      const stubFetch = createStubFetch([
        { status: 401, ok: false, body: { error: 'invalid_client' } },
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      const result = await adapter.execute({ tenantId: TENANT, operation: 'listContacts' });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('provider_error');
    });
  });

  describe('createStub', () => {
    it('returns a working in-memory adapter', async () => {
      const stub = SalesforceCrmAdapter.createStub();
      const result = await stub.execute({ tenantId: TENANT, operation: 'listContacts' });
      expect(result.ok).toBe(true);
    });
  });

  describe('OAuth token caching', () => {
    it('reuses token across calls', async () => {
      const stubFetch = createStubFetch([
        tokenResponse(),
        queryResponse([{ Id: '003xx1', Name: 'A' }]),
        // Second call should reuse token, not call auth again
        queryResponse([{ Id: '001xx1', Name: 'B Corp' }]),
      ]);
      const adapter = new SalesforceCrmAdapter(CONFIG, { fetch: stubFetch });

      await adapter.execute({ tenantId: TENANT, operation: 'listContacts' });
      await adapter.execute({ tenantId: TENANT, operation: 'listCompanies' });

      // 1 token call + 2 API calls = 3 total
      expect(stubFetch).toHaveBeenCalledTimes(3);
    });
  });
});
