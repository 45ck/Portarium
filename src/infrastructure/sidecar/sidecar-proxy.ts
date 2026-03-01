import type { SidecarConfigV1 } from './sidecar-config-v1.js';
import type { EgressAuditRecord, EgressAuditSink } from './egress-audit-log.js';

/**
 * Egress validation result.
 */
export type EgressCheckResult = Readonly<{
  allowed: boolean;
  host: string;
  reason?: string;
}>;

/**
 * Identity context carried through the sidecar for audit and header injection.
 * Populated from SPIFFE SVID and JWT claims per ADR-0115.
 */
export type SidecarIdentityContext = Readonly<{
  tenantId?: string;
  workflowRunId?: string;
  agentSpiffeId?: string;
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
 * Portarium sidecar proxy — default-deny egress enforcement (ADR-0115 Pattern B).
 *
 * Responsibilities:
 * 1. Intercept all outbound HTTP/HTTPS from agent workloads
 * 2. Enforce egress allowlist with default-deny behavior
 * 3. Inject identity headers (Bearer token, tenant, SPIFFE ID)
 * 4. Inject W3C trace context headers (traceparent, tracestate)
 * 5. Emit structured audit records for every egress decision
 *
 * Enforcement modes:
 * - 'enforce': blocked requests return 403 (default-deny, fail-closed)
 * - 'monitor': violations are logged but traffic is forwarded (Phase 1)
 */
export class SidecarProxy {
  readonly #config: SidecarConfigV1;
  readonly #fetchImpl: typeof fetch;
  readonly #auditSink: EgressAuditSink | undefined;
  #currentToken: string | undefined;
  #identity: SidecarIdentityContext = {};

  public constructor(
    config: SidecarConfigV1,
    fetchImpl?: typeof fetch,
    auditSink?: EgressAuditSink,
  ) {
    this.#config = config;
    this.#fetchImpl = fetchImpl ?? fetch;
    this.#auditSink = auditSink;
  }

  public setToken(token: string): void {
    this.#currentToken = token;
  }

  public setIdentity(identity: SidecarIdentityContext): void {
    this.#identity = identity;
  }

  public checkEgress(targetUrl: string): EgressCheckResult {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return { allowed: false, host: targetUrl, reason: 'Invalid URL' };
    }

    const host = parsedUrl.hostname;

    if (this.#config.egressAllowlist.length === 0) {
      return { allowed: false, host, reason: 'Egress allowlist is empty (default-deny)' };
    }

    for (const pattern of this.#config.egressAllowlist) {
      if (matchesHost(host, pattern)) {
        return { allowed: true, host };
      }
    }

    return { allowed: false, host, reason: `Host "${host}" not in egress allowlist` };
  }

  /**
   * Proxy a request through the sidecar with full egress enforcement.
   *
   * In 'enforce' mode: denied requests are blocked (403).
   * In 'monitor' mode: denied requests are logged but forwarded.
   * All decisions are emitted as audit records.
   */
  public async proxy(
    request: ProxiedRequest,
    traceContext?: Readonly<{ traceparent?: string; tracestate?: string }>,
  ): Promise<ProxiedResponse> {
    const start = Date.now();
    const egressCheck = this.checkEgress(request.url);
    const parsedUrl = safeParseUrl(request.url);

    if (!egressCheck.allowed && this.#config.enforcementMode === 'enforce') {
      const response = buildEgressDeniedResponse(egressCheck);
      this.#emitAudit(request, parsedUrl, egressCheck, response.status, start);
      return response;
    }

    if (!egressCheck.allowed && this.#config.enforcementMode === 'monitor') {
      this.#emitAudit(request, parsedUrl, egressCheck, undefined, start);
    }

    const headers = this.#buildProxyHeaders(request.headers, traceContext);

    try {
      const response = await this.#fetchImpl(request.url, {
        method: request.method,
        headers,
        ...(request.body !== undefined ? { body: request.body } : {}),
      });

      const result: ProxiedResponse = {
        status: response.status,
        headers: toHeaderRecord(response.headers),
        body: await response.text(),
      };

      if (egressCheck.allowed) {
        this.#emitAudit(request, parsedUrl, egressCheck, result.status, start);
      }

      return result;
    } catch (error) {
      const result = buildUpstreamFailureResponse(error);
      this.#emitAudit(request, parsedUrl, egressCheck, result.status, start);
      return result;
    }
  }

  #emitAudit(
    request: ProxiedRequest,
    parsedUrl: URL | undefined,
    egressCheck: EgressCheckResult,
    responseStatus: number | undefined,
    startMs: number,
  ): void {
    if (!this.#auditSink) return;

    const record: EgressAuditRecord = {
      timestamp: Date.now(),
      enforcementMode: this.#config.enforcementMode,
      policyDecision: egressCheck.allowed ? 'allow' : 'deny',
      destinationHost: egressCheck.host,
      destinationPort: parsedUrl ? parsePort(parsedUrl) : undefined,
      httpMethod: request.method,
      httpPath: parsedUrl?.pathname ?? request.url,
      responseStatus,
      policyReason: egressCheck.reason,
      latencyMs: Date.now() - startMs,
      tenantId: this.#identity.tenantId,
      workflowRunId: this.#identity.workflowRunId,
      agentSpiffeId: this.#identity.agentSpiffeId,
    };

    this.#auditSink.emit(record);
  }

  #buildProxyHeaders(
    requestHeaders: Readonly<Record<string, string>>,
    traceContext?: Readonly<{ traceparent?: string; tracestate?: string }>,
  ): Record<string, string> {
    const headers: Record<string, string> = { ...requestHeaders };

    if (this.#currentToken && !headers['authorization']) {
      headers['authorization'] = `Bearer ${this.#currentToken}`;
    }

    if (this.#identity.tenantId && !headers['x-portarium-tenant-id']) {
      headers['x-portarium-tenant-id'] = this.#identity.tenantId;
    }
    if (this.#identity.workflowRunId && !headers['x-portarium-workflow-run-id']) {
      headers['x-portarium-workflow-run-id'] = this.#identity.workflowRunId;
    }
    if (this.#identity.agentSpiffeId && !headers['x-portarium-agent-spiffe-id']) {
      headers['x-portarium-agent-spiffe-id'] = this.#identity.agentSpiffeId;
    }

    if (traceContext?.traceparent && !headers['traceparent']) {
      headers['traceparent'] = traceContext.traceparent;
    }
    if (traceContext?.tracestate && !headers['tracestate']) {
      headers['tracestate'] = traceContext.tracestate;
    }
    return headers;
  }
}

function matchesHost(host: string, pattern: string): boolean {
  if (pattern === host) return true;

  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1);
    return host.endsWith(suffix) && host.length > suffix.length;
  }

  return false;
}

function toHeaderRecord(headers: Headers): Record<string, string> {
  const responseHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  return responseHeaders;
}

function safeParseUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

function parsePort(url: URL): number | undefined {
  if (url.port) return Number(url.port);
  if (url.protocol === 'https:') return 443;
  if (url.protocol === 'http:') return 80;
  return undefined;
}

function buildEgressDeniedResponse(egressCheck: EgressCheckResult): ProxiedResponse {
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

function buildUpstreamFailureResponse(error: unknown): ProxiedResponse {
  return {
    status: 502,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      error: 'UpstreamFailure',
      message: error instanceof Error ? error.message : 'Unknown error',
    }),
  };
}
