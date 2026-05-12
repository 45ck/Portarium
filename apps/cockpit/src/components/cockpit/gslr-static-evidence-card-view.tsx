import { AlertTriangle, FileCheck2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EngineeringEvidenceCardCockpitExportV1 } from '@portarium/domain-evidence';

export type GslrStaticTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface GslrStaticEvidenceBadge {
  label: string;
  value: string;
  tone: GslrStaticTone;
}

export interface GslrStaticEvidenceRow {
  label: string;
  value: string | number;
  tone: GslrStaticTone;
  detail?: string;
}

export interface GslrStaticArtifactRef {
  label: string;
  path: string;
}

export interface GslrStaticEvidenceCardExport {
  contentType: string;
  routeHint: string;
  source: {
    system: string;
    area: string;
    manifestSchemaVersion: string | number | boolean | null;
  };
  title: string;
  subtitle: string;
  actionStatus: 'research-only' | 'blocked';
  operatorDecision: string;
  routeBadge: GslrStaticEvidenceBadge;
  modelBadge: GslrStaticEvidenceBadge;
  actionBadge: GslrStaticEvidenceBadge;
  metricRows: readonly GslrStaticEvidenceRow[];
  gateRows: readonly GslrStaticEvidenceRow[];
  artifactRefs: readonly GslrStaticArtifactRef[];
  boundaryWarnings: readonly string[];
}

interface GslrStaticEvidenceCardViewProps {
  cards: readonly GslrStaticEvidenceCardExport[];
  introTitle?: string;
  introDescription?: string;
}

function badgeVariant(tone: GslrStaticTone) {
  switch (tone) {
    case 'success':
      return 'success' as const;
    case 'warning':
      return 'warning' as const;
    case 'danger':
      return 'destructive' as const;
    case 'info':
      return 'info' as const;
    case 'neutral':
      return 'outline' as const;
  }
}

function renderBadge(badge: GslrStaticEvidenceBadge) {
  return (
    <Badge key={`${badge.label}:${badge.value}`} variant={badgeVariant(badge.tone)}>
      {badge.label}: {badge.value}
    </Badge>
  );
}

function EvidenceRows({ title, rows }: { title: string; rows: readonly GslrStaticEvidenceRow[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-md border bg-background px-3 py-2 text-sm">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2 font-medium">
              <span>{row.value}</span>
              <Badge variant={badgeVariant(row.tone)}>{row.tone}</Badge>
            </dd>
            {row.detail ? <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

function ArtifactRefs({ refs }: { refs: readonly GslrStaticArtifactRef[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">Artifact references</h3>
      <ul className="grid gap-2 text-sm">
        {refs.map((ref) => (
          <li
            key={`${ref.label}:${ref.path}`}
            className="rounded-md border bg-background px-3 py-2"
          >
            <span className="font-medium">{ref.label}</span>
            <span className="block break-all text-xs text-muted-foreground">{ref.path}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BoundaryWarnings({ warnings }: { warnings: readonly string[] }) {
  return (
    <Alert variant="warning">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>Static R&D boundary</AlertTitle>
      <AlertDescription>
        <ul className="grid gap-1">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function EvidenceCard({ card }: { card: GslrStaticEvidenceCardExport }) {
  return (
    <Card className="gap-4">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCheck2 className="h-4 w-4" aria-hidden="true" />
              {card.title}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{card.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {[card.routeBadge, card.modelBadge, card.actionBadge].map(renderBadge)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-md border bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">Content type</div>
            <div className="mt-1 break-all font-medium">{card.contentType}</div>
          </div>
          <div className="rounded-md border bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">Route hint</div>
            <div className="mt-1 break-all font-medium">{card.routeHint}</div>
          </div>
          <div className="rounded-md border bg-background px-3 py-2">
            <div className="text-xs text-muted-foreground">Operator decision</div>
            <div className="mt-1 font-medium">{card.operatorDecision}</div>
          </div>
        </div>
        <EvidenceRows title="Metrics" rows={card.metricRows} />
        <EvidenceRows title="Gates" rows={card.gateRows} />
        <ArtifactRefs refs={card.artifactRefs} />
        <BoundaryWarnings warnings={card.boundaryWarnings} />
      </CardContent>
    </Card>
  );
}

export function toGslrStaticEvidenceCardExport(
  card: EngineeringEvidenceCardCockpitExportV1,
): GslrStaticEvidenceCardExport {
  return {
    contentType: card.contentType,
    routeHint: card.routeHint,
    source: card.source,
    title: card.title,
    subtitle: card.subtitle,
    actionStatus: card.actionStatus,
    operatorDecision: card.operatorDecision,
    routeBadge: card.routeBadge,
    modelBadge: card.modelBadge,
    actionBadge: card.actionBadge,
    metricRows: card.metricRows.map((row) => ({
      label: row.label,
      value: formatMetricValue(row.value, row.unit),
      tone: row.tone,
    })),
    gateRows: card.gateRows.map((row) => ({
      label: row.label,
      value: row.value,
      tone: row.tone,
      ...(row.details.length > 0 ? { detail: row.details.join('; ') } : {}),
    })),
    artifactRefs: card.artifactRefs.map((ref) => ({
      label: ref.label,
      path: ref.ref ?? 'not supplied',
    })),
    boundaryWarnings: card.boundaryWarnings,
  };
}

function formatMetricValue(value: number, unit: string) {
  if (unit === 'usd') return `$${value.toFixed(2)}`;
  if (unit === 'seconds') return `${value.toFixed(3)}s`;
  return value;
}

export function GslrStaticEvidenceCardView({
  cards,
  introTitle = 'Fixture-backed Cockpit proof',
  introDescription = 'These cards are checked-in static exports only. They prove the operator-facing shape for GSLR evidence without live prompt-language ingestion, Cockpit queues, runtime actions, or MacquarieCollege connector access.',
}: GslrStaticEvidenceCardViewProps) {
  return (
    <div className="space-y-4">
      <Alert variant="info">
        <ShieldCheck aria-hidden="true" />
        <AlertTitle>{introTitle}</AlertTitle>
        <AlertDescription>{introDescription}</AlertDescription>
      </Alert>
      <div className="grid gap-4">
        {cards.map((card) => (
          <EvidenceCard key={card.title} card={card} />
        ))}
      </div>
    </div>
  );
}
