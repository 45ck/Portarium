/**
 * Minimal Integration Surface (MIS) v0.1 — Portarium SDK
 *
 * This module defines the minimum contract an adapter integration must
 * satisfy to be registered and invoked by the Portarium control plane.
 *
 * Design principles:
 * - No runtime dependencies (pure TypeScript types + one schema object).
 * - Framework-agnostic: works with Express, Fastify, plain Node http, etc.
 * - All fields are documented inline so SDK consumers need no external docs.
 *
 * Adoption path:
 *   1. Implement `MisAdapterV1` for your external service.
 *   2. Register the adapter via `PortariumClient.adapters.register()`.
 *   3. The control plane will call `invoke()` on inbound workflow actions.
 *
 * Bead: bead-0743
 */

// ---------------------------------------------------------------------------
// Core result types
// ---------------------------------------------------------------------------

/**
 * Every adapter invocation returns a `MisResult`.
 * Use `MisResult.ok()` / `MisResult.err()` factory helpers.
 */
export type MisResultOk<T> = Readonly<{ ok: true; value: T }>;
export type MisResultErr = Readonly<{
  ok: false;
  code: MisErrorCode;
  message: string;
  retryable: boolean;
}>;
export type MisResult<T> = MisResultOk<T> | MisResultErr;

export const MisResult = {
  ok<T>(value: T): MisResultOk<T> {
    return { ok: true, value };
  },
  err(code: MisErrorCode, message: string, retryable = false): MisResultErr {
    return { ok: false, code, message, retryable };
  },
} as const;

/**
 * Standard error codes for adapter failures.
 * The control plane uses these to decide retry/escalation strategy.
 */
export type MisErrorCode =
  | 'NOT_FOUND' // Resource does not exist in the external system
  | 'UNAUTHORIZED' // Credential rejected by the external system
  | 'RATE_LIMITED' // External system is throttling requests
  | 'VALIDATION_FAILED' // Input payload did not satisfy external system constraints
  | 'EXTERNAL_ERROR' // Non-retryable error from the external system
  | 'TIMEOUT' // External system did not respond within the allotted time
  | 'INTERNAL_ERROR'; // Bug in the adapter itself

// ---------------------------------------------------------------------------
// Invocation context
// ---------------------------------------------------------------------------

/**
 * Context passed to every `invoke()` call.
 * The adapter should use `correlationId` for logging and tracing.
 */
export type MisInvocationContext = Readonly<{
  /** W3C traceparent for distributed tracing. */
  traceparent?: string;
  /** Portarium correlation ID — include in adapter logs. */
  correlationId: string;
  /** ISO 8601 timestamp when the invocation was initiated. */
  requestedAtIso: string;
  /** Workspace that owns this invocation. */
  workspaceId: string;
  /** Dry-run mode: perform all validation but skip side effects. */
  dryRun?: boolean;
}>;

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export type MisHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export type MisHealthResult = Readonly<{
  status: MisHealthStatus;
  /** Optional human-readable detail, e.g. "DB latency 450 ms". */
  detail?: string;
}>;

// ---------------------------------------------------------------------------
// Core adapter interface
// ---------------------------------------------------------------------------

/**
 * The minimum interface every Portarium adapter must implement.
 *
 * @example
 * ```ts
 * class MyAdapter implements MisAdapterV1 {
 *   readonly meta = {
 *     adapterId: 'my-service-v1',
 *     portFamily: 'FinanceAccounting',
 *     displayName: 'My Service',
 *     schemaVersion: 1 as const,
 *   };
 *
 *   async health() { return { status: 'healthy' as const }; }
 *
 *   async invoke(operation, payload, ctx) {
 *     if (operation === 'listInvoices') { ... }
 *     return MisResult.err('VALIDATION_FAILED', `Unknown operation: ${operation}`);
 *   }
 * }
 * ```
 */
export interface MisAdapterV1 {
  /** Static metadata about this adapter. */
  readonly meta: MisAdapterMetaV1;

  /**
   * Perform a connectivity and credential check.
   * Called during registration and periodically by the health monitor.
   */
  health(): Promise<MisHealthResult>;

  /**
   * Invoke a named operation on the external system.
   *
   * @param operation  - The capability token to execute (e.g. `"invoice:create"`).
   * @param payload    - Operation-specific input, validated by the control plane
   *                     against the declared operation schema before this call.
   * @param ctx        - Invocation context (tracing, workspace, dry-run flag).
   */
  invoke(
    operation: string,
    payload: Record<string, unknown>,
    ctx: MisInvocationContext,
  ): Promise<MisResult<Record<string, unknown>>>;
}

// ---------------------------------------------------------------------------
// Adapter metadata
// ---------------------------------------------------------------------------

/**
 * Static descriptor for an adapter.  Registered with the control plane on
 * startup; immutable for the lifetime of the adapter process.
 */
export type MisAdapterMetaV1 = Readonly<{
  schemaVersion: 1;
  /** Stable identifier. Use reverse-domain or kebab-case: `acme-crm-v1`. */
  adapterId: string;
  /**
   * Port family this adapter belongs to.
   * Must match one of the canonical Portarium port families.
   */
  portFamily: MisPortFamily;
  /** Human-readable name shown in the Cockpit UI. */
  displayName: string;
  /** Semantic version of the adapter implementation. */
  version?: string;
  /**
   * Operations this adapter supports.
   * Each token must match `entity:verb` format (e.g. `"invoice:create"`).
   */
  supportedOperations?: readonly string[];
}>;

/**
 * Canonical Portarium port families (frozen at MIS v0.1).
 * Extending this list requires an ADR.
 */
export type MisPortFamily =
  | 'FinanceAccounting'
  | 'PaymentsBilling'
  | 'ProcurementSpend'
  | 'HrisHcm'
  | 'Payroll'
  | 'CrmSales'
  | 'CustomerSupport'
  | 'ItsmItOps'
  | 'IamDirectory'
  | 'SecretsVaulting'
  | 'MarketingAutomation'
  | 'AdsPlatforms'
  | 'CommsCollaboration'
  | 'ProjectsWorkMgmt'
  | 'DocumentsEsign'
  | 'AnalyticsBi'
  | 'MonitoringIncident'
  | 'ComplianceGrc'
  | 'SoftwareDev'
  | 'RoboticsActuation';

// ---------------------------------------------------------------------------
// MIS v0.1 schema descriptor (runtime-accessible)
// ---------------------------------------------------------------------------

/** Runtime descriptor of the MIS version — use for compatibility checks. */
export const MIS_V1 = {
  version: '0.1.0',
  schemaVersion: 1,
  portFamilies: [
    'FinanceAccounting',
    'PaymentsBilling',
    'ProcurementSpend',
    'HrisHcm',
    'Payroll',
    'CrmSales',
    'CustomerSupport',
    'ItsmItOps',
    'IamDirectory',
    'SecretsVaulting',
    'MarketingAutomation',
    'AdsPlatforms',
    'CommsCollaboration',
    'ProjectsWorkMgmt',
    'DocumentsEsign',
    'AnalyticsBi',
    'MonitoringIncident',
    'ComplianceGrc',
    'SoftwareDev',
    'RoboticsActuation',
  ] as readonly MisPortFamily[],
  requiredMethods: ['health', 'invoke'] as const,
} as const;
