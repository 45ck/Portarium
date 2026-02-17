import { describe, expect, it } from 'vitest';

import { parseProjectV1 } from './project-v1.js';

describe('parseProjectV1', () => {
  it('parses a valid project with all fields', () => {
    const project = parseProjectV1({
      schemaVersion: 1,
      projectId: 'proj-1',
      workspaceId: 'ws-1',
      name: 'Alpha',
      description: 'First project',
      createdAtIso: '2026-02-17T00:00:00.000Z',
    });

    expect(project.schemaVersion).toBe(1);
    expect(project.projectId).toBe('proj-1');
    expect(project.workspaceId).toBe('ws-1');
    expect(project.name).toBe('Alpha');
    expect(project.description).toBe('First project');
    expect(project.createdAtIso).toBe('2026-02-17T00:00:00.000Z');
  });

  it('parses a valid project with optional description omitted', () => {
    const project = parseProjectV1({
      schemaVersion: 1,
      projectId: 'proj-2',
      workspaceId: 'ws-1',
      name: 'Beta',
      createdAtIso: '2026-02-17T00:00:00.000Z',
    });

    expect(project.projectId).toBe('proj-2');
    expect(project.description).toBeUndefined();
  });

  it('rejects missing projectId', () => {
    expect(() =>
      parseProjectV1({
        schemaVersion: 1,
        workspaceId: 'ws-1',
        name: 'Alpha',
        createdAtIso: '2026-02-17T00:00:00.000Z',
      }),
    ).toThrow(/projectId must be a non-empty string/);
  });

  it('rejects empty projectId', () => {
    expect(() =>
      parseProjectV1({
        schemaVersion: 1,
        projectId: '  ',
        workspaceId: 'ws-1',
        name: 'Alpha',
        createdAtIso: '2026-02-17T00:00:00.000Z',
      }),
    ).toThrow(/projectId must be a non-empty string/);
  });

  it('rejects missing workspaceId', () => {
    expect(() =>
      parseProjectV1({
        schemaVersion: 1,
        projectId: 'proj-1',
        name: 'Alpha',
        createdAtIso: '2026-02-17T00:00:00.000Z',
      }),
    ).toThrow(/workspaceId must be a non-empty string/);
  });

  it('rejects missing name', () => {
    expect(() =>
      parseProjectV1({
        schemaVersion: 1,
        projectId: 'proj-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-17T00:00:00.000Z',
      }),
    ).toThrow(/name must be a non-empty string/);
  });

  it('rejects invalid schemaVersion', () => {
    expect(() =>
      parseProjectV1({
        schemaVersion: 2,
        projectId: 'proj-1',
        workspaceId: 'ws-1',
        name: 'Alpha',
        createdAtIso: '2026-02-17T00:00:00.000Z',
      }),
    ).toThrow(/schemaVersion must be 1/);
  });

  it('rejects missing schemaVersion', () => {
    expect(() =>
      parseProjectV1({
        projectId: 'proj-1',
        workspaceId: 'ws-1',
        name: 'Alpha',
        createdAtIso: '2026-02-17T00:00:00.000Z',
      }),
    ).toThrow(/schemaVersion must be a finite number/);
  });

  it('rejects non-object values', () => {
    expect(() => parseProjectV1(null)).toThrow(/Project must be an object/);
    expect(() => parseProjectV1('string')).toThrow(/Project must be an object/);
    expect(() => parseProjectV1(42)).toThrow(/Project must be an object/);
  });
});
