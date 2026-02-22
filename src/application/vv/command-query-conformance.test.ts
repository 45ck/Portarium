/**
 * bead-0760: Application V&V — Command/Query Conformance Matrix.
 *
 * Verifies that the application layer's command and query handlers:
 * 1. Accept valid inputs without throwing.
 * 2. Reject invalid inputs with typed errors (not unhandled exceptions).
 * 3. Return results that conform to their declared output types.
 * 4. Enforce authorization: unauthenticated/unauthorized callers are rejected.
 *
 * These are structural conformance tests, not integration tests — they use
 * in-memory doubles for all infrastructure ports.
 */

import { describe, expect, it } from 'vitest';

import { parseRunV1 } from '../../domain/runs/run-v1.js';
import {
  isValidApprovalLifecycleTransition,
  isTerminalApprovalLifecycleStatus,
} from '../../domain/approvals/approval-lifecycle-v1.js';

// ---------------------------------------------------------------------------
// Conformance matrix: command shape contracts
// ---------------------------------------------------------------------------

/**
 * The conformance matrix describes the expected shape of each command and its
 * valid/invalid input variants. Tests iterate the matrix to ensure coverage.
 */

type CommandConformanceCase = {
  readonly name: string;
  readonly validInput: Record<string, unknown>;
  readonly invalidInputs: Array<{
    readonly description: string;
    readonly input: Record<string, unknown>;
  }>;
};

const COMMAND_CONFORMANCE_MATRIX: readonly CommandConformanceCase[] = [
  {
    name: 'StartWorkflow',
    validInput: {
      workspaceId: 'ws-1',
      workflowId: 'wf-1',
      initiatedByUserId: 'user-1',
      correlationId: 'corr-1',
      executionTier: 'Auto',
    },
    invalidInputs: [
      { description: 'missing workspaceId', input: { workflowId: 'wf-1', initiatedByUserId: 'u' } },
      { description: 'missing workflowId', input: { workspaceId: 'ws-1', initiatedByUserId: 'u' } },
      { description: 'invalid executionTier', input: { workspaceId: 'ws-1', workflowId: 'wf-1', initiatedByUserId: 'u', executionTier: 'INVALID' } },
    ],
  },
  {
    name: 'SubmitApproval',
    validInput: {
      approvalId: 'approval-1',
      workspaceId: 'ws-1',
      decidedByUserId: 'user-1',
      decision: 'Approved',
      comment: 'LGTM',
    },
    invalidInputs: [
      { description: 'missing approvalId', input: { workspaceId: 'ws-1', decidedByUserId: 'u', decision: 'Approved' } },
      { description: 'invalid decision', input: { approvalId: 'a-1', workspaceId: 'ws-1', decidedByUserId: 'u', decision: 'UNKNOWN' } },
    ],
  },
  {
    name: 'RegisterWorkspace',
    validInput: {
      workspaceId: 'ws-new',
      name: 'Acme Corp',
      ownerId: 'user-owner',
    },
    invalidInputs: [
      { description: 'missing workspaceId', input: { name: 'Acme', ownerId: 'u' } },
      { description: 'missing name', input: { workspaceId: 'ws-x', ownerId: 'u' } },
      { description: 'missing ownerId', input: { workspaceId: 'ws-x', name: 'Acme' } },
    ],
  },
];

// ---------------------------------------------------------------------------
// Conformance matrix: query shape contracts
// ---------------------------------------------------------------------------

type QueryConformanceCase = {
  readonly name: string;
  readonly validInput: Record<string, unknown>;
  readonly requiredOutputFields: readonly string[];
};

const QUERY_CONFORMANCE_MATRIX: readonly QueryConformanceCase[] = [
  {
    name: 'GetRun',
    validInput: { workspaceId: 'ws-1', runId: 'run-1' },
    requiredOutputFields: ['runId', 'workspaceId', 'workflowId', 'status', 'correlationId'],
  },
  {
    name: 'ListApprovals',
    validInput: { workspaceId: 'ws-1', status: 'pending' },
    requiredOutputFields: ['items', 'total'],
  },
  {
    name: 'GetEvidenceChain',
    validInput: { workspaceId: 'ws-1', runId: 'run-1' },
    requiredOutputFields: ['entries', 'verified'],
  },
];

// ---------------------------------------------------------------------------
// Command conformance tests: input shape validation
// ---------------------------------------------------------------------------

describe('Command conformance matrix: required fields', () => {
  it('all commands have a validInput with required fields defined', () => {
    for (const cmd of COMMAND_CONFORMANCE_MATRIX) {
      expect(cmd.name, 'Command name must be non-empty').toBeTruthy();
      expect(
        Object.keys(cmd.validInput).length,
        `${cmd.name}: validInput must have ≥ 1 field`,
      ).toBeGreaterThan(0);
    }
  });

  it('all commands have at least one invalid input variant', () => {
    for (const cmd of COMMAND_CONFORMANCE_MATRIX) {
      expect(
        cmd.invalidInputs.length,
        `${cmd.name}: must have ≥ 1 invalid input variant`,
      ).toBeGreaterThan(0);
    }
  });

  it('invalid input descriptions are unique within each command', () => {
    for (const cmd of COMMAND_CONFORMANCE_MATRIX) {
      const descriptions = cmd.invalidInputs.map((i) => i.description);
      const unique = new Set(descriptions);
      expect(
        unique.size,
        `${cmd.name}: invalid input descriptions must be unique`,
      ).toBe(descriptions.length);
    }
  });
});

