import { describe, expect, it } from 'vitest';

import { RunId, WorkspaceId } from '../primitives/index.js';
import {
  createRunCharterExpansionEvidenceV1,
  evaluateRunCharterActionAuthorityV1,
  expandRunCharterV1,
  parseRunCharterLayerV1,
  parseRunCharterV1,
  summarizeRunCharterForCockpitV1,
  type RunCharterLayerV1,
} from './run-charter-v1.js';
import { parseRunV1 } from './run-v1.js';

const NOW = '2026-05-03T06:00:00.000Z';

const PLATFORM: RunCharterLayerV1 = {
  schemaVersion: 1,
  layerId: 'platform-baseline',
  scopeKind: 'PlatformBaseline',
  goal: 'Resolve routine invoice exceptions without bypassing governance.',
  successCondition: 'Invoice exceptions are reconciled or routed with evidence.',
  scopeBoundary: 'Only finance exception Actions for the current Workspace are in scope.',
  allowedActionClasses: ['finance.invoice.read', 'finance.invoice.annotate', 'finance.invoice.pay'],
  blockedActionClasses: ['finance.invoice.delete'],
  budgetCaps: [
    { metric: 'ToolCalls', hardStopAt: 20 },
    { metric: 'ModelSpendCents', hardStopAt: 2_000, currency: 'AUD' },
  ],
  timeWindow: {
    startsAtIso: '2026-05-03T00:00:00.000Z',
    endsAtIso: '2026-05-03T12:00:00.000Z',
  },
  evidenceDepth: 'standard',
  escalationTriggers: [
    {
      triggerId: 'policy-violation-high',
      exceptionClass: 'policy-violation',
      minSeverity: 'high',
      nextStepOptions: ['request-more-evidence', 'escalate'],
      rationale: 'High policy violations require live escalation.',
    },
  ],
  decisionBoundary: {
    localDecisionActionClasses: ['finance.invoice.read', 'finance.invoice.annotate'],
    approvalGateActionClasses: ['finance.invoice.pay'],
    interventionActionClasses: [],
  },
  summary: 'Platform baseline for governed finance Runs.',
};

