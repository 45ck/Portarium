import { useEffect, useMemo, useRef, useState } from 'react';
import type { DiffHunk, EvidenceEntry, RunSummary, SodEvaluation } from '@portarium/cockpit-types';
import { AlertTriangle, CheckCircle2, GitPullRequest, RotateCcw, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { SodBanner, DEFAULT_SOD_EVALUATION } from '@/components/cockpit/sod-banner';
import { EvidenceTimeline } from '@/components/cockpit/evidence-timeline';
import { cn } from '@/lib/utils';

export interface DiffApprovalSurfaceProps {
  beadId: string;
  approvalId: string;
  policyTier: RunSummary['executionTier'];
  policyRationale: string;
  blastRadius: string;
  isIrreversible: boolean;
  hunks: DiffHunk[];
  recentEvidence: EvidenceEntry[];
  sodEvaluation?: SodEvaluation;
  onDecide: (
    decision: 'Approved' | 'Denied' | 'RequestChanges',
    rationale: string,
  ) => Promise<void> | void;
  loading?: boolean;
}

function linePrefix(op: DiffHunk['lines'][number]['op']): string {
  if (op === 'add') return '+';
  if (op === 'remove') return '-';
  return ' ';
}

function lineClass(op: DiffHunk['lines'][number]['op']): string {
  if (op === 'add') return 'bg-green-500/10 text-green-700 dark:text-green-300';
  if (op === 'remove') return 'bg-red-500/10 text-red-700 dark:text-red-300';
  return 'text-muted-foreground';
}

function countLines(hunks: DiffHunk[]) {
  return hunks.reduce(
    (acc, hunk) => {
      for (const line of hunk.lines) {
        if (line.op === 'add') acc.additions += 1;
        if (line.op === 'remove') acc.deletions += 1;
      }
      return acc;
    },
    { additions: 0, deletions: 0 },
  );
}

export function DiffApprovalSurface({
  beadId,
  approvalId,
  policyTier,
  policyRationale,
  blastRadius,
  isIrreversible,
  hunks,
  recentEvidence,
  sodEvaluation = DEFAULT_SOD_EVALUATION,
  onDecide,
  loading,
}: DiffApprovalSurfaceProps) {
  const [hasReadAll, setHasReadAll] = useState(false);
  const [rationale, setRationale] = useState('');
  const [attempted, setAttempted] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { additions, deletions } = useMemo(() => countLines(hunks), [hunks]);
  const rationaleReady = rationale.trim().length >= 10;
  const canDecide = hasReadAll && rationaleReady && !loading;

  useEffect(() => {
    setHasReadAll(false);
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    if (typeof IntersectionObserver === 'undefined') {
      setHasReadAll(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setHasReadAll(true);
      },
      { threshold: 0.8 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hunks]);

  async function decide(decision: 'Approved' | 'Denied' | 'RequestChanges') {
    setAttempted(true);
    if (!canDecide) return;
    await onDecide(decision, rationale.trim());
  }

  return (
    <div className="min-h-screen bg-background" data-testid="diff-approval-surface">
      <header className="border-b bg-card/70 px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[11px]">
                {beadId}
              </Badge>
              <Badge variant="secondary" className="text-[11px]">
                {policyTier}
              </Badge>
              <Badge variant={isIrreversible ? 'destructive' : 'outline'} className="text-[11px]">
                {isIrreversible ? 'Irreversible' : 'Reversible'}
              </Badge>
            </div>
            <h1 className="text-xl font-semibold leading-tight md:text-2xl">
              Review proposed changes
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">{policyRationale}</p>
          </div>
          <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Approval {approvalId}</div>
            <div>
              {additions} additions · {deletions} deletions · {blastRadius}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_340px] md:px-6">
        <section className="min-w-0 rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <GitPullRequest className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Diff</h2>
            </div>
            <Progress value={hasReadAll ? 100 : 35} className="h-2 w-28" />
          </div>

          <div className="max-h-[62vh] overflow-y-auto">
            {hunks.map((hunk) => (
              <article key={hunk.hunkId} className="border-b last:border-b-0">
                <div className="flex flex-wrap items-center gap-2 bg-muted/40 px-4 py-2 text-xs">
                  <span className="font-mono font-semibold">{hunk.filePath}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {hunk.changeType}
                  </Badge>
                  <span className="text-muted-foreground">
                    -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount}
                  </span>
                </div>
                <pre className="overflow-x-auto text-xs leading-5">
                  {hunk.lines.map((line, index) => (
                    <div
                      key={`${hunk.hunkId}-${index}`}
                      className={cn(
                        'grid grid-cols-[44px_44px_24px_minmax(0,1fr)] px-3',
                        lineClass(line.op),
                      )}
                    >
                      <span className="select-none text-right text-muted-foreground">
                        {line.oldLineNumber ?? ''}
                      </span>
                      <span className="select-none text-right text-muted-foreground">
                        {line.newLineNumber ?? ''}
                      </span>
                      <span className="select-none text-center">{linePrefix(line.op)}</span>
                      <code className="whitespace-pre-wrap break-words">{line.content}</code>
                    </div>
                  ))}
                </pre>
              </article>
            ))}
            <div ref={sentinelRef} className="h-8" aria-label="End of diff" />
          </div>
        </section>

        <aside className="space-y-4">
          <SodBanner eval={sodEvaluation} />

          <section className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
              <div>
                <h2 className="text-sm font-semibold">Decision Gate</h2>
                <p className="text-xs text-muted-foreground">
                  Read the full diff and add a rationale before deciding.
                </p>
              </div>
            </div>
            <Textarea
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              placeholder="Decision rationale..."
              className="min-h-24 text-sm"
            />
            {attempted && !hasReadAll && (
              <p role="alert" className="mt-2 text-xs font-medium text-amber-700">
                Scroll to the end of the diff first.
              </p>
            )}
            {attempted && hasReadAll && !rationaleReady && (
              <p role="alert" className="mt-2 text-xs font-medium text-amber-700">
                Rationale must be at least 10 characters.
              </p>
            )}
            <div className="mt-3 grid grid-cols-1 gap-2">
              <Button onClick={() => void decide('Approved')} disabled={!canDecide}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => void decide('RequestChanges')}
                disabled={!canDecide}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Request Changes
              </Button>
              <Button
                variant="destructive"
                onClick={() => void decide('Denied')}
                disabled={!canDecide}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Deny
              </Button>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">Recent Evidence</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Last 3 entries linked to this review.
            </p>
            <Separator className="mb-3" />
            <EvidenceTimeline entries={recentEvidence.slice(0, 3)} />
          </section>
        </aside>
      </main>
    </div>
  );
}
