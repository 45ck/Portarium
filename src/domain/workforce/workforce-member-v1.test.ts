import { describe, expect, it } from 'vitest';
import { UserId } from '../primitives/index.js';
import { parseWorkspaceUserV1 } from '../users/workspace-user-v1.js';
import {
  assertLinkedWorkspaceUserActive,
  parseWorkforceMemberV1,
  updateWorkforceMemberAvailabilityV1,
  updateWorkforceMemberCapabilitiesV1,
} from './workforce-member-v1.js';

function baseMember() {
  return {
    schemaVersion: 1,
    workforceMemberId: 'wm-001',
    linkedUserId: 'user-1',
    displayName: 'Alex',
    capabilities: ['operations.dispatch', 'operations.approval'],
    availabilityStatus: 'available',
    queueMemberships: ['queue-ops'],
    tenantId: 'ws-1',
    createdAtIso: '2026-02-19T00:00:00.000Z',
  } as const;
}

describe('parseWorkforceMemberV1', () => {
  it('parses workforce member aggregate', () => {
    const parsed = parseWorkforceMemberV1(baseMember());
    expect(parsed.displayName).toBe('Alex');
    expect(parsed.capabilities).toEqual(['operations.dispatch', 'operations.approval']);
  });

  it('rejects capability outside controlled vocabulary', () => {
    expect(() =>
      parseWorkforceMemberV1({
        ...baseMember(),
        capabilities: ['random.capability'],
      }),
    ).toThrow(/controlled vocab/i);
  });
});

describe('workforce domain rules', () => {
  it('enforces active linked workspace user', () => {
    const member = parseWorkforceMemberV1(baseMember());
    const activeUser = parseWorkspaceUserV1({
      userId: 'user-1',
      workspaceId: 'ws-1',
      email: 'alex@example.com',
      roles: ['operator'],
      active: true,
      createdAtIso: '2026-02-18T00:00:00.000Z',
    });

    expect(() => assertLinkedWorkspaceUserActive(member, activeUser)).not.toThrow();

    const inactiveUser = { ...activeUser, active: false };
    expect(() => assertLinkedWorkspaceUserActive(member, inactiveUser)).toThrow(/active WorkspaceUser/i);
  });

  it('allows capability updates for admin only', () => {
    const member = parseWorkforceMemberV1(baseMember());

    const updated = updateWorkforceMemberCapabilitiesV1({
      member,
      nextCapabilities: ['operations.dispatch', 'robotics.supervision'],
      actorRole: 'admin',
      updatedAtIso: '2026-02-19T01:00:00.000Z',
    });
    expect(updated.capabilities).toContain('robotics.supervision');

    expect(() =>
      updateWorkforceMemberCapabilitiesV1({
        member,
        nextCapabilities: ['operations.dispatch'],
        actorRole: 'operator',
        updatedAtIso: '2026-02-19T01:00:00.000Z',
      }),
    ).toThrow(/admin role/i);
  });

  it('allows availability updates by linked user only', () => {
    const member = parseWorkforceMemberV1(baseMember());
    const updated = updateWorkforceMemberAvailabilityV1({
      member,
      nextStatus: 'busy',
      actorUserId: UserId('user-1'),
      updatedAtIso: '2026-02-19T02:00:00.000Z',
    });
    expect(updated.availabilityStatus).toBe('busy');

    expect(() =>
      updateWorkforceMemberAvailabilityV1({
        member,
        nextStatus: 'offline',
        actorUserId: UserId('user-2'),
        updatedAtIso: '2026-02-19T02:00:00.000Z',
      }),
    ).toThrow(/self-managed/i);
  });
});
