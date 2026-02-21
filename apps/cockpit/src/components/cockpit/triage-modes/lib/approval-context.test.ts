import { describe, expect, it } from 'vitest';
import { resolveApprovalContext, type ApprovalDomain } from './approval-context';
import { getRelevantModes, getNextRelevantMode, getPrevRelevantMode, TRIAGE_MODES } from '../index';
import type {
  ApprovalSummary,
  PlanEffect,
  EvidenceEntry,
  RunSummary,
  WorkflowSummary,
} from '@portarium/cockpit-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeApproval(overrides: Partial<ApprovalSummary> = {}): ApprovalSummary {
  return {
    schemaVersion: 1,
    approvalId: 'appr-1',
    workspaceId: 'ws-1',
    runId: 'run-1',
    planId: 'plan-1',
    prompt: 'Test approval',
    status: 'Pending',
    requestedAtIso: '2026-01-01T00:00:00Z',
    requestedByUserId: 'user-1',
    ...overrides,
  };
}

function makeEffect(
  overrides: Partial<PlanEffect> & { portFamily?: string; sorName?: string } = {},
): PlanEffect {
  const { portFamily = 'FinanceAccounting', sorName = 'Odoo', ...rest } = overrides;
  return {
    effectId: `eff-${Math.random().toString(36).slice(2, 8)}`,
    operation: 'Create',
    target: {
      sorName,
      portFamily,
      externalId: 'ext-1',
      externalType: 'Invoice',
    },
    summary: 'Test effect',
    ...rest,
  };
}

function makeRun(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    schemaVersion: 1,
    runId: 'run-1',
    workspaceId: 'ws-1',
    workflowId: 'wf-1',
    correlationId: 'cor-1',
    executionTier: 'HumanApprove',
    initiatedByUserId: 'user-1',
    status: 'WaitingForApproval',
    createdAtIso: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeWorkflow(overrides: Partial<WorkflowSummary> = {}): WorkflowSummary {
  return {
    schemaVersion: 1,
    workflowId: 'wf-1',
    workspaceId: 'ws-1',
    name: 'Test workflow',
    version: 1,
    active: true,
    executionTier: 'HumanApprove',
    actions: [],
    ...overrides,
  };
}

function makeEvidence(count: number): EvidenceEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    schemaVersion: 1,
    evidenceId: `ev-${i}`,
    workspaceId: 'ws-1',
    occurredAtIso: '2026-01-01T00:00:00Z',
    category: 'Action' as const,
    summary: `Evidence ${i}`,
    actor: { kind: 'System' as const },
    hashSha256: `hash-${i}`,
  }));
}

// ---------------------------------------------------------------------------
// Domain classification tests
// ---------------------------------------------------------------------------
describe('resolveApprovalContext — domain classification', () => {
  it('classifies robotics when run has robotIds', () => {
    const ctx = resolveApprovalContext(
      makeApproval(),
      [makeEffect({ portFamily: 'FinanceAccounting' })],
      [],
      makeRun({ robotIds: ['robot-1'] }),
    );
    expect(ctx.domain).toBe('robotics');
    expect(ctx.hasRobots).toBe(true);
  });

  it('classifies finance by effect port families', () => {
    const ctx = resolveApprovalContext(
      makeApproval(),
      [
        makeEffect({ portFamily: 'FinanceAccounting' }),
        makeEffect({ portFamily: 'PaymentsBilling' }),
      ],
      [],
      makeRun(),
    );
    expect(ctx.domain).toBe('finance');
  });

  it('classifies compliance by effect port families', () => {
    const ctx = resolveApprovalContext(
      makeApproval(),
      [makeEffect({ portFamily: 'RegulatoryCompliance' })],
      [],
      makeRun(),
    );
    expect(ctx.domain).toBe('compliance');
  });

  it('classifies logistics by effect port families', () => {
    const ctx = resolveApprovalContext(
      makeApproval(),
      [makeEffect({ portFamily: 'Logistics' })],
      [],
      makeRun(),
    );
    expect(ctx.domain).toBe('logistics');
  });

  it('classifies itsm by effect port families', () => {
    const ctx = resolveApprovalContext(
      makeApproval(),
      [makeEffect({ portFamily: 'ITSM' })],
      [],
      makeRun(),
    );
    expect(ctx.domain).toBe('itsm');
  });

  it('classifies agent-task when run has agentIds but no known port families', () => {
    const ctx = resolveApprovalContext(
      makeApproval(),
      [makeEffect({ portFamily: 'CustomPort' })],
      [],
      makeRun({ agentIds: ['agent-1'] }),
    );
    expect(ctx.domain).toBe('agent-task');
    expect(ctx.hasAgents).toBe(true);
  });

  it('classifies general when no specific signals', () => {
    const ctx = resolveApprovalContext(
      makeApproval(),
      [makeEffect({ portFamily: 'CustomPort' })],
      [],
      makeRun(),
    );
    expect(ctx.domain).toBe('general');
  });

  it('picks domain by vote count when multiple domains present', () => {
    const ctx = resolveApprovalContext(
      makeApproval(),
      [
        makeEffect({ portFamily: 'FinanceAccounting' }),
        makeEffect({ portFamily: 'PaymentsBilling' }),
        makeEffect({ portFamily: 'RegulatoryCompliance' }),
      ],
      [],
      makeRun(),
    );
    // 2 finance vs 1 compliance
    expect(ctx.domain).toBe('finance');
  });

  it('robots override port-family votes', () => {
    const ctx = resolveApprovalContext(
      makeApproval(),
      [
        makeEffect({ portFamily: 'FinanceAccounting' }),
        makeEffect({ portFamily: 'PaymentsBilling' }),
      ],
      [],
      makeRun({ robotIds: ['robot-1'] }),
    );
    expect(ctx.domain).toBe('robotics');
  });
});

