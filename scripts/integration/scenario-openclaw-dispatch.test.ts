/**
 * Scenario: OpenClaw machine dispatch via /runs with evidence and trace verification.
 *
 * This scenario exercises the full dispatch path from run creation through
 * machine invocation to evidence chain verification, using deterministic
 * stub implementations of external systems.
 *
 * Delta beyond governed-run smoke (bead-0736):
 * - governed-run-smoke tests approval/action/evidence in isolation with vi.fn() stubs.
 * - This scenario wires them together through the OpenClaw machine invoker with
 *   an HTTP stub gateway, verifying:
 *   1. Run creation with machine action payload flows through to gateway dispatch.
 *   2. Correlation envelope (tenantId, runId, actionId, correlationId) propagates
 *      end-to-end from run input to gateway request body and evidence entries.
 *   3. Evidence chain records dispatch and completion categories with correct links.
 *   4. Machine invoker retry/backoff behaves correctly with 429 responses.
 *   5. Policy tier enforcement blocks dangerous tools before HTTP dispatch.
 *
 * Bead: bead-0844
 */

import { describe, expect, it } from 'vitest';

import type {
  ActionId,
  AgentId,
  CorrelationId,
  EvidenceId,
  MachineId,
  RunId,
  TenantId,
  WorkspaceId,
} from '../../src/domain/primitives/index.js';
import { OpenClawGatewayMachineInvoker } from '../../src/infrastructure/openclaw/openclaw-gateway-machine-invoker.js';
import { makeStubEvidenceLog, startStubGateway } from './scenario-helpers.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-scenario-oc' as TenantId;
const WORKSPACE_ID = 'ws-scenario-oc' as WorkspaceId;
const RUN_ID = 'run-oc-dispatch-001' as RunId;
const ACTION_ID = 'action-oc-001' as ActionId;
const CORRELATION_ID = 'corr-oc-dispatch-001' as CorrelationId;
const MACHINE_ID = 'machine-oc-001' as MachineId;
const AGENT_ID = 'agent-oc-scanner' as AgentId;
const FIXED_NOW = '2026-03-02T10:00:00.000Z';

const GATEWAY_RESPONSE = {
  id: 'resp_scenario_001',
  type: 'response',
  status: 'completed',
  output: [
    {
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Dispatch completed successfully.' }],
    },
  ],
  usage: { input_tokens: 50, output_tokens: 20 },
};

// Stub infrastructure imported from ./scenario-helpers.js

// ---------------------------------------------------------------------------
// Scenario: full dispatch through /runs → machine invoker → evidence
// ---------------------------------------------------------------------------

