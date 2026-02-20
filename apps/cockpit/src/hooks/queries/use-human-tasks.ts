import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  HumanTaskSummary,
  AssignHumanTaskRequest,
  CompleteHumanTaskRequest,
  EscalateHumanTaskRequest,
} from '@portarium/cockpit-types';

async function fetchHumanTasks(wsId: string): Promise<{ items: HumanTaskSummary[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/human-tasks`);
  if (!res.ok) throw new Error('Failed to fetch human tasks');
  return res.json();
}

async function postAssignHumanTask(
  wsId: string,
  taskId: string,
  body: AssignHumanTaskRequest,
): Promise<HumanTaskSummary> {
  const res = await fetch(`/v1/workspaces/${wsId}/human-tasks/${taskId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to assign human task');
  return res.json();
}

async function postCompleteHumanTask(
  wsId: string,
  taskId: string,
  body: CompleteHumanTaskRequest,
): Promise<HumanTaskSummary> {
  const res = await fetch(`/v1/workspaces/${wsId}/human-tasks/${taskId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to complete human task');
  return res.json();
}

async function postEscalateHumanTask(
  wsId: string,
  taskId: string,
  body: EscalateHumanTaskRequest,
): Promise<HumanTaskSummary> {
  const res = await fetch(`/v1/workspaces/${wsId}/human-tasks/${taskId}/escalate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to escalate human task');
  return res.json();
}

export function useHumanTasks(wsId: string) {
  return useQuery({
    queryKey: ['human-tasks', wsId],
    queryFn: () => fetchHumanTasks(wsId),
    enabled: Boolean(wsId),
  });
}

export function useAssignHumanTask(wsId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AssignHumanTaskRequest) => postAssignHumanTask(wsId, taskId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['human-tasks', wsId] });
    },
  });
}

export function useCompleteHumanTask(wsId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CompleteHumanTaskRequest) => postCompleteHumanTask(wsId, taskId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['human-tasks', wsId] });
    },
  });
}

export function useEscalateHumanTask(wsId: string, taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EscalateHumanTaskRequest) => postEscalateHumanTask(wsId, taskId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['human-tasks', wsId] });
    },
  });
}
