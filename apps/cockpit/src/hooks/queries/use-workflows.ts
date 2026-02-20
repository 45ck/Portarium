import { useQuery } from '@tanstack/react-query';
import type { WorkflowDetail, WorkflowSummary } from '@portarium/cockpit-types';

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
