import { randomUUID } from 'node:crypto';

import { diffEffects, type VerifiedEffectV1 } from '../../domain/services/diff.js';
import { buildPlanFromWorkflow, validatePlanEffectIds } from '../../domain/services/planning.js';
import { assertValidRunStatusTransition } from '../../domain/services/run-status-transitions.js';
import type { RunStatus } from '../../domain/runs/run-v1.js';
import type { PlanV1, PlannedEffectV1 } from '../../domain/plan/plan-v1.js';
import type { EffectDiffResultV1 } from '../../domain/services/diff.js';
import type { WorkflowActionV1, WorkflowV1 } from '../../domain/workflows/workflow-v1.js';
import { NodeCryptoEvidenceHasher } from '../crypto/node-crypto-evidence-hasher.js';
import { appendEvidenceEntryV1, verifyEvidenceChainV1 } from '../../domain/evidence/evidence-chain-v1.js';
import type { EvidenceEntryV1 } from '../../domain/evidence/evidence-entry-v1.js';
import {
  CorrelationId,
  EffectId,
  EvidenceId,
  PlanId,
  RunId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';

export type StartRunActivityInput = Readonly<{
  runId: string;
  tenantId: string;
  workflowId: string;
  workflow: WorkflowV1;
  initiatedByUserId: string;
  correlationId: string;
  executionTier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
}>;

export function startRunActivity(input: StartRunActivityInput): Promise<void> {
  ensureRunState(input.tenantId, input.runId, 'Pending');
  transitionRun(input.tenantId, input.runId, 'Running');

  appendEvidence(input.tenantId, {
    schemaVersion: 1,
    evidenceId: EvidenceId(randomUUID()),
    workspaceId: WorkspaceId(input.tenantId),
    correlationId: CorrelationId(input.correlationId),
    occurredAtIso: new Date().toISOString(),
    category: 'System',
    summary: `Run started for workflow ${input.workflowId}.`,
    actor: { kind: 'System' },
    links: {
      runId: RunId(input.runId),
    },
  });

  // This is an application-level placeholder. Later beads will persist state to DB.
  return Promise.resolve();
}

export type CompleteRunActivityInput = Readonly<{
  runId: string;
  tenantId: string;
  workflowId: string;
  workflow: WorkflowV1;
  initiatedByUserId: string;
  correlationId: string;
}>;

export function completeRunActivity(input: CompleteRunActivityInput): Promise<void> {
  ensureRunState(input.tenantId, input.runId, 'Running');

  const nowIso = new Date().toISOString();

  const plan = buildPlanFromWorkflow({
    workflow: input.workflow,
    workspaceId: WorkspaceId(input.tenantId),
    createdByUserId: UserId(input.initiatedByUserId),
    planId: PlanId(randomUUID()),
    createdAtIso: nowIso,
    effectFactory: actionToPlannedEffect,
  });

  const validation = validatePlanEffectIds(plan);
  if (!validation.ok) {
    throw new Error(`Duplicate effect IDs in plan: ${validation.duplicateEffectIds.join(', ')}`);
  }

  setRunPlan(input.tenantId, input.runId, plan);

  appendEvidence(input.tenantId, {
    schemaVersion: 1,
    evidenceId: EvidenceId(randomUUID()),
    workspaceId: WorkspaceId(input.tenantId),
    correlationId: CorrelationId(input.correlationId),
    occurredAtIso: nowIso,
    category: 'Plan',
    summary: `Plan built with ${plan.plannedEffects.length} effects.`,
    actor: { kind: 'System' },
    links: {
      runId: RunId(input.runId),
      planId: plan.planId,
    },
  });

  // Execute actions (placeholder): treat each planned effect as verified success.
  const verified = plan.plannedEffects.map((p): VerifiedEffectV1 => ({
    effectId: p.effectId,
    operation: p.operation,
    target: p.target,
    summary: `Verified: ${p.summary}`,
    verifiedAtIso: nowIso,
  }));

  const diff = diffEffects({ planned: plan.plannedEffects, verified });
  setRunDiff(input.tenantId, input.runId, diff);

  appendEvidence(input.tenantId, {
    schemaVersion: 1,
    evidenceId: EvidenceId(randomUUID()),
    workspaceId: WorkspaceId(input.tenantId),
    correlationId: CorrelationId(input.correlationId),
    occurredAtIso: nowIso,
    category: 'System',
    summary: `Planned vs verified diff computed (clean=${diff.isClean}).`,
    actor: { kind: 'System' },
    links: {
      runId: RunId(input.runId),
      planId: plan.planId,
    },
    payloadRefs: [
      {
        kind: 'Diff',
        uri: `memory://runs/${encodeURIComponent(input.runId)}/diff`,
        contentType: 'application/json',
      },
    ],
  });

  transitionRun(input.tenantId, input.runId, 'Succeeded');

  // Verify chain integrity (defensive) to keep regressions visible early.
  const chain = getEvidenceChain(input.tenantId, input.runId);
  const verify = verifyEvidenceChainV1(chain, hasher);
  if (!verify.ok) {
    throw new Error(`Evidence chain invalid: ${verify.reason} (index=${verify.index})`);
  }

  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// In-memory state (temporary scaffolding until persistence beads land)
// ---------------------------------------------------------------------------

type RunExecutionState = {
  status: RunStatus;
  evidence: EvidenceEntryV1[];
  plan?: PlanV1;
  diff?: EffectDiffResultV1;
};

const hasher = new NodeCryptoEvidenceHasher();
const runs = new Map<string, RunExecutionState>();

function runKey(tenantId: string, runId: string): string {
  return `${tenantId}/${runId}`;
}

function ensureRunState(tenantId: string, runId: string, initial: RunStatus): RunExecutionState {
  const key = runKey(tenantId, runId);
  const existing = runs.get(key);
  if (existing) return existing;
  const created: RunExecutionState = { status: initial, evidence: [] };
  runs.set(key, created);
  return created;
}

function transitionRun(tenantId: string, runId: string, to: RunStatus): void {
  const state = ensureRunState(tenantId, runId, 'Pending');
  assertValidRunStatusTransition(state.status, to);
  state.status = to;
}

function setRunPlan(tenantId: string, runId: string, plan: PlanV1): void {
  const state = ensureRunState(tenantId, runId, 'Pending');
  state.plan = plan;
}

function setRunDiff(tenantId: string, runId: string, diff: EffectDiffResultV1): void {
  const state = ensureRunState(tenantId, runId, 'Pending');
  state.diff = diff;
}

function appendEvidence(
  tenantId: string,
  next: Omit<EvidenceEntryV1, 'previousHash' | 'hashSha256' | 'signatureBase64'>,
): EvidenceEntryV1 {
  const state = ensureRunState(tenantId, String(next.links?.runId ?? 'unknown'), 'Pending');
  const previous = state.evidence[state.evidence.length - 1];
  const entry = appendEvidenceEntryV1({ previous, next, hasher });
  state.evidence.push(entry);
  return entry;
}

function getEvidenceChain(tenantId: string, runId: string): readonly EvidenceEntryV1[] {
  const state = ensureRunState(tenantId, runId, 'Pending');
  return state.evidence;
}

function actionToPlannedEffect(action: WorkflowActionV1): PlannedEffectV1 {
  // Current workflow schema does not yet encode a typed effect operation.
  // Treat every action as an Upsert into an external system reference.
  return {
    effectId: EffectId(String(action.actionId)),
    operation: 'Upsert',
    target: {
      sorName: 'execution-plane',
      portFamily: action.portFamily,
      externalId: String(action.actionId),
      externalType: action.operation,
      displayLabel: action.operation,
    },
    summary: `Action ${action.order}: ${action.operation}`,
    idempotencyKey: String(action.actionId),
  };
}

export const __test = {
  reset(): void {
    runs.clear();
  },
  getRunStatus(tenantId: string, runId: string): RunStatus | undefined {
    return runs.get(runKey(tenantId, runId))?.status;
  },
  getEvidence(tenantId: string, runId: string): readonly EvidenceEntryV1[] {
    return runs.get(runKey(tenantId, runId))?.evidence ?? [];
  },
  getPlan(tenantId: string, runId: string): PlanV1 | undefined {
    return runs.get(runKey(tenantId, runId))?.plan;
  },
  getDiff(tenantId: string, runId: string): EffectDiffResultV1 | undefined {
    return runs.get(runKey(tenantId, runId))?.diff;
  },
};
