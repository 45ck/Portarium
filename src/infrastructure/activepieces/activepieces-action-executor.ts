import type {
  ActionDispatchResult,
  ActionRunnerPort,
} from '../../application/ports/action-runner.js';
import { buildActivepiecesCorrelationHeaders } from './activepieces-piece-package-pattern.js';

type FetchImpl = typeof fetch;

const DEFAULT_TIMEOUT_MS = 10_000;

export type ActivepiecesActionExecutorConfig = Readonly<{
  baseUrl: string;
  apiToken?: string;
  timeoutMs?: number;
  fetchImpl?: FetchImpl;
}>;

export class ActivepiecesActionExecutor implements ActionRunnerPort {
  readonly #baseUrl: string;
  readonly #apiToken: string | undefined;
  readonly #timeoutMs: number;
  readonly #fetchImpl: FetchImpl;

  public constructor(config: ActivepiecesActionExecutorConfig) {
    this.#baseUrl = normalizeBaseUrl(config.baseUrl);
    this.#apiToken = hasNonEmptyText(config.apiToken) ? config.apiToken.trim() : undefined;
    this.#timeoutMs = resolveTimeoutMs(config.timeoutMs);
    this.#fetchImpl = config.fetchImpl ?? fetch;
  }

  public async dispatchAction(
    input: Parameters<ActionRunnerPort['dispatchAction']>[0],
  ): Promise<ActionDispatchResult> {
    const flowRef = input.flowRef.trim();
    if (flowRef === '') {
      return {
        ok: false,
        errorKind: 'FlowNotFound',
        message: 'Activepieces flowRef must be a non-empty string.',
      };
    }

    const endpoint = resolveFlowEndpoint(this.#baseUrl, flowRef);
    const timeoutController = new AbortController();
    const timeoutHandle = setTimeout(() => timeoutController.abort(), this.#timeoutMs);

    try {
      const response = await this.#fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...buildActivepiecesCorrelationHeaders({
            tenantId: String(input.tenantId),
            correlationId: String(input.correlationId),
            runId: String(input.runId),
          }),
          ...(this.#apiToken ? { authorization: `Bearer ${this.#apiToken}` } : {}),
        },
        body: JSON.stringify({
          actionId: String(input.actionId),
          flowRef,
          tenantId: String(input.tenantId),
          runId: String(input.runId),
          correlationId: String(input.correlationId),
          payload: input.payload,
        }),
        signal: timeoutController.signal,
      });

      if (!response.ok) {
        return mapHttpFailure(response.status);
      }

      const output = await parseResponseOutput(response);
      if (output === undefined) {
        return { ok: true };
      }
      return { ok: true, output };
    } catch (error) {
      if (isAbortError(error)) {
        return {
          ok: false,
          errorKind: 'Timeout',
          message: 'Activepieces request timed out.',
        };
      }

      const reason = error instanceof Error ? error.message : 'Unknown error.';
      return {
        ok: false,
        errorKind: 'RemoteError',
        message: `Activepieces request failed: ${reason}`,
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') {
    throw new Error('ActivepiecesActionExecutor requires a non-empty baseUrl.');
  }
  return trimmed.replace(/\/+$/, '');
}

function resolveTimeoutMs(timeoutMs?: number): number {
  if (timeoutMs === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('ActivepiecesActionExecutor timeoutMs must be a positive number.');
  }
  return Math.floor(timeoutMs);
}

function resolveFlowEndpoint(baseUrl: string, flowRef: string): string {
  if (looksLikeHttpUrl(flowRef)) {
    return flowRef;
  }
  return `${baseUrl}/api/v1/flows/${encodeURIComponent(flowRef)}/run`;
}

function looksLikeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function mapHttpFailure(status: number): ActionDispatchResult {
  if (status === 401 || status === 403) {
    return {
      ok: false,
      errorKind: 'Unauthorized',
      message: 'Activepieces request was not authorized.',
    };
  }
  if (status === 404) {
    return {
      ok: false,
      errorKind: 'FlowNotFound',
      message: 'Activepieces flow was not found.',
    };
  }
  if (status === 429) {
    return {
      ok: false,
      errorKind: 'RateLimited',
      message: 'Activepieces request was rate limited.',
    };
  }
  if (status >= 500) {
    return {
      ok: false,
      errorKind: 'RemoteError',
      message: `Activepieces server failed with status ${status}.`,
    };
  }
  return {
    ok: false,
    errorKind: 'RemoteError',
    message: `Activepieces request failed with status ${status}.`,
  };
}

async function parseResponseOutput(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === '') {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { rawBody: text };
  }
}

function hasNonEmptyText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
