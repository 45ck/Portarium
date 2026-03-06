/**
 * Scenario: Live approval lifecycle with real LLM agents.
 *
 * Uses live LLM inference (Claude, OpenAI, Gemini) + live Portarium proxy +
 * mock tools (mockMachineInvoker returns canned results). Skips gracefully
 * when API keys are absent.
 *
 * The auto-approver runs in background so no human is needed for CI.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAutoApprover, type AutoApproverHandle } from './lab-auto-approver.js';
import {
  createClaudeAdapter,
  createOpenAIAdapter,
  createGeminiAdapter,
  runAgentLoop,
  type LLMAdapter,
} from './lab-agent-adapter.js';

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

const HAS_ANTHROPIC_KEY = !!process.env['ANTHROPIC_API_KEY'];
const HAS_OPENAI_KEY = !!process.env['OPENAI_API_KEY'];
const HAS_GEMINI_KEY = !!process.env['GOOGLE_VERTEX_API_KEY'];
const HAS_ANY_KEY = HAS_ANTHROPIC_KEY || HAS_OPENAI_KEY || HAS_GEMINI_KEY;

// ---------------------------------------------------------------------------
// Proxy + auto-approver lifecycle
// ---------------------------------------------------------------------------

let proxyUrl: string;
let closeProxy: () => void;
let autoApprover: AutoApproverHandle;

const SYSTEM_PROMPT =
  'You are a task runner. Execute the requested steps using the available tools. ' +
  'Report the result of each step.';

const USER_PROMPT =
  'Please do the following in order:\n' +
  '1. Read the file at path "README.md"\n' +
  '2. Write the text "test output" to the file at path "output.txt"\n' +
  'Report the result of each step.';

// ---------------------------------------------------------------------------
// Shared test logic
// ---------------------------------------------------------------------------

async function runAndAssert(adapter: LLMAdapter) {
  const trace = await runAgentLoop({
    adapter,
    proxyUrl,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    policyTier: 'Auto',
    maxRounds: 8,
  });

  // At least 2 tool interactions (read + write)
  expect(trace.toolInteractions.length).toBeGreaterThanOrEqual(2);

  // At least one safe tool allowed directly (200)
  const directlyAllowed = trace.toolInteractions.filter((t) => t.approved && !t.approvedByHuman);
  expect(directlyAllowed.length).toBeGreaterThanOrEqual(1);

  // At least one mutation tool went through approval
  const humanApproved = trace.toolInteractions.filter((t) => t.approved && t.approvedByHuman);
  expect(humanApproved.length).toBeGreaterThanOrEqual(1);

  // Auto-approver processed at least one
  expect(autoApprover.approvedIds.length).toBeGreaterThanOrEqual(1);

  // Agent loop completed
  expect(trace.rounds).toBeGreaterThanOrEqual(1);
  expect(trace.rounds).toBeLessThanOrEqual(8);

  return trace;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_ANY_KEY)('Scenario: Live approval lifecycle with real LLM agents', () => {
  beforeAll(async () => {
    // @ts-expect-error -- untyped .mjs demo module
    const proxyMod = await import('../demo/portarium-tool-proxy.mjs');
    const handle = await proxyMod.startPolicyProxy(0);
    proxyUrl = handle.url;
    closeProxy = handle.close;

    autoApprover = startAutoApprover(proxyUrl, {
      pollIntervalMs: 200,
      approveDelayMs: 500,
      decision: 'approved',
    });
  });

  afterAll(() => {
    autoApprover?.stop();
    closeProxy?.();
  });

  describe.skipIf(!HAS_ANTHROPIC_KEY)('Claude (claude-sonnet-4-6)', { timeout: 120_000 }, () => {
    it('safe tool allowed + mutation tool approved via lifecycle', async () => {
      const adapter = await createClaudeAdapter();
      expect(adapter).not.toBeNull();
      await runAndAssert(adapter!);
    });
  });

  describe.skipIf(!HAS_OPENAI_KEY)('OpenAI (gpt-4o)', { timeout: 120_000 }, () => {
    it('safe tool allowed + mutation tool approved via lifecycle', async () => {
      const adapter = await createOpenAIAdapter();
      expect(adapter).not.toBeNull();
      await runAndAssert(adapter!);
    });
  });

  describe.skipIf(!HAS_GEMINI_KEY)('Gemini (gemini-2.0-flash)', { timeout: 120_000 }, () => {
    it('safe tool allowed + mutation tool approved via lifecycle', async () => {
      const adapter = await createGeminiAdapter();
      expect(adapter).not.toBeNull();
      await runAndAssert(adapter!);
    });
  });
});
