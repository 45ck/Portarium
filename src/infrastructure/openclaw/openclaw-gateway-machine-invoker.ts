import type {
  InvokeToolInput,
  MachineInvokerFailure,
  MachineInvokerPort,
  MachineInvokerResult,
  RunAgentInput,
} from '../../application/ports/machine-invoker.js';
import { evaluateOpenClawToolPolicyV1 } from '../../domain/machines/openclaw-tool-blast-radius-v1.js';
import type { ExecutionTier, MachineId, TenantId } from '../../domain/primitives/index.js';

type FetchImpl = typeof fetch;
type SleepFn = (ms: number) => Promise<void>;

export type OpenClawGatewayCredentialResolverInput = Readonly<{
  tenantId: TenantId;
  machineId: MachineId;
}>;

export type OpenClawGatewayCredentialResolver = (
  input: OpenClawGatewayCredentialResolverInput,
) => Promise<string | undefined>;

export type OpenClawGatewayRetryPolicy = Readonly<{
  maxAttempts: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
}>;

export type OpenClawGatewayMachineInvokerConfig = Readonly<{
  baseUrl: string;
  resolveBearerToken: OpenClawGatewayCredentialResolver;
  fetchImpl?: FetchImpl;
  requestTimeoutMs?: number;
  retry?: Partial<OpenClawGatewayRetryPolicy>;
  sleep?: SleepFn;
}>;

type HttpAttemptResult =
  | Readonly<{ type: 'success'; body: unknown }>
  | Readonly<{ type: 'http_error'; status: number; retryAfterMs?: number }>
  | Readonly<{ type: 'timeout' }>
  | Readonly<{ type: 'network_error' }>;

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

const DEFAULT_RETRY_POLICY: OpenClawGatewayRetryPolicy = {
  maxAttempts: 3,
  initialBackoffMs: 100,
  maxBackoffMs: 1_000,
  backoffMultiplier: 2,
};

export class OpenClawGatewayMachineInvoker implements MachineInvokerPort {
  readonly #baseUrl: string;
  readonly #resolveBearerToken: OpenClawGatewayCredentialResolver;
  readonly #fetchImpl: FetchImpl;
  readonly #requestTimeoutMs: number;
  readonly #retryPolicy: OpenClawGatewayRetryPolicy;
  readonly #sleep: SleepFn;

  public constructor(config: OpenClawGatewayMachineInvokerConfig) {
    this.#baseUrl = normalizeBaseUrl(config.baseUrl);
    this.#resolveBearerToken = config.resolveBearerToken;
    this.#fetchImpl = config.fetchImpl ?? fetch;
    this.#requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.#retryPolicy = {
      ...DEFAULT_RETRY_POLICY,
      ...(config.retry ?? {}),
    };
    this.#sleep = config.sleep ?? defaultSleep;
  }

  public async runAgent(input: RunAgentInput): Promise<MachineInvokerResult> {
    return this.#postWithBearerToken({
      tenantId: input.tenantId,
      machineId: input.machineId,
      path: '/v1/responses',
      payload: {
        model: `openclaw:${input.agentId}`,
        input: input.prompt,
        metadata: {
          tenantId: input.tenantId,
          runId: input.runId,
          actionId: input.actionId,
          correlationId: input.correlationId,
          ...(input.capability ? { capability: input.capability } : {}),
          ...(input.traceparent ? { traceparent: input.traceparent } : {}),
          ...(input.tracestate ? { tracestate: input.tracestate } : {}),
        },
      },
    });
  }

  public async invokeTool(input: InvokeToolInput): Promise<MachineInvokerResult> {
    const policyTier = (input.policyTier ?? 'HumanApprove') as ExecutionTier;
    const policy = evaluateOpenClawToolPolicyV1({
      toolName: input.toolName,
      policyTier,
    });
    if (policy.decision === 'Deny') {
      return {
        ok: false,
        errorKind: 'PolicyDenied',
        runState: policy.runState,
        message: `Policy blocked tool "${input.toolName}" for tier "${policyTier}"; requires "${policy.violation.requiredTier}".`,
      };
    }

    const sessionKey = hasNonEmptyText(input.sessionKey)
      ? input.sessionKey.trim()
      : `${input.tenantId}:${input.runId}`;

    return this.#postWithBearerToken({
      tenantId: input.tenantId,
      machineId: input.machineId,
      path: '/tools/invoke',
      extraHeaders: {
        'x-openclaw-session-key': sessionKey,
      },
      payload: {
        toolName: input.toolName,
        parameters: input.parameters,
        dryRun: input.dryRun === true,
        metadata: {
          tenantId: input.tenantId,
          runId: input.runId,
          actionId: input.actionId,
          correlationId: input.correlationId,
          sessionKey,
          policyTier,
          dryRun: input.dryRun === true,
          ...(input.traceparent ? { traceparent: input.traceparent } : {}),
          ...(input.tracestate ? { tracestate: input.tracestate } : {}),
        },
      },
    });
  }

  async #postWithBearerToken(input: {
    tenantId: TenantId;
    machineId: MachineId;
    path: string;
    extraHeaders?: Readonly<Record<string, string>>;
    payload: unknown;
  }): Promise<MachineInvokerResult> {
    const token = await this.#resolveBearerToken({
      tenantId: input.tenantId,
      machineId: input.machineId,
    });
    if (!hasNonEmptyText(token)) {
      return {
        ok: false,
        errorKind: 'Unauthorized',
        message: 'Missing bearer-token credential for machine invocation.',
      };
    }

    const endpoint = `${this.#baseUrl}${input.path}`;
    const attempt = await this.#postJsonWithRetry({
      endpoint,
      bearerToken: token,
      ...(input.extraHeaders ? { extraHeaders: input.extraHeaders } : {}),
      payload: input.payload,
    });
    return mapAttemptToMachineInvokerResult(attempt);
  }

  async #postJsonWithRetry(input: {
    endpoint: string;
    bearerToken: string;
    extraHeaders?: Readonly<Record<string, string>>;
    payload: unknown;
  }): Promise<HttpAttemptResult> {
    let attempt = 0;
    let nextBackoffMs = this.#retryPolicy.initialBackoffMs;
    let lastFailure: HttpAttemptResult = { type: 'network_error' };

    while (attempt < this.#retryPolicy.maxAttempts) {
      attempt += 1;
      const result = await this.#postJsonOnce({
        endpoint: input.endpoint,
        bearerToken: input.bearerToken,
        ...(input.extraHeaders ? { extraHeaders: input.extraHeaders } : {}),
        payload: input.payload,
      });
      if (result.type === 'success') return result;
      lastFailure = result;

      if (!isRetryableFailure(result) || attempt >= this.#retryPolicy.maxAttempts) {
        return result;
      }

      const backoffMs = retryBackoffMs(result, nextBackoffMs);
      await this.#sleep(backoffMs);
      nextBackoffMs = Math.min(
        this.#retryPolicy.maxBackoffMs,
        Math.round(nextBackoffMs * this.#retryPolicy.backoffMultiplier),
      );
    }

    return lastFailure;
  }

  async #postJsonOnce(input: {
    endpoint: string;
    bearerToken: string;
    extraHeaders?: Readonly<Record<string, string>>;
    payload: unknown;
  }): Promise<HttpAttemptResult> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.#requestTimeoutMs);

    try {
      const response = await this.#fetchImpl(input.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${input.bearerToken}`,
          ...(input.extraHeaders ?? {}),
        },
        body: JSON.stringify(input.payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        const retryAfterMs =
          response.status === 429
            ? parseRetryAfterMs(response.headers.get('retry-after'))
            : undefined;
        return {
          type: 'http_error',
          status: response.status,
          ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        };
      }
      return {
        type: 'success',
        body: await parseGatewayResponseBody(response),
      };
    } catch (error) {
      if (isAbortError(error)) return { type: 'timeout' };
      return { type: 'network_error' };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

async function parseGatewayResponseBody(response: Response): Promise<unknown> {
  const bodyText = await response.text();
  if (bodyText.trim() === '') return {};
  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    return { rawBody: bodyText };
  }
}

