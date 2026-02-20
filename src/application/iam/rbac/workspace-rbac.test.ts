import { describe, expect, it } from 'vitest';

import { assertCanPerformWorkspaceAction, isAllowedWorkspaceAction } from './workspace-rbac.js';
import type { WorkspaceActor } from '../workspace-actor.js';
import { UserId, WorkspaceId } from '../../../domain/primitives/index.js';

function actor(roles: WorkspaceActor['roles']): WorkspaceActor {
  return { userId: UserId('user-1'), workspaceId: WorkspaceId('ws-1'), roles };
}

describe('Workspace RBAC (IAM MVP)', () => {
  it('allows admin for workspace:register', () => {
    expect(isAllowedWorkspaceAction(actor(['admin']), 'workspace:register')).toBe(true);
  });

  it('denies operator for workspace:register', () => {
    expect(isAllowedWorkspaceAction(actor(['operator']), 'workspace:register')).toBe(false);
  });

  it('allows operator for run:start', () => {
    expect(isAllowedWorkspaceAction(actor(['operator']), 'run:start')).toBe(true);
  });

  it('allows auditor for work-item:read', () => {
    expect(isAllowedWorkspaceAction(actor(['auditor']), 'work-item:read')).toBe(true);
  });

  it('allows approver for approval:submit', () => {
    expect(isAllowedWorkspaceAction(actor(['approver']), 'approval:submit')).toBe(true);
  });

  it('allows auditor for approval:read', () => {
    expect(isAllowedWorkspaceAction(actor(['auditor']), 'approval:read')).toBe(true);
  });

  it('denies auditor for approval:submit', () => {
    expect(isAllowedWorkspaceAction(actor(['auditor']), 'approval:submit')).toBe(false);
  });

  it('allows operator for workforce:assign', () => {
    expect(isAllowedWorkspaceAction(actor(['operator']), 'workforce:assign')).toBe(true);
  });

  it('allows operator for workforce:complete', () => {
    expect(isAllowedWorkspaceAction(actor(['operator']), 'workforce:complete')).toBe(true);
  });

  it('allows approver for workforce:complete', () => {
    expect(isAllowedWorkspaceAction(actor(['approver']), 'workforce:complete')).toBe(true);
  });

  it('assert helper throws when denied', () => {
    expect(() => assertCanPerformWorkspaceAction(actor(['auditor']), 'approval:submit')).toThrow(
      /lacks required role/i,
    );
  });
});
