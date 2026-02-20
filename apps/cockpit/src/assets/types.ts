export type CockpitAssetKind = 'icon' | 'image' | 'illustration';

export type CockpitAssetDomain =
  | 'robot'
  | 'agent'
  | 'mission'
  | 'adapter'
  | 'evidence'
  | 'policy'
  | 'fleet'
  | 'other';

export type CockpitAssetStyle = 'isometric-3d' | 'realistic' | 'flat';
export type CockpitAssetTheme = 'light' | 'dark' | 'neutral';
export type CockpitAssetFormat = 'svg' | 'png' | 'webp';
export type CockpitAssetStatus = 'draft' | 'approved' | 'deprecated';
export type CockpitAssetLicense = 'internal-generated';
export type CockpitAssetSizeToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type CockpitAssetDimension = {
  width: number;
  height: number;
};

export type CockpitAsset = {
  id: string;
  kind: CockpitAssetKind;
  domain: CockpitAssetDomain;
  style: CockpitAssetStyle;
  theme: CockpitAssetTheme;
  sizes: Partial<Record<CockpitAssetSizeToken, CockpitAssetDimension>>;
  formats: CockpitAssetFormat[];
  paths: Partial<Record<CockpitAssetTheme, string>>;
  alt?: string;
  decorative: boolean;
  promptRef: string;
  generator: {
    model: string;
    createdAt: string;
    operator: string;
    seed?: number;
  };
  status: CockpitAssetStatus;
  license: CockpitAssetLicense;
  tags: string[];
};

export type CockpitAssetManifest = {
  $schema?: string;
  version: string;
  generatedAt?: string;
  assets: CockpitAsset[];
};

export type DomainEntityType =
  | 'robot'
  | 'drone'
  | 'agent'
  | 'adapter'
  | 'mission'
  | 'evidence'
  | 'policy'
  | 'fleet';
