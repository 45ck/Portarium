export type StartRunActivityInput = Readonly<{
  runId: string;
  tenantId: string;
  workflowId: string;
  initiatedByUserId: string;
  correlationId: string;
  executionTier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
}>;

export function startRunActivity(input: StartRunActivityInput): Promise<void> {
  // Placeholder activity: real implementation will persist state/evidence.
  // Non-deterministic I/O belongs here, not in the workflow function.
  void input;
  return Promise.resolve();
}

export type CompleteRunActivityInput = Readonly<{
  runId: string;
  tenantId: string;
  workflowId: string;
  correlationId: string;
}>;

export function completeRunActivity(input: CompleteRunActivityInput): Promise<void> {
  // Placeholder activity: real implementation will execute actions and persist outcomes.
  void input;
  return Promise.resolve();
}
