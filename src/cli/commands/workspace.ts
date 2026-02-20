/**
 * CLI workspace command stubs.
 *
 * Subcommands: list, select, current
 */

export async function handleWorkspaceList(
  _baseUrl: string,
  _token: string,
): Promise<void> {
  console.log('Listing workspaces... (stub)');
}

export async function handleWorkspaceSelect(
  _baseUrl: string,
  _token: string,
  _workspaceId: string,
): Promise<void> {
  console.log('Selecting workspace... (stub)');
}

export async function handleWorkspaceCurrent(): Promise<void> {
  console.log('Current workspace: (stub -- reads from ~/.portarium/context.json)');
}
