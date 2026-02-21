import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChainIntegrityBanner } from '@/components/cockpit/chain-integrity-banner';
import { EvidenceCategoryBadge } from '@/components/cockpit/evidence-category-badge';
import {
  CheckCircle2,
  XCircle,
  Link2,
  FileText,
  Camera,
  GitBranch,
  ScrollText,
  ShieldOff,
  Video,
  Music,
  FileDown,
  Image as ImageIcon,
} from 'lucide-react';
import { formatDistanceToNow, formatDistanceStrict } from 'date-fns';
import type { EvidenceEntry, EvidencePayloadRef } from '@portarium/cockpit-types';
import type { TriageModeProps } from './index';
import { verifyChain, type ChainEntry } from './lib/chain-verification';

function actorLabel(actor: EvidenceEntry['actor']): string {
  switch (actor.kind) {
    case 'User':
      return actor.userId;
    case 'Machine':
      return actor.machineId;
    case 'Adapter':
      return actor.adapterId;
    case 'System':
      return 'System';
  }
}

const PAYLOAD_ICONS: Record<string, typeof FileText> = {
  Artifact: FileText,
  Snapshot: Camera,
  Diff: GitBranch,
  Log: ScrollText,
};

function getMediaIcon(ref: EvidencePayloadRef) {
  const ct = ref.contentType ?? '';
  if (ct.startsWith('image/')) return ImageIcon;
  if (ct.startsWith('video/')) return Video;
  if (ct.startsWith('audio/')) return Music;
  if (ct === 'application/pdf') return FileText;
  if (ct === 'text/x-diff') return GitBranch;
  if (ct.startsWith('text/')) return ScrollText;
  return PAYLOAD_ICONS[ref.kind] ?? FileDown;
}

function getMediaLabel(ref: EvidencePayloadRef): string {
  const ct = ref.contentType ?? '';
  if (ct.startsWith('image/')) return 'Image';
  if (ct.startsWith('video/')) return 'Video';
  if (ct.startsWith('audio/')) return 'Audio';
  if (ct === 'application/pdf') return 'PDF';
  if (ct === 'text/x-diff') return 'Diff';
  if (ct.startsWith('text/')) return 'Log';
  return ref.kind;
}

function getMediaColor(ref: EvidencePayloadRef): string {
  const ct = ref.contentType ?? '';
  if (ct.startsWith('image/')) return 'bg-violet-100 text-violet-700 border-violet-200';
  if (ct.startsWith('video/')) return 'bg-rose-100 text-rose-700 border-rose-200';
  if (ct.startsWith('audio/')) return 'bg-amber-100 text-amber-700 border-amber-200';
  if (ct === 'application/pdf') return 'bg-red-100 text-red-700 border-red-200';
  if (ct === 'text/x-diff') return 'bg-blue-100 text-blue-700 border-blue-200';
  return 'bg-muted text-muted-foreground border-border';
}

function filename(uri: string): string {
  return uri.split('/').pop() ?? uri;
}

