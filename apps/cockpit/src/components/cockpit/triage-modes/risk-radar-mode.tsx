import { useMemo } from 'react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { TriageModeProps } from './index';
import { computeRiskScore, RISK_AXIS_LABELS, type RiskScore } from './lib/risk-scoring';

const SCORE_COLORS: Record<
  RiskScore['label'],
  { fill: string; stroke: string; text: string; bar: string; badge: string }
> = {
  Low: {
    fill: 'rgba(34, 197, 94, 0.2)',
    stroke: '#22c55e',
    text: 'text-success',
    bar: 'bg-success',
    badge: 'bg-success/10 text-success',
  },
  Medium: {
    fill: 'rgba(234, 179, 8, 0.2)',
    stroke: '#eab308',
    text: 'text-warning',
    bar: 'bg-warning',
    badge: 'bg-warning/10 text-warning',
  },
  High: {
    fill: 'rgba(249, 115, 22, 0.2)',
    stroke: '#f97316',
    text: 'text-destructive',
    bar: 'bg-destructive/80',
    badge: 'bg-destructive/10 text-destructive',
  },
  Critical: {
    fill: 'rgba(239, 68, 68, 0.2)',
    stroke: '#ef4444',
    text: 'text-destructive',
    bar: 'bg-destructive',
    badge: 'bg-destructive/10 text-destructive',
  },
};

function MicroBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-muted-foreground w-24 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-muted-foreground w-8 text-right font-mono">{value}</span>
    </div>
  );
}

export function RiskRadarMode({ approval, plannedEffects, evidenceEntries, run }: TriageModeProps) {
  const score = useMemo(
    () => computeRiskScore(approval, plannedEffects, evidenceEntries, run),
    [approval, plannedEffects, evidenceEntries, run],
  );

  const chartData = useMemo(
    () =>
      (Object.keys(score.axes) as Array<keyof typeof score.axes>).map((key) => ({
        axis: RISK_AXIS_LABELS[key],
        value: score.axes[key],
        fullMark: 100,
      })),
    [score],
  );

  const colors = SCORE_COLORS[score.label];

  return (
    <div className="space-y-3">
      {/* Radar chart */}
      <div className="flex justify-center">
        <div className="w-full max-w-[240px] sm:max-w-[300px] h-[200px] sm:h-[240px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="58%">
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar dataKey="value" stroke={colors.stroke} fill={colors.fill} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Composite score */}
      <div className="text-center space-y-1.5">
        <div className="flex items-center justify-center gap-2">
          <span className={cn('text-2xl font-bold tabular-nums', colors.text)}>
            {(score.composite / 10).toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">/ 10</span>
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', colors.badge)}>
            {score.label}
          </span>
        </div>
        <div className="mx-auto w-36 sm:w-48 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', colors.bar)}
            style={{ width: `${score.composite}%` }}
          />
        </div>
      </div>

      {/* Axis detail bars */}
      <div className="space-y-1.5 pt-1 max-w-[240px] sm:max-w-[300px] mx-auto">
        {(Object.keys(score.axes) as Array<keyof typeof score.axes>).map((key) => (
          <MicroBar
            key={key}
            label={RISK_AXIS_LABELS[key]}
            value={score.axes[key]}
            color={colors.bar}
          />
        ))}
      </div>
    </div>
  );
}
