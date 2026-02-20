import { describe, expect, it } from 'vitest';
import {
  assetSupportsFormat,
  getAssetById,
  getDomainIcon,
  getEntityImage,
  listAssets,
  listAssetsByKind,
  resolveAssetPath,
} from '@/assets/registry';

describe('cockpit asset registry', () => {
  it('loads a non-empty manifest', () => {
    expect(listAssets().length).toBeGreaterThan(0);
  });

  it('resolves known domain icons', () => {
    const robotIcon = getDomainIcon('robot');
    expect(robotIcon?.id).toBe('icon-robot-ground');
  });

  it('resolves known entity images', () => {
    const robotImage = getEntityImage('robot-ground-alpha');
    expect(robotImage?.id).toBe('image-robot-ground-alpha');
  });

  it('resolves theme-specific asset paths with fallback', () => {
    const icon = getAssetById('icon-agent');
    expect(icon).toBeDefined();
    if (!icon) return;

    expect(resolveAssetPath(icon, 'light')).toBe('/assets/icons/domain/agent.svg');
    expect(resolveAssetPath(icon, 'dark')).toBe('/assets/icons/domain/agent.svg');
  });

  it('reports format support correctly', () => {
    const icon = getAssetById('icon-policy');
    expect(icon).toBeDefined();
    if (!icon) return;

    expect(assetSupportsFormat(icon, 'svg')).toBe(true);
    expect(assetSupportsFormat(icon, 'webp')).toBe(false);
  });

  it('filters by kind', () => {
    const icons = listAssetsByKind('icon');
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.every((asset) => asset.kind === 'icon')).toBe(true);
  });
});
