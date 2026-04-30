import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  HumanTaskSummary,
  AssignHumanTaskRequest,
  CompleteHumanTaskRequest,
  EscalateHumanTaskRequest,
} from '@portarium/cockpit-types';
import { fetchJson } from '@/lib/fetch-json';
import { useOfflineQuery } from '@/hooks/queries/use-offline-query';

async function fetchHumanTasks(wsId: string): Promise<{ items: HumanTaskSummary[] }> {
  return fetchJson(
    `/v1/workspaces/${encodeURIComponent(wsId)}/human-tasks`,
    undefined,
    'Failed to fetch human tasks',
  );
}

async function postAssignHumanTask(
  wsId: string,
  taskId: string,
  body: AssignHumanTaskRequest,
): Promise<HumanTaskSummary> {
  return fetchJson<HumanTaskSummary>(
    `/v1/workspaces/${encodeURIComponent(wsId)}/human-tasks/${encodeURIComponent(taskId)}/assign`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    'Failed to assign human task',
  );
}

async function postCompleteHumanTask(
  wsId: string,
  taskId: string,
  body: CompleteHumanTaskRequest,
): Promise<HumanTaskSummary> {
  return fetchJson<HumanTaskSummary>(
    `/v1/workspaces/${encodeURIComponent(wsId)}/human-tasks/${encodeURIComponent(taskId)}/complete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    'Failed to complete human task',
  );
}

async function postEscalateHumanTask(
  wsId: string,
  taskId: string,
  body: EscalateHumanTaskRequest,
): Promise<HumanTaskSummary> {
  return fetchJson<HumanTaskSummary>(
    `/v1/workspaces/${encodeURIComponent(wsId)}/human-tasks/${encodeURIComponent(taskId)}/escalate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    'Failed to escalate human task',
  );
}

export function useHumanTasks(wsId: string) {
  return useOfflineQuery({
    queryKey: ['human-tasks', wsId],
    cacheKey: `human-tasks:${wsId}`,
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
