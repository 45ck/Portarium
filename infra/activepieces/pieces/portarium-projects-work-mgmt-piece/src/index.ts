export type PortariumOperationMapping = Readonly<{
  operation: string;
  flowSlug: string;
  displayName: string;
  requiresApproval: boolean;
}>;

export const PORTARIUM_PROJECTS_WORK_MGMT_MAPPINGS: readonly PortariumOperationMapping[] = [
  {
    operation: 'project:create',
    flowSlug: 'projects-work-mgmt-create-project',
    displayName: 'Create project',
    requiresApproval: false,
  },
  {
    operation: 'task:create',
    flowSlug: 'projects-work-mgmt-create-task',
    displayName: 'Create task',
    requiresApproval: false,
  },
  {
    operation: 'task:update',
    flowSlug: 'projects-work-mgmt-update-task',
    displayName: 'Update task',
    requiresApproval: false,
  },
];

export type CorrelationHeaders = Readonly<{
  tenantId: string;
  correlationId: string;
  runId?: string;
}>;

export function buildCorrelationHeaders(input: CorrelationHeaders): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {
    tenantId: requireNonEmpty(input.tenantId, 'tenantId'),
    correlationId: requireNonEmpty(input.correlationId, 'correlationId'),
  };
  if (input.runId !== undefined) {
    headers.runId = requireNonEmpty(input.runId, 'runId');
  }
  return headers;
}

function requireNonEmpty(value: string, fieldName: string): string {
  if (value.trim() === '') {
    throw new Error(`${fieldName} must be non-empty.`);
  }
  return value;
}
