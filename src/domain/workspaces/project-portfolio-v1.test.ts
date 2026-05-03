import { describe, expect, it } from 'vitest';

import {
  classifyProjectGovernancePosture,
  parseProjectPortfolioV1,
} from './project-portfolio-v1.js';

const PROJECT = {
  schemaVersion: 1,
  projectId: 'proj-finance',
  workspaceId: 'ws-1',
  name: 'Finance Controls',
  status: 'Active',
  governancePosture: 'Attention',
  governance: {
    ownerUserIds: ['user-ops'],
    policyIds: ['policy-finance'],
    defaultExecutionTier: 'HumanApprove',
    evidenceDepth: 'deep',
    allowedActionClasses: ['finance.reconcile', 'finance.notify'],
    blockedActionClasses: ['finance.pay-large-supplier'],
  },
  metrics: {
    workItemCount: 4,
    activeRunCount: 1,
    pendingApprovalCount: 2,
    evidenceCount: 12,
    artifactCount: 3,
    policyViolationCount: 0,
  },
  latestActivityAtIso: '2026-05-01T09:00:00.000Z',
  summary: 'Governed finance remediation work.',
} as const;

describe('Project portfolio v1', () => {
  it('parses multiple Projects for one Workspace', () => {
    const portfolio = parseProjectPortfolioV1({
      schemaVersion: 1,
      workspaceId: 'ws-1',
      projects: [
        PROJECT,
        {
          ...PROJECT,
          projectId: 'proj-iam',
          name: 'IAM Access Review',
          governancePosture: 'Clear',
          metrics: {
            ...PROJECT.metrics,
            activeRunCount: 0,
            pendingApprovalCount: 0,
          },
        },
      ],
    });

    expect(portfolio.projects).toHaveLength(2);
    expect(portfolio.projects[0]!.projectId).toBe('proj-finance');
    expect(portfolio.projects[0]!.governance.policyIds).toEqual(['policy-finance']);
  });

  it('classifies governance posture from operational metrics', () => {
    expect(
      classifyProjectGovernancePosture({
        workItemCount: 0,
        activeRunCount: 0,
        pendingApprovalCount: 0,
        evidenceCount: 0,
        artifactCount: 0,
        policyViolationCount: 0,
      }),
    ).toBe('Clear');
    expect(
      classifyProjectGovernancePosture({
        workItemCount: 1,
        activeRunCount: 1,
        pendingApprovalCount: 0,
        evidenceCount: 0,
        artifactCount: 0,
        policyViolationCount: 0,
      }),
    ).toBe('Attention');
    expect(
      classifyProjectGovernancePosture({
        workItemCount: 1,
        activeRunCount: 0,
        pendingApprovalCount: 0,
        evidenceCount: 1,
        artifactCount: 0,
        policyViolationCount: 1,
      }),
    ).toBe('Blocked');
  });

  it('rejects a Project whose posture does not match its metrics', () => {
    expect(() =>
      parseProjectPortfolioV1({
        schemaVersion: 1,
        workspaceId: 'ws-1',
        projects: [{ ...PROJECT, governancePosture: 'Clear' }],
      }),
    ).toThrow(/governancePosture must be Attention/);
  });

  it('rejects Projects outside the portfolio Workspace', () => {
    expect(() =>
      parseProjectPortfolioV1({
        schemaVersion: 1,
        workspaceId: 'ws-1',
        projects: [{ ...PROJECT, workspaceId: 'ws-2' }],
      }),
    ).toThrow(/workspaceId must match portfolio workspaceId/);
  });

  it('rejects negative metrics', () => {
    expect(() =>
      parseProjectPortfolioV1({
        schemaVersion: 1,
        workspaceId: 'ws-1',
        projects: [
          {
            ...PROJECT,
            metrics: { ...PROJECT.metrics, workItemCount: -1 },
          },
        ],
      }),
    ).toThrow(/workItemCount must be a non-negative integer/);
  });
});
