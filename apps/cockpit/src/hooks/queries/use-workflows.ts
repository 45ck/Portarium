import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  UpdateWorkflowRequest,
  WorkflowDetail,
  WorkflowSummary,
} from '@portarium/cockpit-types';

async function fetchWorkflows(wsId: string): Promise<{ items: WorkflowSummary[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/workflows`);
  if (!res.ok) throw new Error('Failed to fetch workflows');
  return res.json();
}

async function fetchWorkflow(wsId: string, workflowId: string): Promise<WorkflowDetail> {
  const res = await fetch(`/v1/workspaces/${wsId}/workflows/${workflowId}`);
  if (!res.ok) throw new Error('Workflow not found');
  return res.json();
}

async function patchWorkflow(
  wsId: string,
  workflowId: string,
  body: UpdateWorkflowRequest,
): Promise<WorkflowDetail> {
  const res = await fetch(`/v1/workspaces/${wsId}/workflows/${workflowId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to update workflow');
  return res.json();
}

export function useWorkflows(wsId: string) {
  return useQuery({
    queryKey: ['workflows', wsId],
    queryFn: () => fetchWorkflows(wsId),
    enabled: Boolean(wsId),
  });
}

export function useWorkflow(wsId: string, workflowId: string) {
  return useQuery({
    queryKey: ['workflows', wsId, workflowId],
    queryFn: () => fetchWorkflow(wsId, workflowId),
    enabled: Boolean(wsId) && Boolean(workflowId),
  });
}

export function useUpdateWorkflow(wsId: string, workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateWorkflowRequest) => patchWorkflow(wsId, workflowId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows', wsId] });
      qc.invalidateQueries({ queryKey: ['workflows', wsId, workflowId] });
    },
  });
}