function PayloadAttachments({ refs }: { refs: EvidencePayloadRef[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {refs.map((ref, i) => {
        const Icon = getMediaIcon(ref);
        const label = getMediaLabel(ref);
        const color = getMediaColor(ref);
        const name = filename(ref.uri);

        return (
          <span
            key={i}
            className={cn(
              'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium cursor-default',
              color,
            )}
            title={`${label}: ${name}\nType: ${ref.contentType ?? 'unknown'}`}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[100px]">{name}</span>
          </span>
        );
      })}
    </div>
  );
}

interface AdequacyResult {
  score: number;
  label: 'Adequate' | 'Partial' | 'Insufficient';
  color: string;
  entryCount: number;
  actorCount: number;
  categoryCount: number;
  attachmentCount: number;
}

function computeAdequacy(entries: EvidenceEntry[]): AdequacyResult {
  const entryCount = entries.length;
  const actorSet = new Set(entries.map((e) => actorLabel(e.actor)));
  const actorCount = actorSet.size;
  const categories = new Set(entries.map((e) => e.category));
  const categoryCount = categories.size;
  const attachmentCount = entries.reduce((sum, e) => sum + (e.payloadRefs?.length ?? 0), 0);

  let score = 0;
  if (entryCount >= 3) score += 25;
  score += Math.min(25, (categoryCount / 5) * 25);
  if (actorCount >= 2) score += 25;
  if (attachmentCount >= 1) score += 25;
  score = Math.round(score);

  const label: AdequacyResult['label'] =
    score >= 75 ? 'Adequate' : score >= 40 ? 'Partial' : 'Insufficient';
  const color = score >= 75 ? 'text-emerald-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600';

  return { score, label, color, entryCount, actorCount, categoryCount, attachmentCount };
}

function EvidenceAdequacy({ entries }: { entries: EvidenceEntry[] }) {
  const adeq = computeAdequacy(entries);
  const barColor =
    adeq.score >= 75 ? 'bg-emerald-500' : adeq.score >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Evidence Adequacy
        </span>
        <span className={cn('text-xs font-bold', adeq.color)}>
          {adeq.label} ({adeq.score}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${adeq.score}%` }}
        />
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
        <span className="inline-flex items-center gap-0.5">
          {adeq.entryCount >= 3 ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          ) : (
            <XCircle className="h-3 w-3 text-red-500" />
          )}
          Entries {adeq.entryCount}/3
        </span>
        <span className="inline-flex items-center gap-0.5">
          {adeq.categoryCount >= 5 ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          ) : (
            <XCircle className="h-3 w-3 text-red-500" />
          )}
          Categories {adeq.categoryCount}/5
        </span>
        <span className="inline-flex items-center gap-0.5">
          {adeq.actorCount >= 2 ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          ) : (
            <XCircle className="h-3 w-3 text-red-500" />
          )}
          Actors {adeq.actorCount}/2
        </span>
        <span className="inline-flex items-center gap-0.5">
          {adeq.attachmentCount >= 1 ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          ) : (
            <XCircle className="h-3 w-3 text-red-500" />
          )}
          Attachments {adeq.attachmentCount}/1
        </span>
      </div>
    </div>
  );
}

function EvidenceBlock({
  item,
  index,
  requestedAtIso,
  runId,
}: {
  item: ChainEntry<EvidenceEntry>;
  index: number;
  requestedAtIso?: string;
  runId?: string;
}) {
  const { entry, chainValid } = item;
  const hasPayloads = entry.payloadRefs && entry.payloadRefs.length > 0;

  return (
    <div className="relative">
      {/* Chain link to previous */}
      {index > 0 && (
        <div className="flex items-center justify-center h-6 -mt-1 -mb-1">
          {chainValid === true ? (
            <div className="flex items-center gap-1">
              <div className="w-0.5 h-4 bg-emerald-400" />
              <CheckCircle2
                className="h-3.5 w-3.5 text-emerald-500"
                aria-label="Chain link valid"
              />
              <div className="w-0.5 h-4 bg-emerald-400" />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <div className="w-0.5 h-4 bg-red-400" />
              <XCircle className="h-3.5 w-3.5 text-red-500" aria-label="Chain link broken" />
              <div className="w-0.5 h-4 bg-red-400" />
            </div>
          )}
        </div>
      )}

      {/* Block card */}
      <div
        className={cn(
          'rounded-lg border bg-card px-3.5 py-2.5 space-y-1.5',
          chainValid === false ? 'border-red-300' : 'border-border',
        )}
      >
        <div className="flex items-center gap-2">
          <EvidenceCategoryBadge category={entry.category} />
          <span className="text-[11px] text-muted-foreground flex-1 truncate">
            {actorLabel(entry.actor)}
          </span>
          {entry.links?.runId && runId && entry.links.runId === runId && (
            <span className="text-[9px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0">
              This run
            </span>
          )}
          <span className="text-[10px] text-muted-foreground shrink-0">
            {requestedAtIso
              ? (() => {
                  const occurred = new Date(entry.occurredAtIso);
                  const requested = new Date(requestedAtIso);
                  const isBefore = occurred < requested;
                  const distance = formatDistanceStrict(
                    isBefore ? occurred : requested,
                    isBefore ? requested : occurred,
                  );
                  return `${distance} ${isBefore ? 'before request' : 'after request'}`;
                })()
              : formatDistanceToNow(new Date(entry.occurredAtIso), { addSuffix: true })}
          </span>
        </div>

        <p className="text-xs text-foreground">{entry.summary}</p>

        {/* Payload attachments — shown prominently when present */}
        {hasPayloads && <PayloadAttachments refs={entry.payloadRefs!} />}

        <div className="flex items-center gap-2">
          <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
          <code
            className="text-[10px] font-mono text-muted-foreground truncate cursor-help"
            title={entry.hashSha256}
          >
            {entry.hashSha256.slice(0, 16)}...
          </code>
          {hasPayloads && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              {entry.payloadRefs!.length} attachment{entry.payloadRefs!.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function EvidenceChainMode({
  approval,
  plannedEffects,
  evidenceEntries = [],
}: TriageModeProps) {
  const chain = useMemo(() => verifyChain(evidenceEntries), [evidenceEntries]);

  const chainStatus = useMemo<'verified' | 'broken' | 'pending'>(() => {
    if (chain.length === 0) return 'pending';
    const hasBroken = chain.some((c) => c.chainValid === false);
    return hasBroken ? 'broken' : 'verified';
  }, [chain]);

  const actorCount = useMemo(
    () => new Set(evidenceEntries.map((e) => actorLabel(e.actor))).size,
    [evidenceEntries],
  );

  const attachmentCount = useMemo(
    () => evidenceEntries.reduce((sum, e) => sum + (e.payloadRefs?.length ?? 0), 0),
    [evidenceEntries],
  );

  if (evidenceEntries.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/10 px-4 py-8 flex flex-col items-center gap-2 text-center">
        <ShieldOff className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-xs font-medium text-muted-foreground">No evidence collected yet</p>
        <p className="text-[11px] text-muted-foreground/70 max-w-[260px] sm:max-w-xs">
          Evidence entries are recorded as actions occur — approvals, artifact uploads, and system
          checks will appear here as a tamper-proof chain.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ChainIntegrityBanner status={chainStatus} />

      <EvidenceAdequacy entries={evidenceEntries} />

      <div className="max-h-[240px] sm:max-h-[320px] overflow-y-auto space-y-0 pr-1">
        {chain.map((item, i) => (
          <EvidenceBlock
            key={item.entry.evidenceId}
            item={item}
            index={i}
            requestedAtIso={approval.requestedAtIso}
            runId={approval.runId}
          />
        ))}
      </div>

      <div className="text-[11px] text-muted-foreground text-center">
        {evidenceEntries.length} entries · chain {chainStatus} · {actorCount} actor
        {actorCount !== 1 ? 's' : ''}
        {attachmentCount > 0 &&
          ` · ${attachmentCount} attachment${attachmentCount !== 1 ? 's' : ''}`}
      </div>
    </div>
  );
}
