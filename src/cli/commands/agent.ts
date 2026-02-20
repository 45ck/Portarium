/**
 * CLI agent command stubs.
 *
 * Subcommands: register, list, heartbeat
 */

export async function handleAgentRegister(
  _baseUrl: string,
  _token: string,
  _workspaceId: string,
  _name: string,
): Promise<void> {
  console.log('Registering agent... (stub)');
}

export async function handleAgentList(
  _baseUrl: string,
  _token: string,
  _workspaceId: string,
): Promise<void> {
  console.log('Listing agents... (stub)');
}

export async function handleAgentHeartbeat(
  _baseUrl: string,
  _token: string,
  _workspaceId: string,
  _agentId: string,
): Promise<void> {
  console.log('Sending heartbeat... (stub)');
}
