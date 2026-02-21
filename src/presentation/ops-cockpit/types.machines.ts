import type { CursorPaginationRequest } from './types.js';

export type AgentCapability =
  | 'read:external'
  | 'write:external'
  | 'classify'
  | 'generate'
  | 'analyze'
  | 'execute-code'
  | 'notify'
  | 'machine:invoke';

export type ConnectionTestStatus = 'ok' | 'slow' | 'unreachable';

export interface ConnectionTestResult {
  status: ConnectionTestStatus;
  latencyMs: number;
  errorMessage?: string;
}

export type MachineStatus = 'Online' | 'Degraded' | 'Offline';

export interface MachineV1 {
  schemaVersion: 1;
  machineId: string;
  workspaceId: string;
  hostname: string;
  osImage?: string;
  registeredAtIso: string;
  lastHeartbeatAtIso?: string;
  status: MachineStatus;
  activeRunCount?: number;
  allowedCapabilities?: AgentCapability[];
}

export interface RegisterMachineRequest {
  hostname: string;
  osImage?: string;
  allowedCapabilities?: AgentCapability[];
}

export type ListMachinesRequest = CursorPaginationRequest;

export interface AgentV1 {
  schemaVersion: 1;
  agentId: string;
  workspaceId: string;
  name: string;
  modelId?: string;
  endpoint: string;
  allowedCapabilities: AgentCapability[];
  usedByWorkflowIds?: string[];
}

export interface RegisterAgentRequest {
  name: string;
  modelId?: string;
  endpoint: string;
  allowedCapabilities?: AgentCapability[];
}

export interface UpdateAgentRequest {
  name?: string;
  endpoint?: string;
  allowedCapabilities?: AgentCapability[];
}

export type ListAgentsRequest = CursorPaginationRequest;

export interface PolicyCondition {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'gt' | 'lt';
  value: string;
}

export interface PolicySummary {
  policyId: string;
  name: string;
  description: string;
  status: 'Active' | 'Draft' | 'Archived';
  ruleText: string;
  conditions: PolicyCondition[];
}

export interface SodConstraint {
  constraintId: string;
  name: string;
  description: string;
  status: 'Active' | 'Inactive';
  relatedPolicyIds: string[];
}

export interface AdapterSummary {
  adapterId: string;
  name: string;
  sorFamily: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastSyncIso: string;
}

export interface GatewaySummary {
  gatewayId: string;
  url: string;
  status: 'Online' | 'Offline' | 'Degraded';
  connectedRobots: number;
  lastHeartbeatIso: string;
  region: string;
}
