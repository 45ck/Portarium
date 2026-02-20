/**
 * CLI agent command stubs.
 *
 * Subcommands: register, list, heartbeat
 */

export interface AgentRegisterArgs {
  baseUrl: string;
  token: string;
  workspaceId: string;
  name: string;
}

export function handleAgentRegister(_args: AgentRegisterArgs): void {
  console.log('Registering agent... (stub)');
}

export interface AgentListArgs {
  baseUrl: string;
  token: string;
  workspaceId: string;
}

export function handleAgentList(_args: AgentListArgs): void {
  console.log('Listing agents... (stub)');
}

export interface AgentHeartbeatArgs {
  baseUrl: string;
  token: string;
  workspaceId: string;
  agentId: string;
}

export function handleAgentHeartbeat(_args: AgentHeartbeatArgs): void {
  console.log('Sending heartbeat... (stub)');
}