// ---------------------------------------------------------------------------
// Context properties
// ---------------------------------------------------------------------------
describe('resolveApprovalContext — context properties', () => {
  it('collects port families from effects and workflow actions', () => {
    const ctx = resolveApprovalContext(
      makeApproval(),
      [makeEffect({ portFamily: 'FinanceAccounting' })],
      [],
      makeRun(),
      makeWorkflow({
        actions: [{ actionId: 'a1', order: 1, portFamily: 'PaymentsBilling', operation: 'Create' }],
      }),
    );
    expect(ctx.portFamilies.has('FinanceAccounting')).toBe(true);
    expect(ctx.portFamilies.has('PaymentsBilling')).toBe(true);
  });

  it('counts distinct SORs', () => {
    const ctx = resolveApprovalContext(
      makeApproval(),
      [
        makeEffect({ sorName: 'Odoo' }),
        makeEffect({ sorName: 'Stripe' }),
        makeEffect({ sorName: 'Odoo' }),
      ],
      [],
    );
    expect(ctx.sorCount).toBe(2);
  });

  it('detects evidence', () => {
    const ctx = resolveApprovalContext(makeApproval(), [], makeEvidence(3));
    expect(ctx.hasEvidence).toBe(true);
  });

  it('detects no evidence', () => {
    const ctx = resolveApprovalContext(makeApproval(), [], []);
    expect(ctx.hasEvidence).toBe(false);
  });

  it('falls back to Auto execution tier when no run', () => {
    const ctx = resolveApprovalContext(makeApproval(), [], []);
    expect(ctx.executionTier).toBe('Auto');
  });
});

// ---------------------------------------------------------------------------
// Mode visibility (relevance)
// ---------------------------------------------------------------------------
describe('getRelevantModes — mode visibility', () => {
  it('returns all modes when no context provided', () => {
    const modes = getRelevantModes();
    expect(modes.length).toBe(TRIAGE_MODES.length);
  });

  it('hides diff-view and action-replay when no effects', () => {
    const ctx = resolveApprovalContext(makeApproval(), [], []);
    const modes = getRelevantModes(ctx);
    const ids = modes.map((m) => m.id);
    expect(ids).not.toContain('diff-view');
    expect(ids).not.toContain('action-replay');
  });

  it('hides evidence-chain when no evidence', () => {
    const ctx = resolveApprovalContext(makeApproval(), [makeEffect()], []);
    const modes = getRelevantModes(ctx);
    const ids = modes.map((m) => m.id);
    expect(ids).not.toContain('evidence-chain');
  });

  it('shows evidence-chain when evidence exists', () => {
    const ctx = resolveApprovalContext(makeApproval(), [], makeEvidence(2));
    const modes = getRelevantModes(ctx);
    const ids = modes.map((m) => m.id);
    expect(ids).toContain('evidence-chain');
  });

  it('shows robotics-safety as recommended for robotics domain', () => {
    const ctx = resolveApprovalContext(makeApproval(), [], [], makeRun({ robotIds: ['r-1'] }));
    const modes = getRelevantModes(ctx);
    const roboticsMode = modes.find((m) => m.id === 'robotics-safety');
    expect(roboticsMode).toBeDefined();
    expect(roboticsMode!.relevance(ctx)).toBe('recommended');
  });

  it('hides robotics-safety for non-robotics domain', () => {
    const ctx = resolveApprovalContext(makeApproval(), [makeEffect()], []);
    const modes = getRelevantModes(ctx);
    const ids = modes.map((m) => m.id);
    expect(ids).not.toContain('robotics-safety');
  });

  it('shows finance-impact as recommended for finance domain', () => {
    const ctx = resolveApprovalContext(
      makeApproval(),
      [makeEffect({ portFamily: 'FinanceAccounting' })],
      [],
    );
    const modes = getRelevantModes(ctx);
    const finMode = modes.find((m) => m.id === 'finance-impact');
    expect(finMode).toBeDefined();
    expect(finMode!.relevance(ctx)).toBe('recommended');
  });

  it('shows agent-overview as recommended when agents present', () => {
    const ctx = resolveApprovalContext(makeApproval(), [], [], makeRun({ agentIds: ['agent-1'] }));
    const modes = getRelevantModes(ctx);
    const agentMode = modes.find((m) => m.id === 'agent-overview');
    expect(agentMode).toBeDefined();
    expect(agentMode!.relevance(ctx)).toBe('recommended');
  });

  it('hides agent-overview when no agents', () => {
    const ctx = resolveApprovalContext(makeApproval(), [makeEffect()], []);
    const modes = getRelevantModes(ctx);
    const ids = modes.map((m) => m.id);
    expect(ids).not.toContain('agent-overview');
  });
});

