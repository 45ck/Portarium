/**
 * bead-0758: Workflow V&V — Structural invariants for workflow definitions.
 *
 * These tests verify domain invariants that must hold for any valid workflow:
 * - Tier monotonicity (action overrides cannot weaken workflow-level tier)
 * - Action ordering (contiguous, starting at 1)
 * - Schema version constraints
 * - Port family / capability consistency
 */

import { describe, expect, it } from 'vitest';

import { parseWorkflowV1, type WorkflowV1 } from '../workflows/workflow-v1.js';
import type { ExecutionTier } from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXECUTION_TIERS: ExecutionTier[] = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'];

const TIER_RANK: Record<ExecutionTier, number> = {
  Auto: 0,
  Assisted: 1,
  HumanApprove: 2,
  ManualOnly: 3,
};

function makeWorkflow(overrides: Record<string, unknown> = {}): unknown {
  return {
    schemaVersion: 1,
    workflowId: 'wf-vv-1',
    workspaceId: 'ws-vv-1',
    name: 'V&V test workflow',
    version: 1,
    active: true,
    executionTier: 'Auto',
    actions: [
      {
        actionId: 'act-1',
        order: 1,
        portFamily: 'SecretsVaulting',
        operation: 'secret:read',
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tier monotonicity
// ---------------------------------------------------------------------------

describe('Workflow V&V: tier monotonicity invariant', () => {
  it('every tier can override itself (identity)', () => {
    for (const tier of EXECUTION_TIERS) {
      const wf = parseWorkflowV1(
        makeWorkflow({
          executionTier: tier,
          actions: [
            {
              actionId: 'act-1',
              order: 1,
              portFamily: 'SecretsVaulting',
              operation: 'secret:read',
              executionTierOverride: tier,
            },
          ],
        }),
      );
      expect(wf.actions[0]?.executionTierOverride).toBe(tier);
    }
  });

  it('stricter overrides are always accepted', () => {
    for (const workflowTier of EXECUTION_TIERS) {
      const stricterTiers = EXECUTION_TIERS.filter((t) => TIER_RANK[t] > TIER_RANK[workflowTier]);
      for (const override of stricterTiers) {
        const wf = parseWorkflowV1(
          makeWorkflow({
            executionTier: workflowTier,
            actions: [
              {
                actionId: 'act-1',
                order: 1,
                portFamily: 'SecretsVaulting',
                operation: 'secret:read',
                executionTierOverride: override,
              },
            ],
          }),
        );
        expect(wf.actions[0]?.executionTierOverride).toBe(override);
      }
    }
  });

  it('weaker overrides are always rejected', () => {
    for (const workflowTier of EXECUTION_TIERS) {
      const weakerTiers = EXECUTION_TIERS.filter((t) => TIER_RANK[t] < TIER_RANK[workflowTier]);
      for (const override of weakerTiers) {
        expect(
          () =>
            parseWorkflowV1(
              makeWorkflow({
                executionTier: workflowTier,
                actions: [
                  {
                    actionId: 'act-1',
                    order: 1,
                    portFamily: 'SecretsVaulting',
                    operation: 'secret:read',
                    executionTierOverride: override,
                  },
                ],
              }),
            ),
          `${override} override should be rejected when workflow tier is ${workflowTier}`,
        ).toThrow(/less strict/i);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Action ordering
// ---------------------------------------------------------------------------

describe('Workflow V&V: action ordering invariant', () => {
  it('multi-action workflows must have contiguous 1-based ordering', () => {
    const wf = parseWorkflowV1(
      makeWorkflow({
        actions: [
          { actionId: 'a1', order: 1, portFamily: 'SecretsVaulting', operation: 'secret:read' },
          { actionId: 'a2', order: 2, portFamily: 'SecretsVaulting', operation: 'secret:write' },
          { actionId: 'a3', order: 3, portFamily: 'SecretsVaulting', operation: 'secret:read' },
        ],
      }),
    );
    expect(wf.actions).toHaveLength(3);
    for (let i = 0; i < wf.actions.length; i += 1) {
      expect(wf.actions[i]?.order).toBe(i + 1);
    }
  });

  it('gaps in ordering are rejected', () => {
    expect(() =>
      parseWorkflowV1(
        makeWorkflow({
          actions: [
            { actionId: 'a1', order: 1, portFamily: 'SecretsVaulting', operation: 'secret:read' },
            { actionId: 'a2', order: 3, portFamily: 'SecretsVaulting', operation: 'secret:write' },
          ],
        }),
      ),
    ).toThrow(/contiguous/i);
  });

  it('order starting at 0 is rejected', () => {
    expect(() =>
      parseWorkflowV1(
        makeWorkflow({
          actions: [
            { actionId: 'a1', order: 0, portFamily: 'SecretsVaulting', operation: 'secret:read' },
          ],
        }),
      ),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Schema version constraints
// ---------------------------------------------------------------------------

describe('Workflow V&V: schema version constraints', () => {
  it('schema version 1 accepts operation-only actions', () => {
    const wf = parseWorkflowV1(makeWorkflow({ schemaVersion: 1 }));
    expect(wf.schemaVersion).toBe(1);
  });

  it('schema version 2 requires capability on every action', () => {
    expect(() =>
      parseWorkflowV1(
        makeWorkflow({
          schemaVersion: 2,
          actions: [
            { actionId: 'a1', order: 1, portFamily: 'SecretsVaulting', operation: 'secret:read' },
          ],
        }),
      ),
    ).toThrow(/capability is required/i);
  });

  it('schema version 2 with capability is valid', () => {
    const wf = parseWorkflowV1(
      makeWorkflow({
        schemaVersion: 2,
        actions: [
          { actionId: 'a1', order: 1, portFamily: 'SecretsVaulting', capability: 'secret:read' },
        ],
      }),
    );
    expect(wf.schemaVersion).toBe(2);
  });

  it('unsupported schema versions are rejected', () => {
    expect(() => parseWorkflowV1(makeWorkflow({ schemaVersion: 0 }))).toThrow(/schemaVersion/i);
    expect(() => parseWorkflowV1(makeWorkflow({ schemaVersion: 3 }))).toThrow(/schemaVersion/i);
  });
});

// ---------------------------------------------------------------------------
// Workflow structural invariants
// ---------------------------------------------------------------------------

describe('Workflow V&V: structural invariants', () => {
  it('parsed workflow preserves all required fields', () => {
    const wf: WorkflowV1 = parseWorkflowV1(
      makeWorkflow({
        name: 'Test',
        description: 'A test workflow',
        version: 5,
        active: false,
      }),
    );

    expect(wf.workflowId).toBe('wf-vv-1');
    expect(wf.workspaceId).toBe('ws-vv-1');
    expect(wf.name).toBe('Test');
    expect(wf.description).toBe('A test workflow');
    expect(wf.version).toBe(5);
    expect(wf.active).toBe(false);
  });

  it('version must be >= 1', () => {
    expect(() => parseWorkflowV1(makeWorkflow({ version: 0 }))).toThrow(/version/i);
    expect(() => parseWorkflowV1(makeWorkflow({ version: -1 }))).toThrow(/version/i);
  });

  it('empty actions array is rejected', () => {
    expect(() => parseWorkflowV1(makeWorkflow({ actions: [] }))).toThrow(/non-empty/i);
  });
});
