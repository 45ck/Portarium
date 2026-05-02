/**
 * Provider and credential preflight for experiments that use live model inference.
 *
 * The preflight is intentionally opt-in. Normal CI must not need provider secrets
 * and must not make live LLM calls by accident.
 */

import { spawn } from 'node:child_process';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

const OPT_IN_ENV_KEYS = ['PORTARIUM_EXPERIMENT_LIVE_LLM', 'PORTARIUM_LIVE_MODEL_RUNS'];
const PROVIDER_ENV_KEYS = ['PORTARIUM_LIVE_MODEL_PROVIDER', 'PORTARIUM_EXPERIMENT_LLM_PROVIDER'];

const PROVIDER_DEFAULTS = {
  openai: {
    model: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    modelEnvKeys: ['PORTARIUM_LIVE_MODEL', 'OPENAI_MODEL'],
    baseUrlEnvKeys: ['OPENAI_BASE_URL'],
    credentialEnvKeys: ['OPENAI_API_KEY'],
    probe: 'chat-completions',
  },
  openrouter: {
    model: 'openai/gpt-4o',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelEnvKeys: ['PORTARIUM_LIVE_MODEL', 'OPENROUTER_MODEL'],
    baseUrlEnvKeys: ['OPENROUTER_BASE_URL'],
    credentialEnvKeys: ['OPENROUTER_API_KEY'],
    probe: 'chat-completions',
  },
  codex: {
    model: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    modelEnvKeys: ['PORTARIUM_LIVE_MODEL', 'CODEX_MODEL', 'OPENAI_MODEL'],
    baseUrlEnvKeys: ['CODEX_BASE_URL', 'OPENAI_BASE_URL'],
    credentialEnvKeys: ['CODEX_API_KEY', 'OPENAI_API_KEY'],
    probe: 'chat-completions',
  },
  claude: {
    model: 'claude-sonnet-4-6',
    baseUrl: 'https://api.anthropic.com/v1',
    modelEnvKeys: ['PORTARIUM_LIVE_MODEL', 'CLAUDE_MODEL', 'ANTHROPIC_MODEL'],
    baseUrlEnvKeys: ['CLAUDE_BASE_URL', 'ANTHROPIC_BASE_URL'],
    credentialEnvKeys: ['CLAUDE_API_KEY', 'ANTHROPIC_API_KEY'],
    probe: 'claude-messages',
  },
  gemini: {
    model: 'gemini-2.0-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelEnvKeys: ['PORTARIUM_LIVE_MODEL', 'GEMINI_MODEL', 'GOOGLE_MODEL'],
    baseUrlEnvKeys: [
      'GEMINI_BASE_URL',
      'GOOGLE_AI_BASE_URL',
      'GOOGLE_GENERATIVE_LANGUAGE_BASE_URL',
    ],
    credentialEnvKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_VERTEX_API_KEY'],
    probe: 'gemini-generate-content',
  },
};

const AUTO_PROVIDER_ORDER = ['openai', 'openrouter', 'codex', 'claude', 'gemini'];

export async function runLiveModelPreflight(options = {}) {
  const env = options.env ?? process.env;
  const checkedAt = new Date().toISOString();

  if ((options.requireOptIn ?? true) && !isLiveModelOptedIn(env)) {
    return {
      status: 'disabled',
      checkedAt,
      providerSelection: 'none',
      reason: `Live model preflight disabled; set ${OPT_IN_ENV_KEYS[0]}=true to enable it.`,
    };
  }

  const configResult = resolveProviderConfig(options, env, checkedAt);
  if (!('config' in configResult)) return configResult;

  const config = configResult.config;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const codexExecImpl = options.codexExecImpl ?? runCodexExecProbe;
  const timeoutMs = options.timeoutMs ?? 15_000;

  if (config.probe === 'codex-exec') {
    return runCodexCliPreflight(checkedAt, config, codexExecImpl, timeoutMs);
  }

  try {
    const request = buildProbeRequest(config, env);
    const response = await fetchImpl(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.ok) {
      return readyResult(checkedAt, config, response.status);
    }

    return failedHttpResult(checkedAt, config, response.status, await readErrorDetail(response));
  } catch (error) {
    return {
      status: 'failed',
      checkedAt,
      provider: config.provider,
      providerSelection: config.providerSelection,
      model: config.model,
      probe: config.probe,
      failureKind: 'network_error',
      reason: redactDetail(error instanceof Error ? error.message : String(error), config),
    };
  }
}

