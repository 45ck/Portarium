import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCredentialGrantRequest, CredentialGrantV1 } from '@portarium/cockpit-types';
import { fetchJson } from '@/lib/fetch-json';

type CredentialGrantListResponse = Readonly<{
  items: CredentialGrantV1[];
}>;

async function fetchCredentialGrants(wsId: string): Promise<CredentialGrantListResponse> {
  return fetchJson(
    `/v1/workspaces/${encodeURIComponent(wsId)}/credential-grants`,
    undefined,
    'Failed to fetch credential grants',
  );
}

async function postCredentialGrant(
  wsId: string,
  body: CreateCredentialGrantRequest,
): Promise<CredentialGrantV1> {
  return fetchJson(
    `/v1/workspaces/${encodeURIComponent(wsId)}/credential-grants`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    'Failed to grant credential',
  );
}

async function postRevokeCredentialGrant(
  wsId: string,
  credentialGrantId: string,
): Promise<CredentialGrantV1> {
  return fetchJson(
    `/v1/workspaces/${encodeURIComponent(wsId)}/credential-grants/${encodeURIComponent(credentialGrantId)}/revoke`,
    { method: 'POST' },
    'Failed to revoke credential grant',
  );
}

export function useCredentialGrants(wsId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['credential-grants', wsId],
    queryFn: () => fetchCredentialGrants(wsId),
    enabled: Boolean(wsId) && (options.enabled ?? true),
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
