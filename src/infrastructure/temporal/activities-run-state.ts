import type { EffectDiffResultV1 } from '../../domain/services/diff.js';
import { assertValidRunStatusTransition } from '../../domain/services/run-status-transitions.js';
import type { RunStatus } from '../../domain/runs/run-v1.js';
import type { PlanV1 } from '../../domain/plan/plan-v1.js';
import type { EvidenceEntryV1 } from '../../domain/evidence/evidence-entry-v1.js';
import { NodeCryptoEvidenceHasher } from '../crypto/node-crypto-evidence-hasher.js';
import {
  appendEvidenceEntryV1,
  verifyEvidenceChainV1,
} from '../../domain/evidence/evidence-chain-v1.js';

interface RunExecutionState {
  status: RunStatus;
  evidence: EvidenceEntryV1[];
  plan?: PlanV1;
  diff?: EffectDiffResultV1;
}

const hasher = new NodeCryptoEvidenceHasher();
const runs = new Map<string, RunExecutionState>();

function runKey(tenantId: string, runId: string): string {
  return `${tenantId}/${runId}`;
}

export function ensureRunState(
  tenantId: string,
  runId: string,
  initial: RunStatus,
): RunExecutionState {
  const key = runKey(tenantId, runId);
  const existing = runs.get(key);
  if (existing) return existing;
  const created: RunExecutionState = { status: initial, evidence: [] };
  runs.set(key, created);
  return created;
}

export function transitionRun(tenantId: string, runId: string, to: RunStatus): void {
  const state = ensureRunState(tenantId, runId, 'Pending');
  assertValidRunStatusTransition(state.status, to);
  state.status = to;
}

export function setRunPlan(tenantId: string, runId: string, plan: PlanV1): void {
  const state = ensureRunState(tenantId, runId, 'Pending');
  state.plan = plan;
}

export function setRunDiff(tenantId: string, runId: string, diff: EffectDiffResultV1): void {
  const state = ensureRunState(tenantId, runId, 'Pending');
  state.diff = diff;
}

export function appendEvidence(
  tenantId: string,
  next: Omit<EvidenceEntryV1, 'previousHash' | 'hashSha256' | 'signatureBase64'>,
): EvidenceEntryV1 {
  const state = ensureRunState(tenantId, String(next.links?.runId ?? 'unknown'), 'Pending');
  const previous = state.evidence[state.evidence.length - 1];
  const entry = appendEvidenceEntryV1({ previous, next, hasher });
  state.evidence.push(entry);
  return entry;
}

export function verifyEvidenceChainOrThrow(tenantId: string, runId: string): void {
  const verify = verifyEvidenceChainV1(runStateTestApi.getEvidence(tenantId, runId), hasher);
  if (!verify.ok) {
    throw new Error(`Evidence chain invalid: ${verify.reason} (index=${verify.index})`);
  }
}

export const runStateTestApi = {
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
