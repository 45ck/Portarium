/**
 * Standardised identity propagation context for Portarium.
 *
 * Unifies the identity fields that must be carried across all egress control
 * points (Agent Gateway, Sidecar Proxy, Action API) for audit correlation.
 *
 * ADR-0115 Section 5: Identity Model — dual-layer identity.
 * ADR-0115 Section: Audit Requirements — required fields.
 *
 * Bead: bead-0836
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Identity propagation context carried on every proxied request.
 *
 * Combines workload identity (mTLS/SPIFFE layer) and request-level identity
 * (JWT layer) into a single audit-ready record.
 */
export type IdentityPropagationContext = Readonly<{
  /** Subject — agent SPIFFE ID or user principal (from JWT sub). */
  subject: string;
  /** Workspace (tenant) scope. Required on every request. */
  workspaceId: string;
  /** Tenant ID alias (v1 equivalence with workspaceId). */
  tenantId: string;
  /** Agent SPIFFE ID from mTLS peer certificate. */
  agentSpiffeId?: string;
  /** Correlation to the originating workflow run (from JWT). */
  workflowRunId?: string;
  /** Permitted action scopes for this request (from JWT). */
  scopes?: readonly string[];
  /** Request correlation ID (UUID, generated per-request). */
  correlationId: string;
  /** W3C traceparent header value. */
  traceparent?: string;
  /** W3C tracestate header value. */
  tracestate?: string;
}>;

/**
 * HTTP header names used for identity propagation.
 *
 * These are the canonical header names injected by the Agent Gateway
 * and Sidecar Proxy for downstream services and audit sinks.
 */
export const IDENTITY_HEADERS = {
  subject: 'x-portarium-subject',
  workspaceId: 'x-portarium-workspace-id',
  tenantId: 'x-portarium-tenant-id',
  agentSpiffeId: 'x-portarium-agent-spiffe-id',
  workflowRunId: 'x-portarium-workflow-run-id',
  scopes: 'x-portarium-scopes',
  correlationId: 'x-portarium-correlation-id',
  traceparent: 'traceparent',
  tracestate: 'tracestate',
} as const;

// ---------------------------------------------------------------------------
// Build / extract
// ---------------------------------------------------------------------------

/**
 * Build identity propagation headers from a context object.
 *
 * Used by the Agent Gateway and Sidecar Proxy to inject identity
 * headers into proxied requests.
 */
export function buildIdentityHeaders(ctx: IdentityPropagationContext): Record<string, string> {
  const headers: Record<string, string> = {
    [IDENTITY_HEADERS.subject]: ctx.subject,
    [IDENTITY_HEADERS.workspaceId]: ctx.workspaceId,
    [IDENTITY_HEADERS.tenantId]: ctx.tenantId,
    [IDENTITY_HEADERS.correlationId]: ctx.correlationId,
  };

  if (ctx.agentSpiffeId) {
    headers[IDENTITY_HEADERS.agentSpiffeId] = ctx.agentSpiffeId;
  }
  if (ctx.workflowRunId) {
    headers[IDENTITY_HEADERS.workflowRunId] = ctx.workflowRunId;
  }
  if (ctx.scopes && ctx.scopes.length > 0) {
    headers[IDENTITY_HEADERS.scopes] = ctx.scopes.join(' ');
  }
  if (ctx.traceparent) {
    headers[IDENTITY_HEADERS.traceparent] = ctx.traceparent;
  }
  if (ctx.tracestate) {
    headers[IDENTITY_HEADERS.tracestate] = ctx.tracestate;
  }

  return headers;
}

/**
 * Extract an identity propagation context from inbound HTTP headers.
 *
 * Used by downstream services to recover the propagated identity
 * from the Agent Gateway or Sidecar Proxy.
 *
 * Returns undefined if the required fields (subject, workspaceId, correlationId)
 * are missing.
 */
export function extractIdentityFromHeaders(
  headers: Readonly<Record<string, string | string[] | undefined>>,
): IdentityPropagationContext | undefined {
  const subject = normalizeHeader(headers[IDENTITY_HEADERS.subject]);
  const workspaceId = normalizeHeader(headers[IDENTITY_HEADERS.workspaceId]);
  const correlationId = normalizeHeader(headers[IDENTITY_HEADERS.correlationId]);

  if (!subject || !workspaceId || !correlationId) return undefined;

  const tenantId = normalizeHeader(headers[IDENTITY_HEADERS.tenantId]) ?? workspaceId;
  const agentSpiffeId = normalizeHeader(headers[IDENTITY_HEADERS.agentSpiffeId]);
  const workflowRunId = normalizeHeader(headers[IDENTITY_HEADERS.workflowRunId]);
  const scopesRaw = normalizeHeader(headers[IDENTITY_HEADERS.scopes]);
  const scopes = scopesRaw ? scopesRaw.split(' ').filter(Boolean) : undefined;
  const traceparent = normalizeHeader(headers[IDENTITY_HEADERS.traceparent]);
  const tracestate = normalizeHeader(headers[IDENTITY_HEADERS.tracestate]);

  return {
    subject,
    workspaceId,
    tenantId,
    correlationId,
    ...(agentSpiffeId ? { agentSpiffeId } : {}),
    ...(workflowRunId ? { workflowRunId } : {}),
    ...(scopes && scopes.length > 0 ? { scopes } : {}),
    ...(traceparent ? { traceparent } : {}),
    ...(tracestate ? { tracestate } : {}),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  const str = Array.isArray(value) ? value[0] : value;
  const trimmed = str?.trim();
  if (trimmed === undefined || trimmed.length === 0) return undefined;
  return trimmed;
}
