/**
 * Provider and credential preflight for experiments that use live model inference.
 *
 * The preflight is intentionally opt-in. Normal CI must not need provider secrets
 * and must not make live LLM calls by accident.
 */

import { spawn } from 'node:child_process';

export type LiveModelProvider = 'openai' | 'openrouter' | 'codex';

export type LiveModelPreflightStatus = 'disabled' | 'skipped' | 'ready' | 'failed';

export type LiveModelPreflightFailureKind =
  | 'missing_credentials'
  | 'unsupported_provider'
  | 'credential_rejected'
  | 'quota_or_rate_limit'
  | 'model_unavailable'
  | 'network_error'
  | 'unexpected_response';

export interface LiveModelCredentialSource {
  readonly kind: 'env' | 'cli';
  readonly name: string;
}

export interface CodexExecProbeResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export type CodexExecProbe = (prompt: string, timeoutMs: number) => Promise<CodexExecProbeResult>;

export interface LiveModelPreflightOptions {
  readonly provider?: LiveModelProvider;
  readonly model?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly fetchImpl?: typeof fetch;
  readonly codexExecImpl?: CodexExecProbe;
  readonly timeoutMs?: number;
  readonly requireOptIn?: boolean;
  readonly requireProvider?: boolean;
}

export interface LiveModelPreflightResult {
  readonly status: LiveModelPreflightStatus;
  readonly checkedAt: string;
  readonly providerSelection: 'forced' | 'auto' | 'none';
  readonly provider?: LiveModelProvider;
  readonly model?: string;
  readonly probe?: 'chat-completions' | 'codex-exec';
  readonly httpStatus?: number;
  readonly failureKind?: LiveModelPreflightFailureKind;
  readonly reason?: string;
}

interface ProviderConfig {
  readonly provider: LiveModelProvider;
  readonly providerSelection: 'forced' | 'auto';
  readonly model: string;
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly credentialSource: LiveModelCredentialSource;
  readonly probe: 'chat-completions' | 'codex-exec';
}

interface ProviderDefaults {
  readonly model: string;
  readonly baseUrl: string;
  readonly modelEnvKeys: readonly string[];
  readonly baseUrlEnvKeys: readonly string[];
  readonly credentialEnvKeys: readonly string[];
}

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

const OPT_IN_ENV_KEYS = ['PORTARIUM_EXPERIMENT_LIVE_LLM', 'PORTARIUM_LIVE_MODEL_RUNS'];
const PROVIDER_ENV_KEYS = ['PORTARIUM_LIVE_MODEL_PROVIDER', 'PORTARIUM_EXPERIMENT_LLM_PROVIDER'];

const PROVIDER_DEFAULTS: Record<LiveModelProvider, ProviderDefaults> = {
  openai: {
    model: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    modelEnvKeys: ['PORTARIUM_LIVE_MODEL', 'OPENAI_MODEL'],
    baseUrlEnvKeys: ['OPENAI_BASE_URL'],
    credentialEnvKeys: ['OPENAI_API_KEY'],
  },
  openrouter: {
    model: 'openai/gpt-4o',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelEnvKeys: ['PORTARIUM_LIVE_MODEL', 'OPENROUTER_MODEL'],
    baseUrlEnvKeys: ['OPENROUTER_BASE_URL'],
    credentialEnvKeys: ['OPENROUTER_API_KEY'],
  },
  codex: {
    model: 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    modelEnvKeys: ['PORTARIUM_LIVE_MODEL', 'CODEX_MODEL', 'OPENAI_MODEL'],
    baseUrlEnvKeys: ['CODEX_BASE_URL', 'OPENAI_BASE_URL'],
    credentialEnvKeys: ['CODEX_API_KEY', 'OPENAI_API_KEY'],
  },
};

const AUTO_PROVIDER_ORDER: readonly LiveModelProvider[] = ['openai', 'openrouter', 'codex'];

export async function runLiveModelPreflight(
  options: LiveModelPreflightOptions = {},
): Promise<LiveModelPreflightResult> {
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
    const response = await fetchImpl(chatCompletionsUrl(config.baseUrl), {
      method: 'POST',
      headers: buildHeaders(config, env),
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Return the single word ready.' }],
        max_tokens: 1,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.ok) {
      return readyResult(checkedAt, config, response.status);
    }

    return failedHttpResult(checkedAt, config, response.status, await readErrorDetail(response));
  } catch (error: unknown) {
    return {
      status: 'failed',
      checkedAt,
      provider: config.provider,
      providerSelection: config.providerSelection,
      model: config.model,
      probe: 'chat-completions',
      failureKind: 'network_error',
      reason: redactDetail(error instanceof Error ? error.message : String(error), config),
    };
  }
}

