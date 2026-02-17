import { describe, expect, it } from 'vitest';

import { parseWorkspaceV1 } from './workspace-v1.js';

describe('parseWorkspaceV1', () => {
  it('parses workspace with membership identifiers', () => {
    const workspace = parseWorkspaceV1({
      workspaceId: 'ws-1',
      tenantId: 'tenant-1',
      name: 'Acme',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      userIds: ['user-1', 'user-2'],
      projectIds: ['project-1'],
      credentialGrantIds: ['cg-1'],
    });

    expect(workspace.workspaceId).toBe('ws-1');
    expect(workspace.tenantId).toBe('tenant-1');
    expect(workspace.userIds).toHaveLength(2);
    expect(workspace.projectIds).toHaveLength(1);
    expect(workspace.credentialGrantIds).toHaveLength(1);
  });

  it('parses tenantId correctly', () => {
    const workspace = parseWorkspaceV1({
      workspaceId: 'ws-1',
      tenantId: 'tenant-42',
      name: 'Acme',
      createdAtIso: '2026-02-16T00:00:00.000Z',
    });

    expect(workspace.tenantId).toBe('tenant-42');
  });

  it('rejects missing tenantId', () => {
    expect(() =>
      parseWorkspaceV1({
        workspaceId: 'ws-1',
        name: 'Acme',
        createdAtIso: '2026-02-16T00:00:00.000Z',
      }),
    ).toThrow(/tenantId must be a non-empty string/);
  });

  it('rejects empty tenantId', () => {
    expect(() =>
      parseWorkspaceV1({
        workspaceId: 'ws-1',
        tenantId: '   ',
        name: 'Acme',
        createdAtIso: '2026-02-16T00:00:00.000Z',
      }),
    ).toThrow(/tenantId must be a non-empty string/);
  });

  it('enforces duplicate-free userIds', () => {
    expect(() =>
      parseWorkspaceV1({
        workspaceId: 'ws-1',
        tenantId: 'tenant-1',
        name: 'Acme',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        userIds: ['user-1', 'user-1'],
      }),
    ).toThrow(/userIds must not contain duplicate values/);
  });

  it('validates list shape for membership fields', () => {
    expect(() =>
      parseWorkspaceV1({
        workspaceId: 'ws-1',
        tenantId: 'tenant-1',
        name: 'Acme',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        projectIds: 'project-1',
      }),
    ).toThrow(/projectIds must be an array/);
  });

  it('rejects invalid ISO timestamp for createdAtIso', () => {
    expect(() =>
      parseWorkspaceV1({
        workspaceId: 'ws-1',
        tenantId: 'tenant-1',
        name: 'Acme',
        createdAtIso: 'not-a-date',
      }),
    ).toThrow(/createdAtIso must be a valid ISO timestamp/);
  });

  it('rejects non-object values', () => {
    expect(() => parseWorkspaceV1(null)).toThrow(/Workspace must be an object/);
  });
});
