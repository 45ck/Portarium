import type { CSSProperties } from 'react';
import { EntityIcon } from '@/components/domain/entity-icon';
import { getEntityImage, resolveAssetPath } from '@/assets/registry';
import type { CockpitAssetTheme, DomainEntityType } from '@/assets/types';

type EntityImageVariant = 'card' | 'detail' | 'thumbnail';
type EntityImageAspect = '1/1' | '4/3' | '16/9';
type ImageFallback = 'icon' | 'none';

const VARIANT_CLASS: Record<EntityImageVariant, string> = {
  card: 'h-28 w-full rounded-md border border-border object-cover',
  detail: 'h-44 w-full rounded-lg border border-border object-cover',
  thumbnail: 'h-16 w-24 rounded border border-border object-cover',
};

const ASPECT_STYLE: Record<EntityImageAspect, CSSProperties> = {
  '1/1': { aspectRatio: '1 / 1' },
  '4/3': { aspectRatio: '4 / 3' },
  '16/9': { aspectRatio: '16 / 9' },
};

function inferEntityType(entityId: string): DomainEntityType {
  if (entityId.includes('drone')) return 'drone';
  if (entityId.includes('agent')) return 'agent';
  return 'robot';
}

export type EntityImageProps = {
  entityId: string;
  variant?: EntityImageVariant;
  aspect?: EntityImageAspect;
  theme?: CockpitAssetTheme;
  fallback?: ImageFallback;
  className?: string;
};

export function EntityImage({
  entityId,
  variant = 'card',
  aspect = '4/3',
  theme = 'neutral',
  fallback = 'icon',
  className,
}: EntityImageProps) {
  const asset = getEntityImage(entityId);
  const src = asset ? resolveAssetPath(asset, theme) : undefined;

  if (src) {
    return (
      <img
        src={src}
        alt={asset.alt ?? `${entityId} preview`}
        className={`${VARIANT_CLASS[variant]} ${className ?? ''}`.trim()}
        style={ASPECT_STYLE[aspect]}
      />
    );
  }

  if (fallback === 'none') return null;

  const entityType = inferEntityType(entityId);
  return (
    <div
      className={`bg-muted/50 text-muted-foreground flex items-center justify-center ${VARIANT_CLASS[variant]} ${className ?? ''}`.trim()}
      style={ASPECT_STYLE[aspect]}
      aria-label={`${entityId} placeholder`}
    >
      <EntityIcon entityType={entityType} size="lg" />
    </div>
  );
}