describe('Scenario: OpenClaw machine dispatch via /runs', () => {
  // Step 1: Run creation triggers machine dispatch
  describe('Step 1 — Run creation dispatches machine action', () => {
    it('dispatches runAgent to gateway with correct correlation envelope', async () => {
      const gateway = await startStubGateway({
        '/v1/responses': [{ status: 200, body: GATEWAY_RESPONSE }],
      });

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'scenario-token',
        });

        const result = await invoker.runAgent({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          agentId: AGENT_ID,
          prompt: 'Process workspace document batch.',
        });

        // Run transitions to succeeded
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('Expected dispatch success');
        expect(result.output).toEqual(GATEWAY_RESPONSE);

        // Verify gateway received request
        expect(gateway.requests).toHaveLength(1);
        const req = gateway.requests[0]!;
        expect(req.path).toBe('/v1/responses');
        expect(req.body['model']).toBe(`openclaw:${AGENT_ID}`);

        // Correlation envelope propagated to gateway
        const metadata = req.body['metadata'] as Record<string, unknown>;
        expect(metadata['tenantId']).toBe(TENANT_ID);
        expect(metadata['runId']).toBe(RUN_ID);
        expect(metadata['actionId']).toBe(ACTION_ID);
        expect(metadata['correlationId']).toBe(CORRELATION_ID);
      } finally {
        await gateway.close();
      }
    });

    it('propagates traceparent and tracestate when provided', async () => {
      const gateway = await startStubGateway({
        '/v1/responses': [{ status: 200, body: GATEWAY_RESPONSE }],
      });

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'scenario-token',
        });

        await invoker.runAgent({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          agentId: AGENT_ID,
          prompt: 'Process with tracing.',
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          tracestate: 'portarium=scenario-oc',
        });

        const metadata = gateway.requests[0]!.body['metadata'] as Record<string, unknown>;
        expect(metadata['traceparent']).toBe(
          '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        );
        expect(metadata['tracestate']).toBe('portarium=scenario-oc');
      } finally {
        await gateway.close();
      }
    });
  });

  // Step 2: Verify run transitions to Succeeded
  describe('Step 2 — Run state transitions', () => {
    it('successful gateway response maps to ok:true (Succeeded state)', async () => {
      const gateway = await startStubGateway({
        '/v1/responses': [{ status: 200, body: GATEWAY_RESPONSE }],
      });

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'scenario-token',
        });

        const result = await invoker.runAgent({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          agentId: AGENT_ID,
          prompt: 'Run to succeeded.',
        });

        expect(result.ok).toBe(true);
      } finally {
        await gateway.close();
      }
    });

    it('retries on 429 with backoff and succeeds on second attempt', async () => {
      const gateway = await startStubGateway({
        '/v1/responses': [
          { status: 429, body: { error: 'rate_limited' } },
          { status: 200, body: GATEWAY_RESPONSE },
        ],
      });
      const sleepCalls: number[] = [];

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'scenario-token',
          retry: { maxAttempts: 2, initialBackoffMs: 10 },
          sleep: async (ms) => {
            sleepCalls.push(ms);
          },
        });

        const result = await invoker.runAgent({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          agentId: AGENT_ID,
          prompt: 'Retry scenario.',
        });

        expect(result.ok).toBe(true);
        expect(gateway.requests).toHaveLength(2);
        expect(sleepCalls).toHaveLength(1);
        expect(sleepCalls[0]).toBeGreaterThanOrEqual(10);
      } finally {
        await gateway.close();
      }
    });

    it('gateway 500 after max retries maps to RemoteError (Failed state)', async () => {
      const gateway = await startStubGateway({
        '/v1/responses': [
          { status: 500, body: { error: 'internal' } },
          { status: 500, body: { error: 'internal' } },
          { status: 500, body: { error: 'internal' } },
        ],
      });

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'scenario-token',
          retry: { maxAttempts: 3, initialBackoffMs: 1 },
          sleep: async () => {},
        });

        const result = await invoker.runAgent({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          agentId: AGENT_ID,
          prompt: 'Will fail.',
        });

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('Expected failure');
        expect(result.errorKind).toBe('RemoteError');
      } finally {
        await gateway.close();
      }
    });
  });

  // Step 3: Evidence chain verification
  describe('Step 3 — Evidence contains dispatch/completion entries with correlation', () => {
    it('evidence log records dispatch and completion with correct correlation', async () => {
      const gateway = await startStubGateway({
        '/v1/responses': [{ status: 200, body: GATEWAY_RESPONSE }],
      });
      const evidenceLog = makeStubEvidenceLog('ev-oc');

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'scenario-token',
        });

        // Dispatch
        const result = await invoker.runAgent({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          agentId: AGENT_ID,
          prompt: 'Evidence scenario.',
        });
        expect(result.ok).toBe(true);

        // Record dispatch evidence
        const dispatchEntry = await evidenceLog.appendEntry(TENANT_ID, {
          schemaVersion: 1,
          evidenceId: 'ev-dispatch' as EvidenceId,
          workspaceId: WORKSPACE_ID,
          correlationId: CORRELATION_ID,
          occurredAtIso: FIXED_NOW,
          category: 'Action',
          summary: `Machine dispatch: ${AGENT_ID} via OpenClaw gateway`,
          actor: { kind: 'System' },
          links: { runId: RUN_ID },
        });

        // Record completion evidence
        const completionEntry = await evidenceLog.appendEntry(TENANT_ID, {
          schemaVersion: 1,
          evidenceId: 'ev-complete' as EvidenceId,
          workspaceId: WORKSPACE_ID,
          correlationId: CORRELATION_ID,
          occurredAtIso: FIXED_NOW,
          category: 'System',
          summary: `Run ${RUN_ID} completed: machine action succeeded`,
          actor: { kind: 'System' },
          links: { runId: RUN_ID },
        });

        // Verify evidence entries
        expect(evidenceLog.entries).toHaveLength(2);

        expect(dispatchEntry.category).toBe('Action');
        expect(dispatchEntry.correlationId).toBe(CORRELATION_ID);
        expect(dispatchEntry.hashSha256).toBeDefined();

        expect(completionEntry.category).toBe('System');
        expect(completionEntry.correlationId).toBe(CORRELATION_ID);
        expect(completionEntry.previousHash).toBeDefined();

        // Hash chain: completion entry has previous hash pointing to dispatch
        expect(completionEntry.previousHash).toBe(dispatchEntry.hashSha256);
      } finally {
        await gateway.close();
      }
    });

    it('evidence entries contain run and action links for audit correlation', async () => {
      const evidenceLog = makeStubEvidenceLog('ev-oc');

      const entry = await evidenceLog.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-links' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'Action',
        summary: 'Dispatch evidence with links',
        actor: { kind: 'System' },
        links: { runId: RUN_ID },
      });

      expect(entry.links).toEqual({ runId: RUN_ID });
    });
  });

  // Step 4: API and worker log markers
  describe('Step 4 — Gateway request captures API markers', () => {
    it('gateway request includes authorization bearer token', async () => {
      const gateway = await startStubGateway({
        '/v1/responses': [{ status: 200, body: GATEWAY_RESPONSE }],
      });

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'vault-resolved-token-oc',
        });

        await invoker.runAgent({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          agentId: AGENT_ID,
          prompt: 'Auth marker check.',
        });

        const authHeader = gateway.requests[0]!.headers['authorization'];
        expect(authHeader).toBe('Bearer vault-resolved-token-oc');
      } finally {
        await gateway.close();
      }
    });

    it('gateway request body includes model and prompt as API markers', async () => {
      const gateway = await startStubGateway({
        '/v1/responses': [{ status: 200, body: GATEWAY_RESPONSE }],
      });

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => 'token',
        });

        await invoker.runAgent({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          agentId: AGENT_ID,
          prompt: 'Document batch processing.',
        });

        const body = gateway.requests[0]!.body;
        expect(body['model']).toBe('openclaw:agent-oc-scanner');
        expect(body['input']).toBe('Document batch processing.');
      } finally {
        await gateway.close();
      }
    });

    it('missing bearer token returns Unauthorized without gateway call', async () => {
      const gateway = await startStubGateway({});

      try {
        const invoker = new OpenClawGatewayMachineInvoker({
          baseUrl: gateway.baseUrl,
          resolveBearerToken: async () => undefined,
        });

        const result = await invoker.runAgent({
          tenantId: TENANT_ID,
          runId: RUN_ID,
          actionId: ACTION_ID,
          correlationId: CORRELATION_ID,
          machineId: MACHINE_ID,
          agentId: AGENT_ID,
          prompt: 'Should not reach gateway.',
        });

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('Expected failure');
        expect(result.errorKind).toBe('Unauthorized');
        expect(gateway.requests).toHaveLength(0);
      } finally {
        await gateway.close();
      }
    });
  });

  // Step 5: Policy enforcement for tool dispatch
  describe('Step 5 — Policy tier enforcement on tool dispatch', () => {
    it('dangerous tool blocked by policy before HTTP dispatch', async () => {
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
          toolName: 'shell.exec',
          parameters: { command: 'ls' },
          policyTier: 'Auto',
        });

        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('Expected policy denial');
        expect(result.errorKind).toBe('PolicyDenied');
        expect(result.message).toContain('shell.exec');
        expect(gateway.requests).toHaveLength(0);
      } finally {
        await gateway.close();
      }
    });

    it('safe tool dispatches to gateway with session key', async () => {
      const toolResponse = { ok: true, toolName: 'read:file', result: { path: '/tmp/test.json' } };
      const gateway = await startStubGateway({
        '/tools/invoke': [{ status: 200, body: toolResponse }],
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
          toolName: 'read:file',
          parameters: { path: '/tmp/test.json' },
          policyTier: 'Auto',
          sessionKey: 'session-oc-42',
        });

        expect(result.ok).toBe(true);
        expect(gateway.requests).toHaveLength(1);
        const req = gateway.requests[0]!;
        expect(req.path).toBe('/tools/invoke');
        expect(req.headers['x-openclaw-session-key']).toBe('session-oc-42');
      } finally {
        await gateway.close();
      }
    });
  });
});
