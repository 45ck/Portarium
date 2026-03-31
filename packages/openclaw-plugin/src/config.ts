/**
 * Portarium plugin configuration.
 * Matches the configSchema in openclaw.plugin.json.
 */
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
  bypassToolNames: ['portarium_get_run', 'portarium_list_approvals', 'portarium_capability_lookup'],
  defaultPolicyIds: ['default-governance'],
  defaultExecutionTier: 'HumanApprove',
};

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

  return {
    portariumUrl: raw.portariumUrl.replace(/\/+$/, ''),
    workspaceId: raw.workspaceId,
    bearerToken: raw.bearerToken,
    tenantId: typeof raw.tenantId === 'string' ? raw.tenantId : DEFAULT_CONFIG.tenantId,
    failClosed: raw.failClosed !== false,
    approvalTimeoutMs:
      typeof raw.approvalTimeoutMs === 'number'
        ? raw.approvalTimeoutMs
        : DEFAULT_CONFIG.approvalTimeoutMs,
    pollIntervalMs:
      typeof raw.pollIntervalMs === 'number' ? raw.pollIntervalMs : DEFAULT_CONFIG.pollIntervalMs,
    bypassToolNames: Array.isArray(raw.bypassToolNames)
      ? (raw.bypassToolNames as string[])
      : [...DEFAULT_CONFIG.bypassToolNames],
    defaultPolicyIds: Array.isArray(raw.defaultPolicyIds)
      ? (raw.defaultPolicyIds as string[])
      : [...DEFAULT_CONFIG.defaultPolicyIds],
    defaultExecutionTier:
      typeof raw.defaultExecutionTier === 'string'
        ? raw.defaultExecutionTier
        : DEFAULT_CONFIG.defaultExecutionTier,
  };
}