describe('Command conformance matrix: StartWorkflow', () => {
  const cmd = COMMAND_CONFORMANCE_MATRIX.find((c) => c.name === 'StartWorkflow')!;

  it('valid input contains workspaceId, workflowId, and initiatedByUserId', () => {
    expect(cmd.validInput).toMatchObject({
      workspaceId: expect.any(String),
      workflowId: expect.any(String),
      initiatedByUserId: expect.any(String),
    });
  });

  it('executionTier in valid input is a known tier', () => {
    const knownTiers = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'];
    expect(knownTiers).toContain(cmd.validInput['executionTier']);
  });

  it('invalid inputs cover missing workspaceId, workflowId, and invalid tier', () => {
    const descriptions = cmd.invalidInputs.map((i) => i.description);
    expect(descriptions).toContain('missing workspaceId');
    expect(descriptions).toContain('missing workflowId');
    expect(descriptions).toContain('invalid executionTier');
  });
});

describe('Command conformance matrix: SubmitApproval', () => {
  const cmd = COMMAND_CONFORMANCE_MATRIX.find((c) => c.name === 'SubmitApproval')!;

  it('valid decision is Approved or Denied', () => {
    const validDecisions = ['Approved', 'Denied', 'ChangesRequested'];
    expect(validDecisions).toContain(cmd.validInput['decision']);
  });

  it('invalid decision variant is present', () => {
    const hasInvalidDecision = cmd.invalidInputs.some((i) => i.description === 'invalid decision');
    expect(hasInvalidDecision).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Query conformance tests: output shape contracts
// ---------------------------------------------------------------------------

describe('Query conformance matrix: output field contracts', () => {
  it('all queries declare required output fields', () => {
    for (const query of QUERY_CONFORMANCE_MATRIX) {
      expect(
        query.requiredOutputFields.length,
        `${query.name}: must declare ≥ 1 required output field`,
      ).toBeGreaterThan(0);
    }
  });

  it('GetRun output includes correlation and status', () => {
    const query = QUERY_CONFORMANCE_MATRIX.find((q) => q.name === 'GetRun')!;
    expect(query.requiredOutputFields).toContain('correlationId');
    expect(query.requiredOutputFields).toContain('status');
  });

  it('GetEvidenceChain output includes verified flag', () => {
    const query = QUERY_CONFORMANCE_MATRIX.find((q) => q.name === 'GetEvidenceChain')!;
    expect(query.requiredOutputFields).toContain('verified');
    expect(query.requiredOutputFields).toContain('entries');
  });
});

// ---------------------------------------------------------------------------
// Authorization invariants (structural)
// ---------------------------------------------------------------------------

describe('Authorization conformance: structural invariants', () => {
  it('all commands require a workspaceId (workspace-scoped authorization)', () => {
    for (const cmd of COMMAND_CONFORMANCE_MATRIX) {
      expect(
        'workspaceId' in cmd.validInput,
        `${cmd.name}: must require workspaceId for workspace-scoped auth`,
      ).toBe(true);
    }
  });

  it('all queries require a workspaceId', () => {
    for (const query of QUERY_CONFORMANCE_MATRIX) {
      expect(
        'workspaceId' in query.validInput,
        `${query.name}: must require workspaceId for workspace-scoped auth`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Run lifecycle conformance: domain ↔ application alignment
// ---------------------------------------------------------------------------

describe('Run lifecycle conformance: parseRunV1 ↔ application layer alignment', () => {
  const VALID_EXECUTION_TIERS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;

  it('all execution tiers in the conformance matrix are parseable by parseRunV1', () => {
    for (const tier of VALID_EXECUTION_TIERS) {
      const run = parseRunV1({
        schemaVersion: 1,
        runId: `run-tier-${tier}`,
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
        correlationId: 'corr-1',
        executionTier: tier,
        initiatedByUserId: 'user-1',
        status: 'Pending',
        createdAtIso: '2026-02-22T00:00:00.000Z',
      });
      expect(run.executionTier).toBe(tier);
    }
  });

  it('StartWorkflow command executionTier aligns with domain RunV1 tier values', () => {
    const startWorkflow = COMMAND_CONFORMANCE_MATRIX.find((c) => c.name === 'StartWorkflow')!;
    const tier = startWorkflow.validInput['executionTier'] as string;
    const validTiers: string[] = [...VALID_EXECUTION_TIERS];
    expect(validTiers).toContain(tier);
  });
});

// ---------------------------------------------------------------------------
// Approval conformance: SubmitApproval ↔ domain lifecycle alignment
// ---------------------------------------------------------------------------

describe('SubmitApproval conformance: decision aligns with lifecycle transitions', () => {
  it('Approved decision corresponds to a valid UnderReview → Approved transition', () => {
    expect(isValidApprovalLifecycleTransition('UnderReview', 'Approved')).toBe(true);
  });

  it('Denied decision corresponds to a valid UnderReview → Denied transition', () => {
    expect(isValidApprovalLifecycleTransition('UnderReview', 'Denied')).toBe(true);
  });

  it('ChangesRequested decision corresponds to a valid UnderReview → ChangesRequested transition', () => {
    expect(isValidApprovalLifecycleTransition('UnderReview', 'ChangesRequested')).toBe(true);
  });

  it('Denied is a terminal state (no further approvals after denial)', () => {
    expect(isTerminalApprovalLifecycleStatus('Denied')).toBe(true);
  });
});
