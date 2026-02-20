/**
 * CLI run command stubs.
 *
 * Subcommands: start, status, cancel, list
 */

export async function handleRunStart(
  _baseUrl: string,
  _token: string,
  _workspaceId: string,
  _workflowId: string,
  _input?: Record<string, unknown>,
): Promise<void> {
  console.log('Starting run... (stub)');
}

export async function handleRunStatus(
  _baseUrl: string,
  _token: string,
  _workspaceId: string,
  _runId: string,
): Promise<void> {
  console.log('Getting run status... (stub)');
}

export async function handleRunCancel(
  _baseUrl: string,
  _token: string,
  _workspaceId: string,
  _runId: string,
): Promise<void> {
  console.log('Cancelling run... (stub)');
}

export async function handleRunList(
  _baseUrl: string,
  _token: string,
  _workspaceId: string,
  _status?: string,
): Promise<void> {
  console.log('Listing runs... (stub)');
}
