import { APP_ACTIONS, type AppAction } from '../common/actions.js';

export type CockpitExtensionBackendHttpMethod = 'GET' | 'POST';

export type CockpitExtensionBackendIsolation =
  | 'workspace-scoped'
  | 'workspace-and-principal-scoped';

export type CockpitExtensionBackendEvidenceSemantics =
  | 'read-audited-by-control-plane'
  | 'evidence-required-before-response';

export type CockpitExtensionBackendPolicySemantics =
  | 'authorization-required'
  | 'policy-approval-evidence-required';

export type CockpitExtensionBackendSurfaceBase = Readonly<{
  id: string;
  method: CockpitExtensionBackendHttpMethod;
  pathTemplate: string;
  requiredApiScopes: readonly string[];
  requiredCapabilities: readonly string[];
  requiredAppActions: readonly AppAction[];
  isolation: CockpitExtensionBackendIsolation;
  policySemantics: CockpitExtensionBackendPolicySemantics;
  evidenceSemantics: CockpitExtensionBackendEvidenceSemantics;
  failClosed: true;
}>;

export type CockpitExtensionDataQueryContract = CockpitExtensionBackendSurfaceBase &
  Readonly<{
    kind: 'data-query';
  }>;

export type CockpitExtensionGovernedCommandContract = CockpitExtensionBackendSurfaceBase &
  Readonly<{
    kind: 'governed-command-request';
    approvalSemantics: 'policy-determined';
    idempotency: 'caller-or-host-key-required';
  }>;

export type CockpitExtensionHostContract = Readonly<{
  schemaVersion: 1;
  browserEgress: 'host-api-origins-only';
  credentialAccess: 'none';
  failureMode: 'fail-closed';
  dataQueries: readonly CockpitExtensionDataQueryContract[];
  governedCommandRequests: readonly CockpitExtensionGovernedCommandContract[];
}>;

export const COCKPIT_EXTENSION_DATA_QUERY_CONTRACTS = [
  {
    kind: 'data-query',
    id: 'cockpit.extensionContext.get',
    method: 'GET',
    pathTemplate: '/v1/workspaces/{workspaceId}/cockpit/extension-context',
    requiredApiScopes: ['extensions.read'],
    requiredCapabilities: [],
    requiredAppActions: [APP_ACTIONS.workspaceRead],
    isolation: 'workspace-and-principal-scoped',
    policySemantics: 'authorization-required',
    evidenceSemantics: 'read-audited-by-control-plane',
    failClosed: true,
  },
  {
    kind: 'data-query',
    id: 'workItems.list',
    method: 'GET',
    pathTemplate: '/v1/workspaces/{workspaceId}/work-items',
    requiredApiScopes: ['work-items.read'],
    requiredCapabilities: [],
    requiredAppActions: [APP_ACTIONS.workItemRead],
    isolation: 'workspace-scoped',
    policySemantics: 'authorization-required',
    evidenceSemantics: 'read-audited-by-control-plane',
    failClosed: true,
  },
  {
    kind: 'data-query',
    id: 'approvals.list',
    method: 'GET',
    pathTemplate: '/v1/workspaces/{workspaceId}/approvals',
    requiredApiScopes: ['approvals.read'],
    requiredCapabilities: [],
    requiredAppActions: [APP_ACTIONS.approvalRead],
    isolation: 'workspace-scoped',
    policySemantics: 'authorization-required',
    evidenceSemantics: 'read-audited-by-control-plane',
    failClosed: true,
  },
  {
    kind: 'data-query',
    id: 'approvals.get',
    method: 'GET',
    pathTemplate: '/v1/workspaces/{workspaceId}/approvals/{approvalId}',
    requiredApiScopes: ['approvals.read'],
    requiredCapabilities: [],
    requiredAppActions: [APP_ACTIONS.approvalRead],
    isolation: 'workspace-scoped',
    policySemantics: 'authorization-required',
    evidenceSemantics: 'read-audited-by-control-plane',
    failClosed: true,
  },
  {
    kind: 'data-query',
    id: 'evidence.list',
    method: 'GET',
    pathTemplate: '/v1/workspaces/{workspaceId}/evidence',
    requiredApiScopes: ['evidence.read'],
    requiredCapabilities: [],
    requiredAppActions: [APP_ACTIONS.evidenceRead],
    isolation: 'workspace-scoped',
    policySemantics: 'authorization-required',
    evidenceSemantics: 'read-audited-by-control-plane',
    failClosed: true,
  },
] as const satisfies readonly CockpitExtensionDataQueryContract[];

export const COCKPIT_EXTENSION_GOVERNED_COMMAND_CONTRACTS = [
  {
    kind: 'governed-command-request',
    id: 'agentActions.propose',
    method: 'POST',
    pathTemplate: '/v1/workspaces/{workspaceId}/agent-actions:propose',
    requiredApiScopes: ['agent-actions.propose'],
    requiredCapabilities: [],
    requiredAppActions: [APP_ACTIONS.agentActionPropose],
    isolation: 'workspace-and-principal-scoped',
    policySemantics: 'policy-approval-evidence-required',
    evidenceSemantics: 'evidence-required-before-response',
    approvalSemantics: 'policy-determined',
    idempotency: 'caller-or-host-key-required',
    failClosed: true,
  },
] as const satisfies readonly CockpitExtensionGovernedCommandContract[];

export const EMPTY_COCKPIT_EXTENSION_HOST_CONTRACT: CockpitExtensionHostContract = {
  schemaVersion: 1,
  browserEgress: 'host-api-origins-only',
  credentialAccess: 'none',
  failureMode: 'fail-closed',
  dataQueries: [],
  governedCommandRequests: [],
};
