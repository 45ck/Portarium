import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  FileCheck2,
  Layers3,
  ListFilter,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/cockpit/page-header';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CAPABILITY_POSTURE_PRESETS,
  CAPABILITY_POSTURE_ROWS,
  coerceCapabilityPosturePreset,
  resolveEffectiveCapabilityPosture,
  summarizeEffectivePostures,
  type CapabilityPosturePresetId,
  type CapabilityPostureRow,
  type EffectiveCapabilityPosture,
} from '@/lib/capability-posture';
import { cn } from '@/lib/utils';

interface CapabilityPostureSearch {
  preset?: CapabilityPosturePresetId;
  capability?: string;
}

export function validateCapabilityPostureSearch(
  search: Record<string, unknown>,
): CapabilityPostureSearch {
  return {
    preset: coerceCapabilityPosturePreset(search.preset),
    capability: typeof search.capability === 'string' ? search.capability : undefined,
  };
}

function compactList(items: readonly string[], max = 2): string {
  if (items.length <= max) return items.join(', ');
  return `${items.slice(0, max).join(', ')} +${items.length - max}`;
}

function tierSummaryLabel(tier: string): string {
  if (tier === 'HumanApprove') return 'Human Approve';
  if (tier === 'ManualOnly') return 'Manual Only';
  return tier;
}

