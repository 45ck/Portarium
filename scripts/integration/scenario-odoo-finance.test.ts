/**
 * Scenario: Odoo FinanceAccounting run-path verification with seeded-data assertions.
 *
 * This scenario exercises the full finance-accounting adapter path through a
 * Portarium run step, using a deterministic JSON-RPC stub as the Odoo backend.
 * Seeded data fixtures simulate a pre-provisioned Odoo instance.
 *
 * Delta beyond existing Odoo adapter unit tests (bead-0422/0735):
 * - Adapter unit tests verify individual operations against mock fetch in isolation.
 * - This scenario wires the adapter through a run-step abstraction with evidence
 *   logging, verifying:
 *   1. FinanceAccounting operations execute via run step (not direct adapter call).
 *   2. Seeded business data expectations flow through run outputs/evidence.
 *   3. Evidence includes adapter action metadata, result summary, and correlation.
 *   4. Diagnostics detect Odoo connectivity and credential issues early.
 *   5. JSON-RPC transport negotiation and error mapping work end-to-end.
 *
 * Bead: bead-0845
 */

import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import {
  OdooFinanceAccountingAdapter,
  type OdooAdapterConfig,
} from '../../src/infrastructure/adapters/finance-accounting/odoo-finance-accounting-adapter.js';
import type {
  FinanceAccountingExecuteInputV1,
  FinanceAccountingExecuteOutputV1,
} from '../../src/application/ports/finance-accounting-adapter.js';
import type { EvidenceLogPort } from '../../src/application/ports/evidence-log.js';
import type {
  AdapterId,
  CorrelationId,
  EvidenceId,
  HashSha256,
  RunId,
  TenantId,
  WorkspaceId,
} from '../../src/domain/primitives/index.js';

// ---------------------------------------------------------------------------
// Seeded data fixtures (simulating a pre-provisioned Odoo instance)
// ---------------------------------------------------------------------------

const SEEDED_ACCOUNTS = [
  {
    id: 1,
    name: 'Cash',
    code: '101000',
    account_type: 'asset_cash',
    currency_id: [1, 'USD'],
    active: true,
  },
  {
    id: 2,
    name: 'Accounts Receivable',
    code: '120000',
    account_type: 'asset_receivable',
    currency_id: [1, 'USD'],
    active: true,
  },
  {
    id: 3,
    name: 'Revenue',
    code: '400000',
    account_type: 'income',
    currency_id: [2, 'EUR'],
    active: true,
  },
];

const SEEDED_INVOICES = [
  {
    id: 10,
    name: 'INV/2026/0001',
    state: 'posted',
    payment_state: 'paid',
    currency_id: [1, 'USD'],
    amount_total: 2500.0,
    invoice_date: '2026-01-15',
    invoice_date_due: '2026-02-15',
  },
  {
    id: 11,
    name: 'INV/2026/0002',
    state: 'draft',
    payment_state: 'not_paid',
    currency_id: [2, 'EUR'],
    amount_total: 750.0,
    invoice_date: '2026-02-01',
    invoice_date_due: null,
  },
];

const SEEDED_VENDORS = [
  { id: 20, name: 'Acme Industrial Parts', email: 'billing@acme-parts.com', phone: '+1-555-0110' },
  { id: 21, name: 'Beta Logistics GmbH', email: 'invoices@beta-logistics.de', phone: null },
];

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-scenario-odoo' as TenantId;
const WORKSPACE_ID = 'ws-scenario-odoo' as WorkspaceId;
const RUN_ID = 'run-odoo-finance-001' as RunId;
const CORRELATION_ID = 'corr-odoo-finance-001' as CorrelationId;
const ADAPTER_ID = 'odoo-finance-v1' as AdapterId;

// ---------------------------------------------------------------------------
// Stub Odoo JSON-RPC server
// ---------------------------------------------------------------------------

type CapturedRpcCall = Readonly<{
  url: string;
  method: string;
  model: string | undefined;
  rpcMethod: string | undefined;
  domain: unknown[] | undefined;
  fields: string[];
}>;