describe('Run charter v1', () => {
  it('expands platform, tenant, Workspace, role, and Run layers without silent weakening', () => {
    const expanded = expandRunCharterV1({
      charterId: 'charter-1',
      expandedAtIso: NOW,
      layers: [
        PLATFORM,
        {
          schemaVersion: 1,
          layerId: 'tenant-finance',
          scopeKind: 'Tenant',
          allowedActionClasses: [
            'finance.invoice.read',
            'finance.invoice.annotate',
            'finance.invoice.pay',
            'finance.invoice.refund',
          ],
          budgetCaps: [{ metric: 'ToolCalls', hardStopAt: 40 }],
          summary: 'Tenant tries to expand finance authority.',
        },
        {
          schemaVersion: 1,
          layerId: 'workspace-ap',
          scopeKind: 'Workspace',
          allowedActionClasses: ['finance.invoice.read', 'finance.invoice.annotate'],
          budgetCaps: [{ metric: 'ToolCalls', hardStopAt: 10 }],
          evidenceDepth: 'deep',
          decisionBoundary: {
            localDecisionActionClasses: ['finance.invoice.pay'],
            approvalGateActionClasses: [],
            interventionActionClasses: ['finance.invoice.annotate'],
          },
          summary: 'Workspace narrows AP operations.',
        },
        {
          schemaVersion: 1,
          layerId: 'role-operator',
          scopeKind: 'RoleOrQueue',
          timeWindow: {
            startsAtIso: '2026-05-03T01:00:00.000Z',
            endsAtIso: '2026-05-03T08:00:00.000Z',
          },
          summary: 'Operator shift window.',
        },
        {
          schemaVersion: 1,
          layerId: 'run-charter',
          scopeKind: 'RunCharter',
          blockedActionClasses: ['finance.invoice.annotate'],
          summary: 'Run-specific block after anomaly review.',
        },
      ],
    });

    expect(expanded.charter.allowedActionClasses).toEqual(['finance.invoice.read']);
    expect(expanded.charter.version).toBe(1);
    expect(expanded.charter.blockedActionClasses).toEqual([
      'finance.invoice.annotate',
      'finance.invoice.delete',
    ]);
    expect(expanded.charter.budgetCaps).toContainEqual({
      metric: 'ToolCalls',
      hardStopAt: 10,
    });
    expect(expanded.charter.timeWindow).toEqual({
      startsAtIso: '2026-05-03T01:00:00.000Z',
      endsAtIso: '2026-05-03T08:00:00.000Z',
    });
    expect(expanded.charter.evidenceDepth).toBe('deep');
    expect(expanded.blockedWeakeningAttempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'allowedActionClasses',
          weakeningLayerId: 'tenant-finance',
          reason: 'action-class-expansion',
        }),
        expect.objectContaining({
          field: 'budgetCaps',
          weakeningLayerId: 'tenant-finance',
          reason: 'budget-cap-increase',
        }),
        expect.objectContaining({
          field: 'decisionBoundary.localDecisionActionClasses',
          weakeningLayerId: 'workspace-ap',
          reason: 'authority-boundary-relaxation',
        }),
      ]),
    );
    expect(expanded.cockpitSummary.localDecisionSummary).toBe('finance.invoice.read');
    expect(expanded.cockpitSummary.approvalGateSummary).toBe('None declared');
    expect(expanded.cockpitSummary.interventionSummary).toBe('None declared');
  });

  it('evaluates the explicit local decision, Approval Gate, and intervention boundary', () => {
    const expanded = expandRunCharterV1({
      charterId: 'charter-boundary-1',
      version: 3,
      expandedAtIso: NOW,
      layers: [PLATFORM],
    });

    expect(
      evaluateRunCharterActionAuthorityV1({
        charter: expanded.charter,
        actionClass: 'finance.invoice.read',
      }),
    ).toMatchObject({
      charterVersion: 3,
      decision: 'Allow',
      boundary: 'local-decision',
      permittedWithoutApprovalGate: true,
    });

    expect(
      evaluateRunCharterActionAuthorityV1({
        charter: expanded.charter,
        actionClass: 'finance.invoice.pay',
      }),
    ).toMatchObject({
      decision: 'RequireApproval',
      boundary: 'approval-gate',
      requiresApprovalGate: true,
    });

    expect(
      evaluateRunCharterActionAuthorityV1({
        charter: expanded.charter,
        actionClass: 'finance.invoice.delete',
      }),
    ).toMatchObject({
      decision: 'Deny',
      boundary: 'intervention',
      requiresRunIntervention: true,
    });

    expect(
      evaluateRunCharterActionAuthorityV1({
        charter: expanded.charter,
        actionClass: 'finance.invoice.refund',
      }),
    ).toMatchObject({
      decision: 'RequireApproval',
      boundary: 'approval-gate',
    });
  });

  it('parses a RunV1 with an attached typed Run charter', () => {
    const expanded = expandRunCharterV1({
      charterId: 'charter-run-1',
      expandedAtIso: NOW,
      layers: [PLATFORM],
    });

    const run = parseRunV1({
      schemaVersion: 1,
      runId: 'run-1',
      workspaceId: 'ws-1',
      workflowId: 'wf-1',
      correlationId: 'corr-1',
      executionTier: 'HumanApprove',
      initiatedByUserId: 'user-1',
      status: 'Running',
      createdAtIso: NOW,
      runCharter: expanded.charter,
    });

    expect(run.runCharter?.goal).toContain('invoice');
    expect(summarizeRunCharterForCockpitV1(run.runCharter!).localDecisionSummary).toContain(
      'finance.invoice.read',
    );
  });

  it('creates immutable expansion evidence with a canonical charter hash and diff trail', () => {
    const expanded = expandRunCharterV1({
      charterId: 'charter-evidence-1',
      expandedAtIso: NOW,
      layers: [PLATFORM],
    });
    const evidence = createRunCharterExpansionEvidenceV1({
      runId: RunId('run-1'),
      workspaceId: WorkspaceId('ws-1'),
      expanded,
      occurredAtIso: NOW,
      hasher: { sha256Hex: (input) => `hash:${input.length}` },
    });

    expect(evidence.evidenceKind).toBe('RunCharterExpansion');
    expect(evidence.charterHashSha256).toMatch(/^hash:/);
    expect(evidence.diffs).toContainEqual(
      expect.objectContaining({ field: 'goal', kind: 'selected' }),
    );
    expect(evidence.cockpitSummary.title).toBe('Run charter charter-evidence-1');
  });

  it('validates layer and expanded charter contracts', () => {
    expect(() =>
      parseRunCharterLayerV1({
        ...PLATFORM,
        scopeKind: 'Action',
      }),
    ).toThrow(/scopeKind/);

    const expanded = expandRunCharterV1({
      charterId: 'charter-parse-1',
      expandedAtIso: NOW,
      layers: [PLATFORM],
    });

    expect(() =>
      parseRunCharterV1({
        ...expanded.charter,
        timeWindow: {
          startsAtIso: '2026-05-04T00:00:00.000Z',
          endsAtIso: '2026-05-03T00:00:00.000Z',
        },
      }),
    ).toThrow(/endsAtIso/);
  });
});
