import { useMemo, useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import {
  useCredentialGrants,
  useGrantCredential,
  useRevokeCredentialGrant,
} from '@/hooks/queries/use-credential-grants';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { DataTable } from '@/components/cockpit/data-table';
import { EmptyState } from '@/components/cockpit/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { CredentialGrantV1 } from '@portarium/cockpit-types';

interface AdapterRecord {
  adapterId: string;
  name: string;
}

type AdaptersResponse = AdapterRecord[] | { items: AdapterRecord[] };
type GrantStatus = 'active' | 'revoked' | 'expired';

type CredentialGrantRow = CredentialGrantV1 & Readonly<{
  adapterName: string;
  credentialType: string;
  credentialName: string;
  status: GrantStatus;
  grantedBy: string;
}>;

const statusClassName: Record<GrantStatus, string> = {
  active: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  revoked: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950',
  expired: 'text-yellow-700 bg-yellow-50 dark:text-yellow-300 dark:bg-yellow-950',
};

function deriveGrantStatus(grant: CredentialGrantV1, nowMs: number): GrantStatus {
  if (grant.revokedAtIso) {
    return 'revoked';
  }
  if (grant.expiresAtIso) {
    const expiresAtMs = new Date(grant.expiresAtIso).getTime();
    if (!Number.isNaN(expiresAtMs) && expiresAtMs <= nowMs) {
      return 'expired';
    }
  }
  return 'active';
}

function parseCredentialRef(credentialsRef: string): Readonly<{
  credentialType: string;
  credentialName: string;
}> {
  const normalized = credentialsRef.replace(/^[a-z]+:\/\//i, '');
  const parts = normalized.split('/').filter(Boolean);
  const credentialName = parts.at(-1) ?? credentialsRef;
  const credentialType = parts.length > 1 ? (parts.at(-2) ?? 'secret') : 'secret';
  return { credentialType, credentialName };
}

function CredentialsPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const [pendingRevoke, setPendingRevoke] = useState<CredentialGrantRow | null>(null);

  const { data: grantsData, isLoading: grantsLoading } = useCredentialGrants(wsId);
  const { data: adaptersData } = useQuery({
    queryKey: ['adapters', wsId],
    queryFn: async () => {
      const res = await fetch(`/v1/workspaces/${wsId}/adapters`);
      if (!res.ok) throw new Error('Failed to fetch adapters');
      const payload = (await res.json()) as AdaptersResponse;
      return Array.isArray(payload) ? payload : payload.items;
    },
  });
  const grantMutation = useGrantCredential(wsId);
  const revokeMutation = useRevokeCredentialGrant(wsId);

  const adapterNameById = useMemo(() => {
    return new Map((adaptersData ?? []).map((adapter) => [adapter.adapterId, adapter.name]));
  }, [adaptersData]);

  const rows = useMemo((): CredentialGrantRow[] => {
    const nowMs = Date.now();
    return (grantsData?.items ?? []).map((grant) => {
      const parsedRef = parseCredentialRef(grant.credentialsRef);
      return {
        ...grant,
        adapterName: adapterNameById.get(grant.adapterId) ?? grant.adapterId,
        credentialType: parsedRef.credentialType,
        credentialName: parsedRef.credentialName,
        status: deriveGrantStatus(grant, nowMs),
        grantedBy: grant.credentialGrantId.startsWith('cg-auto-')
          ? 'system'
          : grant.credentialsRef.startsWith('vault://')
            ? 'vault'
            : 'provisioned',
      };
    });
  }, [adapterNameById, grantsData?.items]);

  const columns = [
    {
      key: 'credentialGrantId',
      header: 'Grant ID',
      render: (row: CredentialGrantRow) => (
        <span className="font-mono text-[11px]">{row.credentialGrantId}</span>
      ),
    },
    {
      key: 'adapterName',
      header: 'Adapter',
      render: (row: CredentialGrantRow) => <span className="font-medium">{row.adapterName}</span>,
    },
    {
      key: 'credential',
      header: 'Credential',
      render: (row: CredentialGrantRow) => (
        <div className="space-y-0.5">
          <div className="font-medium">{row.credentialName}</div>
          <div className="text-muted-foreground text-[11px]">{row.credentialType}</div>
        </div>
      ),
    },
    {
      key: 'issuedAtIso',
      header: 'Granted At',
      width: '160px',
      render: (row: CredentialGrantRow) => format(new Date(row.issuedAtIso), 'MMM d, yyyy HH:mm'),
    },
    {
      key: 'grantedBy',
      header: 'Granted By',
      width: '120px',
      render: (row: CredentialGrantRow) => row.grantedBy,
    },
    {
      key: 'expiresAtIso',
      header: 'Expires',
      width: '160px',
      render: (row: CredentialGrantRow) =>
        row.expiresAtIso ? format(new Date(row.expiresAtIso), 'MMM d, yyyy HH:mm') : '\u2014',
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (row: CredentialGrantRow) => (
        <Badge variant="secondary" className={statusClassName[row.status]}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '120px',
      render: (row: CredentialGrantRow) => (
        <Button
          size="sm"
          variant="destructive"
          disabled={row.status !== 'active' || revokeMutation.isPending}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setPendingRevoke(row);
          }}
        >
          Revoke
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Credentials"
        description="Credential grants by adapter in this workspace"
        icon={<EntityIcon entityType="credential" size="md" decorative />}
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={grantMutation.isPending}
            onClick={() => {
              const preferredAdapterId = adaptersData?.[0]?.adapterId ?? 'adapter-odoo-001';
              grantMutation.mutate({
                adapterId: preferredAdapterId,
                credentialsRef: `vault://${wsId}/adapters/${preferredAdapterId}`,
                scope: 'read:external write:external',
                expiresAtIso: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
              });
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Grant Credential
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={rows}
        loading={grantsLoading}
        empty={
          <EmptyState
            title="No credential grants"
            description="Grant a credential to allow adapter authentication."
            icon={<EntityIcon entityType="credential" size="xl" decorative />}
          />
        }
        getRowKey={(row) => row.credentialGrantId}
        pagination={{ pageSize: 20 }}
      />

      <AlertDialog open={pendingRevoke !== null} onOpenChange={(open) => !open && setPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke credential grant?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRevoke
                ? `This will revoke grant ${pendingRevoke.credentialGrantId} for ${pendingRevoke.adapterName}.`
                : 'This will revoke the selected credential grant.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revokeMutation.isPending || pendingRevoke === null}
              onClick={(event) => {
                event.preventDefault();
                if (!pendingRevoke) return;
                revokeMutation.mutate(pendingRevoke.credentialGrantId, {
                  onSuccess: () => setPendingRevoke(null),
                });
              }}
            >
              Confirm Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/credentials',
  component: CredentialsPage,
});
