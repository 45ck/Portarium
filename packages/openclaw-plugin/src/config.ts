/**
 * Portarium plugin configuration.
 * Matches the configSchema in openclaw.plugin.json.
 */

/** Tools that are always allowed without governance — hard-coded to Portarium introspection only. */
const PERMITTED_BYPASS_TOOLS: ReadonlySet<string> = new Set([
  'portarium_get_run',
  'portarium_list_approvals',
  'portarium_capability_lookup',
]);

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
  return sanitized;
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
    const v = raw.approvalTimeoutMs;
    if (!Number.isFinite(v) || (v as number) <= 0) {
      throw new Error(
        '[portarium-plugin] config.approvalTimeoutMs must be a finite positive number',
      );
    }
    approvalTimeoutMs = v as number;
  }

  let pollIntervalMs = DEFAULT_CONFIG.pollIntervalMs;
  if (raw.pollIntervalMs !== undefined) {
    const v = raw.pollIntervalMs;
    if (!Number.isFinite(v) || (v as number) < 500) {
      throw new Error(
        '[portarium-plugin] config.pollIntervalMs must be a finite number >= 500ms to prevent spin-loops',
      );
    }
    pollIntervalMs = v as number;
  }

  // bypassToolNames: only allow the hard-coded Portarium introspection tools.
  // Any value outside the permitted set is silently dropped with a warning.
  let bypassToolNames: readonly string[] = [...PERMITTED_BYPASS_TOOLS];
  if (Array.isArray(raw.bypassToolNames)) {
    const requested = raw.bypassToolNames as string[];
    const rejected = requested.filter((t) => !PERMITTED_BYPASS_TOOLS.has(t));
    if (rejected.length > 0) {
      console.warn(
        `[portarium-plugin] config.bypassToolNames contains tools outside the permitted introspection set — ignoring: ${rejected.join(', ')}. ` +
          `Only ${[...PERMITTED_BYPASS_TOOLS].join(', ')} may bypass governance.`,
      );
    }
    const allowed = requested.filter((t) => PERMITTED_BYPASS_TOOLS.has(t));
    bypassToolNames = allowed.length > 0 ? allowed : [...PERMITTED_BYPASS_TOOLS];
  }

  const workspaceId = sanitizeHeaderValue(raw.workspaceId, 'workspaceId');
  const bearerToken = sanitizeHeaderValue(raw.bearerToken, 'bearerToken');
  const tenantId = sanitizeHeaderValue(
    typeof raw.tenantId === 'string' ? raw.tenantId : DEFAULT_CONFIG.tenantId,
    'tenantId',
  );

  return {
    portariumUrl: raw.portariumUrl.replace(/\/+$/, ''),
    workspaceId,
    bearerToken,
    tenantId,
    failClosed: raw.failClosed !== false,
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
