/**
 * CLI run command stubs.
 *
 * Subcommands: start, status, cancel, list
 */

export interface RunStartArgs {
  baseUrl: string;
  token: string;
  workspaceId: string;
  workflowId: string;
  input?: Record<string, unknown>;
}

export interface RunStatusArgs {
  baseUrl: string;
  token: string;
  workspaceId: string;
  runId: string;
}

export interface RunListArgs {
  baseUrl: string;
  token: string;
  workspaceId: string;
  status?: string;
}

export function handleRunStart(_args: RunStartArgs): void {
  console.log('Starting run... (stub)');
}

export function handleRunStatus(_args: RunStatusArgs): void {
  console.log('Getting run status... (stub)');
}

export function handleRunCancel(_args: RunStatusArgs): void {
  console.log('Cancelling run... (stub)');
}

export function handleRunList(_args: RunListArgs): void {
  console.log('Listing runs... (stub)');
}
