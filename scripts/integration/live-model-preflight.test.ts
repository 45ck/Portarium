import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { runExperiment } from '../../experiments/shared/experiment-runner.js';
import { runLiveModelPreflight } from '../../experiments/shared/live-model-preflight.js';

interface FetchCall {
  readonly input: Parameters<typeof fetch>[0];
  readonly init: RequestInit | undefined;
}

const providerCases = [
  {
    provider: 'claude',
    envKey: 'ANTHROPIC_API_KEY',
    secret: 'anthropic-test-secret',
    baseUrlKey: 'ANTHROPIC_BASE_URL',
    baseUrl: 'https://anthropic.example.test/v1/',
    modelKey: 'ANTHROPIC_MODEL',
    model: 'claude-test',
    probe: 'claude-messages',
    expectedUrl: 'https://anthropic.example.test/v1/messages',
    expectedHeader: 'x-api-key',
    expectedBody: {
      model: 'claude-test',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Return the single word ready.' }],
    },
  },
  {
    provider: 'gemini',
    envKey: 'GOOGLE_VERTEX_API_KEY',
    secret: 'gemini-test-secret',
    baseUrlKey: 'GEMINI_BASE_URL',
    baseUrl: 'https://generativelanguage.example.test/v1beta/',
    modelKey: 'GEMINI_MODEL',
    model: 'gemini-test',
    probe: 'gemini-generate-content',
    expectedUrl:
      'https://generativelanguage.example.test/v1beta/models/gemini-test:generateContent',
    expectedHeader: 'x-goog-api-key',
    expectedBody: {
      contents: [{ role: 'user', parts: [{ text: 'Return the single word ready.' }] }],
      generationConfig: {
        maxOutputTokens: 1,
        temperature: 0,
      },
    },
  },
] as const;

function expectRedacted(result: unknown, forbidden: readonly string[]) {
  const serialized = JSON.stringify(result);
  for (const fragment of forbidden) {
    expect(serialized).not.toContain(fragment);
  }
}

