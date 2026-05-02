/**
 * Scenario: Live approval lifecycle with real LLM agents.
 *
 * Uses live LLM inference + live Portarium proxy + mock tools
 * (mockMachineInvoker returns canned results). Skips gracefully unless the
 * explicit live eval env vars and provider credentials are present.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  runLiveModelPreflight,
  type LiveModelPreflightResult,
} from '../../experiments/shared/live-model-preflight.js';
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

type LiveApprovalProvider = LLMAdapter['provider'];

type LiveApprovalConfig =
  | {
      readonly status: 'ready';
      readonly provider: LiveApprovalProvider;
      readonly model: string;
      readonly probe: 'agent-approval-lifecycle';
    }
  | {
      readonly status: 'disabled' | 'skipped';
      readonly reason: string;
    };

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const LIVE_LLM_OPT_IN_ENV = 'PORTARIUM_EXPERIMENT_LIVE_LLM';
const LIVE_APPROVAL_OPT_IN_ENV = 'PORTARIUM_LIVE_APPROVAL_LIFECYCLE';
const LIVE_APPROVAL_PROVIDER_ENV = 'PORTARIUM_LIVE_APPROVAL_PROVIDER';

const PROVIDER_CREDENTIAL_ENV: Record<LiveApprovalProvider, string> = {
  claude: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GOOGLE_VERTEX_API_KEY',
};

const PROVIDER_MODEL: Record<LiveApprovalProvider, string> = {
  claude: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
};

const PROVIDER_PREFLIGHT_PROBE: Record<
  LiveApprovalProvider,
  NonNullable<LiveModelPreflightResult['probe']>
> = {
  claude: 'claude-messages',
  openai: 'chat-completions',
  gemini: 'gemini-generate-content',
};

const liveApprovalConfig = resolveLiveApprovalConfig(process.env);

interface RedactedPreflightMetadata {
  readonly status: LiveModelPreflightResult['status'];
  readonly provider: string | undefined;
  readonly model: string | undefined;
  readonly probe: LiveModelPreflightResult['probe'] | undefined;
  readonly failureKind: LiveModelPreflightResult['failureKind'] | undefined;
}

function resolveLiveApprovalConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): LiveApprovalConfig {
  if (!isTrue(env[LIVE_LLM_OPT_IN_ENV]) || !isTrue(env[LIVE_APPROVAL_OPT_IN_ENV])) {
    return {
      status: 'disabled',
      reason: `Set ${LIVE_LLM_OPT_IN_ENV}=true and ${LIVE_APPROVAL_OPT_IN_ENV}=true to run live approval evals.`,
    };
  }

  const selectedProvider = env[LIVE_APPROVAL_PROVIDER_ENV];
  if (!isLiveApprovalProvider(selectedProvider)) {
    return {
      status: 'skipped',
      reason: `Set ${LIVE_APPROVAL_PROVIDER_ENV} to one of: claude, openai, gemini.`,
    };
  }

  if (!hasValue(env[PROVIDER_CREDENTIAL_ENV[selectedProvider]])) {
    return {
      status: 'skipped',
      reason: `Selected provider "${selectedProvider}" is missing its credential env var.`,
    };
  }

  return {
    status: 'ready',
    provider: selectedProvider,
    model: PROVIDER_MODEL[selectedProvider],
    probe: 'agent-approval-lifecycle',
  };
}

function isTrue(value: string | undefined): boolean {
  return TRUE_VALUES.has((value ?? '').toLowerCase());
}

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

function isLiveApprovalProvider(value: string | undefined): value is LiveApprovalProvider {
  return value === 'claude' || value === 'openai' || value === 'gemini';
}

async function runLiveApprovalPreflight(
  config: Extract<LiveApprovalConfig, { readonly status: 'ready' }>,
): Promise<LiveModelPreflightResult> {
  return runLiveModelPreflight({
    provider: config.provider,
    model: config.model,
    env: process.env,
    requireProvider: true,
  });
}

function redactPreflightMetadata(preflight: LiveModelPreflightResult): RedactedPreflightMetadata {
  return {
    status: preflight.status,
    provider: preflight.provider,
    model: preflight.model,
    probe: preflight.probe,
    failureKind: preflight.failureKind,
  };
}

// ---------------------------------------------------------------------------
// Proxy lifecycle
// ---------------------------------------------------------------------------

let proxyUrl: string;
let closeProxy: () => void;
let liveApprovalPreflight: LiveModelPreflightResult | undefined;

const SYSTEM_PROMPT =
  'You are a task runner. Execute the requested steps using the available tools. ' +
  'Report the result of each step.';

const USER_PROMPT =
  'Please do the following in order:\n' +
  '1. Read the file at path "README.md"\n' +
  '2. Write the text "test output" to the file at path "output.txt"\n' +
  'Report the result of each step.';

const REJECT_PROMPT =
  'Please write the text "rejected output" to the file at path "reject-output.txt". ' +
  'Report whether the write succeeded.';

// ---------------------------------------------------------------------------
// Shared test logic
// ---------------------------------------------------------------------------

async function submitDecision(approvalId: string, decision: 'approved' | 'denied') {
  const resp = await fetch(`${proxyUrl}/approvals/${approvalId}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
  expect(resp.status).toBe(200);
}

async function pollApproval(approvalId: string) {
  const resp = await fetch(`${proxyUrl}/approvals/${approvalId}`);
  expect(resp.status).toBe(200);
  return (await resp.json()) as Record<string, unknown>;
}

async function createSelectedAdapter(provider: LiveApprovalProvider): Promise<LLMAdapter | null> {
  if (provider === 'claude') return createClaudeAdapter();
  if (provider === 'openai') return createOpenAIAdapter();
  return createGeminiAdapter();
}

async function runAndAssertApproved(adapter: LLMAdapter) {
  const approvalIds: string[] = [];
  const trace = await runAgentLoop({
    adapter,
    proxyUrl,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    policyTier: 'Auto',
    maxRounds: 8,
    onApprovalRequired: async (approvalId) => {
      approvalIds.push(approvalId);
      const before = await pollApproval(approvalId);
      expect(before['status']).toBe('pending');
      await submitDecision(approvalId, 'approved');
      return { approved: true };
    },
  });

  // At least 2 tool interactions (read + write)
  expect(trace.toolInteractions.length).toBeGreaterThanOrEqual(2);

  // At least one safe tool allowed directly (200)
  const directlyAllowed = trace.toolInteractions.filter((t) => t.approved && !t.approvedByHuman);
  expect(directlyAllowed.length).toBeGreaterThanOrEqual(1);

  // At least one mutation tool went through approval
  const humanApproved = trace.toolInteractions.filter((t) => t.approved && t.approvedByHuman);
  expect(humanApproved.length).toBeGreaterThanOrEqual(1);

  expect(approvalIds.length).toBeGreaterThanOrEqual(1);

  // Agent loop completed
  expect(trace.rounds).toBeGreaterThanOrEqual(1);
  expect(trace.rounds).toBeLessThanOrEqual(8);

  return trace;
}

async function runAndAssertDenied(adapter: LLMAdapter) {
  const approvalIds: string[] = [];
  const trace = await runAgentLoop({
    adapter,
    proxyUrl,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: REJECT_PROMPT,
    policyTier: 'Auto',
    maxRounds: 8,
    onApprovalRequired: async (approvalId) => {
      approvalIds.push(approvalId);
      const before = await pollApproval(approvalId);
      expect(before['status']).toBe('pending');
      await submitDecision(approvalId, 'denied');
      return { approved: false };
    },
  });

  const denied = trace.toolInteractions.filter((t) => !t.approved && t.approvalId);
  expect(approvalIds.length).toBeGreaterThanOrEqual(1);
  expect(denied.length).toBeGreaterThanOrEqual(1);
  expect(trace.toolInteractions.some((t) => t.approvedByHuman)).toBe(false);
  expect(trace.rounds).toBeGreaterThanOrEqual(1);
  expect(trace.rounds).toBeLessThanOrEqual(8);

  return trace;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('live approval lifecycle gating', () => {
  it('is disabled by default without live opt-in env vars', () => {
    expect(resolveLiveApprovalConfig({}).status).toBe('disabled');
  });

  it('requires an explicit provider even when a credential is present', () => {
    const result = resolveLiveApprovalConfig({
      PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
      PORTARIUM_LIVE_APPROVAL_LIFECYCLE: 'true',
      OPENAI_API_KEY: 'sk-test-secret',
    });

    expect(result.status).toBe('skipped');
    expect(JSON.stringify(result)).not.toContain('sk-test-secret');
    expect(JSON.stringify(result)).not.toContain('OPENAI_API_KEY');
  });

  it.each([
    ['claude', 'ANTHROPIC_API_KEY', 'claude-sonnet-4-6'],
    ['openai', 'OPENAI_API_KEY', 'gpt-4o'],
    ['gemini', 'GOOGLE_VERTEX_API_KEY', 'gemini-2.0-flash'],
  ] as const)(
    'records only redacted provider/model/probe metadata for %s',
    (provider, envKey, model) => {
      const result = resolveLiveApprovalConfig({
        PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
        PORTARIUM_LIVE_APPROVAL_LIFECYCLE: 'true',
        PORTARIUM_LIVE_APPROVAL_PROVIDER: provider,
        [envKey]: 'test-secret',
      });

      expect(result).toEqual({
        status: 'ready',
        provider,
        model,
        probe: 'agent-approval-lifecycle',
      });
      expect(JSON.stringify(result)).not.toContain('test-secret');
      expect(JSON.stringify(result)).not.toContain(envKey);
    },
  );

  it('redacts shared live-model preflight details before scenario metadata is recorded', () => {
    const metadata = redactPreflightMetadata({
      status: 'failed',
      checkedAt: '2026-05-01T00:00:00.000Z',
      providerSelection: 'forced',
      provider: 'openai',
      model: 'gpt-4o',
      probe: 'chat-completions',
      failureKind: 'credential_rejected',
      reason: 'credential sk-test-secret from OPENAI_API_KEY was rejected',
    });

    expect(metadata).toEqual({
      status: 'failed',
      provider: 'openai',
      model: 'gpt-4o',
      probe: 'chat-completions',
      failureKind: 'credential_rejected',
    });
    expect(JSON.stringify(metadata)).not.toContain('sk-test-secret');
    expect(JSON.stringify(metadata)).not.toContain('OPENAI_API_KEY');
  });
});

describe.skipIf(liveApprovalConfig.status !== 'ready')(
  'Scenario: Live approval lifecycle with real LLM agents',
  () => {
    const metadata =
      liveApprovalConfig.status === 'ready'
        ? {
            provider: liveApprovalConfig.provider,
            model: liveApprovalConfig.model,
            probe: liveApprovalConfig.probe,
          }
        : undefined;

    beforeAll(async () => {
      if (liveApprovalConfig.status !== 'ready') return;

      liveApprovalPreflight = await runLiveApprovalPreflight(liveApprovalConfig);
      const credential = process.env[PROVIDER_CREDENTIAL_ENV[liveApprovalConfig.provider]];
      if (credential) expect(JSON.stringify(liveApprovalPreflight)).not.toContain(credential);
      expect(JSON.stringify(liveApprovalPreflight)).not.toContain(
        PROVIDER_CREDENTIAL_ENV[liveApprovalConfig.provider],
      );
      expect(liveApprovalPreflight).toMatchObject({
        status: 'ready',
        provider: liveApprovalConfig.provider,
        model: liveApprovalConfig.model,
        probe: PROVIDER_PREFLIGHT_PROBE[liveApprovalConfig.provider],
      });

      // @ts-expect-error -- untyped .mjs demo module
      const proxyMod = await import('../demo/portarium-tool-proxy.mjs');
      const handle = await proxyMod.startPolicyProxy(0);
      proxyUrl = handle.url;
      closeProxy = handle.close;
    });

    afterAll(() => {
      closeProxy?.();
    });

    it('records redacted provider metadata for the configured live run', () => {
      expect(metadata).toEqual({
        provider: liveApprovalConfig.status === 'ready' ? liveApprovalConfig.provider : undefined,
        model: liveApprovalConfig.status === 'ready' ? liveApprovalConfig.model : undefined,
        probe: 'agent-approval-lifecycle',
      });
      expect(JSON.stringify(metadata)).not.toContain('API_KEY');
      expect(JSON.stringify(metadata)).not.toContain('sk-');

      if (liveApprovalPreflight) {
        const preflightMetadata = redactPreflightMetadata(liveApprovalPreflight);
        expect(JSON.stringify(preflightMetadata)).not.toContain('API_KEY');
        expect(JSON.stringify(preflightMetadata)).not.toContain('sk-');
      }
    });

    it('demonstrates proposal -> approval -> execute', { timeout: 120_000 }, async () => {
      if (liveApprovalConfig.status !== 'ready') return;
      if (liveApprovalPreflight?.status !== 'ready') return;
      const adapter = await createSelectedAdapter(liveApprovalConfig.provider);
      expect(adapter).not.toBeNull();
      await runAndAssertApproved(adapter!);
    });

    it('demonstrates proposal -> reject without execution', { timeout: 120_000 }, async () => {
      if (liveApprovalConfig.status !== 'ready') return;
      if (liveApprovalPreflight?.status !== 'ready') return;
      const adapter = await createSelectedAdapter(liveApprovalConfig.provider);
      expect(adapter).not.toBeNull();
      await runAndAssertDenied(adapter!);
    });
  },
);
