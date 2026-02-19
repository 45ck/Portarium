import type { AdapterRegistrationV1 } from '../../domain/adapters/index.js';
import type { PortFamily, RunId, WorkflowId } from '../../domain/primitives/index.js';
import type { RunV1 } from '../../domain/runs/index.js';
import type { WorkflowV1 } from '../../domain/workflows/index.js';
import type { WorkspaceV1 } from '../../domain/workspaces/index.js';

export type AggregateInvariantConflict = Readonly<{
  kind: 'Conflict';
  message: string;
}>;

export function ensureWorkspaceNameIsUnique(
  existingWorkspace: WorkspaceV1 | null,
  candidateWorkspace: WorkspaceV1,
): AggregateInvariantConflict | null {
  if (!existingWorkspace) return null;
  if (existingWorkspace.workspaceId === candidateWorkspace.workspaceId) return null;
  return {
    kind: 'Conflict',
    message: `Workspace name '${candidateWorkspace.name}' is already in use.`,
  };
}

export function ensureRunIdIsUnique(
  existingRun: RunV1 | null,
  runId: RunId,
): AggregateInvariantConflict | null {
  if (!existingRun) return null;
  return {
    kind: 'Conflict',
    message: `Run ${runId} already exists.`,
  };
}

export function ensureSingleActiveWorkflowVersion(params: {
  workflowName: string;
  selectedWorkflowId: WorkflowId;
  workflowVersions: readonly WorkflowV1[];
}): AggregateInvariantConflict | null {
  const { workflowName, selectedWorkflowId, workflowVersions } = params;
  if (workflowVersions.length === 0) {
    return {
      kind: 'Conflict',
      message: `Workflow '${workflowName}' has no registered versions.`,
    };
  }

  const active = workflowVersions.filter((workflow) => workflow.active);
  if (active.length === 0) {
    return {
      kind: 'Conflict',
      message: `Workflow '${workflowName}' has no active version.`,
    };
  }
  if (active.length > 1) {
    const activeIds = active.map((workflow) => workflow.workflowId).join(', ');
    return {
      kind: 'Conflict',
      message: `Workflow '${workflowName}' has multiple active versions: ${activeIds}.`,
    };
  }

  const activeWorkflow = active[0]!;
  const highestVersion = Math.max(...workflowVersions.map((workflow) => workflow.version));
  if (activeWorkflow.version !== highestVersion) {
    return {
      kind: 'Conflict',
      message: `Workflow '${workflowName}' active version ${activeWorkflow.version} is not the latest version ${highestVersion}.`,
    };
  }

  if (activeWorkflow.workflowId !== selectedWorkflowId) {
    return {
      kind: 'Conflict',
      message: `Workflow '${workflowName}' is not currently active for id ${selectedWorkflowId}.`,
    };
  }

  return null;
}

export function ensureSingleActiveAdapterPerPort(params: {
  portFamilies: readonly PortFamily[];
  adapterRegistrations: readonly AdapterRegistrationV1[];
}): AggregateInvariantConflict | null {
  const { portFamilies, adapterRegistrations } = params;
  const uniqueFamilies = [...new Set(portFamilies)];
  for (const family of uniqueFamilies) {
    const active = adapterRegistrations.filter(
      (registration) => registration.portFamily === family && registration.enabled,
    );
    if (active.length === 0) {
      return {
        kind: 'Conflict',
        message: `Port family ${family} has no active adapter registration.`,
      };
    }
    if (active.length > 1) {
      const activeIds = active.map((registration) => registration.adapterId).join(', ');
      return {
        kind: 'Conflict',
        message: `Port family ${family} has multiple active adapters: ${activeIds}.`,
      };
    }
  }
  return null;
}
