/**
 * CLI workspace command stubs.
 *
 * Subcommands: list, select, current
 */

export interface WorkspaceListArgs {
  baseUrl: string;
  token: string;
}

export interface WorkspaceSelectArgs {
  baseUrl: string;
  token: string;
  workspaceId: string;
}

export function handleWorkspaceList(_args: WorkspaceListArgs): void {
  console.log('Listing workspaces... (stub)');
}

export function handleWorkspaceSelect(_args: WorkspaceSelectArgs): void {
  console.log('Selecting workspace... (stub)');
}

export function handleWorkspaceCurrent(): void {
  console.log('Current workspace: (stub -- reads from ~/.portarium/context.json)');
}
