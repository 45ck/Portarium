import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserSummary, UserRole, UserStatus } from '@/mocks/fixtures/users';

async function fetchUsers(wsId: string): Promise<{ items: UserSummary[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/users`);
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

async function inviteUser(
  wsId: string,
  body: { email: string; role: string },
): Promise<UserSummary> {
  const res = await fetch(`/v1/workspaces/${wsId}/users/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to invite user');
  return res.json();
}

async function patchUser(
  wsId: string,
  userId: string,
  body: Partial<Pick<UserSummary, 'role' | 'status'>>,
): Promise<UserSummary> {
  const res = await fetch(`/v1/workspaces/${wsId}/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to update user');
  return res.json();
}

export function useUsers(wsId: string) {
  return useQuery({ queryKey: ['users', wsId], queryFn: () => fetchUsers(wsId) });
}

export function useInviteUser(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: string }) => inviteUser(wsId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', wsId] });
    },
  });
}

export function usePatchUser(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...body }: { userId: string; role?: UserRole; status?: UserStatus }) => {
      const patch: Partial<Pick<UserSummary, 'role' | 'status'>> = body;
      return patchUser(wsId, userId, patch);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', wsId] });
    },
  });
}
