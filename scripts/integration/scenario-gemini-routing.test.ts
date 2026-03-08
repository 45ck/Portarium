/**
 * Scenario: Gemini agent tool routing through Portarium policy proxy.
 *
 * Exercises the full policy-gated tool invocation flow that the Gemini
 * agent demo uses, without any real LLM calls. Tests use the shared
 * startStubGateway() and ActionGatedToolInvoker directly.
 *
 * Test cases:
 *   1. read:file at Auto tier → Allow
 *   2. write:file at Auto tier → awaiting_approval (mutation tool)
 *   3. shell.exec at Auto tier → awaiting_approval (dangerous tool)
 *   4. Approval granted → re-invoke succeeds
 *   5. Approval denied → agent receives denial
 *   6. Multiple concurrent proposals → correct isolation
 *   7. Policy tier escalation (Auto → HumanApprove)
 */

import { describe, expect, it } from 'vitest';

import type {
  ActionId,
  CorrelationId,
  MachineId,
  RunId,
  TenantId,
} from '../../src/domain/primitives/index.js';
import { classifyOpenClawToolBlastRadiusV1 } from '../../src/domain/machines/openclaw-tool-blast-radius-v1.js';
import { ActionGatedToolInvoker } from '../../src/application/services/action-gated-tool-invoker.js';
import type { MachineInvokerPort } from '../../src/application/ports/machine-invoker.js';
import { startStubGateway, makeStubEvidenceLog } from './scenario-helpers.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-scenario-gemini' as TenantId;
const RUN_ID = 'run-gemini-001' as RunId;
const ACTION_ID = 'action-gemini-001' as ActionId;
const CORRELATION_ID = 'corr-gemini-001' as CorrelationId;
const MACHINE_ID = 'machine-gemini-001' as MachineId;

const DEMO_ACTOR = {
  userId: 'user-gemini-demo',
  workspaceId: 'ws-gemini-demo',
  roles: ['admin'],
} as any;

function makeMockInvoker(): MachineInvokerPort & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    async invokeTool(input) {
      calls.push(input);
      return {
        ok: true as const,
        output: {
          result: `executed ${input.toolName}`,
          parameters: input.parameters,
          timestamp: new Date().toISOString(),
        },
      };
    },
    async runAgent() {
      return { ok: true as const, output: { result: 'agent run completed' } };
    },
  };
}

function makeInvokeInput(
  toolName: string,
  policyTier: string,
  parameters: Record<string, unknown> = {},
) {
  return {
    actor: DEMO_ACTOR,
    tenantId: TENANT_ID,
    runId: RUN_ID,
    actionId: ACTION_ID,
    correlationId: CORRELATION_ID,
    machineId: MACHINE_ID,
    toolName,
    parameters,
    policyTier: policyTier as any,
  };
}

// ---------------------------------------------------------------------------
// Scenario: Gemini agent tool routing through Portarium policy
// ---------------------------------------------------------------------------

