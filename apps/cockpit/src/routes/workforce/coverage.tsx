import { useMemo, useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import {
  CalendarClock,
  ClipboardList,
  GitFork,
  History,
  RefreshCcw,
  Route as RouteIcon,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { PageHeader } from '@/components/cockpit/page-header';
import { FreshnessBadge } from '@/components/cockpit/freshness-badge';
import { KpiRow } from '@/components/cockpit/kpi-row';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useApprovalCoverageMutations,
  useApprovalCoverageRoster,
  useWorkforceMembers,
  useWorkforceQueues,
} from '@/hooks/queries/use-workforce';
import { resolveCockpitRuntime } from '@/lib/cockpit-runtime';
import { canAccess } from '@/lib/role-gate';
import { useUIStore } from '@/stores/ui-store';
import type {
  ApprovalCoverageState,
  ApprovalRoutingState,
  WorkforceMemberSummary,
  WorkforceQueueSummary,
} from '@portarium/cockpit-types';

const APPROVAL_CLASSES = [
  'FinanceAccounting.high-risk',
  'IamDirectory.access-change',
  'RoboticsActuation.safety',
] as const;

const coverageStateClasses: Record<ApprovalCoverageState, string> = {
  active: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  scheduled: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  lapsed: 'bg-muted text-muted-foreground',
  disabled: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

const routingStateClasses: Record<ApprovalRoutingState, string> = {
  assigned: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  delegated: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'waiting-for-coverage': 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  escalated: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

function memberName(members: readonly WorkforceMemberSummary[], memberId: string): string {
  return members.find((member) => member.workforceMemberId === memberId)?.displayName ?? memberId;
}

function userName(members: readonly WorkforceMemberSummary[], userId: string): string {
  return members.find((member) => member.linkedUserId === userId)?.displayName ?? userId;
}

function queueName(queues: readonly WorkforceQueueSummary[], queueId: string): string {
  return queues.find((queue) => queue.workforceQueueId === queueId)?.name ?? queueId;
}

function isoLocalInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

function displayWhen(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function WorkforceCoveragePage() {
  const runtime = resolveCockpitRuntime();

  if (!runtime.allowDemoControls) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Coverage"
          description="Demo approval coverage fixtures are disabled while Cockpit is connected to live tenant data."
          icon={<CalendarClock className="h-5 w-5" />}
          breadcrumb={[{ label: 'Workforce', to: '/workforce' }, { label: 'Coverage' }]}
        />
        <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          Live approval coverage must come from the workforce coverage API. This fixture-backed
          roster is available only in explicit demo mode.
        </div>
      </div>
    );
  }

  return <DemoWorkforceCoveragePage />;
}

function DemoWorkforceCoveragePage() {
  const { activeWorkspaceId: wsId, activePersona } = useUIStore();
  const canManage = canAccess(activePersona, 'approval-coverage:manage');
  const rosterQuery = useApprovalCoverageRoster(wsId);
  const { data: membersData } = useWorkforceMembers(wsId);
  const { data: queuesData } = useWorkforceQueues(wsId);
  const { createWindow, createDelegation, upsertSpecialistRoute } =
    useApprovalCoverageMutations(wsId);

  const members = membersData?.items ?? [];
  const queues = queuesData?.items ?? [];
  const roster = rosterQuery.data;
  const approvalQueueIds = useMemo(
    () =>
      queues
        .filter((queue) => queue.requiredCapabilities.includes('operations.approval'))
        .map((queue) => queue.workforceQueueId),
    [queues],
  );
  const approvalMembers = useMemo(
    () => members.filter((member) => member.capabilities.includes('operations.approval')),
    [members],
  );
  const escalationMembers = useMemo(
    () => members.filter((member) => member.capabilities.includes('operations.escalation')),
    [members],
  );

  const [coverageMode, setCoverageMode] = useState<'operator-team' | 'after-hours'>(
    'operator-team',
  );
  const [approvalClass, setApprovalClass] = useState<string>(APPROVAL_CLASSES[0]);
  const [startsAt, setStartsAt] = useState(() => isoLocalInputValue(new Date()));
  const [endsAt, setEndsAt] = useState(() =>
    isoLocalInputValue(new Date(Date.now() + 8 * 60 * 60 * 1000)),
  );
  const [primaryMemberId, setPrimaryMemberId] = useState('');
  const [queueId, setQueueId] = useState('');
  const [fallbackQueueId, setFallbackQueueId] = useState('');
  const [delegateUserId, setDelegateUserId] = useState('');
  const [specialistMemberId, setSpecialistMemberId] = useState('');
  const [rationale, setRationale] = useState('Operator coverage update for governed work.');

  const selectedQueueId = queueId || approvalQueueIds[0] || queues[0]?.workforceQueueId || '';
  const selectedFallbackQueueId = fallbackQueueId || approvalQueueIds[1] || selectedQueueId;
  const selectedPrimaryMemberId =
    primaryMemberId || approvalMembers[0]?.workforceMemberId || members[0]?.workforceMemberId || '';
  const selectedDelegateUserId =
    delegateUserId ||
    escalationMembers[0]?.linkedUserId ||
    approvalMembers[1]?.linkedUserId ||
    members[0]?.linkedUserId ||
    '';
  const selectedSpecialistMemberId =
    specialistMemberId ||
    approvalMembers[1]?.workforceMemberId ||
    approvalMembers[0]?.workforceMemberId ||
    members[0]?.workforceMemberId ||
    '';
  const mutationPending =
    createWindow.isPending || createDelegation.isPending || upsertSpecialistRoute.isPending;

  const activeWindows =
    roster?.coverageWindows.filter((window) => window.state === 'active').length ?? 0;
  const waitingPreviews =
    roster?.routingPreviews.filter((preview) => preview.state === 'waiting-for-coverage').length ??
    0;
  const escalatedPreviews =
    roster?.routingPreviews.filter((preview) => preview.state === 'escalated').length ?? 0;

  function saveCoverageWindow() {
    if (!canManage || !selectedQueueId || !selectedPrimaryMemberId) return;
    createWindow.mutate({
      name:
        coverageMode === 'after-hours'
          ? 'After-hours approval coverage'
          : 'Operator-team approval coverage',
      approvalClass,
      startsAtIso: fromLocalInput(startsAt),
      endsAtIso: fromLocalInput(endsAt),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      queueId: selectedQueueId,
      primaryMemberIds: [selectedPrimaryMemberId],
      fallbackQueueId: selectedFallbackQueueId,
      rationale,
    });
  }

  function saveDelegation() {
    if (!canManage || !selectedDelegateUserId || !approvalMembers[0]?.linkedUserId) return;
    createDelegation.mutate({
      delegatorUserId: approvalMembers[0].linkedUserId,
      delegateUserId: selectedDelegateUserId,
      approvalClass,
      startsAtIso: fromLocalInput(startsAt),
      expiresAtIso: fromLocalInput(endsAt),
      reason: rationale,
    });
  }

  function saveSpecialistRoute() {
    if (!canManage || !selectedQueueId || !selectedSpecialistMemberId || !selectedFallbackQueueId) {
      return;
    }
    upsertSpecialistRoute.mutate({
      approvalClass,
      matchLabel:
        coverageMode === 'after-hours'
          ? 'after-hours high risk approvals'
          : 'operator-team specialist approvals',
      queueId: selectedQueueId,
      specialistMemberIds: [selectedSpecialistMemberId],
      fallbackQueueId: selectedFallbackQueueId,
      priority: coverageMode === 'after-hours' ? 5 : 10,
      active: true,
      rationale,
    });
  }

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Coverage"
        description="Approval coverage, delegation, and specialist routing roster"
        icon={<CalendarClock className="h-5 w-5" />}
        breadcrumb={[{ label: 'Workforce', to: '/workforce' }, { label: 'Coverage' }]}
        status={
          <FreshnessBadge
            sourceLabel="Coverage"
            offlineMeta={rosterQuery.offlineMeta}
            isFetching={rosterQuery.isLoading || rosterQuery.isFetching}
          />
        }
      />

      <KpiRow
        stats={[
          { label: 'Coverage windows', value: roster?.coverageWindows.length ?? 0 },
          { label: 'Active now', value: activeWindows },
          { label: 'Waiting coverage', value: waitingPreviews },
          { label: 'Escalated', value: escalatedPreviews },
        ]}
      />

      {!canManage ? (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-100">
          {activePersona} can inspect coverage and audit history. Admin or Operator permission is
          required to change the roster.
        </div>
      ) : null}

      <Tabs
        value={coverageMode}
        onValueChange={(value) => setCoverageMode(value as typeof coverageMode)}
      >
        <TabsList>
          <TabsTrigger value="operator-team">Operator team</TabsTrigger>
          <TabsTrigger value="after-hours">After-hours</TabsTrigger>
        </TabsList>

        <TabsContent value="operator-team" className="space-y-4">
          <CoverageEditor
            canManage={canManage}
            mutationPending={mutationPending}
            approvalClass={approvalClass}
            onApprovalClassChange={setApprovalClass}
            startsAt={startsAt}
            endsAt={endsAt}
            onStartsAtChange={setStartsAt}
            onEndsAtChange={setEndsAt}
            queues={queues}
            members={members}
            selectedQueueId={selectedQueueId}
            selectedFallbackQueueId={selectedFallbackQueueId}
            selectedPrimaryMemberId={selectedPrimaryMemberId}
            selectedDelegateUserId={selectedDelegateUserId}
            selectedSpecialistMemberId={selectedSpecialistMemberId}
            onQueueChange={setQueueId}
            onFallbackQueueChange={setFallbackQueueId}
            onPrimaryMemberChange={setPrimaryMemberId}
            onDelegateChange={setDelegateUserId}
            onSpecialistChange={setSpecialistMemberId}
            rationale={rationale}
            onRationaleChange={setRationale}
            onSaveCoverageWindow={saveCoverageWindow}
            onSaveDelegation={saveDelegation}
            onSaveSpecialistRoute={saveSpecialistRoute}
          />
        </TabsContent>

        <TabsContent value="after-hours" className="space-y-4">
          <CoverageEditor
            canManage={canManage}
            mutationPending={mutationPending}
            approvalClass={approvalClass}
            onApprovalClassChange={setApprovalClass}
            startsAt={startsAt}
            endsAt={endsAt}
            onStartsAtChange={setStartsAt}
            onEndsAtChange={setEndsAt}
            queues={queues}
            members={members}
            selectedQueueId={selectedQueueId}
            selectedFallbackQueueId={selectedFallbackQueueId}
            selectedPrimaryMemberId={selectedPrimaryMemberId}
            selectedDelegateUserId={selectedDelegateUserId}
            selectedSpecialistMemberId={selectedSpecialistMemberId}
            onQueueChange={setQueueId}
            onFallbackQueueChange={setFallbackQueueId}
            onPrimaryMemberChange={setPrimaryMemberId}
            onDelegateChange={setDelegateUserId}
            onSpecialistChange={setSpecialistMemberId}
            rationale={rationale}
            onRationaleChange={setRationale}
            onSaveCoverageWindow={saveCoverageWindow}
            onSaveDelegation={saveDelegation}
            onSaveSpecialistRoute={saveSpecialistRoute}
          />
        </TabsContent>
      </Tabs>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="space-y-4">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4" />
                Coverage Windows
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(roster?.coverageWindows ?? []).map((window) => (
                <div
                  key={window.coverageWindowId}
                  className="rounded-md border border-border p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{window.name}</div>
                      <div className="text-xs text-muted-foreground">{window.approvalClass}</div>
                    </div>
                    <Badge variant="secondary" className={coverageStateClasses[window.state]}>
                      {window.state}
                    </Badge>
                  </div>
                  <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                    <span>
                      {displayWhen(window.startsAtIso)} - {displayWhen(window.endsAtIso)}
                    </span>
                    <span>Queue: {queueName(queues, window.queueId)}</span>
                    <span>
                      Primary:{' '}
                      {window.primaryMemberIds.map((id) => memberName(members, id)).join(', ')}
                    </span>
                    <span>
                      Fallback:{' '}
                      {window.fallbackQueueId ? queueName(queues, window.fallbackQueueId) : 'none'}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GitFork className="h-4 w-4" />
                Delegates and Specialist Routing
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-2">
              {(roster?.delegations ?? []).map((delegation) => (
                <div key={delegation.delegationId} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {userName(members, delegation.delegatorUserId)} to{' '}
                      {userName(members, delegation.delegateUserId)}
                    </div>
                    <Badge variant={delegation.active ? 'default' : 'secondary'}>
                      {delegation.active ? 'active' : 'inactive'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{delegation.reason}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {delegation.approvalClass} until {displayWhen(delegation.expiresAtIso)}
                  </p>
                </div>
              ))}
              {(roster?.specialistRoutingRules ?? []).map((rule) => (
                <div key={rule.routingRuleId} className="rounded-md border border-border p-3">
                  <div className="text-sm font-medium">{rule.matchLabel}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{rule.approvalClass}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Specialists:{' '}
                    {rule.specialistMemberIds.map((id) => memberName(members, id)).join(', ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Route: {queueName(queues, rule.queueId)}; fallback{' '}
                    {queueName(queues, rule.fallbackQueueId)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <RouteIcon className="h-4 w-4" />
                Assignment Explanation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(roster?.routingPreviews ?? []).map((preview) => (
                <div key={preview.approvalId} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{preview.approvalId}</span>
                    <Badge variant="secondary" className={routingStateClasses[preview.state]}>
                      {preview.state}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{preview.explanation}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{preview.primaryTargetLabel}</Badge>
                    {preview.fallbackTargetLabel ? (
                      <Badge variant="outline">{preview.fallbackTargetLabel}</Badge>
                    ) : null}
                    <Badge variant="outline">{preview.authoritySource}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(roster?.auditTrail ?? []).map((entry) => (
                <div key={entry.auditId} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      {entry.action}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {displayWhen(entry.changedAtIso)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{entry.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{entry.changedByUserId}</Badge>
                    <Badge variant="outline">{entry.governanceFunction}</Badge>
                    <Badge variant="outline">{entry.authoritySource}</Badge>
                    <Badge variant="outline">{entry.evidenceId}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

interface CoverageEditorProps {
  canManage: boolean;
  mutationPending: boolean;
  approvalClass: string;
  onApprovalClassChange: (value: string) => void;
  startsAt: string;
  endsAt: string;
  onStartsAtChange: (value: string) => void;
  onEndsAtChange: (value: string) => void;
  queues: readonly WorkforceQueueSummary[];
  members: readonly WorkforceMemberSummary[];
  selectedQueueId: string;
  selectedFallbackQueueId: string;
  selectedPrimaryMemberId: string;
  selectedDelegateUserId: string;
  selectedSpecialistMemberId: string;
  onQueueChange: (value: string) => void;
  onFallbackQueueChange: (value: string) => void;
  onPrimaryMemberChange: (value: string) => void;
  onDelegateChange: (value: string) => void;
  onSpecialistChange: (value: string) => void;
  rationale: string;
  onRationaleChange: (value: string) => void;
  onSaveCoverageWindow: () => void;
  onSaveDelegation: () => void;
  onSaveSpecialistRoute: () => void;
}

function CoverageEditor({
  canManage,
  mutationPending,
  approvalClass,
  onApprovalClassChange,
  startsAt,
  endsAt,
  onStartsAtChange,
  onEndsAtChange,
  queues,
  members,
  selectedQueueId,
  selectedFallbackQueueId,
  selectedPrimaryMemberId,
  selectedDelegateUserId,
  selectedSpecialistMemberId,
  onQueueChange,
  onFallbackQueueChange,
  onPrimaryMemberChange,
  onDelegateChange,
  onSpecialistChange,
  rationale,
  onRationaleChange,
  onSaveCoverageWindow,
  onSaveDelegation,
  onSaveSpecialistRoute,
}: CoverageEditorProps) {
  const approvalMembers = members.filter((member) =>
    member.capabilities.includes('operations.approval'),
  );
  const delegateMembers = members.filter(
    (member) =>
      member.capabilities.includes('operations.approval') ||
      member.capabilities.includes('operations.escalation'),
  );

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          Roster Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Approval class">
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={approvalClass}
              onChange={(event) => onApprovalClassChange(event.target.value)}
              disabled={!canManage}
            >
              {APPROVAL_CLASSES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Starts">
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => onStartsAtChange(event.target.value)}
              disabled={!canManage}
            />
          </Field>
          <Field label="Ends">
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => onEndsAtChange(event.target.value)}
              disabled={!canManage}
            />
          </Field>
          <Field label="Queue">
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={selectedQueueId}
              onChange={(event) => onQueueChange(event.target.value)}
              disabled={!canManage}
            >
              {queues.map((queue) => (
                <option key={queue.workforceQueueId} value={queue.workforceQueueId}>
                  {queue.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Primary">
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={selectedPrimaryMemberId}
              onChange={(event) => onPrimaryMemberChange(event.target.value)}
              disabled={!canManage}
            >
              {approvalMembers.map((member) => (
                <option key={member.workforceMemberId} value={member.workforceMemberId}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fallback">
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={selectedFallbackQueueId}
              onChange={(event) => onFallbackQueueChange(event.target.value)}
              disabled={!canManage}
            >
              {queues.map((queue) => (
                <option key={queue.workforceQueueId} value={queue.workforceQueueId}>
                  {queue.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Delegate">
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={selectedDelegateUserId}
              onChange={(event) => onDelegateChange(event.target.value)}
              disabled={!canManage}
            >
              {delegateMembers.map((member) => (
                <option key={member.linkedUserId} value={member.linkedUserId}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Specialist">
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={selectedSpecialistMemberId}
              onChange={(event) => onSpecialistChange(event.target.value)}
              disabled={!canManage}
            >
              {approvalMembers.map((member) => (
                <option key={member.workforceMemberId} value={member.workforceMemberId}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rationale">
            <Input
              value={rationale}
              onChange={(event) => onRationaleChange(event.target.value)}
              disabled={!canManage}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSaveCoverageWindow} disabled={!canManage || mutationPending}>
            <CalendarClock className="h-4 w-4" />
            Add coverage window
          </Button>
          <Button
            variant="outline"
            onClick={onSaveDelegation}
            disabled={!canManage || mutationPending}
          >
            <UserCheck className="h-4 w-4" />
            Add delegate
          </Button>
          <Button
            variant="outline"
            onClick={onSaveSpecialistRoute}
            disabled={!canManage || mutationPending}
          >
            <RefreshCcw className="h-4 w-4" />
            Update route
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workforce/coverage',
  component: WorkforceCoveragePage,
});
