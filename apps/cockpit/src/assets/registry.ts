import manifestData from './manifest.json';
import type {
  CockpitAsset,
  CockpitAssetFormat,
  CockpitAssetManifest,
  CockpitAssetTheme,
  DomainEntityType,
} from './types';

const manifest = manifestData as CockpitAssetManifest;

const DOMAIN_ICON_IDS: Record<DomainEntityType, string> = {
  robot: 'icon-robot-ground',
  drone: 'icon-robot-drone',
  agent: 'icon-agent',
  adapter: 'icon-adapter',
  mission: 'icon-mission',
  evidence: 'icon-evidence',
  policy: 'icon-policy',
  fleet: 'icon-fleet',
};

const ENTITY_IMAGE_IDS: Record<string, string> = {
  'robot-ground-alpha': 'image-robot-ground-alpha',
  'robot-drone-gamma': 'image-robot-drone-gamma',
  'agent-ops-analyst': 'image-agent-ops-analyst',
  'agent-policy-reviewer': 'image-agent-policy-reviewer',
};

function firstPath(asset: CockpitAsset): string | undefined {
  return Object.values(asset.paths).find((value) => typeof value === 'string');
}

export function listAssets(): CockpitAsset[] {
  return manifest.assets;
}

export function getAssetById(id: string): CockpitAsset | undefined {
  return manifest.assets.find((asset) => asset.id === id);
}

export function getDomainIcon(entityType: DomainEntityType): CockpitAsset | undefined {
  const assetId = DOMAIN_ICON_IDS[entityType];
  return assetId !== undefined ? getAssetById(assetId) : undefined;
}

export function getEntityImage(entityId: string): CockpitAsset | undefined {
  const assetId = ENTITY_IMAGE_IDS[entityId];
  return assetId !== undefined ? getAssetById(assetId) : undefined;
}

export function resolveAssetPath(
  asset: CockpitAsset,
  theme: CockpitAssetTheme = 'light',
): string | undefined {
  return asset.paths[theme] ?? asset.paths.neutral ?? firstPath(asset);
}

export function assetSupportsFormat(asset: CockpitAsset, format: CockpitAssetFormat): boolean {
  return asset.formats.includes(format);
}

export function listAssetsByKind(kind: CockpitAsset['kind']): CockpitAsset[] {
  return manifest.assets.filter((asset) => asset.kind === kind);
}

export function listAssetsByDomain(domain: CockpitAsset['domain']): CockpitAsset[] {
  return manifest.assets.filter((asset) => asset.domain === domain);
}
