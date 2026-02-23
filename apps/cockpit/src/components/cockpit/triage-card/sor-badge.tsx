import { cn } from '@/lib/utils';
import { resolveSorPalette } from '@/components/cockpit/triage-modes/lib/sor-palette';

export function SorBadge({ name }: { name: string }) {
  const palette = resolveSorPalette(name);
  const abbr = name.slice(0, 2);
  return (
    <span
      title={name}
      className={cn(
        'inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold shrink-0',
        palette.bg,
        palette.text,
      )}
    >
      {abbr}
    </span>
  );
}
