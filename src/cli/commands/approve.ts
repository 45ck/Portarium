/**
 * CLI approve command stubs.
 *
 * Subcommands: list, decide
 */

export async function handleApproveList(
  _baseUrl: string,
  _token: string,
  _workspaceId: string,
  _pending?: boolean,
): Promise<void> {
  console.log('Listing approvals... (stub)');
}

export async function handleApproveDecide(
  _baseUrl: string,
  _token: string,
  _workspaceId: string,
  _approvalId: string,
  _decision: string,
  _reason?: string,
): Promise<void> {
  console.log('Deciding approval... (stub)');
}
