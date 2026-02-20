/**
 * CLI approve command stubs.
 *
 * Subcommands: list, decide
 */

export interface ApproveListArgs {
  baseUrl: string;
  token: string;
  workspaceId: string;
  pending?: boolean;
}

export interface ApproveDecideArgs {
  baseUrl: string;
  token: string;
  workspaceId: string;
  approvalId: string;
  decision: string;
  reason?: string;
}

export function handleApproveList(_args: ApproveListArgs): void {
  console.log('Listing approvals... (stub)');
}

export function handleApproveDecide(_args: ApproveDecideArgs): void {
  console.log('Deciding approval... (stub)');
}
