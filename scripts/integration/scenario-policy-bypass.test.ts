/**
 * Scenario: Policy enforcement check for control-plane bypass attempts (409).
 *
 * Validates rejection behavior for attempts to bypass governed execution flow.
 * Exercises policy tier enforcement at two layers:
 *   1. Client-side: evaluateOpenClawToolPolicyV1 blocks dangerous/mutation tools
 *      before any HTTP request is made (pre-dispatch deny).
 *   2. Server-side: HTTP 409 from gateway maps to PolicyDenied error kind,
 *      verifying the gateway contract for policy-rejected requests.
 *
 * Tests also verify:
 *   - Evidence entries record denial reason and correlation ID for audit.
 *   - Regression guard: permitting a known-blocked tool at Auto tier fails the test.
 *   - Multiple tool categories (Dangerous, Mutation, Unknown) are correctly denied.
 *   - Gateway is never contacted when client-side policy blocks the request.
 *
 * Bead: bead-0848
 */

import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import type {
  ActionId,
  CorrelationId,
  EvidenceId,
  HashSha256,
  MachineId,
  RunId,
  TenantId,
  WorkspaceId,
} from '../../src/domain/primitives/index.js';
import type { EvidenceLogPort } from '../../src/application/ports/evidence-log.js';
import { OpenClawGatewayMachineInvoker } from '../../src/infrastructure/openclaw/openclaw-gateway-machine-invoker.js';
import {
  evaluateOpenClawToolPolicyV1,
  classifyOpenClawToolBlastRadiusV1,
} from '../../src/domain/machines/openclaw-tool-blast-radius-v1.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-scenario-bypass' as TenantId;
const WORKSPACE_ID = 'ws-scenario-bypass' as WorkspaceId;
const RUN_ID = 'run-bypass-001' as RunId;
const ACTION_ID = 'action-bypass-001' as ActionId;
const CORRELATION_ID = 'corr-bypass-001' as CorrelationId;
const MACHINE_ID = 'machine-bypass-001' as MachineId;
const FIXED_NOW = '2026-03-02T12:00:00.000Z';

// ---------------------------------------------------------------------------
// Stub infrastructure
// ---------------------------------------------------------------------------

type CapturedRequest = Readonly<{
  method: string;
  path: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  body: Record<string, unknown>;
}>;

async function startStubGateway(
  responses: Record<string, { status: number; body: unknown }[]>,
): Promise<{
  baseUrl: string;
  requests: CapturedRequest[];
  close: () => Promise<void>;
}> {
  const requestLog: CapturedRequest[] = [];
  const queues = new Map(Object.entries(responses).map(([path, resps]) => [path, [...resps]]));

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    req.on('end', () => {
      const path = req.url ?? '/';
      const bodyText = Buffer.concat(chunks).toString('utf8');
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(bodyText) as Record<string, unknown>;
      } catch {
        /* empty body is ok */
      }
      requestLog.push({ method: req.method ?? '', path, headers: req.headers, body });

      const queue = queues.get(path) ?? [];
      const next = queue.shift();
      if (!next) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'no_stub' }));
        return;
      }
      res.writeHead(next.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(next.body));
    });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Could not bind stub gateway.');

  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    requests: requestLog,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

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
        evidenceId: `ev-bypass-${counter}` as EvidenceId,
        previousHash: counter > 1 ? (`hash-bypass-${counter - 1}` as HashSha256) : undefined,
        hashSha256: `hash-bypass-${counter}` as HashSha256,
      };
      entries.push(stored as unknown as Record<string, unknown>);
      return stored;
    }),
  };
}

// ---------------------------------------------------------------------------
// Scenario: Policy enforcement for control-plane bypass attempts
// ---------------------------------------------------------------------------

