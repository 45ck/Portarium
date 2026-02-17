import { describe, expect, it, vi } from 'vitest';

import {
  PlanId,
  UserId,
  WorkspaceId,
  WorkflowId,
  ActionId,
  EffectId,
} from '../primitives/index.js';
import type { PortFamily } from '../primitives/index.js';
import type { ExternalObjectRef } from '../canonical/external-object-ref.js';
import type { WorkflowV1, WorkflowActionV1 } from '../workflows/workflow-v1.js';
import type { PlannedEffectV1 } from '../plan/plan-v1.js';

import { buildPlanFromWorkflow, validatePlanEffectIds } from './planning.js';

const makeAction = (id: string, order: number): WorkflowActionV1 => ({
  actionId: ActionId(id),
  order,
  portFamily: 'FinanceAccounting' as PortFamily,
  operation: 'invoice:read',
});

const makeRef = (): ExternalObjectRef => ({
  sorName: 'test-sor',
  portFamily: 'FinanceAccounting',
  externalId: 'ext-1',
  externalType: 'Invoice',
});

const makeWorkflow = (actions: readonly WorkflowActionV1[]): WorkflowV1 => ({
  schemaVersion: 1,
  workflowId: WorkflowId('wf-1'),
  workspaceId: WorkspaceId('ws-1'),
  name: 'Test Workflow',
  version: 1,
  active: true,
  executionTier: 'Auto',
  actions,
});

const makeEffect = (id: string): PlannedEffectV1 => ({
  effectId: EffectId(id),
  operation: 'Create',
  target: makeRef(),
  summary: `Effect ${id}`,
});

describe('buildPlanFromWorkflow', () => {
  it('creates plan from workflow actions', () => {
    const workflow = makeWorkflow([makeAction('a-1', 1)]);
    const factory = (): PlannedEffectV1 => makeEffect('eff-1');

    const plan = buildPlanFromWorkflow({
      workflow,
      workspaceId: WorkspaceId('ws-1'),
      createdByUserId: UserId('user-1'),
      planId: PlanId('plan-1'),
      createdAtIso: '2026-02-17T00:00:00.000Z',
      effectFactory: factory,
    });

    expect(plan.planId).toBe('plan-1');
    expect(plan.workspaceId).toBe('ws-1');
    expect(plan.createdByUserId).toBe('user-1');
    expect(plan.createdAtIso).toBe('2026-02-17T00:00:00.000Z');
    expect(plan.plannedEffects).toHaveLength(1);
  });

  it('maps each action through effectFactory', () => {
    const actions = [makeAction('a-1', 1), makeAction('a-2', 2)];
    const workflow = makeWorkflow(actions);
    const factory = vi.fn((action: WorkflowActionV1): PlannedEffectV1 => {
      return makeEffect(`eff-${action.actionId as string}`);
    });

    buildPlanFromWorkflow({
      workflow,
      workspaceId: WorkspaceId('ws-1'),
      createdByUserId: UserId('user-1'),
      planId: PlanId('plan-1'),
      createdAtIso: '2026-02-17T00:00:00.000Z',
      effectFactory: factory,
    });

    expect(factory).toHaveBeenCalledTimes(2);
    expect(factory).toHaveBeenCalledWith(actions[0]);
    expect(factory).toHaveBeenCalledWith(actions[1]);
  });

  it('returns correct schemaVersion', () => {
    const workflow = makeWorkflow([makeAction('a-1', 1)]);
    const factory = (): PlannedEffectV1 => makeEffect('eff-1');

    const plan = buildPlanFromWorkflow({
      workflow,
      workspaceId: WorkspaceId('ws-1'),
      createdByUserId: UserId('user-1'),
      planId: PlanId('plan-1'),
      createdAtIso: '2026-02-17T00:00:00.000Z',
      effectFactory: factory,
    });

    expect(plan.schemaVersion).toBe(1);
  });

  it('handles workflow with multiple actions', () => {
    const actions = [makeAction('a-1', 1), makeAction('a-2', 2), makeAction('a-3', 3)];
    const workflow = makeWorkflow(actions);
    let counter = 0;
    const factory = (): PlannedEffectV1 => {
      counter += 1;
      return makeEffect(`eff-${counter}`);
    };

    const plan = buildPlanFromWorkflow({
      workflow,
      workspaceId: WorkspaceId('ws-1'),
      createdByUserId: UserId('user-1'),
      planId: PlanId('plan-1'),
      createdAtIso: '2026-02-17T00:00:00.000Z',
      effectFactory: factory,
    });

    expect(plan.plannedEffects).toHaveLength(3);
    expect(plan.plannedEffects[0]?.effectId).toBe('eff-1');
    expect(plan.plannedEffects[1]?.effectId).toBe('eff-2');
    expect(plan.plannedEffects[2]?.effectId).toBe('eff-3');
  });
});

describe('validatePlanEffectIds', () => {
  it('returns ok for unique effectIds', () => {
    const plan = buildPlanFromWorkflow({
      workflow: makeWorkflow([makeAction('a-1', 1), makeAction('a-2', 2)]),
      workspaceId: WorkspaceId('ws-1'),
      createdByUserId: UserId('user-1'),
      planId: PlanId('plan-1'),
      createdAtIso: '2026-02-17T00:00:00.000Z',
      effectFactory: () => {
        return makeEffect(`eff-${Math.random()}`);
      },
    });

    const result = validatePlanEffectIds(plan);
    expect(result).toEqual({ ok: true });
  });

  it('detects duplicate effectIds', () => {
    const plan = buildPlanFromWorkflow({
      workflow: makeWorkflow([makeAction('a-1', 1), makeAction('a-2', 2)]),
      workspaceId: WorkspaceId('ws-1'),
      createdByUserId: UserId('user-1'),
      planId: PlanId('plan-1'),
      createdAtIso: '2026-02-17T00:00:00.000Z',
      effectFactory: () => makeEffect('same-id'),
    });

    const result = validatePlanEffectIds(plan);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.duplicateEffectIds).toContain('same-id');
    }
  });

  it('handles empty plannedEffects', () => {
    const plan = {
      schemaVersion: 1 as const,
      planId: PlanId('plan-1'),
      workspaceId: WorkspaceId('ws-1'),
      createdAtIso: '2026-02-17T00:00:00.000Z',
      createdByUserId: UserId('user-1'),
      plannedEffects: [] as readonly PlannedEffectV1[],
    };

    const result = validatePlanEffectIds(plan);
    expect(result).toEqual({ ok: true });
  });
});