async function startStubOdoo(): Promise<{
  baseUrl: string;
  rpcCalls: CapturedRpcCall[];
  close: () => Promise<void>;
}> {
  const rpcCalls: CapturedRpcCall[] = [];

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    req.on('end', () => {
      const url = req.url ?? '/';
      const bodyText = Buffer.concat(chunks).toString('utf8');
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(bodyText) as Record<string, unknown>;
      } catch {
        /* empty body ok */
      }

      const params = body['params'] as Record<string, unknown> | undefined;

      // Authentication endpoint
      if (url.includes('/web/session/authenticate')) {
        rpcCalls.push({
          url,
          method: 'authenticate',
          model: undefined,
          rpcMethod: undefined,
          domain: undefined,
          fields: [],
        });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ result: { uid: 7 } }));
        return;
      }

      // call_kw endpoint — route by model + method
      if (url.includes('/web/dataset/call_kw')) {
        const model = params?.['model'] as string | undefined;
        const rpcMethod = params?.['method'] as string | undefined;
        const args = (params?.['args'] ?? []) as unknown[];
        const kwargs = (params?.['kwargs'] ?? {}) as Record<string, unknown>;

        rpcCalls.push({
          url,
          method: 'call_kw',
          model,
          rpcMethod,
          domain: args[0] as unknown[] | undefined,
          fields: (kwargs['fields'] ?? []) as string[],
        });

        let result: unknown = [];

        if (model === 'account.account' && rpcMethod === 'search_read') {
          const domain = (args[0] ?? []) as unknown[][];
          // getAccount with id filter
          const idFilter = domain.find((d) => Array.isArray(d) && d[0] === 'id' && d[1] === 'in');
          if (idFilter) {
            const ids = (idFilter as [string, string, number[]])[2];
            result = SEEDED_ACCOUNTS.filter((a) => ids.includes(a.id));
          } else {
            result = SEEDED_ACCOUNTS;
          }
        } else if (model === 'account.move' && rpcMethod === 'search_read') {
          result = SEEDED_INVOICES;
        } else if (model === 'account.move' && rpcMethod === 'create') {
          result = 42; // new move ID
        } else if (model === 'res.partner' && rpcMethod === 'search_read') {
          result = SEEDED_VENDORS;
        } else if (model === 'account.move.line' && rpcMethod === 'search_read') {
          result = null; // reconcile accepted
        }

        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ result }));
        return;
      }

      // Unknown endpoint
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'unknown_endpoint' }));
    });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Could not bind stub Odoo.');

  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    rpcCalls,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

// ---------------------------------------------------------------------------
// Stub evidence log
// ---------------------------------------------------------------------------

function makeStubEvidenceLog(): EvidenceLogPort & { entries: Record<string, unknown>[] } {
  const entries: Record<string, unknown>[] = [];
  let counter = 0;
  return {
    entries,
    appendEntry: vi.fn(async (_tenantId, entry) => {
      counter += 1;
      const stored = {
        ...entry,
        schemaVersion: 1 as const,
        evidenceId: `ev-odoo-${counter}` as EvidenceId,
        previousHash: counter > 1 ? (`hash-odoo-${counter - 1}` as HashSha256) : undefined,
        hashSha256: `hash-odoo-${counter}` as HashSha256,
      };
      entries.push(stored as unknown as Record<string, unknown>);
      return stored;
    }),
  };
}

// ---------------------------------------------------------------------------
// Run-step abstraction: executes adapter operation via a run step with evidence
// ---------------------------------------------------------------------------

