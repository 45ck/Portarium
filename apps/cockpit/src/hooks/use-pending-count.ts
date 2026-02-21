import { useApprovals } from '@/hooks/queries/use-approvals';

export function usePendingCount(wsId: string): number {
  const { data } = useApprovals(wsId);
  return (data?.items ?? []).filter((a) => a.status === 'Pending').length;
}
