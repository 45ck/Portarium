import type { ExternalObjectRef } from '@portarium/cockpit-types';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';

interface SorRefPillProps {
  externalRef: ExternalObjectRef;
}

export function SorRefPill({ externalRef }: SorRefPillProps) {
  const content = (
    <Badge variant="outline" className="text-[11px] gap-1">
      <span className="font-medium">{externalRef.sorName}</span>
      {externalRef.displayLabel && (
        <span className="text-muted-foreground">{externalRef.displayLabel}</span>
      )}
      {externalRef.deepLinkUrl && <ExternalLink className="h-2.5 w-2.5" />}
    </Badge>
  );

  const safeUrl =
    externalRef.deepLinkUrl && /^https?:\/\//.test(externalRef.deepLinkUrl)
      ? externalRef.deepLinkUrl
      : undefined;

  if (safeUrl) {
    return (
      <a href={safeUrl} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return content;
}
