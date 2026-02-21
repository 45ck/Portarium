import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Bot, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import type { TriageModeProps } from './index';
import { useRobots } from '@/hooks/queries/use-robots';
import { useSafetyConstraints } from '@/hooks/queries/use-safety';
import { useMissions } from '@/hooks/queries/use-missions';
import type {
  RobotSummary,
  RobotStatus,
  SafetyConstraint,
  EnforcementMode,
} from '@/types/robotics';

const STATUS_COLORS: Record<RobotStatus, string> = {
  Online: 'bg-emerald-500',
  Degraded: 'bg-yellow-500',
  'E-Stopped': 'bg-red-500',
  Offline: 'bg-muted-foreground/50',
};

const STATUS_TEXT_COLORS: Record<RobotStatus, string> = {
  Online: 'text-emerald-600',
  Degraded: 'text-yellow-600',
  'E-Stopped': 'text-red-600',
  Offline: 'text-muted-foreground',
};

const ENFORCEMENT_ICON: Record<EnforcementMode, typeof ShieldAlert> = {
  block: ShieldAlert,
  warn: AlertTriangle,
  log: Info,
};

const ENFORCEMENT_COLOR: Record<EnforcementMode, string> = {
  block: 'text-red-500',
  warn: 'text-yellow-500',
  log: 'text-muted-foreground',
};

function BatteryBar({ pct }: { pct: number }) {
  const barColor = pct > 60 ? 'bg-emerald-500' : pct > 25 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
    </div>
  );
}

function RobotCard({ robot, missionGoal }: { robot: RobotSummary; missionGoal?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium text-xs">{robot.name}</span>
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-medium ml-auto',
            STATUS_TEXT_COLORS[robot.status],
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_COLORS[robot.status])} />
          {robot.status}
        </span>
        <BatteryBar pct={robot.batteryPct} />
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>Class: {robot.robotClass}</span>
        <span className="text-border">|</span>
        <span className="truncate">Caps: {robot.capabilities.join(', ')}</span>
      </div>
      {missionGoal && (
        <div className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Mission:</span> {missionGoal}
        </div>
      )}
    </div>
  );
}

function ConstraintRow({ constraint }: { constraint: SafetyConstraint }) {
  const Icon = ENFORCEMENT_ICON[constraint.enforcement];
  return (
    <div className="flex items-start gap-2 py-1.5">
      <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', ENFORCEMENT_COLOR[constraint.enforcement])} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{constraint.constraint}</span>
          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
            {constraint.site}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          Enforcement: {constraint.enforcement} · {constraint.robotCount} robot
          {constraint.robotCount !== 1 ? 's' : ''} affected
        </div>
      </div>
    </div>
  );
}

export function RoboticsSafetyMode({ approval, run }: TriageModeProps) {
  const wsId = approval.workspaceId;
  const robotIds = useMemo(() => run?.robotIds ?? [], [run]);

  const { data: robotsData } = useRobots(wsId);
  const { data: constraintsData } = useSafetyConstraints(wsId);
  const { data: missionsData } = useMissions(wsId);

  const robots = useMemo(() => {
    if (!robotsData?.items || robotIds.length === 0) return [];
    return robotsData.items.filter((r) => robotIds.includes(r.robotId));
  }, [robotsData, robotIds]);

  const missionsByRobot = useMemo(() => {
    const map = new Map<string, string>();
    if (!missionsData?.items) return map;
    for (const m of missionsData.items) {
      if (robotIds.includes(m.robotId) && (m.status === 'Executing' || m.status === 'Pending')) {
        map.set(m.robotId, m.goal);
      }
    }
    return map;
  }, [missionsData, robotIds]);

  const constraints = constraintsData?.items ?? [];

  if (robots.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/10 px-4 py-8 text-center">
        <Bot className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-xs font-medium text-muted-foreground">No robot data available</p>
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          Robot information will appear once the run is linked to robotic assets.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Involved Robots */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Involved Robots
        </p>
        <div className="space-y-2">
          {robots.map((robot) => (
            <RobotCard
              key={robot.robotId}
              robot={robot}
              missionGoal={missionsByRobot.get(robot.robotId)}
            />
          ))}
        </div>
      </div>

      {/* Active Safety Constraints */}
      {constraints.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Active Safety Constraints
          </p>
          <div className="divide-y divide-border/40">
            {constraints.map((c) => (
              <ConstraintRow key={c.constraintId} constraint={c} />
            ))}
          </div>
        </div>
      )}

      {/* Approval Tier Context */}
      <div className="rounded-lg border border-border bg-muted/10 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Approval Tier Context
        </p>
        <div className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1 text-xs">
          <span className="text-muted-foreground">Tier</span>
          <span className="font-medium">
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {run?.executionTier ?? 'Unknown'}
            </Badge>
          </span>
          {approval.policyRule && (
            <>
              <span className="text-muted-foreground">Trigger</span>
              <span className="font-mono text-[11px]">{approval.policyRule.trigger}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
