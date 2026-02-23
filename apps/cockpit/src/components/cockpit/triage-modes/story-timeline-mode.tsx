import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { format, formatDistanceStrict } from 'date-fns';
import { EntityIcon } from '@/components/domain/entity-icon';
import type { TriageModeProps } from './index';
import type { EvidenceEntry } from '@portarium/cockpit-types';

interface TimelineEvent {
  id: string;
  label: string;
  timestamp: Date;
  dotColor: string;
  bgColor: string;
  type: 'run' | 'request' | 'history' | 'now' | 'due' | 'evidence' | 'future';
  detail?: string;
  pulsing?: boolean;
}

function buildTimelineEvents(props: TriageModeProps): TimelineEvent[] {
  const { approval, plannedEffects, evidenceEntries = [], run, workflow } = props;
  const events: TimelineEvent[] = [];

  // Workflow trigger event (before run creation)
  if (workflow && run?.createdAtIso) {
    const triggerLabel: Record<string, string> = {
      Manual: 'Manual trigger',
      Cron: 'Scheduled trigger',
      Webhook: 'Webhook trigger',
      DomainEvent: 'Event trigger',
    };
    events.push({
      id: 'workflow-trigger',
      label: triggerLabel[workflow.triggerKind ?? ''] ?? 'Workflow triggered',
      timestamp: new Date(new Date(run.createdAtIso).getTime() - 500),
      dotColor: 'bg-violet-500',
      bgColor: 'bg-violet-50 border-violet-200',
      type: 'run',
      detail: `${workflow.name} v${workflow.version}`,
    });
  }

  // Run created
  if (run?.createdAtIso) {
    events.push({
      id: 'run-created',
      label: 'Run created',
      timestamp: new Date(run.createdAtIso),
      dotColor: 'bg-violet-400',
      bgColor: 'bg-violet-50 border-violet-200',
      type: 'run',
      detail: `By ${run.initiatedByUserId}`,
    });
  }

  // Run started
  if (run?.startedAtIso) {
    events.push({
      id: 'run-started',
      label: 'Run started',
      timestamp: new Date(run.startedAtIso),
      dotColor: 'bg-blue-500',
      bgColor: 'bg-blue-50 border-blue-200',
      type: 'run',
      detail: `${run.executionTier} tier · Run ${run.runId}`,
    });
  }

  // Agent/robot join events
  if (run?.startedAtIso && run.agentIds?.length) {
    run.agentIds.forEach((agentId, i) => {
      events.push({
        id: `agent-join-${i}`,
        label: 'Agent joined',
        timestamp: new Date(new Date(run.startedAtIso!).getTime() + (i + 1) * 1000),
        dotColor: 'bg-indigo-500',
        bgColor: 'bg-indigo-50 border-indigo-200',
        type: 'run',
        detail: agentId,
      });
    });
  }
  if (run?.startedAtIso && run.robotIds?.length) {
    run.robotIds.forEach((robotId, i) => {
      events.push({
        id: `robot-join-${i}`,
        label: 'Robot joined',
        timestamp: new Date(new Date(run.startedAtIso!).getTime() + (i + 1) * 1500),
        dotColor: 'bg-indigo-400',
        bgColor: 'bg-indigo-50 border-indigo-200',
        type: 'run',
        detail: robotId,
      });
    });
  }

  // Approval requested
  events.push({
    id: 'requested',
    label: 'Approval Requested',
    timestamp: new Date(approval.requestedAtIso),
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-50 border-amber-200',
    type: 'request',
    detail: `By ${approval.requestedByUserId}`,
  });

  // Decision history
  const history = approval.decisionHistory ?? [];
  history.forEach((entry, i) => {
    const defaultColor = { dot: 'bg-muted-foreground/50', bg: 'bg-muted/30 border-border' };
    const colors: Record<string, { dot: string; bg: string }> = {
      requested: defaultColor,
      changes_requested: { dot: 'bg-yellow-500', bg: 'bg-yellow-50 border-yellow-200' },
      resubmitted: { dot: 'bg-blue-500', bg: 'bg-blue-50 border-blue-200' },
    };
    const c = colors[entry.type] ?? defaultColor;
    events.push({
      id: `history-${i}`,
      label:
        entry.type === 'changes_requested'
          ? 'Changes Requested'
          : entry.type === 'resubmitted'
            ? 'Resubmitted'
            : 'Requested',
      timestamp: new Date(entry.timestamp),
      dotColor: c.dot,
      bgColor: c.bg,
      type: 'history',
      detail: `${entry.actor}: ${entry.message}`,
    });
  });

  // Evidence entries as notch marks
  evidenceEntries.forEach((ev) => {
    events.push({
      id: `ev-${ev.evidenceId}`,
      label: ev.category,
      timestamp: new Date(ev.occurredAtIso),
      dotColor: 'bg-muted-foreground/30',
      bgColor: 'bg-muted/10 border-border/50',
      type: 'evidence',
      detail: ev.summary,
    });
  });

  // NOW marker
  const nowTs = new Date();
  events.push({
    id: 'now',
    label: 'NOW',
    timestamp: nowTs,
    dotColor: 'bg-primary',
    bgColor: 'bg-primary/10 border-primary/30',
    type: 'now',
    pulsing: true,
  });

  // Planned effects as future projections (after NOW)
  if (plannedEffects.length > 0 && approval.status === 'Pending') {
    const projectionBase = nowTs.getTime() + 60_000;
    const bySor = new Map<string, number>();
    for (const eff of plannedEffects) {
      bySor.set(eff.target.sorName, (bySor.get(eff.target.sorName) ?? 0) + 1);
    }
    let idx = 0;
    for (const [sorName, count] of bySor.entries()) {
      events.push({
        id: `future-${sorName}`,
        label: `${sorName}`,
        timestamp: new Date(projectionBase + idx * 30_000),
        dotColor: 'bg-muted-foreground/30',
        bgColor: 'bg-muted/20 border-dashed border-muted-foreground/20',
        type: 'future',
        detail: `${count} effect${count > 1 ? 's' : ''} if approved`,
      });
      idx++;
    }
  }

  // Due date
  if (approval.dueAtIso) {
    const due = new Date(approval.dueAtIso);
    const overdue = due < new Date();
    events.push({
      id: 'due',
      label: overdue ? 'OVERDUE' : 'Due',
      timestamp: due,
      dotColor: overdue ? 'bg-red-500' : 'bg-amber-500',
      bgColor: overdue ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200',
      type: 'due',
      detail: format(due, 'MMM d, HH:mm'),
    });
  }

  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return events;
}