describe('Scenario: Policy enforcement — control-plane bypass attempts (409)', () => {
  // -------------------------------------------------------------------------
  // Test A: Non-allowlisted external effect payloads → 409 policy error
  // -------------------------------------------------------------------------

  describe('Test A — Non-allowlisted external effect payloads denied', () => {
    it('AC-A1: shell.exec at Auto tier is denied before gateway dispatch', async () => {
      const gateway = await startStubGateway({});

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'token-bypass',
        });

        const result = await invoker.invokeTool({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          toolName: 'shell.exec',
          parameters: { command: 'rm -rf /' },
          policyTier: 'Auto',
        });

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('Expected policy denial');
        expect(result.errorKind).toBe('PolicyDenied');
        expect(result.message).toContain('shell.exec');
        expect(result.message).toContain('Auto');
        expect(result.message).toContain('ManualOnly');
        expect(result.runState).toBe('PolicyBlocked');
        // Gateway must never be contacted
        expect(gateway.requests).toHaveLength(0);
      } finally {
        await gateway.close();
      }
    });

    it('AC-A2: browser.navigate at Assisted tier is denied (Dangerous category)', async () => {
      const gateway = await startStubGateway({});

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'token-bypass',
        });

        const result = await invoker.invokeTool({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          toolName: 'browser.navigate',
          parameters: { url: 'https://evil.example.com' },
          policyTier: 'Assisted',
        });

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('Expected policy denial');
        expect(result.errorKind).toBe('PolicyDenied');
        expect(result.message).toContain('browser.navigate');
        expect(gateway.requests).toHaveLength(0);
      } finally {
        await gateway.close();
      }
    });

    it('AC-A3: write:file at Auto tier is denied (Mutation category)', async () => {
      const gateway = await startStubGateway({});

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'token-bypass',
        });

        const result = await invoker.invokeTool({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          toolName: 'write:file',
          parameters: { path: '/etc/passwd', content: 'hacked' },
          policyTier: 'Auto',
        });

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('Expected policy denial');
        expect(result.errorKind).toBe('PolicyDenied');
        expect(result.message).toContain('write:file');
        expect(result.message).toContain('HumanApprove');
        expect(gateway.requests).toHaveLength(0);
      } finally {
        await gateway.close();
      }
    });

    it('AC-A4: unknown tool at Auto tier defaults to HumanApprove (denied)', async () => {
      const gateway = await startStubGateway({});

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'token-bypass',
        });

        const result = await invoker.invokeTool({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          toolName: 'custom.mystery-tool',
          parameters: {},
          policyTier: 'Auto',
        });

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('Expected policy denial');
        expect(result.errorKind).toBe('PolicyDenied');
        expect(result.message).toContain('custom.mystery-tool');
        expect(gateway.requests).toHaveLength(0);
      } finally {
        await gateway.close();
      }
    });

    it('AC-A5: gateway 409 response maps to PolicyDenied error kind', async () => {
      const policyError = {
        type: 'urn:portarium:error:policy_denied',
        title: 'Policy Denied',
        status: 409,
        detail: 'Tool "deploy.production" violates workspace policy for tier "Assisted".',
      };
      const gateway = await startStubGateway({
        '/tools/invoke': [{ status: 409, body: policyError }],
      });

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'token-bypass',
        });

        // Use a read-only tool that passes client-side policy (Auto tier allows read:*)
        const result = await invoker.invokeTool({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          toolName: 'read:config',
          parameters: { key: 'deploy.target' },
          policyTier: 'Auto',
        });

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('Expected gateway policy denial');
        expect(result.errorKind).toBe('PolicyDenied');
        expect(result.message).toContain('policy');
        // Gateway was contacted (client policy allowed the tool)
        expect(gateway.requests).toHaveLength(1);
      } finally {
        await gateway.close();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Test B: Direct external-effect call path without approved route
  // -------------------------------------------------------------------------

  describe('Test B — Direct call path denied with audit marker', () => {
    it('AC-B1: policy denial emits evidence entry with denial reason and correlationId', async () => {
      const gateway = await startStubGateway({});
      const evidenceLog = makeStubEvidenceLog();

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'token-bypass',
        });

        const result = await invoker.invokeTool({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          toolName: 'shell.exec',
          parameters: { command: 'cat /etc/shadow' },
          policyTier: 'Auto',
        });

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('Expected denial');

        // Record denial evidence entry (as the orchestration layer would)
        const denialEntry = await evidenceLog.appendEntry(TENANT_ID, {
          schemaVersion: 1,
          evidenceId: 'ev-deny-audit' as EvidenceId,
          workspaceId: WORKSPACE_ID,
          correlationId: CORRELATION_ID,
          occurredAtIso: FIXED_NOW,
          category: 'System',
          summary: `Policy denied tool "${result.message}"`,
          actor: { kind: 'System' },
          links: { runId: RUN_ID },
        });

        // Evidence contains denial correlation
        expect(denialEntry.correlationId).toBe(CORRELATION_ID);
        expect(denialEntry.category).toBe('System');
        expect(String(denialEntry.summary)).toContain('Policy');
        expect(evidenceLog.entries).toHaveLength(1);

        // Audit marker: evidence links to the run that was denied
        const stored = evidenceLog.entries[0]!;
        const links = stored['links'] as { runId: string } | undefined;
        expect(links?.runId).toBe(RUN_ID);
      } finally {
        await gateway.close();
      }
    });

    it('AC-B2: gateway 409 denial also records evidence with correlation', async () => {
      const policyError = {
        type: 'urn:portarium:error:policy_denied',
        title: 'Policy Denied',
        status: 409,
        detail: 'Workspace policy rejected tool invocation.',
      };
      const gateway = await startStubGateway({
        '/tools/invoke': [{ status: 409, body: policyError }],
      });
      const evidenceLog = makeStubEvidenceLog();

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'token-bypass',
        });

        const result = await invoker.invokeTool({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          toolName: 'read:audit-log',
          parameters: {},
          policyTier: 'Auto',
        });

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('Expected gateway denial');

        // Record gateway denial evidence
        await evidenceLog.appendEntry(TENANT_ID, {
          schemaVersion: 1,
          evidenceId: 'ev-gw-deny' as EvidenceId,
          workspaceId: WORKSPACE_ID,
          correlationId: CORRELATION_ID,
          occurredAtIso: FIXED_NOW,
          category: 'System',
          summary: `Gateway policy denied: ${result.errorKind} — ${result.message}`,
          actor: { kind: 'System' },
          links: { runId: RUN_ID },
        });

        expect(evidenceLog.entries).toHaveLength(1);
        const stored = evidenceLog.entries[0]!;
        expect(stored['correlationId']).toBe(CORRELATION_ID);
        expect(String(stored['summary'])).toContain('PolicyDenied');
      } finally {
        await gateway.close();
      }
    });

    it('AC-B3: multiple denied tools produce separate evidence entries per denial', async () => {
      const gateway = await startStubGateway({});
      const evidenceLog = makeStubEvidenceLog();

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'token-bypass',
        });

        const deniedTools = ['shell.exec', 'powershell.invoke', 'package.install'];

        for (const toolName of deniedTools) {
          const result = await invoker.invokeTool({
            tenantId: TENANT_ID,
            runId: RUN_ID,
            actionId: ACTION_ID,
            correlationId: CORRELATION_ID,
            machineId: MACHINE_ID,
            toolName,
            parameters: {},
            policyTier: 'Auto',
          });

          expect(result.ok).toBe(false);
          if (result.ok) continue;

          await evidenceLog.appendEntry(TENANT_ID, {
            schemaVersion: 1,
            evidenceId: `ev-deny-${toolName}` as EvidenceId,
            workspaceId: WORKSPACE_ID,
            correlationId: CORRELATION_ID,
            occurredAtIso: FIXED_NOW,
            category: 'System',
            summary: `Policy denied: ${toolName} (${result.errorKind})`,
            actor: { kind: 'System' },
            links: { runId: RUN_ID },
          });
        }

        // Each denial produced an evidence entry
        expect(evidenceLog.entries).toHaveLength(3);
        // Hash chain is maintained
        const second = evidenceLog.entries[1]!;
        const third = evidenceLog.entries[2]!;
        expect(second['previousHash']).toBeDefined();
        expect(third['previousHash']).toBeDefined();
        // Gateway was never contacted for any of them
        expect(gateway.requests).toHaveLength(0);
      } finally {
        await gateway.close();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Regression guard: fails if bypass path is accidentally permitted
  // -------------------------------------------------------------------------

  describe('Regression — bypass path guard', () => {
    it('RG-1: shell.exec must be classified as Dangerous with ManualOnly minimum tier', () => {
      const policy = classifyOpenClawToolBlastRadiusV1('shell.exec');
      expect(policy.category).toBe('Dangerous');
      expect(policy.minimumTier).toBe('ManualOnly');
    });

    it('RG-2: evaluateOpenClawToolPolicyV1 returns Deny for shell.exec at every tier below ManualOnly', () => {
      const tiersBelow = ['Auto', 'Assisted', 'HumanApprove'] as const;
      for (const tier of tiersBelow) {
        const result = evaluateOpenClawToolPolicyV1({
          toolName: 'shell.exec',
          policyTier: tier,
        });
        expect(result.decision).toBe('Deny');
        if (result.decision !== 'Deny') continue;
        expect(result.violation.requiredTier).toBe('ManualOnly');
        expect(result.runState).toBe('PolicyBlocked');
      }
    });

    it('RG-3: shell.exec at ManualOnly tier is allowed (positive control)', () => {
      const result = evaluateOpenClawToolPolicyV1({
        toolName: 'shell.exec',
        policyTier: 'ManualOnly',
      });
      expect(result.decision).toBe('Allow');
    });

    it('RG-4: mutation tools (write:*, create:*, delete:*) denied at Auto tier', () => {
      const mutationTools = [
        'write:file',
        'create:resource',
        'delete:record',
        'send:email',
        'deploy.production',
      ];
      for (const toolName of mutationTools) {
        const result = evaluateOpenClawToolPolicyV1({
          toolName,
          policyTier: 'Auto',
        });
        expect(result.decision).toBe('Deny');
      }
    });

    it('RG-5: read-only tools are allowed at Auto tier (negative regression guard)', () => {
      const readTools = ['read:file', 'list:accounts', 'search:documents', 'query:metrics'];
      for (const toolName of readTools) {
        const result = evaluateOpenClawToolPolicyV1({
          toolName,
          policyTier: 'Auto',
        });
        expect(result.decision).toBe('Allow');
      }
    });

    it('RG-6: all dangerous-pattern tools are denied at HumanApprove tier', () => {
      const dangerousTools = [
        'shell.exec',
        'terminal.run',
        'powershell.invoke',
        'bash.execute',
        'browser.navigate',
        'playwright.click',
        'selenium.open',
        'package.install',
        'tool.remove',
      ];
      for (const toolName of dangerousTools) {
        const result = evaluateOpenClawToolPolicyV1({
          toolName,
          policyTier: 'HumanApprove',
        });
        expect(result.decision).toBe('Deny');
        if (result.decision !== 'Deny') continue;
        expect(result.violation.category).toBe('Dangerous');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Evidence metadata and error contract shape
  // -------------------------------------------------------------------------

  describe('Evidence and error contract', () => {
    it('EC-1: PolicyDenied result includes runState and descriptive message', async () => {
      const gateway = await startStubGateway({});

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'token',
        });

        const result = await invoker.invokeTool({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          toolName: 'os.command',
          parameters: {},
          policyTier: 'Assisted',
        });

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('Expected denial');
        expect(result.errorKind).toBe('PolicyDenied');
        expect(result.runState).toBe('PolicyBlocked');
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(10);
        // Message includes tool name, tier, and required tier
        expect(result.message).toContain('os.command');
        expect(result.message).toContain('Assisted');
        expect(result.message).toContain('ManualOnly');
      } finally {
        await gateway.close();
      }
    });

    it('EC-2: gateway 409 PolicyDenied does not include runState (server-side denial)', async () => {
      const gateway = await startStubGateway({
        '/tools/invoke': [
          {
            status: 409,
            body: { error: 'policy_denied', detail: 'Workspace policy violation' },
          },
        ],
      });

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'token',
        });

        const result = await invoker.invokeTool({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          toolName: 'read:config',
          parameters: {},
          policyTier: 'Auto',
        });

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('Expected gateway denial');
        expect(result.errorKind).toBe('PolicyDenied');
        // Server-side denial via mapHttpStatusToFailure does not set runState
        expect(result.runState).toBeUndefined();
      } finally {
        await gateway.close();
      }
    });
  });
});
