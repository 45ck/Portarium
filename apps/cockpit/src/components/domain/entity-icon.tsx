import type { CSSProperties } from 'react';
import { Bot, Brain, FileCheck2, Network, Plane, Plug, Route, ShieldCheck, User } from 'lucide-react';
import { getDomainIcon, resolveAssetPath } from '@/assets/registry';
import type { CockpitAssetTheme, DomainEntityType } from '@/assets/types';

type EntityIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PIXELS: Record<EntityIconSize, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
};

const FALLBACK_ICON: Record<DomainEntityType, typeof Bot> = {
  robot: Bot,
  drone: Plane,
  agent: Brain,
  adapter: Plug,
  mission: Route,
  evidence: FileCheck2,
  policy: ShieldCheck,
  fleet: Network,
  'work-item': FileCheck2,
  workflow: Route,
  run: Route,
  approval: ShieldCheck,
  'human-task': FileCheck2,
  workforce: Network,
  queue: Network,
  machine: Bot,
  'map-layer': Network,
  'location-event': Route,
  port: Plug,
  project: FileCheck2,
  plan: FileCheck2,
  credential: ShieldCheck,
  tenant: Network,
  user: User,
  event: Route,
  artifact: FileCheck2,
};

export type EntityIconProps = {
  entityType: DomainEntityType;
  size?: EntityIconSize;
  theme?: CockpitAssetTheme;
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function EntityIcon({
  entityType,
  size = 'md',
  theme = 'light',
  decorative = false,
  className,
  style,
}: EntityIconProps) {
  const iconAsset = getDomainIcon(entityType);
  const iconPath = iconAsset ? resolveAssetPath(iconAsset, theme) : undefined;
  const pixelSize = SIZE_PIXELS[size];

  if (iconAsset && iconPath) {
    const altText = decorative ? '' : (iconAsset?.alt ?? `${entityType} icon`);
    return (
      <img
        src={iconPath}
        alt={altText}
        className={className}
        width={pixelSize}
        height={pixelSize}
        style={style}
      />
    );
  }

  const Fallback = FALLBACK_ICON[entityType] ?? Bot;
  return (
    <Fallback
      aria-hidden={decorative}
      aria-label={decorative ? undefined : `${entityType} icon`}
      className={className}
      style={{ width: pixelSize, height: pixelSize, ...style }}
    />
  );
}