describe('Scenario: Gemini agent tool routing through Portarium policy', () => {
  // Step 1: Safe read tool at Auto tier → Allow
  describe('Step 1 — read:file at Auto tier is allowed', () => {
    it('read:file is classified as ReadOnly and passes policy at Auto tier', () => {
      const policy = classifyOpenClawToolBlastRadiusV1('read:file');
      expect(policy.category).toBe('ReadOnly');
      expect(policy.minimumTier).toBe('Auto');
    });

    it('ActionGatedToolInvoker allows read:file at Auto tier', async () => {
      const mockInvoker = makeMockInvoker();
      const gated = new ActionGatedToolInvoker(mockInvoker);

      const result = await gated.invoke(
        makeInvokeInput('read:file', 'Auto', { path: 'README.md' }),
      );

      expect(result.proposed).toBe(true);
      if (!result.proposed) throw new Error('Expected proposed');
      expect(result.ok).toBe(true);
      expect(mockInvoker.calls).toHaveLength(1);
    });
  });

  // Step 2: Mutation tool at Auto tier → denied by policy
  describe('Step 2 — write:file at Auto tier is denied by policy', () => {
    it('write:file is classified as Mutation tool requiring HumanApprove tier', () => {
      const policy = classifyOpenClawToolBlastRadiusV1('write:file');
      expect(policy.category).toBe('Mutation');
      expect(policy.minimumTier).toBe('HumanApprove');
    });

    it('ActionGatedToolInvoker denies write:file at Auto tier', async () => {
      const mockInvoker = makeMockInvoker();
      const gated = new ActionGatedToolInvoker(mockInvoker);

      const result = await gated.invoke(
        makeInvokeInput('write:file', 'Auto', { path: 'output.txt', content: 'hello' }),
      );

      expect(result.proposed).toBe(false);
      if (result.proposed) throw new Error('Expected denial');
      expect(result.denied).toBe(true);
      expect(result.reason).toBe('policy');
      expect(result.message).toContain('write:file');
      expect(mockInvoker.calls).toHaveLength(0);
    });
  });

  // Step 3: Dangerous tool at Auto tier → denied by policy
  describe('Step 3 — shell.exec at Auto tier is denied by policy', () => {
    it('shell.exec is classified as Dangerous tool requiring ManualOnly tier', () => {
      const policy = classifyOpenClawToolBlastRadiusV1('shell.exec');
      expect(policy.category).toBe('Dangerous');
      expect(policy.minimumTier).toBe('ManualOnly');
    });

    it('ActionGatedToolInvoker denies shell.exec at Auto tier', async () => {
      const mockInvoker = makeMockInvoker();
      const gated = new ActionGatedToolInvoker(mockInvoker);

      const result = await gated.invoke(
        makeInvokeInput('shell.exec', 'Auto', { command: 'git log --oneline -5' }),
      );

      expect(result.proposed).toBe(false);
      if (result.proposed) throw new Error('Expected denial');
      expect(result.denied).toBe(true);
      expect(result.reason).toBe('policy');
      expect(result.message).toContain('shell.exec');
      expect(mockInvoker.calls).toHaveLength(0);
    });
  });

  // Step 4: Approval granted → re-invoke succeeds
  describe('Step 4 — Approval granted allows previously denied tool', () => {
    it('write:file succeeds at HumanApprove tier (simulating post-approval escalation)', async () => {
      const mockInvoker = makeMockInvoker();
      const gated = new ActionGatedToolInvoker(mockInvoker);

      const result = await gated.invoke(
        makeInvokeInput('write:file', 'HumanApprove', {
          path: 'output.txt',
          content: 'approved content',
        }),
      );

      expect(result.proposed).toBe(true);
      if (!result.proposed) throw new Error('Expected proposed');
      expect(result.ok).toBe(true);
      expect(mockInvoker.calls).toHaveLength(1);
    });

    it('shell.exec succeeds at ManualOnly tier (simulating post-approval escalation)', async () => {
      const mockInvoker = makeMockInvoker();
      const gated = new ActionGatedToolInvoker(mockInvoker);

      const result = await gated.invoke(
        makeInvokeInput('shell.exec', 'ManualOnly', { command: 'ls' }),
      );

      expect(result.proposed).toBe(true);
      if (!result.proposed) throw new Error('Expected proposed');
      expect(result.ok).toBe(true);
      expect(mockInvoker.calls).toHaveLength(1);
    });
  });

  // Step 5: Approval denied → agent receives denial
  describe('Step 5 — Denied tool stays denied at insufficient tier', () => {
    it('shell.exec stays denied at HumanApprove tier (requires ManualOnly)', async () => {
      const mockInvoker = makeMockInvoker();
      const gated = new ActionGatedToolInvoker(mockInvoker);

      const result = await gated.invoke(
        makeInvokeInput('shell.exec', 'HumanApprove', { command: 'rm -rf /' }),
      );

      expect(result.proposed).toBe(false);
      if (result.proposed) throw new Error('Expected denial');
      expect(result.denied).toBe(true);
      expect(result.reason).toBe('policy');
      expect(result.message).toContain('ManualOnly');
    });
  });

  // Step 6: Multiple concurrent proposals → correct isolation
  describe('Step 6 — Multiple concurrent proposals are evaluated independently', () => {
    it('concurrent proposals produce independent results', async () => {
      const mockInvoker = makeMockInvoker();
      const gated = new ActionGatedToolInvoker(mockInvoker);

      const results = await Promise.all([
        gated.invoke(makeInvokeInput('read:file', 'Auto', { path: 'a.txt' })),
        gated.invoke(makeInvokeInput('write:file', 'Auto', { path: 'b.txt', content: 'x' })),
        gated.invoke(makeInvokeInput('shell.exec', 'Auto', { command: 'echo hi' })),
        gated.invoke(makeInvokeInput('search:documents', 'Auto', { query: 'test' })),
      ]);

      // read:file and search:documents should be allowed (ReadOnly category)
      expect(results[0].proposed).toBe(true);
      expect(results[3].proposed).toBe(true);

      // write:file and shell.exec should be denied
      expect(results[1].proposed).toBe(false);
      expect(results[2].proposed).toBe(false);

      // Only safe tools were forwarded to the invoker
      expect(mockInvoker.calls).toHaveLength(2);
    });
  });

  // Step 7: Policy tier escalation
  describe('Step 7 — Policy tier escalation (Auto → HumanApprove)', () => {
    it('all tools pass at ManualOnly tier', async () => {
      const mockInvoker = makeMockInvoker();
      const gated = new ActionGatedToolInvoker(mockInvoker);

      const tools = ['read:file', 'search:documents', 'write:file', 'shell.exec'];
      const results = await Promise.all(
        tools.map((t) => gated.invoke(makeInvokeInput(t, 'ManualOnly'))),
      );

      for (const result of results) {
        expect(result.proposed).toBe(true);
      }
      expect(mockInvoker.calls).toHaveLength(4);
    });

    it('classification outputs correct minimum tiers for each tool', () => {
      const expectations: [string, string, string][] = [
        ['read:file', 'ReadOnly', 'Auto'],
        ['search:documents', 'ReadOnly', 'Auto'],
        ['write:file', 'Mutation', 'HumanApprove'],
        ['shell.exec', 'Dangerous', 'ManualOnly'],
      ];

      for (const [toolName, expectedCategory, expectedTier] of expectations) {
        const policy = classifyOpenClawToolBlastRadiusV1(toolName);
        expect(policy.category).toBe(expectedCategory);
        expect(policy.minimumTier).toBe(expectedTier);
      }
    });
  });

  // Step 8: Evidence logging for Gemini tool routing
  describe('Step 8 — Evidence logging records Gemini agent tool routing', () => {
    it('evidence log captures policy-allowed and policy-denied actions', async () => {
      const evidenceLog = makeStubEvidenceLog('ev-gemini');

      // Record allowed action
      const allowedEntry = await evidenceLog.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-allowed' as any,
        workspaceId: 'ws-gemini-demo' as any,
        correlationId: CORRELATION_ID,
        occurredAtIso: '2026-03-06T10:00:00.000Z',
        category: 'Action',
        summary: 'Gemini agent read:file — allowed at Auto tier',
        actor: { kind: 'System' },
        links: { runId: RUN_ID },
      });

      // Record denied action
      const deniedEntry = await evidenceLog.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-denied' as any,
        workspaceId: 'ws-gemini-demo' as any,
        correlationId: CORRELATION_ID,
        occurredAtIso: '2026-03-06T10:00:01.000Z',
        category: 'Action',
        summary: 'Gemini agent shell.exec — denied at Auto tier (requires HumanApprove)',
        actor: { kind: 'System' },
        links: { runId: RUN_ID },
      });

      expect(evidenceLog.entries).toHaveLength(2);
      expect(allowedEntry.correlationId).toBe(CORRELATION_ID);
      expect(deniedEntry.correlationId).toBe(CORRELATION_ID);
      expect(deniedEntry.previousHash).toBe(allowedEntry.hashSha256);
    });
  });

  // Step 9: Proxy HTTP integration (stub gateway simulates proxy behavior)
  describe('Step 9 — Proxy HTTP integration via stub gateway', () => {
    it('stub gateway simulates policy proxy allow response', async () => {
      const gateway = await startStubGateway({
        '/tools/invoke': [
          {
            status: 200,
            body: {
              allowed: true,
              decision: 'Allow',
              tool: 'read:file',
              tier: 'Auto',
              category: 'safe',
              output: { result: 'file contents here' },
            },
          },
        ],
      });

      try {
        const resp = await fetch(`${gateway.baseUrl}/tools/invoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolName: 'read:file',
            parameters: { path: 'README.md' },
            policyTier: 'Auto',
          }),
        });

        const result = (await resp.json()) as Record<string, unknown>;
        expect(result['allowed']).toBe(true);
        expect(result['tool']).toBe('read:file');
        expect(gateway.requests).toHaveLength(1);
        expect(gateway.requests[0]!.body['toolName']).toBe('read:file');
      } finally {
        await gateway.close();
      }
    });

    it('stub gateway simulates policy proxy awaiting_approval response', async () => {
      const approvalId = 'approval-gemini-test-001';
      const gateway = await startStubGateway({
        '/tools/invoke': [
          {
            status: 202,
            body: {
              status: 'awaiting_approval',
              approvalId,
              toolName: 'shell.exec',
              minimumTier: 'HumanApprove',
              message: 'Tool "shell.exec" requires human approval.',
            },
          },
        ],
      });

      try {
        const resp = await fetch(`${gateway.baseUrl}/tools/invoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolName: 'shell.exec',
            parameters: { command: 'ls' },
            policyTier: 'Auto',
          }),
        });

        const result = (await resp.json()) as Record<string, unknown>;
        expect(resp.status).toBe(202);
        expect(result['status']).toBe('awaiting_approval');
        expect(result['approvalId']).toBe(approvalId);
        expect(result['toolName']).toBe('shell.exec');
      } finally {
        await gateway.close();
      }
    });

    it('concurrent requests to stub gateway are handled independently', async () => {
      const gateway = await startStubGateway({
        '/tools/invoke': [
          { status: 200, body: { allowed: true, tool: 'read:file' } },
          { status: 202, body: { status: 'awaiting_approval', tool: 'write:file' } },
          { status: 202, body: { status: 'awaiting_approval', tool: 'shell.exec' } },
        ],
      });

      try {
        const [r1, r2, r3] = await Promise.all([
          fetch(`${gateway.baseUrl}/tools/invoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toolName: 'read:file', policyTier: 'Auto' }),
          }),
          fetch(`${gateway.baseUrl}/tools/invoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toolName: 'write:file', policyTier: 'Auto' }),
          }),
          fetch(`${gateway.baseUrl}/tools/invoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toolName: 'shell.exec', policyTier: 'Auto' }),
          }),
        ]);

        expect(r1.status).toBe(200);
        expect(r2.status).toBe(202);
        expect(r3.status).toBe(202);
        expect(gateway.requests).toHaveLength(3);

        // Each request carries its own toolName
        const toolNames = gateway.requests.map((r) => r.body['toolName']);
        expect(toolNames).toContain('read:file');
        expect(toolNames).toContain('write:file');
        expect(toolNames).toContain('shell.exec');
      } finally {
        await gateway.close();
      }
    });
  });
});