function StatTile({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function PresetSelector({
  presetId,
  onSelect,
}: {
  presetId: CapabilityPosturePresetId;
  onSelect: (presetId: CapabilityPosturePresetId) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {CAPABILITY_POSTURE_PRESETS.map((preset) => {
        const selected = preset.id === presetId;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset.id)}
            className={cn(
              'rounded-md border p-3 text-left transition-colors',
              selected ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/40',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{preset.label}</span>
              {selected ? <Badge variant="secondary">Previewing</Badge> : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{preset.description}</p>
          </button>
        );
      })}
    </div>
  );
}

function CapabilityRowButton({
  row,
  effective,
  selected,
  onSelect,
}: {
  row: CapabilityPostureRow;
  effective: EffectiveCapabilityPosture;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <TableRow data-state={selected ? 'selected' : undefined}>
      <TableCell className="min-w-64 whitespace-normal">
        <button type="button" className="text-left" onClick={onSelect}>
          <span className="block font-medium">{row.capability}</span>
          <span className="mt-1 block font-mono text-xs text-muted-foreground">
            {row.actionPattern}
          </span>
        </button>
      </TableCell>
      <TableCell className="min-w-48 whitespace-normal">
        <span className="block">{row.family}</span>
        <span className="text-xs text-muted-foreground">{row.environment}</span>
      </TableCell>
      <TableCell className="min-w-56 whitespace-normal">
        <span className="block text-sm">{row.inheritedFrom}</span>
        <span className="text-xs text-muted-foreground">{row.persistence}</span>
      </TableCell>
      <TableCell>
        <ExecutionTierBadge tier={row.defaultPosture.tier} />
      </TableCell>
      <TableCell>
        <ExecutionTierBadge tier={effective.posture.tier} />
      </TableCell>
      <TableCell className="min-w-48 whitespace-normal">
        <span className="text-sm">{compactList(effective.posture.roles)}</span>
      </TableCell>
      <TableCell className="min-w-64 whitespace-normal">
        <span className="text-sm">{compactList(effective.posture.evidence, 3)}</span>
      </TableCell>
      <TableCell>
        {effective.exceptionCount > 0 ? (
          <Badge variant="warning">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {effective.exceptionCount} visible
          </Badge>
        ) : (
          <Badge variant="outline">None</Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

function EffectivePostureInspector({ effective }: { effective: EffectiveCapabilityPosture }) {
  const { row, posture, layers, strongestException } = effective;
  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Effective posture
              </CardTitle>
              <CardDescription>{row.capability}</CardDescription>
            </div>
            <ExecutionTierBadge tier={posture.tier} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            {effective.explanation}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-primary" />
                Role gates
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {posture.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileCheck2 className="h-4 w-4 text-primary" />
                Required evidence
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {posture.evidence.map((item) => (
                  <Badge key={item} variant="outline">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers3 className="h-4 w-4 text-primary" />
            Inheritance and exceptions
          </CardTitle>
          <CardDescription>How the effective decision path is assembled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {layers.map((layer, index) => (
            <div key={`${layer.label}-${index}`} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {index + 1}. {layer.label}
                  </div>
                  <div className="mt-1 text-sm font-medium">{layer.source}</div>
                </div>
                <ExecutionTierBadge tier={layer.posture.tier} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{layer.note}</p>
            </div>
          ))}

          {row.exceptions.length > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <span className="font-medium">Exception visibility:</span>{' '}
              {row.exceptions.map((exception) => exception.label).join(', ')}
              {strongestException ? `; strongest is ${strongestException.label}.` : '.'}
            </div>
          ) : (
            <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
              No exception overrides are active for this capability row.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CapabilityPostureMatrixPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/config/capability-posture' }) as CapabilityPostureSearch;
  const presetId = search.preset ?? 'balanced';
  const selectedRow =
    CAPABILITY_POSTURE_ROWS.find((row) => row.id === search.capability) ??
    CAPABILITY_POSTURE_ROWS[0]!;
  const effectiveRows = CAPABILITY_POSTURE_ROWS.map((row) => ({
    row,
    effective: resolveEffectiveCapabilityPosture(row, presetId),
  }));
  const selectedEffective = resolveEffectiveCapabilityPosture(selectedRow, presetId);
  const summary = summarizeEffectivePostures(CAPABILITY_POSTURE_ROWS, presetId);
  const exceptionTotal = CAPABILITY_POSTURE_ROWS.reduce(
    (count, row) => count + row.exceptions.length,
    0,
  );

  function writeSearch(next: CapabilityPostureSearch) {
    navigate({
      to: '/config/capability-posture',
      search: {
        preset: next.preset === 'balanced' ? undefined : next.preset,
        capability:
          next.capability === CAPABILITY_POSTURE_ROWS[0]?.id ? undefined : next.capability,
      },
      replace: true,
    });
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Capability Posture"
        description="Set and inspect default Execution Tier, role, and evidence posture by capability before writing bespoke rules."
        icon={<SlidersHorizontal className="h-5 w-5 text-primary" aria-hidden="true" />}
        breadcrumb={[
          { label: 'Policies', to: '/config/policies' },
          { label: 'Capability Posture' },
        ]}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/config/policies">Open Policy Studio</Link>
          </Button>
        }
      />

      <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
        This route previews posture changes only. Publishing and activation still belong to the
        policy lifecycle contract; no default is mutated from this matrix.
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {Object.entries(summary).map(([tier, count]) => (
          <StatTile
            key={tier}
            label={tierSummaryLabel(tier)}
            value={count}
            note="effective capability defaults"
          />
        ))}
        <StatTile label="Exceptions" value={exceptionTotal} note="visible row-level overrides" />
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListFilter className="h-4 w-4 text-primary" />
            Presets
          </CardTitle>
          <CardDescription>
            Preview a default posture doctrine before inspecting row-level exceptions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PresetSelector
            presetId={presetId}
            onSelect={(nextPresetId) =>
              writeSearch({ preset: nextPresetId, capability: selectedRow.id })
            }
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.85fr)]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Default posture matrix</CardTitle>
            <CardDescription>
              Rows show inherited defaults, preset effects, and visible exception overrides.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Capability</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Inherits</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Exceptions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {effectiveRows.map(({ row, effective }) => (
                  <CapabilityRowButton
                    key={row.id}
                    row={row}
                    effective={effective}
                    selected={row.id === selectedRow.id}
                    onSelect={() => writeSearch({ preset: presetId, capability: row.id })}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <EffectivePostureInspector effective={selectedEffective} />
      </div>
    </div>
  );
}
