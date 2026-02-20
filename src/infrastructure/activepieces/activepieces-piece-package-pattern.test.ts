import { describe, expect, it } from 'vitest';

import {
  ActivepiecesPiecePackagePatternParseError,
  buildActivepiecesCorrelationHeaders,
  parseActivepiecesPiecePackagePatternV1,
} from './activepieces-piece-package-pattern.js';

describe('parseActivepiecesPiecePackagePatternV1', () => {
  it('parses a valid piece package pattern', () => {
    const parsed = parseActivepiecesPiecePackagePatternV1({
      schemaVersion: 1,
      packageName: '@portarium/piece-projects-work-mgmt',
      pieceName: 'portarium-projects-work-mgmt',
      portFamily: 'ProjectsWorkMgmt',
      operations: [
        {
          operation: 'project:create',
          displayName: 'Create project',
          flowSlug: 'projects-work-mgmt-create-project',
          requiresApproval: false,
        },
        {
          operation: 'task:create',
          displayName: 'Create task',
          flowSlug: 'projects-work-mgmt-create-task',
          requiresApproval: true,
        },
      ],
    });

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.portFamily).toBe('ProjectsWorkMgmt');
    expect(parsed.operations).toHaveLength(2);
  });

  it('rejects invalid portFamily values', () => {
    expect(() =>
      parseActivepiecesPiecePackagePatternV1({
        schemaVersion: 1,
        packageName: '@portarium/piece-invalid',
        pieceName: 'invalid',
        portFamily: 'NotReal',
        operations: [
          {
            operation: 'project:create',
            displayName: 'Create project',
            flowSlug: 'projects-work-mgmt-create-project',
          },
        ],
      }),
    ).toThrow(/portFamily/i);
  });

  it('rejects duplicate operation mappings', () => {
    expect(() =>
      parseActivepiecesPiecePackagePatternV1({
        schemaVersion: 1,
        packageName: '@portarium/piece-projects-work-mgmt',
        pieceName: 'portarium-projects-work-mgmt',
        portFamily: 'ProjectsWorkMgmt',
        operations: [
          {
            operation: 'project:create',
            displayName: 'Create project',
            flowSlug: 'projects-work-mgmt-create-project',
          },
          {
            operation: 'project:create',
            displayName: 'Create project duplicate',
            flowSlug: 'projects-work-mgmt-create-project-2',
          },
        ],
      }),
    ).toThrow(/Duplicate operation mapping/i);
  });
});

describe('buildActivepiecesCorrelationHeaders', () => {
  it('builds tenant and correlation headers and includes runId when provided', () => {
    const headers = buildActivepiecesCorrelationHeaders({
      tenantId: 'tenant-1',
      correlationId: 'corr-1',
      runId: 'run-1',
    });

    expect(headers).toEqual({
      tenantId: 'tenant-1',
      correlationId: 'corr-1',
      runId: 'run-1',
    });
  });

  it('rejects empty correlation values', () => {
    expect(() =>
      buildActivepiecesCorrelationHeaders({
        tenantId: 'tenant-1',
        correlationId: '   ',
      }),
    ).toThrow(ActivepiecesPiecePackagePatternParseError);
  });
});
