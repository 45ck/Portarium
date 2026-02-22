import { useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { format } from 'date-fns';
import { Plus, AlertCircle, RotateCcw } from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useUsers, useInviteUser, usePatchUser } from '@/hooks/queries/use-users';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { DataTable } from '@/components/cockpit/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { UserSummary, UserRole } from '@/mocks/fixtures/users';

const ROLES: UserRole[] = ['Operator', 'Approver', 'Auditor', 'Admin'];

const statusClassName: Record<string, string> = {
  active: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  suspended: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950',
};

function UsersPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data, isLoading, isError, refetch } = useUsers(wsId);
  const inviteMutation = useInviteUser(wsId);
  const patchMutation = usePatchUser(wsId);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('Operator');

  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [sheetRole, setSheetRole] = useState<UserRole>('Operator');

  const users = data?.items ?? [];

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row: UserSummary) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (row: UserSummary) => (
        <span className="text-muted-foreground text-xs">{row.email}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      width: '110px',
      render: (row: UserSummary) => <Badge variant="secondary">{row.role}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      render: (row: UserSummary) => (
        <Badge variant="secondary" className={statusClassName[row.status]}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'lastActiveIso',
      header: 'Last Active',
      width: '160px',
      render: (row: UserSummary) => format(new Date(row.lastActiveIso), 'MMM d, yyyy HH:mm'),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '140px',
      render: (row: UserSummary) => (
        <Button
          size="sm"
          variant={row.status === 'active' ? 'destructive' : 'outline'}
          disabled={patchMutation.isPending}
          onClick={(e) => {
            e.stopPropagation();
            patchMutation.mutate({
              userId: row.userId,
              status: row.status === 'active' ? 'suspended' : 'active',
            });
          }}
        >
          {row.status === 'active' ? 'Suspend' : 'Reactivate'}
        </Button>
      ),
    },
  ];

  function handleInvite() {
    if (!inviteEmail) return;
    inviteMutation.mutate(
      { email: inviteEmail, role: inviteRole },
      {
        onSuccess: () => {
          setInviteOpen(false);
          setInviteEmail('');
          setInviteRole('Operator');
        },
      },
    );
  }

  function handleRowClick(row: UserSummary) {
    setSelectedUser(row);
    setSheetRole(row.role);
  }

  function handleRoleChange() {
    if (!selectedUser) return;
    patchMutation.mutate(
      { userId: selectedUser.userId, role: sheetRole },
      { onSuccess: () => setSelectedUser(null) },
    );
  }

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Users"
        description="Workspace users and role assignments"
        icon={<EntityIcon entityType="user" size="md" decorative />}
        action={
          <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Invite User
          </Button>
        }
      />

      {isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load users</p>
            <p className="text-xs text-muted-foreground">An error occurred while fetching data.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={users}
        loading={isLoading}
        getRowKey={(row) => row.userId}
        onRowClick={handleRowClick}
        pagination={{ pageSize: 20 }}
      />

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>Send an invitation to join this workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || inviteMutation.isPending}>
              {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Assignment Sheet */}
      <Sheet open={selectedUser !== null} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedUser?.name}</SheetTitle>
            <SheetDescription>{selectedUser?.email}</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={sheetRole} onValueChange={(v) => setSheetRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleRoleChange}
              disabled={sheetRole === selectedUser?.role || patchMutation.isPending}
            >
              {patchMutation.isPending ? 'Updating...' : 'Update Role'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/users',
  component: UsersPage,
});
