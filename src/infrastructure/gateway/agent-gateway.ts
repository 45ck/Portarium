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

export type AuthVerifier = (
  authorizationHeader: string | undefined,
) => Promise<AuthVerifyResult>;

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
  public handleRequest = async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> => {
    try {
      // 1. Authenticate
      const authHeader = req.headers.authorization;
      const authResult = await this.#authVerifier(authHeader);
      if (!authResult.ok) {
        return sendProblem(res, 401, 'Unauthorized', authResult.reason);
      }

      // 2. Rate limit
      const rateResult = this.#rateLimiter.tryConsume(authResult.workspaceId);
      if (!rateResult.allowed) {
        res.setHeader('retry-after', String(rateResult.retryAfterSeconds));
        return sendProblem(res, 429, 'Too Many Requests', 'Rate limit exceeded.');
      }

      // 3. Validate request shape
      const method = (req.method ?? 'GET').toUpperCase();
      const path = req.url ?? '/';
      const contentType = req.headers['content-type'];
      const bodyChunks: Buffer[] = [];
      for await (const chunk of req) {
        bodyChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const bodyBuffer = Buffer.concat(bodyChunks);

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
        return sendProblem(res, 422, 'Validation Failed', validation.reason);
      }

      // 4. Build trace context headers
      const incomingTraceparent = req.headers['traceparent'] as string | undefined;
      const traceparent = incomingTraceparent ?? generateTraceparent();
      const tracestate = req.headers['tracestate'] as string | undefined;

      // 5. Proxy to control plane
      const targetUrl = `${this.#controlPlaneBaseUrl}${path}`;
      const proxyHeaders: Record<string, string> = {
        'content-type': contentType ?? 'application/json',
        'x-workspace-id': authResult.workspaceId,
        'x-subject': authResult.subject,
        'x-correlation-id': randomUUID(),
        traceparent,
        ...(tracestate ? { tracestate } : {}),
      };

      const upstream = await this.#fetchImpl(targetUrl, {
        method,
        headers: proxyHeaders,
        ...(bodyBuffer.length > 0 ? { body: bodyBuffer } : {}),
      });

      // 6. Forward response
      res.writeHead(upstream.status, {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
      });
      const upstreamBody = await upstream.text();
      res.end(upstreamBody);
    } catch {
      sendProblem(res, 502, 'Bad Gateway', 'Failed to proxy request to control plane.');
    }
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendProblem(
  res: ServerResponse,
  status: number,
  title: string,
  detail: string,
): void {
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
