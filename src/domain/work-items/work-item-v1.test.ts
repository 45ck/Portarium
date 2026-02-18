import { describe, expect, it } from 'vitest';

import { parseWorkItemV1 } from './work-item-v1.js';

describe('parseWorkItemV1: happy path', () => {
  it('parses a minimal WorkItemV1', () => {
    const workItem = parseWorkItemV1({
      schemaVersion: 1,
      workItemId: 'wi-1',
      workspaceId: 'ws-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      createdByUserId: 'user-1',
      title: 'Change request: tighten CI gates',
      status: 'Open',
    });

    expect(workItem.schemaVersion).toBe(1);
    expect(workItem.workItemId).toBe('wi-1');
    expect(workItem.ownerUserId).toBeUndefined();
    expect(workItem.sla).toBeUndefined();
    expect(workItem.links).toBeUndefined();
  });

  it('parses owner assignment, SLA metadata, and links', () => {
    const workItem = parseWorkItemV1({
      schemaVersion: 1,
      workItemId: 'wi-2',
      workspaceId: 'ws-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      createdByUserId: 'user-1',
      title: 'SCM: release approval chain',
      status: 'Open',
      ownerUserId: 'user-2',
      sla: { dueAtIso: '2026-02-20T00:00:00.000Z' },
      links: {
        externalRefs: [
          {
            sorName: 'jira',
            portFamily: 'ProjectsWorkMgmt',
            externalId: 'PROJ-123',
            externalType: 'Issue',
            displayLabel: 'PROJ-123',
            deepLinkUrl: 'https://jira.example.com/browse/PROJ-123',
          },
        ],
        runIds: ['run-1', 'run-2'],
        approvalIds: ['approval-1'],
        evidenceIds: ['evi-1', 'evi-2'],
      },
    });

    expect(workItem.ownerUserId).toBe('user-2');
    expect(workItem.sla?.dueAtIso).toBe('2026-02-20T00:00:00.000Z');
    expect(workItem.links?.runIds).toEqual(['run-1', 'run-2']);
    expect(workItem.links?.approvalIds).toEqual(['approval-1']);
    expect(workItem.links?.evidenceIds).toEqual(['evi-1', 'evi-2']);
    expect(workItem.links?.externalRefs?.[0]).toEqual(
      expect.objectContaining({
        sorName: 'jira',
        portFamily: 'ProjectsWorkMgmt',
        externalId: 'PROJ-123',
        externalType: 'Issue',
      }),
    );
  });

  it('parses closed status', () => {
    const workItem = parseWorkItemV1({
      schemaVersion: 1,
      workItemId: 'wi-3',
      workspaceId: 'ws-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      createdByUserId: 'user-1',
      title: 'Close out incident follow-up',
      status: 'Closed',
    });

    expect(workItem.status).toBe('Closed');
  });
});

describe('parseWorkItemV1: validation', () => {
  it('rejects invalid top-level inputs and schema versions', () => {
    expect(() => parseWorkItemV1('nope')).toThrow(/WorkItem must be an object/i);

    expect(() =>
      parseWorkItemV1({
        schemaVersion: 2,
        workItemId: 'wi-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        title: 't',
        status: 'Open',
      }),
    ).toThrow(/schemaVersion/i);

    expect(() =>
      parseWorkItemV1({
        schemaVersion: 1.5,
        workItemId: 'wi-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        title: 't',
        status: 'Open',
      }),
    ).toThrow(/schemaVersion/i);
  });

  it('rejects invalid status values', () => {
    expect(() =>
      parseWorkItemV1({
        schemaVersion: 1,
        workItemId: 'wi-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        title: 't',
        status: 'Cancelled',
      }),
    ).toThrow(/status/i);
  });

  it('rejects invalid required strings', () => {
    expect(() =>
      parseWorkItemV1({
        schemaVersion: 1,
        workItemId: '   ',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        title: 't',
        status: 'Open',
      }),
    ).toThrow(/workItemId/i);

    expect(() =>
      parseWorkItemV1({
        schemaVersion: 1,
        workItemId: 'wi-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        title: '   ',
        status: 'Open',
      }),
    ).toThrow(/title/i);
  });

  it('rejects sla.dueAtIso before createdAtIso', () => {
    expect(() =>
      parseWorkItemV1({
        schemaVersion: 1,
        workItemId: 'wi-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T12:00:00.000Z',
        createdByUserId: 'user-1',
        title: 't',
        status: 'Open',
        sla: { dueAtIso: '2026-02-15T00:00:00.000Z' },
      }),
    ).toThrow(/sla\.dueAtIso must not precede createdAtIso/);
  });

  it('rejects invalid SLA shape and values', () => {
    expect(() =>
      parseWorkItemV1({
        schemaVersion: 1,
        workItemId: 'wi-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        title: 't',
        status: 'Open',
        sla: [],
      }),
    ).toThrow(/sla must be an object/i);

    expect(() =>
      parseWorkItemV1({
        schemaVersion: 1,
        workItemId: 'wi-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        title: 't',
        status: 'Open',
        sla: { dueAtIso: '   ' },
      }),
    ).toThrow(/dueAtIso/i);
  });

  it('rejects invalid links shape', () => {
    expect(() =>
      parseWorkItemV1({
        schemaVersion: 1,
        workItemId: 'wi-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        title: 't',
        status: 'Open',
        links: [],
      }),
    ).toThrow(/links must be an object/i);
  });

  it('rejects invalid external refs', () => {
    expect(() =>
      parseWorkItemV1({
        schemaVersion: 1,
        workItemId: 'wi-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        title: 't',
        status: 'Open',
        links: {
          externalRefs: [
            {
              sorName: 'jira',
              portFamily: 'NotARealPortFamily',
              externalId: 'PROJ-1',
              externalType: 'Issue',
            },
          ],
        },
      }),
    ).toThrow(/externalRefs\[0\].*portFamily/i);
  });

  it('rejects invalid id arrays', () => {
    expect(() =>
      parseWorkItemV1({
        schemaVersion: 1,
        workItemId: 'wi-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        title: 't',
        status: 'Open',
        links: { runIds: {} },
      }),
    ).toThrow(/links\.runIds must be an array/i);

    expect(() =>
      parseWorkItemV1({
        schemaVersion: 1,
        workItemId: 'wi-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        title: 't',
        status: 'Open',
        links: { approvalIds: ['   '] },
      }),
    ).toThrow(/approvalIds\[0\]/i);
  });
});
