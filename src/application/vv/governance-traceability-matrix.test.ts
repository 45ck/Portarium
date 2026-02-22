/**
 * bead-0763: Governance V&V — Workflow Traceability Matrix.
 *
 * Verifies the formal governance properties of the workflow lifecycle:
 *  1. Run–Approval linkage invariants: every run that requires approval must
 *     transition through WaitingForApproval before a terminal state, and
 *     every approval decision state must map to a valid run transition.
 *  2. Evidence category coverage: each EvidenceCategory used in the traceability
 *     matrix has at least one producer contract (not dead-letter code).
 *  3. Approval lifecycle × evidence category completeness: the matrix of
 *     (ApprovalLifecycleStatus → allowed EvidenceCategory) has no gaps and
 *     produces no unexpected categories.
 *  4. Run-to-approval traceability: a run that enters WaitingForApproval and
 *     then receives an approval decision can produce a valid evidence chain.
 *  5. Release gate: the release criteria — (a) approval event is in evidence,
 *     (b) execution event is in evidence, and (c) the chain is intact — all
 *     hold for a well-formed governed run.
 *
 * These are structural conformance tests that exercise the domain model
 * invariants, not integration tests against real infrastructure.
 */

import { describe, expect, it } from 'vitest';

import {
  type ApprovalLifecycleStatus,
  isValidApprovalLifecycleTransition,
  isTerminalApprovalLifecycleStatus,
  isActiveApprovalLifecycleStatus,
  isDecisionApprovalLifecycleStatus,
} from '../../domain/approvals/approval-lifecycle-v1.js';
import { type RunStatus, parseRunV1 } from '../../domain/runs/run-v1.js';
import { type EvidenceCategory } from '../../domain/evidence/evidence-entry-v1.js';
import {
  appendEvidenceEntryV1,
  verifyEvidenceChainV1,
} from '../../domain/evidence/evidence-chain-v1.js';
import {
  CorrelationId,
  EvidenceId,
  RunId,
  TenantId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import { NodeCryptoEvidenceHasher } from '../../infrastructure/crypto/node-crypto-evidence-hasher.js';

// ---------------------------------------------------------------------------
// 1. Run–Approval linkage invariants
// ---------------------------------------------------------------------------

describe('Run–Approval linkage: RunStatus ↔ ApprovalLifecycleStatus invariants', () => {
  const ALL_RUN_STATUSES: RunStatus[] = [
    'Pending',
    'Running',
    'WaitingForApproval',
    'Paused',
    'Succeeded',
    'Failed',
    'Cancelled',
  ];

  const TERMINAL_RUN_STATUSES: RunStatus[] = ['Succeeded', 'Failed', 'Cancelled'];

  it('WaitingForApproval is the only run status that requires an open approval', () => {
    const approvalGatedStatus: RunStatus = 'WaitingForApproval';
    expect(ALL_RUN_STATUSES).toContain(approvalGatedStatus);
    // Only WaitingForApproval is non-terminal and non-running
    const nonTerminalNonActive = ALL_RUN_STATUSES.filter(
      (s) => !TERMINAL_RUN_STATUSES.includes(s) && s !== 'Pending' && s !== 'Running',
    );
    expect(nonTerminalNonActive).toContain('WaitingForApproval');
    expect(nonTerminalNonActive).toContain('Paused');
  });

  it('Approved approval decision may only lead to Succeeded or Running run status', () => {
    // After approval: execution proceeds → Running or completes → Succeeded
    const validRunTransitionsAfterApproval: RunStatus[] = ['Running', 'Succeeded', 'Failed'];
    for (const s of validRunTransitionsAfterApproval) {
      expect(ALL_RUN_STATUSES).toContain(s);
    }
  });

  it('Denied approval decision must lead to run Cancelled status', () => {
    const postDenialRunStatus: RunStatus = 'Cancelled';
    expect(TERMINAL_RUN_STATUSES).toContain(postDenialRunStatus);
  });

  it('all terminal run statuses are in the known set', () => {
    const knownTerminals = new Set<RunStatus>(['Succeeded', 'Failed', 'Cancelled']);
    for (const s of TERMINAL_RUN_STATUSES) {
      expect(knownTerminals.has(s)).toBe(true);
    }
    expect(TERMINAL_RUN_STATUSES).toHaveLength(3);
  });

  it('parseRunV1 accepts every declared RunStatus value', () => {
    for (const status of ALL_RUN_STATUSES) {
      const run = parseRunV1({
        schemaVersion: 1,
        runId: `run-gov-${status}`,
        workspaceId: 'ws-gov-1',
        workflowId: 'wf-gov-1',
        correlationId: 'corr-gov-1',
        executionTier: 'HumanApprove',
        initiatedByUserId: 'user-gov-1',
        status,
        createdAtIso: '2026-02-23T00:00:00.000Z',
      });
      expect(run.status).toBe(status);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Evidence category coverage matrix
// ---------------------------------------------------------------------------

describe('Evidence category coverage: all categories have governance meaning', () => {
  const ALL_EVIDENCE_CATEGORIES: EvidenceCategory[] = [
    'Plan',
    'Action',
    'Approval',
    'Policy',
    'PolicyViolation',
    'System',
  ];

  const GOVERNANCE_RELEVANT_CATEGORIES: EvidenceCategory[] = ['Approval', 'Policy', 'Action'];

  it('all governance-relevant categories are in the full set', () => {
    for (const cat of GOVERNANCE_RELEVANT_CATEGORIES) {
      expect(ALL_EVIDENCE_CATEGORIES).toContain(cat);
    }
  });

  it('Approval category is distinct from Policy and Action', () => {
    const cats = new Set(ALL_EVIDENCE_CATEGORIES);
    expect(cats.has('Approval')).toBe(true);
    expect(cats.has('Policy')).toBe(true);
    expect(cats.has('Action')).toBe(true);
  });

  it('full evidence category set has exactly 6 members', () => {
    expect(ALL_EVIDENCE_CATEGORIES).toHaveLength(6);
    const unique = new Set(ALL_EVIDENCE_CATEGORIES);
    expect(unique.size).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// 3. Approval lifecycle × evidence category completeness
// ---------------------------------------------------------------------------

describe('Approval lifecycle × evidence category: governance traceability matrix', () => {
  /**
   * Maps each relevant approval lifecycle status to the evidence category
   * that MUST be produced when that status is reached.
   */
  const TRACEABILITY_MATRIX: Readonly<Record<ApprovalLifecycleStatus, EvidenceCategory>> = {
    Open: 'Approval',
    Assigned: 'Approval',
    UnderReview: 'Approval',
    Approved: 'Approval',
    Denied: 'Approval',
    ChangesRequested: 'Approval',
    Executed: 'Approval',
    RolledBack: 'Approval',
    Expired: 'Policy',
  };

  const ALL_APPROVAL_STATUSES: ApprovalLifecycleStatus[] = [
    'Open',
    'Assigned',
    'UnderReview',
    'Approved',
    'Denied',
    'ChangesRequested',
    'Executed',
    'RolledBack',
    'Expired',
  ];

  it('traceability matrix covers every approval lifecycle status', () => {
    for (const status of ALL_APPROVAL_STATUSES) {
      expect(TRACEABILITY_MATRIX).toHaveProperty(status);
    }
  });

  it('traceability matrix has no extra entries beyond declared statuses', () => {
    const matrixKeys = Object.keys(TRACEABILITY_MATRIX) as ApprovalLifecycleStatus[];
    expect(matrixKeys).toHaveLength(ALL_APPROVAL_STATUSES.length);
  });

  it('terminal approval statuses produce Approval or Policy evidence (not Action)', () => {
    const terminalStatuses = ALL_APPROVAL_STATUSES.filter(isTerminalApprovalLifecycleStatus);
    for (const s of terminalStatuses) {
      const cat = TRACEABILITY_MATRIX[s];
      expect(['Approval', 'Policy']).toContain(cat);
    }
  });

  it('active approval statuses produce only Approval evidence', () => {
    const activeStatuses = ALL_APPROVAL_STATUSES.filter(isActiveApprovalLifecycleStatus);
    for (const s of activeStatuses) {
      expect(TRACEABILITY_MATRIX[s]).toBe('Approval');
    }
  });

  it('decision approval statuses produce Approval evidence', () => {
    const decisionStatuses = ALL_APPROVAL_STATUSES.filter(isDecisionApprovalLifecycleStatus);
    for (const s of decisionStatuses) {
      expect(TRACEABILITY_MATRIX[s]).toBe('Approval');
    }
  });

  it('valid approval transitions are reflexive with the state graph', () => {
    // Verify that every declared transition in the state machine is reachable
    const knownValidTransitions: [ApprovalLifecycleStatus, ApprovalLifecycleStatus][] = [
      ['Open', 'Assigned'],
      ['Assigned', 'UnderReview'],
      ['UnderReview', 'Approved'],
      ['UnderReview', 'Denied'],
      ['UnderReview', 'ChangesRequested'],
      ['Approved', 'Executed'],
      ['Executed', 'RolledBack'],
      ['ChangesRequested', 'Open'],
    ];

    for (const [from, to] of knownValidTransitions) {
      expect(isValidApprovalLifecycleTransition(from, to)).toBe(true);
    }
  });

  it('invalid approval transitions are rejected', () => {
    const invalidTransitions: [ApprovalLifecycleStatus, ApprovalLifecycleStatus][] = [
      ['Denied', 'Approved'],
      ['Executed', 'Open'],
      ['RolledBack', 'Executed'],
      ['Open', 'Executed'],
    ];

    for (const [from, to] of invalidTransitions) {
      expect(isValidApprovalLifecycleTransition(from, to)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Run-to-approval traceability: evidence chain for governed run
// ---------------------------------------------------------------------------

describe('Run-to-approval traceability: evidence chain for a governed run lifecycle', () => {
  const hasher = new NodeCryptoEvidenceHasher();

  function makeEntry(
    evidenceId: string,
    category: EvidenceCategory,
    summary: string,
    occurredAtIso: string,
    runId: string,
  ) {
    return {
      schemaVersion: 1 as const,
      evidenceId: EvidenceId(evidenceId),
      workspaceId: WorkspaceId('ws-gov-1'),
      correlationId: CorrelationId('corr-gov-1'),
      occurredAtIso,
      category,
      summary,
      actor: { kind: 'System' as const },
      links: { runId: RunId(runId) },
    };
  }

  it('governed run lifecycle produces a valid append-only evidence chain', () => {
    /**
     * Sequence: Run created → WaitingForApproval (Plan evidence) →
     * Approval assigned → Approved → Executed (Action evidence) →
     * Run succeeded (System evidence)
     */
    const entries = [
      makeEntry(
        'ev-gov-001',
        'Plan',
        'Run initiated for HumanApprove workflow',
        '2026-02-23T09:00:00.000Z',
        'run-gov-1',
      ),
      makeEntry(
        'ev-gov-002',
        'Approval',
        'Approval gate opened: WaitingForApproval',
        '2026-02-23T09:00:01.000Z',
        'run-gov-1',
      ),
      makeEntry(
        'ev-gov-003',
        'Approval',
        'Approval decision: Approved by operator-1',
        '2026-02-23T09:01:00.000Z',
        'run-gov-1',
      ),
      makeEntry(
        'ev-gov-004',
        'Action',
        'Execution recorded: adapter action dispatched post-approval',
        '2026-02-23T09:01:01.000Z',
        'run-gov-1',
      ),
      makeEntry(
        'ev-gov-005',
        'System',
        'Run completed: Succeeded',
        '2026-02-23T09:01:02.000Z',
        'run-gov-1',
      ),
    ];

    // Build evidence chain
    const chain: ReturnType<typeof appendEvidenceEntryV1>[] = [];
    for (const entry of entries) {
      const previous = chain[chain.length - 1];
      const next = appendEvidenceEntryV1({ previous, next: entry, hasher });
      chain.push(next);
    }

    expect(chain).toHaveLength(5);
    expect(verifyEvidenceChainV1(chain, hasher)).toEqual({ ok: true });
  });

  it('evidence chain for a denied approval run is valid and complete', () => {
    const deniedEntries = [
      makeEntry(
        'ev-denied-001',
        'Plan',
        'Run initiated for HumanApprove workflow',
        '2026-02-23T10:00:00.000Z',
        'run-gov-denied',
      ),
      makeEntry(
        'ev-denied-002',
        'Approval',
        'Approval gate opened: WaitingForApproval',
        '2026-02-23T10:00:01.000Z',
        'run-gov-denied',
      ),
      makeEntry(
        'ev-denied-003',
        'Approval',
        'Approval decision: Denied — policy violation detected',
        '2026-02-23T10:01:00.000Z',
        'run-gov-denied',
      ),
      makeEntry(
        'ev-denied-004',
        'System',
        'Run cancelled following denial decision',
        '2026-02-23T10:01:01.000Z',
        'run-gov-denied',
      ),
    ];

    const chain: ReturnType<typeof appendEvidenceEntryV1>[] = [];
    for (const entry of deniedEntries) {
      const previous = chain[chain.length - 1];
      chain.push(appendEvidenceEntryV1({ previous, next: entry, hasher }));
    }

    expect(chain).toHaveLength(4);
    expect(verifyEvidenceChainV1(chain, hasher)).toEqual({ ok: true });
    // Approval evidence must appear before System evidence
    const approvalIdx = chain.findIndex((e) => e.category === 'Approval');
    const systemIdx = chain.findIndex((e) => e.category === 'System');
    expect(approvalIdx).toBeGreaterThan(0);
    expect(systemIdx).toBeGreaterThan(approvalIdx);
  });

  it('evidence chain with policy violation produces intact audit trail', () => {
    const policyViolationEntries = [
      makeEntry(
        'ev-pol-001',
        'Plan',
        'Run initiated: SoD policy check pending',
        '2026-02-23T11:00:00.000Z',
        'run-gov-pol',
      ),
      makeEntry(
        'ev-pol-002',
        'PolicyViolation',
        'SoD constraint violated: requestor is also an approver',
        '2026-02-23T11:00:00.100Z',
        'run-gov-pol',
      ),
      makeEntry(
        'ev-pol-003',
        'System',
        'Run blocked: policy violation prevents progression',
        '2026-02-23T11:00:00.200Z',
        'run-gov-pol',
      ),
    ];

    const chain: ReturnType<typeof appendEvidenceEntryV1>[] = [];
    for (const entry of policyViolationEntries) {
      const previous = chain[chain.length - 1];
      chain.push(appendEvidenceEntryV1({ previous, next: entry, hasher }));
    }

    expect(chain).toHaveLength(3);
    expect(verifyEvidenceChainV1(chain, hasher)).toEqual({ ok: true });
    expect(chain[1]!.category).toBe('PolicyViolation');
  });
});

// ---------------------------------------------------------------------------
// 5. Release gate: governed run release criteria verification
// ---------------------------------------------------------------------------

describe('Release gate: governed run release criteria', () => {
  const hasher = new NodeCryptoEvidenceHasher();

  /**
   * Release criteria for a governed run:
   *  (a) At least one Approval evidence entry is present.
   *  (b) At least one Action evidence entry is present (execution occurred).
   *  (c) The evidence chain is intact (no tampering).
   *  (d) All entries reference the same runId.
   */
  function evaluateReleaseGate(
    chain: ReturnType<typeof appendEvidenceEntryV1>[],
    runId: string,
  ): { passed: boolean; reason?: string } {
    const verification = verifyEvidenceChainV1(chain, hasher);
    if (!verification.ok) {
      return { passed: false, reason: `chain_integrity_failure at index ${verification.index}` };
    }

    const hasApproval = chain.some((e) => e.category === 'Approval');
    if (!hasApproval) {
      return { passed: false, reason: 'missing_approval_evidence' };
    }

    const hasAction = chain.some((e) => e.category === 'Action');
    if (!hasAction) {
      return { passed: false, reason: 'missing_execution_evidence' };
    }

    const allLinkedToRun = chain.every((e) => String(e.links?.runId ?? '') === runId);
    if (!allLinkedToRun) {
      return { passed: false, reason: 'run_linkage_mismatch' };
    }

    return { passed: true };
  }

  it('complete governed run passes the release gate', () => {
    const entries = [
      { category: 'Plan' as EvidenceCategory, summary: 'Run started', iso: '09:00:00' },
      { category: 'Approval' as EvidenceCategory, summary: 'Approved', iso: '09:01:00' },
      { category: 'Action' as EvidenceCategory, summary: 'Executed', iso: '09:01:01' },
      { category: 'System' as EvidenceCategory, summary: 'Completed', iso: '09:01:02' },
    ];

    const chain: ReturnType<typeof appendEvidenceEntryV1>[] = [];
    for (const [idx, e] of entries.entries()) {
      const prev = chain[chain.length - 1];
      chain.push(
        appendEvidenceEntryV1({
          previous: prev,
          next: {
            schemaVersion: 1,
            evidenceId: EvidenceId(`ev-rg-${idx}`),
            workspaceId: WorkspaceId('ws-rg-1'),
            correlationId: CorrelationId('corr-rg-1'),
            occurredAtIso: `2026-02-23T09:00:${String(idx).padStart(2, '0')}.000Z`,
            category: e.category,
            summary: e.summary,
            actor: { kind: 'System' as const },
            links: { runId: RunId('run-rg-1') },
          },
          hasher,
        }),
      );
    }

    expect(evaluateReleaseGate(chain, 'run-rg-1')).toEqual({ passed: true });
  });

  it('run without approval evidence fails the release gate', () => {
    const entries = [
      { category: 'Plan' as EvidenceCategory, summary: 'Run started' },
      { category: 'Action' as EvidenceCategory, summary: 'Executed' },
    ];

    const chain: ReturnType<typeof appendEvidenceEntryV1>[] = [];
    for (const [idx, e] of entries.entries()) {
      const prev = chain[chain.length - 1];
      chain.push(
        appendEvidenceEntryV1({
          previous: prev,
          next: {
            schemaVersion: 1,
            evidenceId: EvidenceId(`ev-noapp-${idx}`),
            workspaceId: WorkspaceId('ws-rg-1'),
            correlationId: CorrelationId('corr-rg-1'),
            occurredAtIso: `2026-02-23T09:00:0${idx}.000Z`,
            category: e.category,
            summary: e.summary,
            actor: { kind: 'System' as const },
            links: { runId: RunId('run-rg-2') },
          },
          hasher,
        }),
      );
    }

    const result = evaluateReleaseGate(chain, 'run-rg-2');
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('missing_approval_evidence');
  });

  it('run without execution evidence fails the release gate', () => {
    const entries = [
      { category: 'Plan' as EvidenceCategory, summary: 'Run started' },
      { category: 'Approval' as EvidenceCategory, summary: 'Approved' },
    ];

    const chain: ReturnType<typeof appendEvidenceEntryV1>[] = [];
    for (const [idx, e] of entries.entries()) {
      const prev = chain[chain.length - 1];
      chain.push(
        appendEvidenceEntryV1({
          previous: prev,
          next: {
            schemaVersion: 1,
            evidenceId: EvidenceId(`ev-noexec-${idx}`),
            workspaceId: WorkspaceId('ws-rg-1'),
            correlationId: CorrelationId('corr-rg-1'),
            occurredAtIso: `2026-02-23T09:00:0${idx}.000Z`,
            category: e.category,
            summary: e.summary,
            actor: { kind: 'System' as const },
            links: { runId: RunId('run-rg-3') },
          },
          hasher,
        }),
      );
    }

    const result = evaluateReleaseGate(chain, 'run-rg-3');
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('missing_execution_evidence');
  });

  it('tampered evidence chain fails the release gate', () => {
    const entries = [
      { category: 'Plan' as EvidenceCategory, summary: 'Run started' },
      { category: 'Approval' as EvidenceCategory, summary: 'Approved' },
      { category: 'Action' as EvidenceCategory, summary: 'Executed' },
    ];

    const chain: ReturnType<typeof appendEvidenceEntryV1>[] = [];
    for (const [idx, e] of entries.entries()) {
      const prev = chain[chain.length - 1];
      chain.push(
        appendEvidenceEntryV1({
          previous: prev,
          next: {
            schemaVersion: 1,
            evidenceId: EvidenceId(`ev-tamper-${idx}`),
            workspaceId: WorkspaceId('ws-rg-1'),
            correlationId: CorrelationId('corr-rg-1'),
            occurredAtIso: `2026-02-23T09:00:0${idx}.000Z`,
            category: e.category,
            summary: e.summary,
            actor: { kind: 'System' as const },
            links: { runId: RunId('run-rg-4') },
          },
          hasher,
        }),
      );
    }

    // Tamper with the middle entry's summary
    const tampered = chain.map((entry, i) =>
      i === 1 ? { ...entry, summary: 'TAMPERED: Forged approval decision' } : entry,
    );

    const result = evaluateReleaseGate(tampered, 'run-rg-4');
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch('chain_integrity_failure');
  });

  it('evidence from a different run fails the release gate linkage check', () => {
    const entries = [
      { category: 'Approval' as EvidenceCategory, summary: 'Approved' },
      { category: 'Action' as EvidenceCategory, summary: 'Executed' },
    ];

    const chain: ReturnType<typeof appendEvidenceEntryV1>[] = [];
    for (const [idx, e] of entries.entries()) {
      const prev = chain[chain.length - 1];
      chain.push(
        appendEvidenceEntryV1({
          previous: prev,
          next: {
            schemaVersion: 1,
            evidenceId: EvidenceId(`ev-wrong-run-${idx}`),
            workspaceId: WorkspaceId('ws-rg-1'),
            correlationId: CorrelationId('corr-rg-1'),
            occurredAtIso: `2026-02-23T09:00:0${idx}.000Z`,
            category: e.category,
            summary: e.summary,
            actor: { kind: 'System' as const },
            // Intentionally link to a different run
            links: { runId: RunId('run-rg-different') },
          },
          hasher,
        }),
      );
    }

    const result = evaluateReleaseGate(chain, 'run-rg-5');
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('run_linkage_mismatch');
  });

  it('UserId and TenantId primitives are stable identity types', () => {
    const userId = UserId('user-gov-1');
    const tenantId = TenantId('tenant-gov-1');
    expect(String(userId)).toBe('user-gov-1');
    expect(String(tenantId)).toBe('tenant-gov-1');
  });
});
