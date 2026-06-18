import type {
  ApprovalPacket,
  ApprovalPacketArtifactRef,
  EvidenceEntry,
  EvidencePayloadRef,
} from '@portarium/cockpit-types';
import { formatDistanceToNow } from 'date-fns';
import { Camera, ExternalLink, ImageOff, LockKeyhole, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type VisualEvidenceItem = {
  entry: EvidenceEntry;
  ref: EvidencePayloadRef;
  index: number;
};

type TimelineVariant = 'compact' | 'detail';

export interface VisualEvidenceTimelineProps {
  evidenceEntries: readonly EvidenceEntry[];
  approvalPacket?: ApprovalPacket;
  maxItems?: number;
  variant?: TimelineVariant;
  className?: string;
}

function displayPolicyAllowsMedia(displayPolicy: string | null | undefined): boolean {
  return !/^metadata-only$/i.test(String(displayPolicy ?? '').trim());
}

function isBlockedProviderUrl(value: string): boolean {
  try {
    const url = new URL(value, 'http://localhost');
    const host = url.hostname.toLowerCase();
    if (/\/visual-evidence\//i.test(url.pathname) && !/browser-use|provider/i.test(host)) {
      return false;
    }
    return /browser-use|screenshoturl|provider/i.test(`${url.hostname}${url.pathname}`);
  } catch {
    return /browser-use|screenshoturl|provider/i.test(value);
  }
}

function isRenderableUrl(
  value: string | null | undefined,
  displayPolicy?: string | null,
): value is string {
  if (!value || !displayPolicyAllowsMedia(displayPolicy)) return false;
  if (/^(data:image\/|blob:)/i.test(value)) return true;
  if (/^https?:/i.test(value)) {
    return /\/visual-evidence\//i.test(value) && !isBlockedProviderUrl(value);
  }
  return false;
}

function isVisualEvidencePlanContentType(contentType: string): boolean {
  return /^application\/vnd\.portarium\.visual-evidence-plan\+json$/i.test(contentType.trim());
}

function isVisualEvidenceRef(ref: EvidencePayloadRef): boolean {
  const contentType = ref.contentType ?? '';
  return (
    (ref.kind === 'Snapshot' ||
      isVisualEvidencePlanContentType(contentType) ||
      Boolean(ref.thumbnailUrl || ref.thumbnailUri || ref.fullUrl || ref.fullUri)) &&
    (contentType.startsWith('image/') ||
      isVisualEvidencePlanContentType(contentType) ||
      Boolean(ref.thumbnailUrl || ref.thumbnailUri || ref.fullUrl || ref.fullUri) ||
      ref.uri.startsWith('visual-evidence://'))
  );
}

function artifactVisualRef(artifact: ApprovalPacketArtifactRef): EvidencePayloadRef | null {
  const contentType = artifact.mimeType;
  const visualish =
    artifact.role === 'decision-evidence' ||
    contentType.startsWith('image/') ||
    Boolean(
      artifact.thumbnailUrl ||
        artifact.thumbnailUri ||
        artifact.fullUrl ||
        artifact.fullUri ||
        artifact.uri?.startsWith('visual-evidence://'),
    );
  if (!visualish) return null;

  return {
    kind: artifact.evidenceKind ?? 'Snapshot',
    uri:
      artifact.fullUri ??
      artifact.thumbnailUri ??
      artifact.uri ??
      `approval-packet://${artifact.artifactId}`,
    contentType,
    sha256: artifact.sha256,
    artifactId: artifact.artifactId,
    thumbnailUri: artifact.thumbnailUri,
    fullUri: artifact.fullUri,
    thumbnailUrl: artifact.thumbnailUrl,
    fullUrl: artifact.fullUrl,
    sourceFamily: artifact.sourceFamily,
    sourceId: artifact.sourceId,
    dataClass: artifact.dataClass,
    retention: artifact.retention,
    displayPolicy: artifact.displayPolicy,
    caption: artifact.caption ?? artifact.title,
    capturedAtIso: artifact.capturedAtIso,
    capturedAtUtc: artifact.capturedAtUtc,
    runId: artifact.runId,
    approvalId: artifact.approvalId,
    messageId: artifact.messageId,
    correlationId: artifact.correlationId,
  };
}

function packetVisualEvidenceEntries(packet: ApprovalPacket | undefined): EvidenceEntry[] {
  if (!packet) return [];
  const byId = new Map<string, ApprovalPacketArtifactRef>();
  for (const artifact of [...(packet.visualEvidenceTimeline ?? []), ...packet.artifacts]) {
    const ref = artifactVisualRef(artifact);
    if (!ref) continue;
    byId.set(artifact.artifactId, artifact);
  }

  return [...byId.values()].map((artifact) => {
    const ref = artifactVisualRef(artifact)!;
    const occurredAtIso =
      ref.capturedAtIso ?? ref.capturedAtUtc ?? new Date(0).toISOString();
    return {
      schemaVersion: 1,
      evidenceId: `approval-packet-${packet.packetId}-${artifact.artifactId}`,
      workspaceId: 'approval-packet',
      occurredAtIso,
      category: 'Approval',
      summary: artifact.caption ?? artifact.title,
      actor: { kind: 'System' },
      hashSha256: artifact.sha256 ?? '',
      payloadRefs: [ref],
    };
  });
}

function visualEvidenceItems(entries: readonly EvidenceEntry[]): VisualEvidenceItem[] {
  const items: VisualEvidenceItem[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    for (const [index, ref] of (entry.payloadRefs ?? []).entries()) {
      if (!isVisualEvidenceRef(ref)) continue;
      const key = ref.artifactId ?? ref.uri;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ entry, ref, index });
    }
  }
  return items;
}

