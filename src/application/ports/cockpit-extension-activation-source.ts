export type CockpitExtensionActivationState = Readonly<{
  activePackIds: readonly string[];
  quarantinedExtensionIds: readonly string[];
  emergencyDisabledExtensionIds?: readonly string[];
  availableCapabilities?: readonly string[];
  availableApiScopes?: readonly string[];
  availablePrivacyClasses?: readonly string[];
}>;

export type CockpitExtensionActivationQuery = Readonly<{
  workspaceId: string;
  principalId: string;
  roles: readonly string[];
  scopes: readonly string[];
  correlationId: string;
  traceparent: string;
  tracestate?: string;
}>;

export interface CockpitExtensionActivationSource {
  getActivationState(
    query: CockpitExtensionActivationQuery,
  ): Promise<CockpitExtensionActivationState>;
}

export const EMPTY_COCKPIT_EXTENSION_ACTIVATION_SOURCE: CockpitExtensionActivationSource = {
  getActivationState: async () => ({
    activePackIds: [],
    quarantinedExtensionIds: [],
    emergencyDisabledExtensionIds: [],
    availableCapabilities: [],
    availableApiScopes: [],
    availablePrivacyClasses: [],
  }),
};