function resolveProviderConfig(
  options: LiveModelPreflightOptions,
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  checkedAt: string,
): { readonly status: 'ready'; readonly config: ProviderConfig } | LiveModelPreflightResult {
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
      probe: 'chat-completions',
    },
  };
}

function isLiveModelOptedIn(env: NodeJS.ProcessEnv | Record<string, string | undefined>): boolean {
  return OPT_IN_ENV_KEYS.some((key) => TRUE_VALUES.has((env[key] ?? '').toLowerCase()));
}

function detectProviderFromCredentials(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): LiveModelProvider | undefined {
  return AUTO_PROVIDER_ORDER.find((provider) =>
    PROVIDER_DEFAULTS[provider].credentialEnvKeys.some((key) => hasValue(env[key])),
  );
}

function readCredential(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  keys: readonly string[],
): { readonly envKey: string; readonly value: string } | undefined {
  for (const key of keys) {
    const value = env[key];
    if (hasValue(value)) return { envKey: key, value };
  }
  return undefined;
}

function readFirstEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (hasValue(value)) return value;
  }
  return undefined;
}

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

function isLiveModelProvider(value: string): value is LiveModelProvider {
  return value === 'openai' || value === 'openrouter' || value === 'codex';
}

function chatCompletionsUrl(baseUrl: string): string {
  return `${trimTrailingSlash(baseUrl)}/chat/completions`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function buildHeaders(
  config: ProviderConfig,
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): Record<string, string> {
  if (!config.apiKey) {
    throw new Error('HTTP live model preflight requires an API key');
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${config.apiKey}`,
    'content-type': 'application/json',
  };

  if (config.provider === 'openrouter') {
    headers['x-title'] = env['OPENROUTER_APP_TITLE'] ?? 'Portarium live experiment preflight';
    const referer = env['OPENROUTER_HTTP_REFERER'];
    if (hasValue(referer)) headers['http-referer'] = referer;
  }

  return headers;
}

function readyResult(
  checkedAt: string,
  config: ProviderConfig,
  httpStatus: number,
): LiveModelPreflightResult {
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

function failedHttpResult(
  checkedAt: string,
  config: ProviderConfig,
  httpStatus: number,
  detail: string | undefined,
): LiveModelPreflightResult {
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

function classifyHttpFailure(httpStatus: number): LiveModelPreflightFailureKind {
  if (httpStatus === 401 || httpStatus === 403) return 'credential_rejected';
  if (httpStatus === 402 || httpStatus === 429) return 'quota_or_rate_limit';
  if (httpStatus === 404) return 'model_unavailable';
  return 'unexpected_response';
}

async function readErrorDetail(response: Response): Promise<string | undefined> {
  const text = await response.text().catch(() => '');
  if (!text.trim()) return undefined;

  const parsed = parseJsonRecord(text);
  const candidate =
    readNestedString(parsed, ['error', 'message']) ?? readNestedString(parsed, ['message']);
  return truncateDetail(candidate ?? text.trim());
}

function parseJsonRecord(text: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readNestedString(
  record: Record<string, unknown> | undefined,
  path: readonly string[],
): string | undefined {
  let current: unknown = record;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return typeof current === 'string' ? current : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function truncateDetail(value: string): string {
  return value.length <= 240 ? value : `${value.slice(0, 237)}...`;
}

function redactDetail(value: string, config: ProviderConfig): string {
  let redacted = value;
  for (const sensitiveValue of [config.apiKey, config.baseUrl, config.credentialSource.name]) {
    if (hasValue(sensitiveValue)) redacted = redacted.replaceAll(sensitiveValue, '[redacted]');
  }
  return truncateDetail(redacted);
}

async function runCodexCliPreflight(
  checkedAt: string,
  config: ProviderConfig,
  codexExecImpl: CodexExecProbe,
  timeoutMs: number,
): Promise<LiveModelPreflightResult> {
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
  } catch (error: unknown) {
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

function runCodexExecProbe(prompt: string, timeoutMs: number): Promise<CodexExecProbeResult> {
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
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`codex exec timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(Buffer.from(chunk)));
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
