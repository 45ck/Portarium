/**
 * Portarium plugin configuration.
 * Matches the configSchema in openclaw.plugin.json.
 */

/** Tools that are always allowed without governance - hard-coded to Portarium introspection only. */
export const PERMITTED_BYPASS_TOOL_NAMES = [
  'portarium_get_run',
  'portarium_list_approvals',
  'portarium_capability_lookup',
] as const;

const PERMITTED_BYPASS_TOOLS: ReadonlySet<string> = new Set(PERMITTED_BYPASS_TOOL_NAMES);
const MIN_APPROVAL_TIMEOUT_MS = 60_000;
const MIN_POLL_INTERVAL_MS = 500;
const FAIL_OPEN_ALLOWED_NODE_ENVS = new Set(['development', 'test']);

export function isPermittedBypassToolName(toolName: string): boolean {
  return PERMITTED_BYPASS_TOOLS.has(toolName);
}

export interface PortariumPluginConfig {
  readonly portariumUrl: string;
  readonly workspaceId: string;
  readonly bearerToken: string;
  readonly tenantId: string;
  readonly failClosed: boolean;
  readonly approvalTimeoutMs: number;
  readonly pollIntervalMs: number;
  readonly bypassToolNames: readonly string[];
  /** Policy IDs to evaluate each proposal against. Defaults to ['default-governance']. */
  readonly defaultPolicyIds: readonly string[];
  /** Default execution tier when none is provided. Defaults to 'HumanApprove'. */
  readonly defaultExecutionTier: string;
}

export const DEFAULT_CONFIG: Pick<
  PortariumPluginConfig,
  | 'tenantId'
  | 'failClosed'
  | 'approvalTimeoutMs'
  | 'pollIntervalMs'
  | 'bypassToolNames'
  | 'defaultPolicyIds'
  | 'defaultExecutionTier'
> = {
  tenantId: 'default',
  failClosed: true,
  approvalTimeoutMs: 86_400_000, // 24 hours
  pollIntervalMs: 3_000,
  bypassToolNames: [...PERMITTED_BYPASS_TOOLS],
  defaultPolicyIds: ['default-governance'],
  defaultExecutionTier: 'HumanApprove',
};

/** Strip CRLF and NUL characters from a string used as an HTTP header value. */
function sanitizeHeaderValue(value: string, field: string): string {
  const sanitized = value.replace(/[\r\n\0]/g, '');
  if (sanitized !== value) {
    console.warn(
      `[portarium-plugin] config.${field} contained CRLF/NUL characters — stripped for safety`,
    );
  }
  if (!sanitized.trim()) {
    throw new Error(
      `[portarium-plugin] config.${field} must not be empty after CRLF/NUL sanitization`,
    );
  }
  return sanitized;
}

function resolveFiniteNumberAtLeast(
  value: unknown,
  field: 'approvalTimeoutMs' | 'pollIntervalMs',
  minimum: number,
  safetyReason: string,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new Error(
      `[portarium-plugin] config.${field} must be a finite number >= ${minimum}ms ${safetyReason}`,
    );
  }
  return value;
}

export function resolveConfig(raw: Record<string, unknown>): PortariumPluginConfig {
  if (typeof raw.portariumUrl !== 'string' || !raw.portariumUrl) {
    throw new Error('[portarium-plugin] config.portariumUrl is required');
  }
  if (typeof raw.workspaceId !== 'string' || !raw.workspaceId) {
    throw new Error('[portarium-plugin] config.workspaceId is required');
  }
  if (typeof raw.bearerToken !== 'string' || !raw.bearerToken) {
    throw new Error('[portarium-plugin] config.bearerToken is required');
  }

  // Validate numeric fields: must be finite and positive
  let approvalTimeoutMs = DEFAULT_CONFIG.approvalTimeoutMs;
  if (raw.approvalTimeoutMs !== undefined) {
    approvalTimeoutMs = resolveFiniteNumberAtLeast(
      raw.approvalTimeoutMs,
      'approvalTimeoutMs',
      MIN_APPROVAL_TIMEOUT_MS,
      'to prevent instant-deny approval waits',
    );
  }

  let pollIntervalMs = DEFAULT_CONFIG.pollIntervalMs;
  if (raw.pollIntervalMs !== undefined) {
    pollIntervalMs = resolveFiniteNumberAtLeast(
      raw.pollIntervalMs,
      'pollIntervalMs',
      MIN_POLL_INTERVAL_MS,
      'to prevent spin-loops',
    );
  }

  // bypassToolNames: only allow the hard-coded Portarium introspection tools.
  // Any value outside the permitted set is dropped with a visible warning.
  let bypassToolNames: readonly string[] = [...PERMITTED_BYPASS_TOOLS];
  if (Array.isArray(raw.bypassToolNames)) {
    const requested = raw.bypassToolNames;
    const rejected = requested.filter(
      (toolName): toolName is Exclude<unknown, string> =>
        typeof toolName !== 'string' || !isPermittedBypassToolName(toolName),
    );
    if (rejected.length > 0) {
      console.warn(
        `[portarium-plugin] config.bypassToolNames contains entries outside the permitted introspection set; ignoring: ${rejected.map(formatBypassToolNameForLog).join(', ')}. ` +
          `Only ${PERMITTED_BYPASS_TOOL_NAMES.join(', ')} may bypass governance.`,
      );
    }
    const allowed = requested.filter(
      (toolName): toolName is string =>
        typeof toolName === 'string' && isPermittedBypassToolName(toolName),
    );
    bypassToolNames = allowed.length > 0 ? allowed : [...PERMITTED_BYPASS_TOOLS];
  }

  const workspaceId = sanitizeHeaderValue(raw.workspaceId, 'workspaceId');
  const bearerToken = sanitizeHeaderValue(raw.bearerToken, 'bearerToken');
  const tenantId = sanitizeHeaderValue(
    typeof raw.tenantId === 'string' ? raw.tenantId : DEFAULT_CONFIG.tenantId,
    'tenantId',
  );
  const failClosed = raw.failClosed !== false;
  assertFailClosedIsProductionSafe(failClosed);

  return {
    portariumUrl: raw.portariumUrl.replace(/\/+$/, ''),
    workspaceId,
    bearerToken,
    tenantId,
    failClosed,
    approvalTimeoutMs,
    pollIntervalMs,
    bypassToolNames,
    defaultPolicyIds: Array.isArray(raw.defaultPolicyIds)
      ? (raw.defaultPolicyIds as string[])
      : [...DEFAULT_CONFIG.defaultPolicyIds],
    defaultExecutionTier:
      typeof raw.defaultExecutionTier === 'string'
        ? raw.defaultExecutionTier
        : DEFAULT_CONFIG.defaultExecutionTier,
  };
}

function formatBypassToolNameForLog(value: unknown): string {
  if (typeof value === 'string') {
    return value.replace(/[\r\n\0]/g, '');
  }
  return JSON.stringify(value) ?? String(value);
}

function assertFailClosedIsProductionSafe(failClosed: boolean): void {
  if (failClosed) return;

  const nodeEnv = readNodeEnv();
  if (!FAIL_OPEN_ALLOWED_NODE_ENVS.has(nodeEnv ?? '')) {
    throw new Error(
      '[portarium-plugin] config.failClosed=false is allowed only when NODE_ENV is development or test. Keep failClosed=true for production and shared deployments.',
    );
  }
}

function readNodeEnv(): string | undefined {
  const globalWithProcess = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return globalWithProcess.process?.env?.NODE_ENV;
}