function resolveProviderConfig(options, env, checkedAt) {
  const forcedProvider = options.provider ?? readFirstEnv(env, PROVIDER_ENV_KEYS);
  if (forcedProvider !== undefined && !isLiveModelProvider(forcedProvider)) {
    return {
      status: 'failed',
      checkedAt,
      providerSelection: 'forced',
      failureKind: 'unsupported_provider',
      reason: `Unsupported live model provider "${forcedProvider}".`,
    };
  }

  if (options.requireProvider === true && forcedProvider === undefined) {
    return {
      status: 'skipped',
      checkedAt,
      providerSelection: 'none',
      failureKind: 'unsupported_provider',
      reason: `Live model provider is required; set ${PROVIDER_ENV_KEYS[0]}.`,
    };
  }

  const provider = forcedProvider ?? detectProviderFromCredentials(env);
  const providerSelection = forcedProvider === undefined ? 'auto' : 'forced';

  if (provider === undefined) {
    return {
      status: 'skipped',
      checkedAt,
      providerSelection: 'none',
      failureKind: 'missing_credentials',
      reason: 'No live model credentials found for the selected provider set.',
    };
  }

  const defaults = PROVIDER_DEFAULTS[provider];
  const credential = readCredential(env, defaults.credentialEnvKeys);

  if (provider === 'codex' && credential === undefined && providerSelection === 'forced') {
    return {
      status: 'ready',
      config: {
        provider,
        providerSelection,
        model: options.model ?? readFirstEnv(env, defaults.modelEnvKeys) ?? 'codex-cli',
        baseUrl: 'codex-cli',
        credentialSource: { kind: 'cli', name: 'codex' },
        probe: 'codex-exec',
      },
    };
  }

  if (credential === undefined) {
    return {
      status: 'skipped',
      checkedAt,
      provider,
      providerSelection,
      failureKind: 'missing_credentials',
      reason: `No credentials found for provider "${provider}".`,
    };
  }

  return {
    status: 'ready',
    config: {
      provider,
      providerSelection,
      model: options.model ?? readFirstEnv(env, defaults.modelEnvKeys) ?? defaults.model,
      baseUrl: trimTrailingSlash(readFirstEnv(env, defaults.baseUrlEnvKeys) ?? defaults.baseUrl),
      apiKey: credential.value,
      credentialSource: { kind: 'env', name: credential.envKey },
      probe: defaults.probe,
    },
  };
}

function isLiveModelOptedIn(env) {
  return OPT_IN_ENV_KEYS.some((key) => TRUE_VALUES.has((env[key] ?? '').toLowerCase()));
}

function detectProviderFromCredentials(env) {
  return AUTO_PROVIDER_ORDER.find((provider) =>
    PROVIDER_DEFAULTS[provider].credentialEnvKeys.some((key) => hasValue(env[key])),
  );
}

function readCredential(env, keys) {
  for (const key of keys) {
    const value = env[key];
    if (hasValue(value)) return { envKey: key, value };
  }
  return undefined;
}

function readFirstEnv(env, keys) {
  for (const key of keys) {
    const value = env[key];
    if (hasValue(value)) return value;
  }
  return undefined;
}

function hasValue(value) {
  return value !== undefined && value.trim().length > 0;
}

function isLiveModelProvider(value) {
  return (
    value === 'openai' ||
    value === 'openrouter' ||
    value === 'codex' ||
    value === 'claude' ||
    value === 'gemini'
  );
}

function chatCompletionsUrl(baseUrl) {
  return `${trimTrailingSlash(baseUrl)}/chat/completions`;
}

function claudeMessagesUrl(baseUrl) {
  return `${trimTrailingSlash(baseUrl)}/messages`;
}

function geminiGenerateContentUrl(baseUrl, model) {
  const modelPath = model.startsWith('models/') ? model : `models/${model}`;
  return `${trimTrailingSlash(baseUrl)}/${encodeGeminiModelPath(modelPath)}:generateContent`;
}

function encodeGeminiModelPath(modelPath) {
  return modelPath.split('/').map(encodeURIComponent).join('/');
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function buildProbeRequest(config, env) {
  if (config.probe === 'claude-messages') return buildClaudeMessagesRequest(config);
  if (config.probe === 'gemini-generate-content') return buildGeminiGenerateContentRequest(config);
  return buildChatCompletionsRequest(config, env);
}

function buildChatCompletionsRequest(config, env) {
  if (!config.apiKey) {
    throw new Error('HTTP live model preflight requires an API key');
  }

  const headers = {
    authorization: `Bearer ${config.apiKey}`,
    'content-type': 'application/json',
  };

  if (config.provider === 'openrouter') {
    headers['x-title'] = env['OPENROUTER_APP_TITLE'] ?? 'Portarium live experiment preflight';
    const referer = env['OPENROUTER_HTTP_REFERER'];
    if (hasValue(referer)) headers['http-referer'] = referer;
  }

  return {
    url: chatCompletionsUrl(config.baseUrl),
    headers,
    body: {
      model: config.model,
      messages: [{ role: 'user', content: 'Return the single word ready.' }],
      max_tokens: 1,
      temperature: 0,
    },
  };
}

function buildClaudeMessagesRequest(config) {
  if (!config.apiKey) {
    throw new Error('HTTP live model preflight requires an API key');
  }

  return {
    url: claudeMessagesUrl(config.baseUrl),
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: {
      model: config.model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Return the single word ready.' }],
    },
  };
}

function buildGeminiGenerateContentRequest(config) {
  if (!config.apiKey) {
    throw new Error('HTTP live model preflight requires an API key');
  }

  return {
    url: geminiGenerateContentUrl(config.baseUrl, config.model),
    headers: {
      'x-goog-api-key': config.apiKey,
      'content-type': 'application/json',
    },
    body: {
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Return the single word ready.' }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1,
        temperature: 0,
      },
    },
  };
}