function displayTime(item: VisualEvidenceItem): string {
  const iso = item.ref.capturedAtIso ?? item.ref.capturedAtUtc ?? item.entry.occurredAtIso;
  if (isVisualEvidencePlanContentType(item.ref.contentType ?? '') && iso === new Date(0).toISOString()) {
    return 'awaiting approved capture';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return 'time unknown';
  return formatDistanceToNow(date, { addSuffix: true });
}

function filename(uri: string): string {
  return uri.split('/').pop() ?? uri;
}

function visualTitle(item: VisualEvidenceItem): string {
  return item.ref.caption?.trim() || item.entry.summary || filename(item.ref.uri);
}

function shortHash(value: string | undefined): string | undefined {
  return value ? `${value.slice(0, 12)}...` : undefined;
}

function VisualEvidenceCard({ item, variant }: { item: VisualEvidenceItem; variant: TimelineVariant }) {
  const { ref, entry } = item;
  const plannedVisualEvidence = isVisualEvidencePlanContentType(ref.contentType ?? '');
  const thumbnailSrc = isRenderableUrl(ref.thumbnailUrl, ref.displayPolicy)
    ? ref.thumbnailUrl
    : isRenderableUrl(ref.thumbnailUri, ref.displayPolicy)
      ? ref.thumbnailUri
      : undefined;
  const openUrl = isRenderableUrl(ref.fullUrl, ref.displayPolicy)
    ? ref.fullUrl
    : isRenderableUrl(ref.fullUri, ref.displayPolicy)
      ? ref.fullUri
      : isRenderableUrl(ref.thumbnailUrl, ref.displayPolicy)
        ? ref.thumbnailUrl
        : undefined;
  const metadataOnly = !thumbnailSrc && !openUrl;
  const title = visualTitle(item);
  const detail = variant === 'detail';
  const dataClass = ref.dataClass ?? 'unclassified';
  const sensitive = /private|restricted|sensitive|finance|secret/i.test(dataClass);

  return (
    <article
      className={cn(
        'min-w-0 overflow-hidden rounded-md border border-border bg-background',
        detail ? 'grid gap-0 sm:grid-cols-[minmax(9rem,14rem)_1fr]' : 'h-full',
      )}
    >
      <div
        className={cn(
          'relative flex items-center justify-center bg-muted/40',
          detail ? 'aspect-[4/3] sm:h-full sm:min-h-32' : 'aspect-video',
        )}
      >
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            {plannedVisualEvidence ? (
              <Camera className="h-5 w-5" aria-hidden="true" />
            ) : metadataOnly ? (
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            ) : (
              <ImageOff className="h-5 w-5" aria-hidden="true" />
            )}
            <span className="max-w-[9rem] truncate px-2 text-[10px] font-medium">
              {plannedVisualEvidence
                ? 'Screenshot pending'
                : metadataOnly
                  ? 'Metadata only'
                  : 'Preview unavailable'}
            </span>
          </div>
        )}
        <Badge
          variant={sensitive ? 'destructive' : 'secondary'}
          className="absolute left-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate text-[9px]"
        >
          {dataClass}
        </Badge>
      </div>

      <div className={cn('min-w-0 space-y-2 p-2.5', detail && 'p-3')}>
        <div className="flex min-w-0 items-start gap-2">
          <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground" title={title}>
              {title}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{displayTime(item)}</p>
            {plannedVisualEvidence ? (
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                Image appears after approved execution stores a renderable artifact.
              </p>
            ) : null}
          </div>
        </div>

        {detail ? (
          <div className="flex flex-wrap gap-1.5">
            {ref.sourceFamily && (
              <Badge variant="outline" className="max-w-full truncate text-[10px]">
                {ref.sourceFamily}
              </Badge>
            )}
            {ref.displayPolicy && (
              <Badge variant="outline" className="max-w-full truncate text-[10px]">
                {ref.displayPolicy}
              </Badge>
            )}
            {ref.artifactId && (
              <Badge variant="secondary" className="max-w-full truncate font-mono text-[10px]">
                {ref.artifactId}
              </Badge>
            )}
          </div>
        ) : null}

        <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
          {sensitive ? <ShieldAlert className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
          <span className="truncate">
            {shortHash(ref.sha256) ?? ref.sourceFamily ?? entry.evidenceId}
          </span>
          {openUrl ? (
            <a
              href={openUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              Open evidence
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function VisualEvidenceTimeline({
  evidenceEntries,
  approvalPacket,
  maxItems,
  variant = 'detail',
  className,
}: VisualEvidenceTimelineProps) {
  const items = visualEvidenceItems([
    ...packetVisualEvidenceEntries(approvalPacket),
    ...evidenceEntries,
  ]);
  if (items.length === 0) return null;

  const displayed = items.slice(0, maxItems ?? (variant === 'compact' ? 3 : items.length));
  const hiddenCount = Math.max(0, items.length - displayed.length);

  return (
    <section className={cn('space-y-2', className)} data-visual-evidence-timeline>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Camera className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <h3 className="truncate text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Visual evidence
          </h3>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {items.length} item{items.length === 1 ? '' : 's'}
        </Badge>
      </div>
      <div
        className={cn(
          'grid gap-2',
          variant === 'compact'
            ? 'grid-cols-1 sm:grid-cols-3'
            : 'grid-cols-1 lg:grid-cols-2',
        )}
      >
        {displayed.map((item) => (
          <VisualEvidenceCard
            key={`${item.entry.evidenceId}-${item.index}-${item.ref.artifactId ?? item.ref.uri}`}
            item={item}
            variant={variant}
          />
        ))}
      </div>
      {hiddenCount > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          +{hiddenCount} more visual evidence item{hiddenCount === 1 ? '' : 's'} in the full
          evidence view.
        </p>
      ) : null}
    </section>
  );
}