async function executeFinanceRunStep(
  adapter: OdooFinanceAccountingAdapter,
  evidenceLog: EvidenceLogPort,
  input: FinanceAccountingExecuteInputV1,
  context: {
    runId: RunId;
    correlationId: CorrelationId;
    workspaceId: WorkspaceId;
    adapterId: AdapterId;
  },
): Promise<FinanceAccountingExecuteOutputV1> {
  const startedAt = new Date().toISOString();

  // Execute adapter operation (the run-step boundary)
  const result = await adapter.execute(input);

  // Record evidence for the adapter action
  const summary = result.ok
    ? `Adapter ${context.adapterId}: ${input.operation} succeeded (${result.result.kind})`
    : `Adapter ${context.adapterId}: ${input.operation} failed — ${result.error}: ${result.message}`;

  await evidenceLog.appendEntry(input.tenantId, {
    schemaVersion: 1,
    evidenceId: `ev-run-step` as EvidenceId,
    workspaceId: context.workspaceId,
    correlationId: context.correlationId,
    occurredAtIso: startedAt,
    category: 'Action',
    summary,
    actor: { kind: 'Adapter', adapterId: context.adapterId },
    links: { runId: context.runId },
  });

  return result;
}

// ---------------------------------------------------------------------------
// Scenario tests
// ---------------------------------------------------------------------------

