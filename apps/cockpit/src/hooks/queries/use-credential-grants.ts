import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCredentialGrantRequest, CredentialGrantV1 } from '@portarium/cockpit-types';

type CredentialGrantListResponse = Readonly<{
  items: CredentialGrantV1[];
}>;

async function fetchCredentialGrants(wsId: string): Promise<CredentialGrantListResponse> {
  const res = await fetch(`/v1/workspaces/${wsId}/credential-grants`);
  if (!res.ok) throw new Error('Failed to fetch credential grants');
  return res.json();
}

async function postCredentialGrant(
  wsId: string,
  body: CreateCredentialGrantRequest,
): Promise<CredentialGrantV1> {
  const res = await fetch(`/v1/workspaces/${wsId}/credential-grants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to grant credential');
  return res.json();
}

async function postRevokeCredentialGrant(
  wsId: string,
  credentialGrantId: string,
): Promise<CredentialGrantV1> {
  const res = await fetch(`/v1/workspaces/${wsId}/credential-grants/${credentialGrantId}/revoke`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to revoke credential grant');
  return res.json();
}

export function useCredentialGrants(wsId: string) {
  return useQuery({
    queryKey: ['credential-grants', wsId],
    queryFn: () => fetchCredentialGrants(wsId),
    enabled: Boolean(wsId),
  });
}

export function useGrantCredential(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCredentialGrantRequest) => postCredentialGrant(wsId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credential-grants', wsId] });
    },
  });
}

export function useRevokeCredentialGrant(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (credentialGrantId: string) => postRevokeCredentialGrant(wsId, credentialGrantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credential-grants', wsId] });
    },
  });
}
