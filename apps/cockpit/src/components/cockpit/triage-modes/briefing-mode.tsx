import { useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { TriageModeProps } from './index';
import { generateBriefing, type BriefingSection } from './lib/briefing-templates';

function RiskContent({ content }: { content: string }) {
  const match = content.match(/^(Risk level:\s*\w+)(\.?\s*)(.*)/s);
  if (!match) return <>{content}</>;
  return (
    <>
      <strong className="text-red-600">{match[1]}</strong>
      {match[2]}
      {match[3]}
    </>
  );
}

function BriefingSectionCard({ section }: { section: BriefingSection }) {
  const isRecommendation = section.id === 'recommendation';
  return (
    <div className={cn('flex gap-3', isRecommendation && 'bg-primary/5 rounded-md px-3 py-2')}>
      <div className="flex flex-col items-center pt-1.5">
        <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', section.dotColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          {section.label}
        </p>
        <p
          className={cn(
            'text-xs leading-relaxed text-foreground',
            isRecommendation && 'font-medium',
          )}
        >
          {section.id === 'risk' ? <RiskContent content={section.content} /> : section.content}
        </p>
      </div>
    </div>
  );
}

export function BriefingMode({
  approval,
  plannedEffects,
  evidenceEntries,
  run,
  workflow,
}: TriageModeProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const sections = useMemo(
    () => generateBriefing(approval, plannedEffects, evidenceEntries, run, workflow),
    [approval, plannedEffects, evidenceEntries, run, workflow],
  );

  const handleCopy = useCallback(() => {
    const text = sections.map((s) => `[${s.label}]\n${s.content}`).join('\n\n');
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        setCopyFailed(true);
        setTimeout(() => setCopyFailed(false), 2000);
      });
  }, [sections]);

  return (
    <div className="rounded-lg border-l-4 border-l-primary border border-border bg-muted/10 px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Approval Briefing
        </p>
        <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copyFailed ? 'Copy failed' : copied ? 'Copied' : 'Copy briefing'}
        </Button>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <BriefingSectionCard key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}