describe('Scenario: Odoo FinanceAccounting run-path verification', () => {
  // Step 1: Execute FinanceAccounting via run step
  describe('Step 1 — FinanceAccounting operations execute via run step', () => {
    it('listAccounts via run step returns seeded accounts', async () => {
      const odoo = await startStubOdoo();
      try {
        const config: OdooAdapterConfig = {
          baseUrl: odoo.baseUrl,
          database: 'test-db',
          username: 'admin@test.com',
          apiKey: 'test-api-key',
        };
        const adapter = new OdooFinanceAccountingAdapter(config);
        const evidenceLog = makeStubEvidenceLog();

        const result = await executeFinanceRunStep(
          adapter,
          evidenceLog,
          { tenantId: TENANT_ID, operation: 'listAccounts' },
          {
            runId: RUN_ID,
            correlationId: CORRELATION_ID,
            workspaceId: WORKSPACE_ID,
            adapterId: ADAPTER_ID,
          },
        );

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('Expected success');
        expect(result.result.kind).toBe('accounts');
        if (result.result.kind !== 'accounts') return;
        expect(result.result.accounts).toHaveLength(3);
      } finally {
        await odoo.close();
      }
    });

    it('listInvoices via run step returns seeded invoices', async () => {
      const odoo = await startStubOdoo();
      try {
        const config: OdooAdapterConfig = {
          baseUrl: odoo.baseUrl,
          database: 'test-db',
          username: 'admin@test.com',
          apiKey: 'test-api-key',
        };
        const adapter = new OdooFinanceAccountingAdapter(config);
        const evidenceLog = makeStubEvidenceLog();

        const result = await executeFinanceRunStep(
          adapter,
          evidenceLog,
          { tenantId: TENANT_ID, operation: 'listInvoices' },
          {
            runId: RUN_ID,
            correlationId: CORRELATION_ID,
            workspaceId: WORKSPACE_ID,
            adapterId: ADAPTER_ID,
          },
        );

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('Expected success');
        expect(result.result.kind).toBe('invoices');
        if (result.result.kind !== 'invoices') return;
        expect(result.result.invoices).toHaveLength(2);
      } finally {
        await odoo.close();
      }
    });

    it('listVendors via run step returns seeded vendors', async () => {
      const odoo = await startStubOdoo();
      try {
        const config: OdooAdapterConfig = {
          baseUrl: odoo.baseUrl,
          database: 'test-db',
          username: 'admin@test.com',
          apiKey: 'test-api-key',
        };
        const adapter = new OdooFinanceAccountingAdapter(config);
        const evidenceLog = makeStubEvidenceLog();

        const result = await executeFinanceRunStep(
          adapter,
          evidenceLog,
          { tenantId: TENANT_ID, operation: 'listVendors' },
          {
            runId: RUN_ID,
            correlationId: CORRELATION_ID,
            workspaceId: WORKSPACE_ID,
            adapterId: ADAPTER_ID,
          },
        );

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('Expected success');
        expect(result.result.kind).toBe('vendors');
        if (result.result.kind !== 'vendors') return;
        expect(result.result.vendors).toHaveLength(2);
      } finally {
        await odoo.close();
      }
    });
  });

  // Step 2: Verify seeded business data expectations
  describe('Step 2 — Seeded data assertions through run outputs', () => {
    it('seeded accounts match expected chart-of-accounts structure', async () => {
      const odoo = await startStubOdoo();
      try {
        const config: OdooAdapterConfig = {
          baseUrl: odoo.baseUrl,
          database: 'test-db',
          username: 'admin@test.com',
          apiKey: 'test-api-key',
        };
        const adapter = new OdooFinanceAccountingAdapter(config);
        const evidenceLog = makeStubEvidenceLog();

        const result = await executeFinanceRunStep(
          adapter,
          evidenceLog,
          { tenantId: TENANT_ID, operation: 'listAccounts' },
          {
            runId: RUN_ID,
            correlationId: CORRELATION_ID,
            workspaceId: WORKSPACE_ID,
            adapterId: ADAPTER_ID,
          },
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        if (result.result.kind !== 'accounts') return;

        const accounts = result.result.accounts;
        // Verify seeded chart-of-accounts expectations
        expect(accounts[0]).toMatchObject({
          accountId: '1',
          tenantId: TENANT_ID,
          accountName: 'Cash',
          accountCode: '101000',
          accountType: 'asset',
          currencyCode: 'USD',
          isActive: true,
        });
        expect(accounts[1]).toMatchObject({
          accountName: 'Accounts Receivable',
          accountCode: '120000',
          accountType: 'asset',
        });
        expect(accounts[2]).toMatchObject({
          accountName: 'Revenue',
          accountCode: '400000',
          accountType: 'revenue',
          currencyCode: 'EUR',
        });
      } finally {
        await odoo.close();
      }
    });

    it('seeded invoices reflect expected payment states and amounts', async () => {
      const odoo = await startStubOdoo();
      try {
        const config: OdooAdapterConfig = {
          baseUrl: odoo.baseUrl,
          database: 'test-db',
          username: 'admin@test.com',
          apiKey: 'test-api-key',
        };
        const adapter = new OdooFinanceAccountingAdapter(config);
        const evidenceLog = makeStubEvidenceLog();

        const result = await executeFinanceRunStep(
          adapter,
          evidenceLog,
          { tenantId: TENANT_ID, operation: 'listInvoices' },
          {
            runId: RUN_ID,
            correlationId: CORRELATION_ID,
            workspaceId: WORKSPACE_ID,
            adapterId: ADAPTER_ID,
          },
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        if (result.result.kind !== 'invoices') return;

        const invoices = result.result.invoices;
        expect(invoices[0]).toMatchObject({
          invoiceId: '10',
          invoiceNumber: 'INV/2026/0001',
          status: 'paid',
          currencyCode: 'USD',
          totalAmount: 2500,
          issuedAtIso: '2026-01-15',
          dueDateIso: '2026-02-15',
        });
        expect(invoices[1]).toMatchObject({
          invoiceId: '11',
          invoiceNumber: 'INV/2026/0002',
          status: 'draft',
          currencyCode: 'EUR',
          totalAmount: 750,
        });
        expect(invoices[1]?.dueDateIso).toBeUndefined();
      } finally {
        await odoo.close();
      }
    });

    it('seeded vendors include contact details and vendor role', async () => {
      const odoo = await startStubOdoo();
      try {
        const config: OdooAdapterConfig = {
          baseUrl: odoo.baseUrl,
          database: 'test-db',
          username: 'admin@test.com',
          apiKey: 'test-api-key',
        };
        const adapter = new OdooFinanceAccountingAdapter(config);
        const evidenceLog = makeStubEvidenceLog();

        const result = await executeFinanceRunStep(
          adapter,
          evidenceLog,
          { tenantId: TENANT_ID, operation: 'listVendors' },
          {
            runId: RUN_ID,
            correlationId: CORRELATION_ID,
            workspaceId: WORKSPACE_ID,
            adapterId: ADAPTER_ID,
          },
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        if (result.result.kind !== 'vendors') return;

        const vendors = result.result.vendors;
        expect(vendors[0]).toMatchObject({
          partyId: '20',
          tenantId: TENANT_ID,
          displayName: 'Acme Industrial Parts',
          email: 'billing@acme-parts.com',
          phone: '+1-555-0110',
          roles: ['vendor'],
        });
        expect(vendors[1]).toMatchObject({
          displayName: 'Beta Logistics GmbH',
          email: 'invoices@beta-logistics.de',
          roles: ['vendor'],
        });
        expect(vendors[1]?.phone).toBeUndefined();
      } finally {
        await odoo.close();
      }
    });
  });

  // Step 3: Evidence includes adapter action metadata and correlation
  describe('Step 3 — Evidence records adapter metadata and correlation context', () => {
    it('evidence entry includes adapter ID, operation, and correlation ID', async () => {
      const odoo = await startStubOdoo();
      try {
        const config: OdooAdapterConfig = {
          baseUrl: odoo.baseUrl,
          database: 'test-db',
          username: 'admin@test.com',
          apiKey: 'test-api-key',
        };
        const adapter = new OdooFinanceAccountingAdapter(config);
        const evidenceLog = makeStubEvidenceLog();

        await executeFinanceRunStep(
          adapter,
          evidenceLog,
          { tenantId: TENANT_ID, operation: 'listAccounts' },
          {
            runId: RUN_ID,
            correlationId: CORRELATION_ID,
            workspaceId: WORKSPACE_ID,
            adapterId: ADAPTER_ID,
          },
        );

        expect(evidenceLog.entries).toHaveLength(1);
        const entry = evidenceLog.entries[0]!;
        expect(entry['category']).toBe('Action');
        expect(entry['correlationId']).toBe(CORRELATION_ID);
        expect(entry['summary']).toContain(ADAPTER_ID);
        expect(entry['summary']).toContain('listAccounts');
        expect(entry['summary']).toContain('succeeded');
        expect(entry['actor']).toEqual({ kind: 'Adapter', adapterId: ADAPTER_ID });
        expect(entry['links']).toEqual({ runId: RUN_ID });
      } finally {
        await odoo.close();
      }
    });

    it('evidence hash chain links sequential run steps', async () => {
      const odoo = await startStubOdoo();
      try {
        const config: OdooAdapterConfig = {
          baseUrl: odoo.baseUrl,
          database: 'test-db',
          username: 'admin@test.com',
          apiKey: 'test-api-key',
        };
        const adapter = new OdooFinanceAccountingAdapter(config);
        const evidenceLog = makeStubEvidenceLog();
        const runCtx = {
          runId: RUN_ID,
          correlationId: CORRELATION_ID,
          workspaceId: WORKSPACE_ID,
          adapterId: ADAPTER_ID,
        };

        await executeFinanceRunStep(
          adapter,
          evidenceLog,
          { tenantId: TENANT_ID, operation: 'listAccounts' },
          runCtx,
        );
        await executeFinanceRunStep(
          adapter,
          evidenceLog,
          { tenantId: TENANT_ID, operation: 'listInvoices' },
          runCtx,
        );

        expect(evidenceLog.entries).toHaveLength(2);
        const first = evidenceLog.entries[0]!;
        const second = evidenceLog.entries[1]!;
        expect(second['previousHash']).toBe(first['hashSha256']);
      } finally {
        await odoo.close();
      }
    });

    it('failed operation records error details in evidence summary', async () => {
      const odoo = await startStubOdoo();
      try {
        const config: OdooAdapterConfig = {
          baseUrl: odoo.baseUrl,
          database: 'test-db',
          username: 'admin@test.com',
          apiKey: 'test-api-key',
        };
        const adapter = new OdooFinanceAccountingAdapter(config);
        const evidenceLog = makeStubEvidenceLog();

        // getAccount without required accountId → validation_error
        const result = await executeFinanceRunStep(
          adapter,
          evidenceLog,
          { tenantId: TENANT_ID, operation: 'getAccount' },
          {
            runId: RUN_ID,
            correlationId: CORRELATION_ID,
            workspaceId: WORKSPACE_ID,
            adapterId: ADAPTER_ID,
          },
        );

        expect(result.ok).toBe(false);
        const entry = evidenceLog.entries[0]!;
        expect(entry['summary']).toContain('failed');
        expect(entry['summary']).toContain('validation_error');
      } finally {
        await odoo.close();
      }
    });
  });

  // Step 4: Diagnostics for Odoo connectivity and credential issues
  describe('Step 4 — Diagnostics for Odoo startup/seed/credential issues', () => {
    it('network failure produces provider_error with diagnostic message', async () => {
      const config: OdooAdapterConfig = {
        baseUrl: 'http://127.0.0.1:1', // unreachable port
        database: 'test-db',
        username: 'admin@test.com',
        apiKey: 'test-api-key',
      };
      const adapter = new OdooFinanceAccountingAdapter(config);
      const evidenceLog = makeStubEvidenceLog();

      const result = await executeFinanceRunStep(
        adapter,
        evidenceLog,
        { tenantId: TENANT_ID, operation: 'listAccounts' },
        {
          runId: RUN_ID,
          correlationId: CORRELATION_ID,
          workspaceId: WORKSPACE_ID,
          adapterId: ADAPTER_ID,
        },
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('provider_error');
      // Network errors surface diagnostic info
      expect(result.message).toMatch(/ECONNREFUSED|fetch failed|network/i);

      // Evidence still recorded for failed operation
      expect(evidenceLog.entries).toHaveLength(1);
      expect(evidenceLog.entries[0]!['summary']).toContain('failed');
    });

    it('JSON-RPC error from Odoo surfaces model/method details', async () => {
      // Stub that returns auth success but RPC error on data call
      let callCount = 0;
      const server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer | string) =>
          chunks.push(typeof c === 'string' ? Buffer.from(c) : c),
        );
        req.on('end', () => {
          callCount++;
          if (callCount === 1) {
            // Auth success
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ result: { uid: 7 } }));
          } else {
            // RPC error
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
              JSON.stringify({
                error: {
                  message: 'Odoo Server Error',
                  data: { message: 'Access denied: account.account' },
                },
              }),
            );
          }
        });
      });

      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Bind failed');

      try {
        const config: OdooAdapterConfig = {
          baseUrl: `http://127.0.0.1:${addr.port}`,
          database: 'test-db',
          username: 'admin@test.com',
          apiKey: 'bad-key',
        };
        const adapter = new OdooFinanceAccountingAdapter(config);
        const evidenceLog = makeStubEvidenceLog();

        const result = await executeFinanceRunStep(
          adapter,
          evidenceLog,
          { tenantId: TENANT_ID, operation: 'listAccounts' },
          {
            runId: RUN_ID,
            correlationId: CORRELATION_ID,
            workspaceId: WORKSPACE_ID,
            adapterId: ADAPTER_ID,
          },
        );

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe('provider_error');
        expect(result.message).toContain('Access denied');
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve())),
        );
      }
    });

    it('HTTP 502 from Odoo proxy produces clear diagnostic error', async () => {
      let callCount = 0;
      const server = createServer((_req: IncomingMessage, res: ServerResponse) => {
        callCount++;
        if (callCount === 1) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ result: { uid: 7 } }));
        } else {
          res.writeHead(502, { 'content-type': 'text/html' });
          res.end('<html>Bad Gateway</html>');
        }
      });

      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Bind failed');

      try {
        const config: OdooAdapterConfig = {
          baseUrl: `http://127.0.0.1:${addr.port}`,
          database: 'test-db',
          username: 'admin@test.com',
          apiKey: 'test-api-key',
        };
        const adapter = new OdooFinanceAccountingAdapter(config);
        const evidenceLog = makeStubEvidenceLog();

        const result = await executeFinanceRunStep(
          adapter,
          evidenceLog,
          { tenantId: TENANT_ID, operation: 'listAccounts' },
          {
            runId: RUN_ID,
            correlationId: CORRELATION_ID,
            workspaceId: WORKSPACE_ID,
            adapterId: ADAPTER_ID,
          },
        );

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe('provider_error');
        expect(result.message).toContain('502');
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve())),
        );
      }
    });
  });

  // Step 5: JSON-RPC transport negotiation end-to-end
  describe('Step 5 — Transport and protocol verification', () => {
    it('JSON-RPC transport authenticates then calls search_read for listAccounts', async () => {
      const odoo = await startStubOdoo();
      try {
        const config: OdooAdapterConfig = {
          baseUrl: odoo.baseUrl,
          database: 'test-db',
          username: 'admin@test.com',
          apiKey: 'test-api-key',
        };
        const adapter = new OdooFinanceAccountingAdapter(config);
        const evidenceLog = makeStubEvidenceLog();

        await executeFinanceRunStep(
          adapter,
          evidenceLog,
          { tenantId: TENANT_ID, operation: 'listAccounts' },
          {
            runId: RUN_ID,
            correlationId: CORRELATION_ID,
            workspaceId: WORKSPACE_ID,
            adapterId: ADAPTER_ID,
          },
        );

        // Verify RPC call sequence: auth first, then search_read
        expect(odoo.rpcCalls).toHaveLength(2);
        expect(odoo.rpcCalls[0]!.method).toBe('authenticate');
        expect(odoo.rpcCalls[1]!.method).toBe('call_kw');
        expect(odoo.rpcCalls[1]!.model).toBe('account.account');
        expect(odoo.rpcCalls[1]!.rpcMethod).toBe('search_read');
      } finally {
        await odoo.close();
      }
    });

    it('session caching avoids re-authentication on sequential operations', async () => {
      const odoo = await startStubOdoo();
      try {
        const config: OdooAdapterConfig = {
          baseUrl: odoo.baseUrl,
          database: 'test-db',
          username: 'admin@test.com',
          apiKey: 'test-api-key',
        };
        const adapter = new OdooFinanceAccountingAdapter(config);
        const evidenceLog = makeStubEvidenceLog();
        const runCtx = {
          runId: RUN_ID,
          correlationId: CORRELATION_ID,
          workspaceId: WORKSPACE_ID,
          adapterId: ADAPTER_ID,
        };

        await executeFinanceRunStep(
          adapter,
          evidenceLog,
          { tenantId: TENANT_ID, operation: 'listAccounts' },
          runCtx,
        );
        await executeFinanceRunStep(
          adapter,
          evidenceLog,
          { tenantId: TENANT_ID, operation: 'listVendors' },
          runCtx,
        );

        // Only one authenticate call despite two operations
        const authCalls = odoo.rpcCalls.filter((c) => c.method === 'authenticate');
        expect(authCalls).toHaveLength(1);
        // Total: 1 auth + 2 data calls = 3
        expect(odoo.rpcCalls).toHaveLength(3);
      } finally {
        await odoo.close();
      }
    });

    it('createJournalEntry via run step creates account.move entry', async () => {
      const odoo = await startStubOdoo();
      try {
        const config: OdooAdapterConfig = {
          baseUrl: odoo.baseUrl,
          database: 'test-db',
          username: 'admin@test.com',
          apiKey: 'test-api-key',
        };
        const adapter = new OdooFinanceAccountingAdapter(config);
        const evidenceLog = makeStubEvidenceLog();

        const result = await executeFinanceRunStep(
          adapter,
          evidenceLog,
          {
            tenantId: TENANT_ID,
            operation: 'createJournalEntry',
            payload: {
              lines: [
                { accountCode: '101000', debit: 1000, credit: 0 },
                { accountCode: '400000', debit: 0, credit: 1000 },
              ],
              reference: 'SCENARIO-JE-001',
            },
          },
          {
            runId: RUN_ID,
            correlationId: CORRELATION_ID,
            workspaceId: WORKSPACE_ID,
            adapterId: ADAPTER_ID,
          },
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // createJournalEntry returns accepted or opaque depending on adapter impl
        expect(['accepted', 'opaque']).toContain(result.result.kind);

        // Verify the adapter called create on account.move
        const createCall = odoo.rpcCalls.find(
          (c) => c.model === 'account.move' && c.rpcMethod === 'create',
        );
        expect(createCall).toBeDefined();
      } finally {
        await odoo.close();
      }
    });
  });
});
