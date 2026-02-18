import { describe, expect, it } from 'vitest';

import type { CapabilityClaimV1 } from '../adapters/adapter-registration-v1.js';
import type { PortCapability } from '../ports/port-family-capabilities-v1.js';
import type { PortV1 } from '../ports/port-v1.js';
import type { WorkflowActionV1 } from '../workflows/workflow-v1.js';
import { ActionId, AdapterId, PortId, WorkspaceId } from '../primitives/index.js';
import {
  adapterClaimSupportsCapability,
  adapterFulfillsAction,
  portFulfillsAction,
  portSupportsCapability,
  resolveActionCapability,
} from './capability-enforcement.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeClaim = (overrides: Partial<CapabilityClaimV1> = {}): CapabilityClaimV1 => ({
  operation: 'account:read',
  requiresAuth: false,
  ...overrides,
});

const makePort = (supportedOperations: readonly PortCapability[]): PortV1 => ({
  schemaVersion: 1,
  portId: PortId('port-1'),
  workspaceId: WorkspaceId('ws-1'),
  adapterId: AdapterId('adapter-1'),
  portFamily: 'FinanceAccounting',
  name: 'Test Port',
  status: 'Active',
  supportedOperations,
  createdAtIso: '2026-02-18T00:00:00.000Z',
});

const makeAction = (overrides: Partial<WorkflowActionV1> = {}): WorkflowActionV1 => ({
  actionId: ActionId('action-1'),
  order: 1,
  portFamily: 'FinanceAccounting',
  operation: 'account:read',
  ...overrides,
});

// ---------------------------------------------------------------------------
// adapterClaimSupportsCapability
// ---------------------------------------------------------------------------

describe('adapterClaimSupportsCapability', () => {
  it('matches by canonical capability when claim.capability is set', () => {
    const claim = makeClaim({ capability: 'account:read', operation: 'account:read' });
    expect(adapterClaimSupportsCapability(claim, 'account:read')).toBe(true);
  });

  it('rejects mismatch on canonical capability even if operation string matches', () => {
    const claim = makeClaim({ capability: 'invoice:read', operation: 'account:read' });
    expect(adapterClaimSupportsCapability(claim, 'account:read')).toBe(false);
  });

  it('falls back to operation equality when capability is absent (compatibility path)', () => {
    const claim = makeClaim({ operation: 'account:read' });
    expect(adapterClaimSupportsCapability(claim, 'account:read')).toBe(true);
  });

  it('rejects when neither canonical capability nor operation matches', () => {
    const claim = makeClaim({ operation: 'invoice:read' });
    expect(adapterClaimSupportsCapability(claim, 'account:read')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// portSupportsCapability
// ---------------------------------------------------------------------------

describe('portSupportsCapability', () => {
  it('returns true when capability is in supportedOperations', () => {
    const port = makePort(['account:read', 'invoice:read']);
    expect(portSupportsCapability(port, 'account:read')).toBe(true);
  });

  it('returns false when capability is not in supportedOperations', () => {
    const port = makePort(['invoice:read']);
    expect(portSupportsCapability(port, 'account:read')).toBe(false);
  });

  it('returns false for empty supportedOperations', () => {
    const port = makePort([]);
    expect(portSupportsCapability(port, 'account:read')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveActionCapability
// ---------------------------------------------------------------------------

describe('resolveActionCapability', () => {
  it('returns canonical capability when action.capability is set', () => {
    const action = makeAction({ capability: 'account:read', operation: 'legacy-op' });
    expect(resolveActionCapability(action)).toBe('account:read');
  });

  it('returns operation string when capability is absent', () => {
    const action = makeAction({ operation: 'account:read' });
    expect(resolveActionCapability(action)).toBe('account:read');
  });
});

// ---------------------------------------------------------------------------
// portFulfillsAction
// ---------------------------------------------------------------------------

describe('portFulfillsAction', () => {
  it('returns true when port supports action capability', () => {
    const port = makePort(['account:read', 'invoice:read']);
    const action = makeAction({ capability: 'account:read' });
    expect(portFulfillsAction(port, action)).toBe(true);
  });

  it('returns false when port does not support action capability', () => {
    const port = makePort(['invoice:read']);
    const action = makeAction({ capability: 'account:read' });
    expect(portFulfillsAction(port, action)).toBe(false);
  });

  it('uses operation as capability when action.capability is absent', () => {
    const port = makePort(['account:read']);
    const action = makeAction({ operation: 'account:read' });
    expect(portFulfillsAction(port, action)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// adapterFulfillsAction
// ---------------------------------------------------------------------------

describe('adapterFulfillsAction', () => {
  it('returns true when a canonical claim satisfies the action capability', () => {
    const claims: readonly CapabilityClaimV1[] = [
      makeClaim({ capability: 'account:read', operation: 'account:read' }),
    ];
    const action = makeAction({ capability: 'account:read' });
    expect(adapterFulfillsAction(claims, action)).toBe(true);
  });

  it('returns true via compatibility fallback for legacy-operation claim', () => {
    const claims: readonly CapabilityClaimV1[] = [
      makeClaim({ operation: 'account:read' }), // no capability field
    ];
    const action = makeAction({ capability: 'account:read' });
    expect(adapterFulfillsAction(claims, action)).toBe(true);
  });

  it('returns false when no claim matches the required capability', () => {
    const claims: readonly CapabilityClaimV1[] = [makeClaim({ operation: 'invoice:read' })];
    const action = makeAction({ capability: 'account:read' });
    expect(adapterFulfillsAction(claims, action)).toBe(false);
  });

  it('returns false when claims list is empty', () => {
    expect(adapterFulfillsAction([], makeAction())).toBe(false);
  });

  it('returns true when any one of multiple claims satisfies the action', () => {
    const claims: readonly CapabilityClaimV1[] = [
      makeClaim({ capability: 'invoice:read', operation: 'invoice:read' }),
      makeClaim({ capability: 'account:read', operation: 'account:read' }),
    ];
    const action = makeAction({ capability: 'account:read' });
    expect(adapterFulfillsAction(claims, action)).toBe(true);
  });
});
