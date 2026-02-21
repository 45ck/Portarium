/**
 * Portarium Agent Gateway -- thin proxy service.
 *
 * Responsibilities:
 * 1. Terminate external auth (JWT / OAuth2 / mTLS)
 * 2. Inject W3C trace-context headers (traceparent, tracestate)
 * 3. Enforce per-workspace rate limits (token bucket)
 * 4. Validate request shape (fast-fail before proxy)
 * 5. Proxy to the internal control plane
 */

import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { TokenBucketRateLimiter } from './rate-limiter.js';
import { validateRequest, type RequestValidatorConfig } from './request-validator.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProblemDetails = Readonly<{
  type: string;
  title: string;
  status: number;
  detail?: string;
}>;

export type AuthVerifier = (authorizationHeader: string | undefined) => Promise<AuthVerifyResult>;

export type AuthVerifyResult =
  | Readonly<{ ok: true; workspaceId: string; subject: string }>
  | Readonly<{ ok: false; reason: string }>;

export type AgentGatewayConfig = Readonly<{
  /** Base URL of the internal control plane (e.g. http://control-plane:3000). */
  controlPlaneBaseUrl: string;
  /** Auth verifier — decodes and validates incoming credentials. */
  authVerifier: AuthVerifier;
  /** Per-workspace rate limiter. */
  rateLimiter: TokenBucketRateLimiter;
  /** Optional request validation config. */
  requestValidation?: RequestValidatorConfig;
  /** Optional fetch implementation for proxying (defaults to global fetch). */
  fetchImpl?: typeof fetch;
}>;

// ---------------------------------------------------------------------------
// Gateway handler
// ---------------------------------------------------------------------------

export class AgentGateway {
  readonly #controlPlaneBaseUrl: string;
  readonly #authVerifier: AuthVerifier;
  readonly #rateLimiter: TokenBucketRateLimiter;
  readonly #requestValidation: RequestValidatorConfig | undefined;
  readonly #fetchImpl: typeof fetch;

  public constructor(config: AgentGatewayConfig) {
    this.#controlPlaneBaseUrl = config.controlPlaneBaseUrl.replace(/\/+$/, '');
    this.#authVerifier = config.authVerifier;
    this.#rateLimiter = config.rateLimiter;
    this.#requestValidation = config.requestValidation;
    this.#fetchImpl = config.fetchImpl ?? fetch;
  }

  /**
   * Handle an inbound HTTP request. This is the top-level entry point used
   * by the HTTP server (e.g. `http.createServer(gateway.handleRequest)`).
   */
  public handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const auth = await this.#authenticate(req, res);
      if (!auth) return;

      const limited = this.#enforceRateLimit(auth.workspaceId, res);
      if (!limited) return;

      const method = (req.method ?? 'GET').toUpperCase();
      const path = req.url ?? '/';
      const contentType = req.headers['content-type'];
      const bodyBuffer = await readBodyBuffer(req);

      const validation = validateRequest(
        {
          method,
          path,
          bodySize: bodyBuffer.length,
          ...(contentType !== undefined ? { contentType } : {}),
        },
        this.#requestValidation,
      );
      if (!validation.valid) {
        sendProblem(res, 422, 'Validation Failed', validation.reason);
        return;
      }

      const inboundTraceparent = normalizeSingleHeader(req.headers['traceparent']) ?? generateTraceparent();
      const inboundTracestate = normalizeSingleHeader(req.headers['tracestate']);
      const upstream = await this.#proxyRequest({
        method,
        path,
        bodyBuffer,
        contentType,
        workspaceId: auth.workspaceId,
        subject: auth.subject,
        traceparent: inboundTraceparent,
        ...(inboundTracestate ? { tracestate: inboundTracestate } : {}),
      });
      await forwardUpstreamResponse(res, upstream);
    } catch {
      sendProblem(res, 502, 'Bad Gateway', 'Failed to proxy request to control plane.');
    }
  };

  async #authenticate(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<Readonly<{ workspaceId: string; subject: string }> | null> {
    const authResult = await this.#authVerifier(req.headers.authorization);
    if (!authResult.ok) {
      sendProblem(res, 401, 'Unauthorized', authResult.reason);
      return null;
    }
    return authResult;
  }

  #enforceRateLimit(workspaceId: string, res: ServerResponse): boolean {
    const rateResult = this.#rateLimiter.tryConsume(workspaceId);
    if (rateResult.allowed) return true;
    res.setHeader('retry-after', String(rateResult.retryAfterSeconds));
    sendProblem(res, 429, 'Too Many Requests', 'Rate limit exceeded.');
    return false;
  }

  #proxyRequest(input: {
    method: string;
    path: string;
    bodyBuffer: Buffer;
    contentType: string | string[] | undefined;
    workspaceId: string;
    subject: string;
    traceparent: string;
    tracestate?: string;
  }): Promise<Response> {
    const targetUrl = `${this.#controlPlaneBaseUrl}${input.path}`;
    const proxyHeaders: Record<string, string> = {
      'content-type': normalizeSingleHeader(input.contentType) ?? 'application/json',
      'x-workspace-id': input.workspaceId,
      'x-subject': input.subject,
      'x-correlation-id': randomUUID(),
      traceparent: input.traceparent,
      ...(input.tracestate ? { tracestate: input.tracestate } : {}),
    };
    return this.#fetchImpl(targetUrl, {
      method: input.method,
      headers: proxyHeaders,
      ...(input.bodyBuffer.length > 0 ? { body: input.bodyBuffer } : {}),
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendProblem(res: ServerResponse, status: number, title: string, detail: string): void {
  const problem: ProblemDetails = {
    type: `https://portarium.dev/problems/${toKebab(title)}`,
    title,
    status,
    detail,
  };
  res.writeHead(status, { 'content-type': 'application/problem+json' });
  res.end(JSON.stringify(problem));
}

function toKebab(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-');
}

function generateTraceparent(): string {
  const version = '00';
  const traceId = randomHex(16);
  const spanId = randomHex(8);
  const flags = '01';
  return `${version}-${traceId}-${spanId}-${flags}`;
}

function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeSingleHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function toBufferChunk(chunk: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (typeof chunk === 'string') return Buffer.from(chunk);
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  return Buffer.from(String(chunk));
}

async function readBodyBuffer(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(toBufferChunk(chunk));
  }
  return Buffer.concat(chunks);
}

async function forwardUpstreamResponse(res: ServerResponse, upstream: Response): Promise<void> {
  res.writeHead(upstream.status, {
    'content-type': upstream.headers.get('content-type') ?? 'application/json',
  });
  res.end(await upstream.text());
}