function readyResult(checkedAt, config, httpStatus) {
  return {
    status: 'ready',
    checkedAt,
    provider: config.provider,
    providerSelection: config.providerSelection,
    model: config.model,
    probe: config.probe,
    httpStatus,
  };
}

function failedHttpResult(checkedAt, config, httpStatus, detail) {
  return {
    status: 'failed',
    checkedAt,
    provider: config.provider,
    providerSelection: config.providerSelection,
    model: config.model,
    probe: config.probe,
    httpStatus,
    failureKind: classifyHttpFailure(httpStatus),
    ...(detail ? { reason: redactDetail(detail, config) } : {}),
  };
}

function classifyHttpFailure(httpStatus) {
  if (httpStatus === 401 || httpStatus === 403) return 'credential_rejected';
  if (httpStatus === 402 || httpStatus === 429) return 'quota_or_rate_limit';
  if (httpStatus === 404) return 'model_unavailable';
  return 'unexpected_response';
}

async function readErrorDetail(response) {
  const text = await response.text().catch(() => '');
  if (!text.trim()) return undefined;

  const parsed = parseJsonRecord(text);
  const candidate =
    readNestedString(parsed, ['error', 'message']) ?? readNestedString(parsed, ['message']);
  return truncateDetail(candidate ?? text.trim());
}

function parseJsonRecord(text) {
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readNestedString(record, path) {
  let current = record;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return typeof current === 'string' ? current : undefined;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function truncateDetail(value) {
  return value.length <= 240 ? value : `${value.slice(0, 237)}...`;
}

function redactDetail(value, config) {
  let redacted = value;
  for (const sensitiveValue of sensitiveDetailValues(config)) {
    if (hasValue(sensitiveValue)) redacted = redacted.replaceAll(sensitiveValue, '[redacted]');
  }
  return truncateDetail(redacted);
}

function sensitiveDetailValues(config) {
  const baseUrl = trimTrailingSlash(config.baseUrl);
  return [
    config.apiKey,
    config.credentialSource.name,
    config.baseUrl,
    baseUrl,
    readUrlOrigin(baseUrl),
    stripUrlProtocol(baseUrl),
  ];
}

function readUrlOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function stripUrlProtocol(value) {
  return value.replace(/^[a-z][a-z\d+.-]*:\/\//i, '');
}

async function runCodexCliPreflight(checkedAt, config, codexExecImpl, timeoutMs) {
  try {
    const result = await codexExecImpl('Return exactly: ready', timeoutMs);
    const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
    if (result.exitCode === 0 && output.includes('ready')) {
      return {
        status: 'ready',
        checkedAt,
        provider: config.provider,
        providerSelection: config.providerSelection,
        model: config.model,
        probe: 'codex-exec',
      };
    }

    return {
      status: 'failed',
      checkedAt,
      provider: config.provider,
      providerSelection: config.providerSelection,
      model: config.model,
      probe: 'codex-exec',
      failureKind:
        output.includes('login') || output.includes('auth')
          ? 'credential_rejected'
          : 'unexpected_response',
      reason: redactDetail(output.trim() || `codex exited with ${String(result.exitCode)}`, config),
    };
  } catch (error) {
    return {
      status: 'failed',
      checkedAt,
      provider: config.provider,
      providerSelection: config.providerSelection,
      model: config.model,
      probe: 'codex-exec',
      failureKind: 'network_error',
      reason: redactDetail(error instanceof Error ? error.message : String(error), config),
    };
  }
}

function runCodexExecProbe(prompt, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child =
      process.platform === 'win32'
        ? spawn(`codex exec --sandbox read-only --ephemeral "${prompt.replaceAll('"', '\\"')}"`, {
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          })
        : spawn('codex', ['exec', '--sandbox', 'read-only', '--ephemeral', prompt], {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          });
    const stdout = [];
    const stderr = [];
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`codex exec timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timeout);
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}
