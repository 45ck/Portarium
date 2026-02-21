import { useState } from 'react';
import { createRoute, Link } from '@tanstack/react-router';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Route as rootRoute } from '../../__root';
import { useUIStore } from '@/stores/ui-store';
import {
  useMission,
  useCancelMission,
  usePreemptMission,
  useRetryMission,
} from '@/hooks/queries/use-missions';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { RelatedEntities } from '@/components/cockpit/related-entities';
import type { RelatedEntity } from '@/components/cockpit/related-entities';
import { MissionStatusBadge } from '@/components/domain/mission-status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';

function MissionDetailPage() {
  const { missionId } = Route.useParams();
  const { activeWorkspaceId: wsId } = useUIStore();
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'preempt' | null>(null);

  const { data: mission, isLoading, isError } = useMission(wsId, missionId);
  const cancelMission = useCancelMission(wsId);
  const preemptMission = usePreemptMission(wsId);
  const retryMission = useRetryMission(wsId);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-7 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !mission) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Mission Not Found"
          icon={<EntityIcon entityType="run" size="md" decorative />}
        />
        <p className="text-sm text-muted-foreground">The mission could not be loaded.</p>
        <Link to={'/robotics/missions' as string}>
          <Button variant="outline" size="sm">
            Back to Missions
          </Button>
        </Link>
      </div>
    );
  }

  const isTerminal = ['Completed', 'Failed', 'Cancelled'].includes(mission.status);
  const activeIdx = mission.status === 'Pending' ? 0 : mission.status === 'Executing' ? 2 : 3;
  const terminalLabel =
    mission.status === 'Completed'
      ? 'Succeeded'
      : mission.status === 'Failed'
        ? 'Failed'
        : 'Cancelled';
  const TIMELINE = ['Pending', 'Dispatched', 'Executing', terminalLabel];

  function handleConfirm() {
    if (!mission) return;
    if (confirmAction === 'cancel') {
      cancelMission.mutate(mission.missionId, {
        onSuccess: () => toast.success(`Mission ${mission.missionId} cancelled`),
        onError: () => toast.error('Failed to cancel mission'),
      });
    } else if (confirmAction === 'preempt') {
      preemptMission.mutate(mission.missionId, {
        onSuccess: () => toast.success(`Mission ${mission.missionId} pre-empted`),
        onError: () => toast.error('Failed to pre-empt mission'),
      });
    }
    setConfirmAction(null);
  }

  const relatedEntities: RelatedEntity[] = [
    {
      type: 'robot',
      id: mission.robotId,
      label: mission.robotId,
      href: `/robotics/robots/${mission.robotId}`,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={`Mission: ${missionId}`}
        icon={<EntityIcon entityType="run" size="md" decorative />}
        breadcrumb={[
          { label: 'Robotics', to: '/robotics' },
          { label: 'Missions', to: '/robotics/missions' },
          { label: missionId },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <MissionStatusBadge status={mission.status} />
        <Badge variant="outline" className="text-[10px]">
          {mission.priority}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {mission.executionTier}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-6">
          <Card className="shadow-none">
            <CardContent className="pt-4 space-y-6">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Details
                </h3>
                <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Mission ID</dt>
                  <dd className="font-mono text-xs">{mission.missionId}</dd>
                  <dt className="text-muted-foreground">Goal</dt>
                  <dd>{mission.goal}</dd>
                  <dt className="text-muted-foreground">Robot</dt>
                  <dd>
                    <Link
                      to={`/robotics/robots/${mission.robotId}` as string}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {mission.robotId}
                    </Link>
                  </dd>
                  <dt className="text-muted-foreground">Action type</dt>
                  <dd>{mission.actionType}</dd>
                  <dt className="text-muted-foreground">Priority</dt>
                  <dd>{mission.priority}</dd>
                  <dt className="text-muted-foreground">Tier</dt>
                  <dd>{mission.executionTier}</dd>
                  {mission.dispatchedAtIso && (
                    <>
                      <dt className="text-muted-foreground">Dispatched</dt>
                      <dd>{format(new Date(mission.dispatchedAtIso), 'HH:mm:ss')}</dd>
                    </>
                  )}
                  {mission.completedAtIso && (
                    <>
                      <dt className="text-muted-foreground">Completed</dt>
                      <dd>{format(new Date(mission.completedAtIso), 'HH:mm:ss')}</dd>
                    </>
                  )}
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Execution Timeline
                </h3>
                <ol className="relative border-l border-border ml-2 space-y-4 pl-4">
                  {TIMELINE.map((label, idx) => (
                    <li key={label} className="flex items-center gap-3">
                      <div
                        className={cn(
                          'absolute -left-1.5 h-3 w-3 rounded-full border-2',
                          idx < activeIdx
                            ? 'bg-green-500 border-green-500'
                            : idx === activeIdx
                              ? 'bg-primary border-primary'
                              : 'bg-background border-muted-foreground/30',
                        )}
                      />
                      <span
                        className={cn(
                          'text-sm',
                          idx <= activeIdx ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {label}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>

              <Link
                to={`/robotics/map?robotId=${mission.robotId}` as string}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <MapPin className="h-3 w-3" />
                Show on Map
              </Link>
            </CardContent>
          </Card>

          {(!isTerminal || mission.status === 'Failed') && (
            <Card className="shadow-none">
              <CardContent className="pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Actions
                </h3>
                <div className="flex gap-2">
                  {mission.status === 'Executing' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmAction('preempt')}
                      aria-label={`Pre-empt mission ${mission.missionId}`}
                    >
                      Pre-empt
                    </Button>
                  )}
                  {!isTerminal && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmAction('cancel')}
                      aria-label={`Cancel mission ${mission.missionId}`}
                    >
                      Cancel Mission
                    </Button>
                  )}
                  {mission.status === 'Failed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        retryMission.mutate(mission.missionId, {
                          onSuccess: () =>
                            toast.success(`Mission ${mission.missionId} queued for retry`),
                          onError: () => toast.error('Failed to retry mission'),
                        });
                      }}
                    >
                      Retry Mission
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <RelatedEntities entities={relatedEntities} />
        </div>
      </div>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'preempt' ? 'Pre-empt' : 'Cancel'} mission {missionId}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will be logged in the evidence chain and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
            >
              Confirm {confirmAction === 'preempt' ? 'Pre-empt' : 'Cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/robotics/missions/$missionId',
  component: MissionDetailPage,
});
