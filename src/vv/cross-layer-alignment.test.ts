/**
 * bead-0758: Cross-layer V&V — Verify domain types align with cockpit
 * presentation types.
 *
 * These tests guard against drift between the domain layer (source of truth)
 * and the cockpit presentation types that the UI consumes. A failure here
 * means the cockpit could render stale or invalid status values.
 */

import { describe, expect, it } from 'vitest';

import type { RunStatus as DomainRunStatus } from '../domain/runs/run-v1.js';
import type { ApprovalStatus as DomainApprovalStatus } from '../domain/approvals/approval-v1.js';
import type { ExecutionTier as DomainExecutionTier } from '../domain/primitives/index.js';
import type { EvidenceCategory as DomainEvidenceCategory } from '../domain/evidence/evidence-entry-v1.js';
import type {
  RunStatus as CockpitRunStatus,
  ApprovalStatus as CockpitApprovalStatus,
  EvidenceCategory as CockpitEvidenceCategory,
} from '../presentation/ops-cockpit/types.js';

// ---------------------------------------------------------------------------
// Type-level alignment (compile-time)
// ---------------------------------------------------------------------------
//
// These assignments will fail to compile if the domain and cockpit types
// diverge. This catches drift at `npm run typecheck` time, before tests run.

type _AssertRunStatusMatch = DomainRunStatus extends CockpitRunStatus
  ? CockpitRunStatus extends DomainRunStatus
    ? true
    : 'CockpitRunStatus has values not in DomainRunStatus'
  : 'DomainRunStatus has values not in CockpitRunStatus';

const _runStatusCheck: _AssertRunStatusMatch = true;
void _runStatusCheck;

type _AssertApprovalStatusMatch = DomainApprovalStatus extends CockpitApprovalStatus
  ? CockpitApprovalStatus extends DomainApprovalStatus
    ? true
    : 'CockpitApprovalStatus has values not in DomainApprovalStatus'
  : 'DomainApprovalStatus has values not in CockpitApprovalStatus';

const _approvalStatusCheck: _AssertApprovalStatusMatch = true;
void _approvalStatusCheck;

type _AssertEvidenceCategoryMatch = DomainEvidenceCategory extends CockpitEvidenceCategory
  ? CockpitEvidenceCategory extends DomainEvidenceCategory
    ? true
    : 'CockpitEvidenceCategory has values not in DomainEvidenceCategory'
  : 'DomainEvidenceCategory has values not in CockpitEvidenceCategory';

const _evidenceCategoryCheck: _AssertEvidenceCategoryMatch = true;
void _evidenceCategoryCheck;

// ExecutionTier is inlined in cockpit types — check structurally
type CockpitExecutionTier = 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';

type _AssertExecutionTierMatch = DomainExecutionTier extends CockpitExecutionTier
  ? CockpitExecutionTier extends DomainExecutionTier
    ? true
    : 'CockpitExecutionTier has values not in DomainExecutionTier'
  : 'DomainExecutionTier has values not in CockpitExecutionTier';

const _executionTierCheck: _AssertExecutionTierMatch = true;
void _executionTierCheck;

// ---------------------------------------------------------------------------
// Runtime alignment (value-level)
// ---------------------------------------------------------------------------
//
// Compile-time checks catch structural drift but cannot verify that the
// *canonical list* of values is consistent when types are defined as unions
// in separate files. These tests use exhaustive const arrays to verify.

const DOMAIN_RUN_STATUSES: DomainRunStatus[] = [
  'Pending',
  'Running',
  'WaitingForApproval',
  'Paused',
  'Succeeded',
  'Failed',
  'Cancelled',
];

const COCKPIT_RUN_STATUSES: CockpitRunStatus[] = [
  'Pending',
  'Running',
  'WaitingForApproval',
  'Paused',
  'Succeeded',
  'Failed',
  'Cancelled',
];

const DOMAIN_APPROVAL_STATUSES: DomainApprovalStatus[] = [
  'Pending',
  'Approved',
  'Denied',
  'RequestChanges',
];

const COCKPIT_APPROVAL_STATUSES: CockpitApprovalStatus[] = [
  'Pending',
  'Approved',
  'Denied',
  'RequestChanges',
];

const DOMAIN_EVIDENCE_CATEGORIES: DomainEvidenceCategory[] = [
  'Plan',
  'Action',
  'Approval',
  'Policy',
  'PolicyViolation',
  'System',
];

const COCKPIT_EVIDENCE_CATEGORIES: CockpitEvidenceCategory[] = [
  'Plan',
  'Action',
  'Approval',
  'Policy',
  'PolicyViolation',
  'System',
];

const DOMAIN_EXECUTION_TIERS: DomainExecutionTier[] = [
  'Auto',
  'Assisted',
  'HumanApprove',
  'ManualOnly',
];

describe('Cross-layer type alignment: RunStatus', () => {
  it('domain and cockpit RunStatus values are identical', () => {
    expect(DOMAIN_RUN_STATUSES.sort()).toEqual(COCKPIT_RUN_STATUSES.sort());
  });

  it('every domain RunStatus is assignable to cockpit RunStatus', () => {
    for (const status of DOMAIN_RUN_STATUSES) {
      const cockpitStatus: CockpitRunStatus = status;
      expect(cockpitStatus).toBe(status);
    }
  });
});

describe('Cross-layer type alignment: ApprovalStatus', () => {
  it('domain and cockpit ApprovalStatus values are identical', () => {
    expect(DOMAIN_APPROVAL_STATUSES.sort()).toEqual(COCKPIT_APPROVAL_STATUSES.sort());
  });
});

describe('Cross-layer type alignment: EvidenceCategory', () => {
  it('domain and cockpit EvidenceCategory values are identical', () => {
    expect(DOMAIN_EVIDENCE_CATEGORIES.sort()).toEqual(COCKPIT_EVIDENCE_CATEGORIES.sort());
  });
});

describe('Cross-layer type alignment: ExecutionTier', () => {
  it('domain ExecutionTier values match cockpit tier values', () => {
    const cockpitTiers: CockpitExecutionTier[] = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'];
    expect(DOMAIN_EXECUTION_TIERS.sort()).toEqual(cockpitTiers.sort());
  });

  it('tier ranking is monotonic (Auto < Assisted < HumanApprove < ManualOnly)', () => {
    // Domain rule: action-level tier override cannot be less strict than workflow tier
    // This invariant depends on a consistent ordering across layers
    const tierRank: Record<DomainExecutionTier, number> = {
      Auto: 0,
      Assisted: 1,
      HumanApprove: 2,
      ManualOnly: 3,
    };

    // Use explicit ranked order, not the sorted array
    const rankedTiers: DomainExecutionTier[] = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'];
    for (let i = 0; i < rankedTiers.length - 1; i += 1) {
      const current = rankedTiers[i]!;
      const next = rankedTiers[i + 1]!;
      expect(tierRank[current], `${current} should rank lower than ${next}`).toBeLessThan(
        tierRank[next],
      );
    }
  });
});
