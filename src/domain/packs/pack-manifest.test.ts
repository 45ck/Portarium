import { describe, expect, it } from 'vitest';

import { parsePackManifestV1 } from './pack-manifest.js';

describe('pack-manifest: happy path', () => {
  it('parses a valid v1 manifest', () => {
    const m = parsePackManifestV1({
      manifestVersion: 1,
      kind: 'VerticalPack',
      id: 'scm.change-management',
      version: '1.2.3',
      requiresCore: '>=0.1.0 <1.0.0',
      displayName: 'Software Change Management',
      assets: {
        workflows: ['workflows/change-request.json'],
        uiTemplates: ['ui/change-request.form.json'],
        mappings: ['mappings/github.json'],
      },
    });

    expect(m.manifestVersion).toBe(1);
    expect(m.kind).toBe('VerticalPack');
    expect(m.displayName).toBe('Software Change Management');
    expect(m.assets.workflows).toEqual(['workflows/change-request.json']);
  });
});

describe('pack-manifest: top-level validation', () => {
  it('rejects non-object manifests', () => {
    expect(() => parsePackManifestV1(null)).toThrow(/must be an object/);
    expect(() => parsePackManifestV1([])).toThrow(/must be an object/);
  });

  it('rejects unsupported manifest versions and kinds', () => {
    expect(() =>
      parsePackManifestV1({
        manifestVersion: 2,
        kind: 'VerticalPack',
        id: 'scm.change-management',
        version: '1.0.0',
        requiresCore: '*',
        displayName: 'Bad Pack',
        assets: {},
      }),
    ).toThrow(/Unsupported manifestVersion/);

    expect(() =>
      parsePackManifestV1({
        manifestVersion: 1,
        kind: 'WeirdPack',
        id: 'scm.change-management',
        version: '1.0.0',
        requiresCore: '*',
        displayName: 'Bad Pack',
        assets: {},
      }),
    ).toThrow(/Unsupported pack kind/);
  });

  it('rejects invalid pack ids', () => {
    expect(() =>
      parsePackManifestV1({
        manifestVersion: 1,
        kind: 'VerticalPack',
        id: 'SCM.ChangeManagement',
        version: '1.0.0',
        requiresCore: '*',
        displayName: 'Bad Pack',
        assets: {},
      }),
    ).toThrow(/Invalid pack id/);
  });
});

describe('pack-manifest: dependencies and assets validation', () => {
  it('rejects non-object dependencies', () => {
    expect(() =>
      parsePackManifestV1({
        manifestVersion: 1,
        kind: 'VerticalPack',
        id: 'scm.change-management',
        version: '1.0.0',
        requiresCore: '*',
        displayName: 'Bad Pack',
        dependencies: [],
        assets: {},
      }),
    ).toThrow(/dependencies must be an object/);
  });

  it('rejects invalid dependency keys and ranges', () => {
    expect(() =>
      parsePackManifestV1({
        manifestVersion: 1,
        kind: 'VerticalPack',
        id: 'scm.change-management',
        version: '1.0.0',
        requiresCore: '*',
        displayName: 'Bad Pack',
        dependencies: { 'Bad Id': '*' },
        assets: {},
      }),
    ).toThrow(/Invalid dependency pack id/);

    expect(() =>
      parsePackManifestV1({
        manifestVersion: 1,
        kind: 'VerticalPack',
        id: 'scm.change-management',
        version: '1.0.0',
        requiresCore: '*',
        displayName: 'Bad Pack',
        dependencies: { 'scm.dep': 123 },
        assets: {},
      }),
    ).toThrow(/Expected string/);
  });

  it('rejects non-string asset entries and non-object assets', () => {
    expect(() =>
      parsePackManifestV1({
        manifestVersion: 1,
        kind: 'VerticalPack',
        id: 'scm.change-management',
        version: '1.0.0',
        requiresCore: '*',
        displayName: 'Bad Pack',
        assets: { workflows: [1] },
      }),
    ).toThrow(/workflows\[0\] must be a non-empty string/);

    expect(() =>
      parsePackManifestV1({
        manifestVersion: 1,
        kind: 'VerticalPack',
        id: 'scm.change-management',
        version: '1.0.0',
        requiresCore: '*',
        displayName: 'Bad Pack',
        assets: 'oops',
      }),
    ).toThrow(/assets must be an object/);
  });

  it('rejects invalid required and optional fields', () => {
    expect(() =>
      parsePackManifestV1({
        manifestVersion: 1,
        kind: 'VerticalPack',
        id: 'scm.change-management',
        version: '1.0.0',
        requiresCore: '*',
        displayName: '',
        assets: {},
      }),
    ).toThrow(/displayName must be a non-empty string/);

    expect(() =>
      parsePackManifestV1({
        manifestVersion: 1,
        kind: 'VerticalPack',
        id: 'scm.change-management',
        version: '1.0.0',
        requiresCore: '*',
        displayName: 'Bad Pack',
        description: '',
        assets: {},
      }),
    ).toThrow(/description must be a non-empty string/);

    expect(() =>
      parsePackManifestV1({
        manifestVersion: 1.5,
        kind: 'VerticalPack',
        id: 'scm.change-management',
        version: '1.0.0',
        requiresCore: '*',
        displayName: 'Bad Pack',
        assets: {},
      }),
    ).toThrow(/manifestVersion must be an integer/);
  });
});