// ---------------------------------------------------------------------------
// Mode ordering
// ---------------------------------------------------------------------------
describe('getRelevantModes — ordering', () => {
  it('orders recommended modes before available modes', () => {
    const ctx = resolveApprovalContext(
      makeApproval(),
      [makeEffect({ portFamily: 'FinanceAccounting' })],
      makeEvidence(3),
    );
    const modes = getRelevantModes(ctx);
    const firstRecommendedIdx = modes.findIndex((m) => m.relevance(ctx) === 'recommended');
    const lastRecommendedIdx = modes.reduce(
      (last, m, i) => (m.relevance(ctx) === 'recommended' ? i : last),
      -1,
    );
    const firstAvailableIdx = modes.findIndex((m) => m.relevance(ctx) === 'available');

    if (firstRecommendedIdx !== -1 && firstAvailableIdx !== -1) {
      expect(lastRecommendedIdx).toBeLessThan(firstAvailableIdx);
    }
  });
});

// ---------------------------------------------------------------------------
// Context-aware cycling
// ---------------------------------------------------------------------------
describe('context-aware cycling', () => {
  it('cycles through only visible modes (forward)', () => {
    const ctx = resolveApprovalContext(makeApproval(), [], []);
    const modes = getRelevantModes(ctx);
    const first = modes[0]!.id;
    const second = getNextRelevantMode(first, ctx);
    expect(second).not.toBe(first);
    expect(modes.map((m) => m.id)).toContain(second);
  });

  it('cycles through only visible modes (backward)', () => {
    const ctx = resolveApprovalContext(makeApproval(), [], []);
    const modes = getRelevantModes(ctx);
    const first = modes[0]!.id;
    const prev = getPrevRelevantMode(first, ctx);
    expect(prev).toBe(modes[modes.length - 1]!.id);
  });

  it('wraps around forward', () => {
    const ctx = resolveApprovalContext(makeApproval(), [], []);
    const modes = getRelevantModes(ctx);
    const last = modes[modes.length - 1]!.id;
    const next = getNextRelevantMode(last, ctx);
    expect(next).toBe(modes[0]!.id);
  });

  it('falls back to first visible mode when current is hidden', () => {
    const ctx = resolveApprovalContext(makeApproval(), [], []);
    // evidence-chain should be hidden (no evidence)
    const next = getNextRelevantMode('evidence-chain', ctx);
    const modes = getRelevantModes(ctx);
    expect(modes.map((m) => m.id)).toContain(next);
  });

  it('skips hidden modes during cycling', () => {
    const ctx = resolveApprovalContext(makeApproval(), [], []);
    const modes = getRelevantModes(ctx);
    const ids = new Set(modes.map((m) => m.id));

    // Cycle through all modes and verify none are hidden
    let current = modes[0]!.id;
    const visited = new Set<string>();
    for (let i = 0; i < modes.length + 1; i++) {
      expect(ids.has(current)).toBe(true);
      visited.add(current);
      current = getNextRelevantMode(current, ctx);
    }
    // Should have visited all visible modes
    expect(visited.size).toBe(modes.length);
  });
});

// ---------------------------------------------------------------------------
// Graceful degradation
// ---------------------------------------------------------------------------
describe('graceful degradation', () => {
  it('returns default for empty inputs', () => {
    const ctx = resolveApprovalContext(makeApproval(), [], []);
    expect(ctx.domain).toBe('general');
    expect(ctx.hasRobots).toBe(false);
    expect(ctx.hasAgents).toBe(false);
    expect(ctx.hasEffects).toBe(false);
    expect(ctx.hasEvidence).toBe(false);
    expect(ctx.sorCount).toBe(0);
  });

  it('handles undefined run/workflow gracefully', () => {
    const ctx = resolveApprovalContext(makeApproval(), [makeEffect()], []);
    expect(ctx.executionTier).toBe('Auto');
    expect(ctx.hasRobots).toBe(false);
    expect(ctx.hasAgents).toBe(false);
  });

  it('getNextRelevantMode returns default for empty mode list', () => {
    // With no context, all modes are available so this shouldn't happen,
    // but test the fallback
    const next = getNextRelevantMode('default');
    expect(next).toBeDefined();
  });
});
