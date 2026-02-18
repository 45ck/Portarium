import { describe, expect, it } from 'vitest';

import { parseWorkspaceActorFromClaims, WorkspaceAuthClaimParseError } from './workspace-actor.js';

describe('parseWorkspaceActorFromClaims', () => {
  it('parses minimal valid claims', () => {
    const actor = parseWorkspaceActorFromClaims({
      sub: 'user-1',
      workspaceId: 'ws-1',
      roles: ['operator', 'approver'],
    });

    expect(actor.userId).toBe('user-1');
    expect(actor.workspaceId).toBe('ws-1');
    expect(actor.roles).toEqual(['operator', 'approver']);
  });

  it('rejects missing sub', () => {
    expect(() =>
      parseWorkspaceActorFromClaims({
        workspaceId: 'ws-1',
        roles: ['operator'],
      }),
    ).toThrow(WorkspaceAuthClaimParseError);
  });

  it('rejects missing workspaceId', () => {
    expect(() =>
      parseWorkspaceActorFromClaims({
        sub: 'user-1',
        roles: ['operator'],
      }),
    ).toThrow(WorkspaceAuthClaimParseError);
  });

  it('rejects empty roles', () => {
    expect(() =>
      parseWorkspaceActorFromClaims({
        sub: 'user-1',
        workspaceId: 'ws-1',
        roles: [],
      }),
    ).toThrow(WorkspaceAuthClaimParseError);
  });

  it('rejects unknown roles', () => {
    expect(() =>
      parseWorkspaceActorFromClaims({
        sub: 'user-1',
        workspaceId: 'ws-1',
        roles: ['superAdmin'],
      }),
    ).toThrow(WorkspaceAuthClaimParseError);
  });

  it('rejects duplicate roles', () => {
    expect(() =>
      parseWorkspaceActorFromClaims({
        sub: 'user-1',
        workspaceId: 'ws-1',
        roles: ['operator', 'operator'],
      }),
    ).toThrow(WorkspaceAuthClaimParseError);
  });
});
