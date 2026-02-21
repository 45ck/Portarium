import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  UpdateWorkflowRequest,
  WorkflowDetail,
  WorkflowSummary,
} from '@portarium/cockpit-types';
import { controlPlaneClient } from '@/lib/control-plane-client';

async function fetchWorkflows(wsId: string): Promise<{ items: WorkflowSummary[] }> {
  return controlPlaneClient.listWorkflows(wsId);
}

async function fetchWorkflow(wsId: string, workflowId: string): Promise<WorkflowDetail> {
  return controlPlaneClient.getWorkflow(wsId, workflowId);
}

async function patchWorkflow(
  wsId: string,
  workflowId: string,
  body: UpdateWorkflowRequest,
): Promise<WorkflowDetail> {
  return controlPlaneClient.updateWorkflow(wsId, workflowId, body);
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
