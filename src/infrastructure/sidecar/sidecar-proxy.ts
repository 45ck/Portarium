import type { SidecarConfigV1 } from './sidecar-config-v1.js';

/**
 * Egress validation result.
 */
export type EgressCheckResult = Readonly<{
  allowed: boolean;
  host: string;
  reason?: string;
}>;

/**
 * Proxied request descriptor.
 */
export type ProxiedRequest = Readonly<{
  method: string;
  url: string;
  headers: Readonly<Record<string, string>>;
  body?: string;
}>;

/**
 * Proxied response descriptor.
 */
export type ProxiedResponse = Readonly<{
  status: number;
  headers: Readonly<Record<string, string>>;
  body: string;
}>;

/**
 * Portarium sidecar proxy logic.
 *
 * Responsibilities:
 * 1. Validate egress destinations against the allowlist
 * 2. Inject authentication headers (Bearer token)
 * 3. Inject W3C trace context headers (traceparent, tracestate)
 *
 * This module implements the proxy logic; the HTTP server binding is
 * handled by the sidecar entrypoint (sidecar main).
 */
export class SidecarProxy {
  readonly #config: SidecarConfigV1;
  readonly #fetchImpl: typeof fetch;
  #currentToken: string | undefined;

  public constructor(config: SidecarConfigV1, fetchImpl?: typeof fetch) {
    this.#config = config;
    this.#fetchImpl = fetchImpl ?? fetch;
  }

  /**
   * Set the current bearer token for auth header injection.
   */
  public setToken(token: string): void {
    this.#currentToken = token;
  }

  /**
   * Validate that a target URL is permitted by the egress allowlist.
   */
  public checkEgress(targetUrl: string): EgressCheckResult {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return { allowed: false, host: targetUrl, reason: 'Invalid URL' };
    }

    const host = parsedUrl.hostname;

    if (this.#config.egressAllowlist.length === 0) {
      return { allowed: false, host, reason: 'Egress allowlist is empty' };
    }

    for (const pattern of this.#config.egressAllowlist) {
      if (matchesHost(host, pattern)) {
        return { allowed: true, host };
      }
    }

    return { allowed: false, host, reason: `Host "${host}" not in egress allowlist` };
  }

  /**
   * Proxy a request to the target URL with egress validation,
   * auth header injection, and trace context propagation.
   */
  public async proxy(
    request: ProxiedRequest,
    traceContext?: Readonly<{ traceparent?: string; tracestate?: string }>,
  ): Promise<ProxiedResponse> {
    const egressCheck = this.checkEgress(request.url);
    if (!egressCheck.allowed) {
      return {
        status: 403,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          error: 'EgressDenied',
          message: egressCheck.reason,
          host: egressCheck.host,
        }),
      };
    }

    const headers: Record<string, string> = { ...request.headers };

    // Inject auth header if token is available and not already set.
    if (this.#currentToken && !headers['authorization']) {
      headers['authorization'] = `Bearer ${this.#currentToken}`;
    }

    // Inject W3C trace context headers.
    if (traceContext?.traceparent && !headers['traceparent']) {
      headers['traceparent'] = traceContext.traceparent;
    }
    if (traceContext?.tracestate && !headers['tracestate']) {
      headers['tracestate'] = traceContext.tracestate;
    }

    try {
      const response = await this.#fetchImpl(request.url, {
        method: request.method,
        headers,
        ...(request.body !== undefined ? { body: request.body } : {}),
      });

      const responseBody = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        status: response.status,
        headers: responseHeaders,
        body: responseBody,
      };
    } catch (error) {
      return {
        status: 502,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          error: 'UpstreamFailure',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      };
    }
  }
}

/**
 * Match a hostname against a pattern.
 * Supports exact match and wildcard prefix (e.g., *.example.com).
 */
function matchesHost(host: string, pattern: string): boolean {
  if (pattern === host) return true;

  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // e.g., ".example.com"
    return host.endsWith(suffix) && host.length > suffix.length;
  }

  return false;
}