describe('live model experiment preflight', () => {
  it('stays disabled unless live model runs are explicitly opted in', async () => {
    const calls: unknown[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(input);
      return new Response('{}', { status: 200 });
    };

    const result = await runLiveModelPreflight({
      env: {},
      fetchImpl,
    });

    expect(result.status).toBe('disabled');
    expect(result.providerSelection).toBe('none');
    expect(calls).toHaveLength(0);
  });

  it('auto-detects OpenAI credentials and records provider metadata without the secret', async () => {
    const calls: FetchCall[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input, init });
      return new Response(JSON.stringify({ id: 'cmpl-preflight' }), { status: 200 });
    };

    const result = await runLiveModelPreflight({
      env: {
        PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
        OPENAI_API_KEY: 'sk-test-secret',
        OPENAI_MODEL: 'gpt-test',
        OPENAI_BASE_URL: 'https://api.example.test/v1/',
      },
      fetchImpl,
    });

    expect(result).toMatchObject({
      status: 'ready',
      provider: 'openai',
      providerSelection: 'auto',
      model: 'gpt-test',
      probe: 'chat-completions',
      httpStatus: 200,
    });
    expectRedacted(result, ['sk-test-secret', 'https://api.example.test', 'OPENAI_API_KEY']);
    expect(String(calls[0]?.input)).toBe('https://api.example.test/v1/chat/completions');
    expect(calls[0]?.init?.headers).toMatchObject({
      authorization: 'Bearer sk-test-secret',
      'content-type': 'application/json',
    });
  });

  it('skips gracefully when a forced provider has no credentials', async () => {
    const calls: unknown[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(input);
      return new Response('{}', { status: 200 });
    };

    const result = await runLiveModelPreflight({
      env: {
        PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
        PORTARIUM_LIVE_MODEL_PROVIDER: 'openrouter',
      },
      fetchImpl,
    });

    expect(result).toMatchObject({
      status: 'skipped',
      provider: 'openrouter',
      providerSelection: 'forced',
      failureKind: 'missing_credentials',
    });
    expectRedacted(result, ['OPENROUTER_API_KEY']);
    expect(calls).toHaveLength(0);
  });

  it.each(providerCases)(
    'skips $provider before fetch when credentials are missing',
    async ({ provider, envKey }) => {
      const calls: unknown[] = [];
      const fetchImpl: typeof fetch = async (input) => {
        calls.push(input);
        return new Response('{}', { status: 200 });
      };

      const result = await runLiveModelPreflight({
        env: {
          PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
          PORTARIUM_LIVE_MODEL_PROVIDER: provider,
        },
        fetchImpl,
      });

      expect(result).toMatchObject({
        status: 'skipped',
        provider,
        providerSelection: 'forced',
        failureKind: 'missing_credentials',
      });
      expectRedacted(result, [envKey]);
      expect(calls).toHaveLength(0);
    },
  );

  it('can require an explicit provider instead of auto-detecting ambient credentials', async () => {
    const calls: unknown[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(input);
      return new Response('{}', { status: 200 });
    };

    const result = await runLiveModelPreflight({
      env: {
        PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
        OPENAI_API_KEY: 'sk-test-secret',
      },
      fetchImpl,
      requireProvider: true,
    });

    expect(result).toMatchObject({
      status: 'skipped',
      providerSelection: 'none',
      failureKind: 'unsupported_provider',
    });
    expectRedacted(result, ['sk-test-secret', 'OPENAI_API_KEY']);
    expect(calls).toHaveLength(0);
  });

  it.each(providerCases)(
    'can require explicit provider instead of auto-detecting ambient $provider credentials',
    async ({ envKey, secret }) => {
      const calls: unknown[] = [];
      const fetchImpl: typeof fetch = async (input) => {
        calls.push(input);
        return new Response('{}', { status: 200 });
      };

      const result = await runLiveModelPreflight({
        env: {
          PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
          [envKey]: secret,
        },
        fetchImpl,
        requireProvider: true,
      });

      expect(result).toMatchObject({
        status: 'skipped',
        providerSelection: 'none',
        failureKind: 'unsupported_provider',
      });
      expectRedacted(result, [secret, envKey]);
      expect(calls).toHaveLength(0);
    },
  );

  it.each(providerCases)(
    'preflights $provider credentials without recording secrets or endpoints',
    async ({
      provider,
      envKey,
      secret,
      baseUrlKey,
      baseUrl,
      modelKey,
      model,
      probe,
      expectedUrl,
      expectedHeader,
      expectedBody,
    }) => {
      const calls: FetchCall[] = [];
      const fetchImpl: typeof fetch = async (input, init) => {
        calls.push({ input, init });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      };

      const result = await runLiveModelPreflight({
        env: {
          PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
          PORTARIUM_LIVE_MODEL_PROVIDER: provider,
          [envKey]: secret,
          [baseUrlKey]: baseUrl,
          [modelKey]: model,
        },
        fetchImpl,
      });

      expect(result).toMatchObject({
        status: 'ready',
        provider,
        providerSelection: 'forced',
        model,
        probe,
        httpStatus: 200,
      });
      expectRedacted(result, [secret, envKey, baseUrl, new URL(baseUrl).origin]);
      expect(String(calls[0]?.input)).toBe(expectedUrl);
      expect(calls[0]?.init?.headers).toMatchObject({
        [expectedHeader]: secret,
        'content-type': 'application/json',
      });
      expect(JSON.parse(String(calls[0]?.init?.body))).toEqual(expectedBody);
    },
  );

  it.each(providerCases)(
    'redacts $provider HTTP error details before returning preflight failure',
    async ({ provider, envKey, secret, baseUrlKey, baseUrl }) => {
      const fetchImpl: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            error: {
              message: `Credential ${secret} from ${envKey} failed at ${baseUrl}`,
            },
          }),
          { status: 403 },
        );

      const result = await runLiveModelPreflight({
        env: {
          PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
          PORTARIUM_LIVE_MODEL_PROVIDER: provider,
          [envKey]: secret,
          [baseUrlKey]: baseUrl,
        },
        fetchImpl,
      });

      expect(result).toMatchObject({
        status: 'failed',
        provider,
        failureKind: 'credential_rejected',
        httpStatus: 403,
      });
      expect(result.reason).toContain('[redacted]');
      expectRedacted(result, [secret, envKey, baseUrl, new URL(baseUrl).origin]);
    },
  );

  it.each(providerCases)(
    'classifies $provider quota, model, unexpected, and network failures',
    async ({ provider, envKey, secret, baseUrlKey, baseUrl }) => {
      for (const [status, failureKind] of [
        [429, 'quota_or_rate_limit'],
        [404, 'model_unavailable'],
        [500, 'unexpected_response'],
      ] as const) {
        const result = await runLiveModelPreflight({
          env: {
            PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
            PORTARIUM_LIVE_MODEL_PROVIDER: provider,
            [envKey]: secret,
          },
          fetchImpl: async () =>
            new Response(JSON.stringify({ message: 'provider failed' }), { status }),
        });

        expect(result).toMatchObject({
          status: 'failed',
          provider,
          failureKind,
          httpStatus: status,
        });
      }

      const networkResult = await runLiveModelPreflight({
        env: {
          PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
          PORTARIUM_LIVE_MODEL_PROVIDER: provider,
          [envKey]: secret,
          [baseUrlKey]: baseUrl,
        },
        fetchImpl: async () => {
          throw new Error(`network lost for ${secret} via ${envKey} at ${baseUrl}`);
        },
      });

      expect(networkResult).toMatchObject({
        status: 'failed',
        provider,
        failureKind: 'network_error',
      });
      expectRedacted(networkResult, [secret, envKey, baseUrl, new URL(baseUrl).origin]);
    },
  );

  it('uses Codex CLI auth when the codex provider is forced without API-key credentials', async () => {
    const calls: unknown[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(input);
      return new Response('{}', { status: 200 });
    };

    const result = await runLiveModelPreflight({
      env: {
        PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
        PORTARIUM_LIVE_MODEL_PROVIDER: 'codex',
      },
      fetchImpl,
      codexExecImpl: async (prompt, timeoutMs) => ({
        exitCode: 0,
        stdout: `ready\nprompt=${prompt}\ntimeout=${timeoutMs}`,
        stderr: '',
      }),
    });

    expect(result).toMatchObject({
      status: 'ready',
      provider: 'codex',
      providerSelection: 'forced',
      model: 'codex-cli',
      probe: 'codex-exec',
    });
    expectRedacted(result, ['codex CLI auth']);
    expect(calls).toHaveLength(0);
  });

  it('records Codex CLI auth failures before executing experiments', async () => {
    let executed = false;
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-codex-preflight-fail-'));

    try {
      const outcome = await runExperiment({
        name: 'codex-cli-preflight-fail',
        resultsDir,
        liveModelPreflight: {
          env: {
            PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
            PORTARIUM_LIVE_MODEL_PROVIDER: 'codex',
          },
          codexExecImpl: async () => ({
            exitCode: 1,
            stdout: '',
            stderr: 'not logged in; run codex login',
          }),
        },
        async execute() {
          executed = true;
        },
        async verify() {
          return [];
        },
      });

      expect(executed).toBe(false);
      expect(outcome.outcome).toBe('inconclusive');
      expect(outcome.liveModelPreflight).toMatchObject({
        status: 'failed',
        provider: 'codex',
        probe: 'codex-exec',
        failureKind: 'credential_rejected',
      });
      expectRedacted(outcome.liveModelPreflight, ['CODEX_API_KEY']);
    } finally {
      rmSync(resultsDir, { recursive: true, force: true });
    }
  });

  it('records a skipped result bundle instead of executing without credentials', async () => {
    let executed = false;
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-live-preflight-skip-'));

    try {
      const outcome = await runExperiment({
        name: 'missing-credential-preflight',
        resultsDir,
        liveModelPreflight: {
          env: {
            PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
            PORTARIUM_LIVE_MODEL_PROVIDER: 'openai',
          },
        },
        async execute() {
          executed = true;
        },
        async verify() {
          return [];
        },
      });

      const saved = JSON.parse(readFileSync(join(resultsDir, 'outcome.json'), 'utf8')) as {
        outcome: string;
        liveModelPreflight: { status: string; failureKind: string };
      };

      expect(executed).toBe(false);
      expect(outcome.outcome).toBe('skipped');
      expect(outcome.liveModelPreflight?.failureKind).toBe('missing_credentials');
      expect(saved.outcome).toBe('skipped');
      expect(saved.liveModelPreflight.status).toBe('skipped');
    } finally {
      rmSync(resultsDir, { recursive: true, force: true });
    }
  });

  it('maps obvious quota responses before an experiment executes', async () => {
    let executed = false;
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-live-preflight-'));
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), { status: 429 });

    try {
      const outcome = await runExperiment({
        name: 'quota-preflight',
        resultsDir,
        liveModelPreflight: {
          env: {
            PORTARIUM_EXPERIMENT_LIVE_LLM: 'true',
            OPENAI_API_KEY: 'sk-test-secret',
          },
          fetchImpl,
        },
        async execute() {
          executed = true;
        },
        async verify() {
          return [];
        },
      });

      const saved = JSON.parse(readFileSync(join(resultsDir, 'outcome.json'), 'utf8')) as {
        liveModelPreflight: { failureKind: string; reason: string };
      };

      expect(executed).toBe(false);
      expect(outcome.outcome).toBe('inconclusive');
      expect(outcome.liveModelPreflight?.failureKind).toBe('quota_or_rate_limit');
      expect(saved.liveModelPreflight.failureKind).toBe('quota_or_rate_limit');
      expect(saved.liveModelPreflight.reason).toBe('quota exceeded');
    } finally {
      rmSync(resultsDir, { recursive: true, force: true });
    }
  });
});