function TimelineCard({ event, above }: { event: TimelineEvent; above: boolean }) {
  if (event.type === 'evidence') {
    return null; // Evidence shown as notch marks only
  }

  const isFuture = event.type === 'future';

  return (
    <div
      className={cn(
        'w-[120px] -translate-x-1/2',
        above ? 'absolute bottom-[calc(50%+20px)]' : 'absolute top-[calc(50%+20px)]',
      )}
    >
      <div
        className={cn(
          'rounded-md border px-2 py-1.5 text-center',
          event.bgColor,
          isFuture && 'border-dashed opacity-60',
        )}
      >
        {isFuture && (
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Projected
          </span>
        )}
        <p
          className={cn(
            'text-[11px] font-semibold',
            event.pulsing && 'text-primary',
            isFuture && 'text-muted-foreground',
          )}
        >
          {event.label}
        </p>
        {!isFuture && (
          <p className="text-[9px] text-muted-foreground mt-0.5">
            {format(event.timestamp, 'MMM d, HH:mm')}
          </p>
        )}
        {event.detail && (
          <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{event.detail}</p>
        )}
      </div>
    </div>
  );
}

/** Simple vertical layout for when there are only 2 card events */
function SimpleTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {events.map((event, i) => (
        <div key={event.id} className="flex flex-col items-center">
          {i > 0 && <div className="w-px h-6 bg-border" />}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'rounded-full shrink-0 border-2 border-background',
                event.dotColor,
                event.pulsing ? 'w-4 h-4 ring-2 ring-primary/30 animate-pulse' : 'w-3 h-3',
              )}
            />
            <div className={cn('rounded-md border px-3 py-2 min-w-[160px]', event.bgColor)}>
              <p className={cn('text-[11px] font-semibold', event.pulsing && 'text-primary')}>
                {event.label}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {format(event.timestamp, 'EEE, MMM d · HH:mm')}
              </p>
              {event.detail && (
                <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{event.detail}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StoryTimelineMode(props: TriageModeProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { approval, plannedEffects, evidenceEntries, run, workflow } = props;
  const events = useMemo(
    () => buildTimelineEvents(props),
    [approval, plannedEffects, evidenceEntries, run, workflow],
  );

  // Filter non-evidence events for card display
  const cardEvents = events.filter((e) => e.type !== 'evidence');
  const evidenceEvents = events.filter((e) => e.type === 'evidence');

  if (cardEvents.length <= 1) {
    return (
      <div className="rounded-lg border border-border bg-muted/10 px-4 py-8 text-center text-xs text-muted-foreground">
        Not enough timeline data to display
      </div>
    );
  }

  // For only 2 card events, use a simpler vertical layout
  if (cardEvents.length <= 2) {
    return (
      <div className="space-y-2">
        <SimpleTimeline events={cardEvents} />
        <JourneySummary
          approval={props.approval}
          events={events}
          run={props.run}
          workflow={props.workflow}
        />
      </div>
    );
  }

  // Calculate positions — ensure minimum spacing per card
  const minSpacingPerCard = 180;
  const minTime = events[0]!.timestamp.getTime();
  const maxTime = events[events.length - 1]!.timestamp.getTime();
  const timeRange = Math.max(maxTime - minTime, 1);
  const totalWidth = Math.max(cardEvents.length * minSpacingPerCard, 480);

  function getX(ts: Date): number {
    return 80 + ((ts.getTime() - minTime) / timeRange) * (totalWidth - 160);
  }

  // P0-4: Pre-pass to enforce minimum spacing between cards and prevent overlap
  const adjustedCardPositions = useMemo(() => {
    const positions = cardEvents.map((event) => ({
      id: event.id,
      x: getX(event.timestamp),
    }));
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1]!;
      const curr = positions[i]!;
      if (curr.x - prev.x < minSpacingPerCard) {
        curr.x = prev.x + minSpacingPerCard;
      }
    }
    return new Map(positions.map((p) => [p.id, p.x]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardEvents, totalWidth, minTime, timeRange]);

  // Compute effective total width to accommodate pushed-out cards
  const lastCardX = adjustedCardPositions.get(cardEvents[cardEvents.length - 1]!.id) ?? totalWidth;
  const effectiveTotalWidth = Math.max(totalWidth, lastCardX + 80);

  // P1-6: Auto-scroll to center the NOW marker
  const nowEvent = cardEvents.find((e) => e.type === 'now');
  const nowX = nowEvent ? (adjustedCardPositions.get(nowEvent.id) ?? getX(nowEvent.timestamp)) : 0;

  useEffect(() => {
    if (nowEvent && scrollRef.current) {
      scrollRef.current.scrollTo({
        left: nowX - scrollRef.current.clientWidth / 2,
        behavior: 'smooth',
      });
    }
  }, [nowEvent, nowX]);

  return (
    <div className="space-y-2">
      <div ref={scrollRef} className="overflow-x-auto pb-2">
        <div className="relative" style={{ width: effectiveTotalWidth, height: 220 }}>
          {/* Timeline bar */}
          <div className="absolute left-[40px] right-[40px] top-1/2 h-px bg-border -translate-y-1/2" />

          {/* Evidence notch marks */}
          {evidenceEvents.map((ev) => {
            const x = getX(ev.timestamp);
            return (
              <div
                key={ev.id}
                className={cn(
                  'absolute w-1 h-3 rounded-full -translate-x-1/2 -translate-y-1/2',
                  ev.dotColor,
                )}
                style={{ left: x, top: '50%' }}
                title={`${ev.label}: ${ev.detail}`}
              />
            );
          })}

          {/* Overdue fill */}
          {props.approval.dueAtIso &&
            new Date(props.approval.dueAtIso) < new Date() &&
            (() => {
              const dueEvent = cardEvents.find((e) => e.id === 'due');
              const nowEventOverdue = cardEvents.find((e) => e.id === 'now');
              const dueX = dueEvent
                ? (adjustedCardPositions.get(dueEvent.id) ?? getX(dueEvent.timestamp))
                : getX(new Date(props.approval.dueAtIso));
              const nowXOverdue = nowEventOverdue
                ? (adjustedCardPositions.get(nowEventOverdue.id) ?? getX(nowEventOverdue.timestamp))
                : getX(new Date());
              return (
                <div
                  className="absolute h-1 bg-red-300/40 top-1/2 -translate-y-1/2 rounded flex items-center justify-center"
                  style={{ left: dueX, width: Math.max(nowXOverdue - dueX, 0) }}
                >
                  <span className="text-[9px] font-bold uppercase text-red-500 leading-none">
                    OVERDUE
                  </span>
                </div>
              );
            })()}

          {/* Event dots and cards */}
          {cardEvents.map((event, i) => {
            const x = adjustedCardPositions.get(event.id) ?? getX(event.timestamp);
            const above = i % 2 === 0;

            return (
              <div key={event.id}>
                {/* Dot */}
                <div
                  className={cn(
                    'absolute rounded-full -translate-x-1/2 -translate-y-1/2 border-2 border-background z-10',
                    event.dotColor,
                    event.pulsing ? 'w-4 h-4 ring-2 ring-primary/30 animate-pulse' : 'w-3 h-3',
                    event.type === 'future' && 'border-dashed opacity-50',
                  )}
                  style={{ left: x, top: '50%' }}
                />

                {/* Connector line */}
                <div
                  className="absolute w-px bg-border"
                  style={{
                    left: x,
                    ...(above
                      ? { top: 'calc(50% - 20px)', height: 14 }
                      : { top: 'calc(50% + 6px)', height: 14 }),
                  }}
                />

                {/* Card */}
                <div style={{ left: x, position: 'absolute' }}>
                  <TimelineCard event={event} above={above} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <JourneySummary
        approval={props.approval}
        events={events}
        run={props.run}
        workflow={props.workflow}
      />
    </div>
  );
}

function JourneySummary({
  approval,
  events,
  run,
  workflow,
}: {
  approval: TriageModeProps['approval'];
  events: TimelineEvent[];
  run?: TriageModeProps['run'];
  workflow?: TriageModeProps['workflow'];
}) {
  const requestedEvent = events.find((e) => e.id === 'requested');
  const rejectionCycles = (approval.decisionHistory ?? []).filter(
    (h) => h.type === 'changes_requested',
  ).length;

  const elapsed = requestedEvent
    ? formatDistanceStrict(requestedEvent.timestamp, new Date())
    : null;

  return (
    <div className="text-[11px] text-muted-foreground text-center">
      {workflow && <>{workflow.name} · </>}
      Requested {requestedEvent ? format(requestedEvent.timestamp, 'MMM d') : 'recently'}
      {elapsed && ` · ${elapsed} elapsed`}
      {rejectionCycles > 0 &&
        ` · ${rejectionCycles} rejection cycle${rejectionCycles > 1 ? 's' : ''}`}
      {run?.executionTier && ` · ${run.executionTier} tier`}
      {approval.dueAtIso && ` · due ${format(new Date(approval.dueAtIso), 'MMM d, HH:mm')}`}
    </div>
  );
}
