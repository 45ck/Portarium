import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserSummary, UserRole, UserStatus } from '@/types/users';
import { fetchJson } from '@/lib/fetch-json';

type WorkspaceUserRole = 'admin' | 'operator' | 'approver' | 'auditor';

type WorkspaceUser = Readonly<{
  userId: string;
  workspaceId: string;
  email: string;
  displayName?: string;
  roles: WorkspaceUserRole[];
  active: boolean;
  createdAtIso: string;
}>;

type UserRecord = WorkspaceUser | UserSummary;

const ROLE_TO_API: Record<UserRole, WorkspaceUserRole> = {
  Admin: 'admin',
  Operator: 'operator',
  Approver: 'approver',
  Auditor: 'auditor',
};

const ROLE_FROM_API: Record<WorkspaceUserRole, UserRole> = {
  admin: 'Admin',
  operator: 'Operator',
  approver: 'Approver',
  auditor: 'Auditor',
};

function toUserSummary(user: UserRecord): UserSummary {
  if ('role' in user && 'status' in user && 'lastActiveIso' in user) return user;
  const role = user.roles[0] ?? 'auditor';
  return {
    userId: user.userId,
    name: user.displayName ?? user.email.split('@')[0] ?? user.email,
    email: user.email,
    role: ROLE_FROM_API[role],
    status: user.active ? 'active' : 'suspended',
    lastActiveIso: user.createdAtIso,
  };
}

async function fetchUsers(wsId: string): Promise<{ items: UserSummary[] }> {
  const body = await fetchJson<{ items: UserRecord[] }>(
    `/v1/workspaces/${encodeURIComponent(wsId)}/users`,
    undefined,
    'Failed to fetch users',
  );
  return { ...body, items: body.items.map(toUserSummary) };
}

async function inviteUser(
  wsId: string,
  body: { email: string; role: string },
): Promise<UserSummary> {
  const role = ROLE_TO_API[body.role as UserRole] ?? 'auditor';
  const user = await fetchJson<UserRecord>(
    `/v1/workspaces/${encodeURIComponent(wsId)}/users`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email, roles: [role], active: true }),
    },
    'Failed to invite user',
  );
  return toUserSummary(user);
}

async function patchUser(
  wsId: string,
  userId: string,
  body: Partial<Pick<UserSummary, 'role' | 'status'>>,
): Promise<UserSummary> {
  const patch = {
    ...(body.role ? { roles: [ROLE_TO_API[body.role]] } : {}),
    ...(body.status ? { active: body.status === 'active' } : {}),
  };
  const user = await fetchJson<UserRecord>(
    `/v1/workspaces/${encodeURIComponent(wsId)}/users/${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
    'Failed to update user',
  );
  return toUserSummary(user);
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
