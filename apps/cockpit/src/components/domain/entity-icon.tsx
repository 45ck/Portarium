import type { CSSProperties } from 'react';
import {
  Activity,
  BadgeCheck,
  Bot,
  Box,
  BrainCircuit,
  Building2,
  CheckSquare,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileText,
  FolderKanban,
  Handshake,
  KeyRound,
  Link,
  ListChecks,
  Map,
  MapPin,
  Megaphone,
  Network,
  Package,
  Plane,
  PlayCircle,
  Plug,
  ReceiptText,
  Repeat,
  Route,
  ShieldCheck,
  ShoppingCart,
  ServerCog,
  User,
  Users,
  Workflow,
} from 'lucide-react';
import type { CockpitAssetTheme, DomainEntityType } from '@/assets/types';

type EntityIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PIXELS: Record<EntityIconSize, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
};

const ENTITY_SYMBOL: Record<DomainEntityType, typeof Bot> = {
  robot: Bot,
  drone: Plane,
  agent: BrainCircuit,
  adapter: Plug,
  mission: Route,
  evidence: FileCheck2,
  policy: ShieldCheck,
  fleet: Network,
  'work-item': ClipboardList,
  workflow: Workflow,
  run: PlayCircle,
  approval: BadgeCheck,
  'human-task': CheckSquare,
  workforce: Users,
  queue: ListChecks,
  machine: ServerCog,
  'map-layer': Map,
  'location-event': MapPin,
  port: Plug,
  project: FolderKanban,
  plan: FileText,
  credential: KeyRound,
  tenant: Building2,
  user: User,
  event: Activity,
  artifact: Box,
  party: User,
  ticket: ClipboardList,
  invoice: ReceiptText,
  payment: CreditCard,
  task: CheckSquare,
  campaign: Megaphone,
  asset: Package,
  document: FileText,
  subscription: Repeat,
  opportunity: Handshake,
  product: Package,
  order: ShoppingCart,
  account: CircleDollarSign,
  'external-object-ref': Link,
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
  decorative = false,
  className,
  style,
}: EntityIconProps) {
  const pixelSize = SIZE_PIXELS[size];
  const Symbol = ENTITY_SYMBOL[entityType] ?? Bot;
  return (
    <Symbol
      aria-hidden={decorative}
      aria-label={decorative ? undefined : `${entityType} icon`}
      className={className}
      style={{ width: pixelSize, height: pixelSize, ...style }}
      strokeWidth={2}
    />
  );
}
