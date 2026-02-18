export type StartRunActivityInput = Readonly<{
  runId: string;
  tenantId: string;
  workflowId: string;
  initiatedByUserId: string;
  correlationId: string;
  executionTier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
}>;

export async function startRunActivity(_input: StartRunActivityInput): Promise<void> {
  // Placeholder activity: real implementation will persist state/evidence.
  // Non-deterministic I/O belongs here, not in the workflow function.
  void _input;
}

export type CompleteRunActivityInput = Readonly<{
  runId: string;
  tenantId: string;
  workflowId: string;
  correlationId: string;
}>;

export async function completeRunActivity(_input: CompleteRunActivityInput): Promise<void> {
  // Placeholder activity: real implementation will execute actions and persist outcomes.
  void _input;
}
