import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { runExperiment } from '../../experiments/shared/experiment-runner.js';
import { runLiveModelPreflight } from '../../experiments/shared/live-model-preflight.js';

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
    const calls: { input: Parameters<typeof fetch>[0]; init: RequestInit | undefined }[] = [];
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
      baseUrl: 'https://api.example.test/v1',
      credentialSource: { kind: 'env', name: 'OPENAI_API_KEY' },
      probe: 'chat-completions',
      httpStatus: 200,
    });
    expect(JSON.stringify(result)).not.toContain('sk-test-secret');
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
      expectedCredentialSources: ['OPENROUTER_API_KEY'],
    });
    expect(calls).toHaveLength(0);
  });

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
      baseUrl: 'codex-cli',
      credentialSource: { kind: 'cli', name: 'codex' },
      probe: 'codex-exec',
    });
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
        credentialSource: { kind: 'cli', name: 'codex' },
        probe: 'codex-exec',
        failureKind: 'credential_rejected',
      });
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