function mapAttemptToMachineInvokerResult(attempt: HttpAttemptResult): MachineInvokerResult {
  switch (attempt.type) {
    case 'success':
      return { ok: true, output: attempt.body };
    case 'timeout':
      return {
        ok: false,
        errorKind: 'Timeout',
        message: 'Gateway request timed out.',
      };
    case 'network_error':
      return {
        ok: false,
        errorKind: 'RemoteError',
        message: 'Gateway request failed due to a network error.',
      };
    case 'http_error':
      return mapHttpStatusToFailure(attempt.status);
  }
}

function mapHttpStatusToFailure(status: number): MachineInvokerFailure {
  if (status === 401 || status === 403) {
    return {
      ok: false,
      errorKind: 'Unauthorized',
      message: 'Gateway request was not authorized.',
    };
  }
  if (status === 429) {
    return {
      ok: false,
      errorKind: 'RateLimited',
      message: 'Gateway request was rate limited.',
    };
  }
  if (status === 409) {
    return {
      ok: false,
      errorKind: 'PolicyDenied',
      message: 'Gateway policy denied the request.',
    };
  }
  if (status >= 400 && status < 500) {
    return {
      ok: false,
      errorKind: 'RemoteError',
      message: `Gateway rejected the request with status ${status}.`,
    };
  }
  return {
    ok: false,
    errorKind: 'RemoteError',
    message: `Gateway failed with status ${status}.`,
  };
}

function isRetryableFailure(result: HttpAttemptResult): boolean {
  if (result.type === 'timeout' || result.type === 'network_error') return true;
  return result.type === 'http_error' && (result.status >= 500 || result.status === 429);
}

function retryBackoffMs(result: HttpAttemptResult, fallbackBackoffMs: number): number {
  if (result.type === 'http_error' && result.status === 429 && result.retryAfterMs !== undefined) {
    return result.retryAfterMs;
  }
  return fallbackBackoffMs;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') {
    throw new Error('OpenClawGatewayMachineInvoker requires a non-empty baseUrl.');
  }
  return trimmed.replace(/\/+$/, '');
}

function hasNonEmptyText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (headerValue === null) return undefined;

  const trimmed = headerValue.trim();
  if (trimmed === '') return undefined;

  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10) * 1_000;
  }

  const retryAt = Date.parse(trimmed);
  if (Number.isNaN(retryAt)) return undefined;

  return Math.max(0, retryAt - Date.now());
}

function isAbortError(value: unknown): boolean {
  return value instanceof Error && value.name === 'AbortError';
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
