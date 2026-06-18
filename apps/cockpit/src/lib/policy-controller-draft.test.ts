import { describe, expect, it } from 'vitest';
import type { PolicySummary } from '@portarium/cockpit-types';
import {
  buildPolicyControllerDraftPacket,
  buildPolicyControllerProposal,
  type PolicyControllerActionClass,
  type PolicyControllerToolRoute,
} from './policy-controller-draft';

const ACTIONS: readonly PolicyControllerActionClass[] = [
  { id: 'local-status', label: 'Status and safe reads', defaultDecision: 'allow' },
  { id: 'external-executor', label: 'Live changes', defaultDecision: 'deny' },
];

const POLICY = {
  policyId: 'pol-live-approval',
  name: 'Local human approval gate',
  description: 'Requires human review.',
  status: 'Active',
  ruleText: 'ALLOW WHEN run.executionTier == "HumanApprove"',
  conditions: [],
} as unknown as PolicySummary;

const TOOL_ROUTES: readonly PolicyControllerToolRoute[] = [
  {
    id: 'tool-gmail-send',
    label: 'Gmail send',
    toolName: 'gmail.message.send',
    provider: 'Gmail',
    actionClass: 'external-executor',
    riskCategory: 'Dangerous',
    minimumExecutionTier: 'ManualOnly',
    currentDecision: 'deny',
    decision: 'approval',
    source: 'custom',
    custom: true,
  },
];

describe('policy-controller-draft', () => {
  it('normalizes group routes into a controller packet', () => {
    const packet = buildPolicyControllerDraftPacket({
      actionClasses: ACTIONS,
      routes: { 'local-status': 'sandbox', 'external-executor': 'deny' },
      strictEvidence: true,
      dryRunExecutors: false,
    });

    expect(packet).toEqual({
      profile: 'cockpit-policy-controller-v1',
      settings: { strictEvidence: true, dryRunExecutors: false },
      routes: [
        {
          actionClass: 'local-status',
          label: 'Status and safe reads',
          decision: 'sandbox',
          policyDecision: 'allow_sandbox_only',
          executionTier: 'Assisted',
        },
        {
          actionClass: 'external-executor',
          label: 'Live changes',
          decision: 'deny',
          policyDecision: 'deny',
          executionTier: 'ManualOnly',
        },
      ],
    });
  });

  it('normalizes tool routes into the controller packet', () => {
    const packet = buildPolicyControllerDraftPacket({
      actionClasses: ACTIONS,
      routes: { 'local-status': 'allow', 'external-executor': 'deny' },
      toolRoutes: TOOL_ROUTES,
      strictEvidence: true,
      dryRunExecutors: true,
    });

    expect(packet.toolRoutes).toEqual([
      {
        toolId: 'tool-gmail-send',
        label: 'Gmail send',
        toolName: 'gmail.message.send',
        provider: 'Gmail',
        actionClass: 'external-executor',
        riskCategory: 'Dangerous',
        minimumExecutionTier: 'ManualOnly',
        currentDecision: 'deny',
        decision: 'approval',
        policyDecision: 'require_approval',
        executionTier: 'HumanApprove',
        source: 'custom',
        custom: true,
      },
    ]);
  });

  it('builds a high-risk policy-change proposal for approval', () => {
    const proposal = buildPolicyControllerProposal({
      workspaceId: 'ws-local-dev',
      selectedPolicy: POLICY,
      currentTier: 'HumanApprove',
      actionClasses: ACTIONS,
      routes: { 'local-status': 'allow', 'external-executor': 'approval' },
      toolRoutes: TOOL_ROUTES,
      strictEvidence: true,
      dryRunExecutors: true,
      rationale: 'Reduce friction for local status while keeping executors gated.',
      now: new Date('2026-05-01T00:00:00.000Z'),
    });

    expect(proposal).toMatchObject({
      policyId: 'pol-live-approval',
      operation: 'Update',
      risk: 'High',
      approvalRequired: true,
      replayReportRequired: false,
      runEffect: 'FutureRunsOnly',
      effectiveFromIso: '2026-05-01T00:01:00.000Z',
      proposedPolicy: {
        schemaVersion: 1,
        policyId: 'pol-live-approval',
        workspaceId: 'ws-local-dev',
        version: 2,
      },
    });
    expect(proposal.proposedPolicy.rules).toHaveLength(3);
    expect(proposal.proposedPolicy.rules?.[1]).toMatchObject({
      ruleId: 'controller-external-executor',
      effect: 'Allow',
    });
    expect(proposal.proposedPolicy.rules?.[2]).toMatchObject({
      ruleId: 'controller-tool-gmail-message-send',
      effect: 'Allow',
    });
    expect(proposal.diff[0]?.after).toMatchObject({
      profile: 'cockpit-policy-controller-v1',
      toolRoutes: [
        expect.objectContaining({
          toolName: 'gmail.message.send',
          riskCategory: 'Dangerous',
          minimumExecutionTier: 'ManualOnly',
          currentDecision: 'deny',
          decision: 'approval',
        }),
      ],
    });
  });

  it('keeps bounded standing email-read routing as a standard applied policy change', () => {
    const standingReadActions: readonly PolicyControllerActionClass[] = [
      { id: 'local-status', label: 'Status and safe reads', defaultDecision: 'allow' },
      { id: 'standing-read', label: 'Approved source reads', defaultDecision: 'allow' },
      { id: 'browser-query', label: 'Browser reads', defaultDecision: 'approval' },
      { id: 'external-executor', label: 'Live changes', defaultDecision: 'deny' },
    ];
    const standingReadTools: readonly PolicyControllerToolRoute[] = [
      {
        id: 'tool-calvin-standing-email-read',
        label: 'Standing email read',
        toolName: 'calvin.standing_cloud_browser_query',
        provider: 'OpenClaw bridge',
        actionClass: 'standing-read',
        riskCategory: 'ReadOnly',
        minimumExecutionTier: 'Auto',
        currentDecision: 'approval',
        decision: 'allow',
      },
    ];

    const proposal = buildPolicyControllerProposal({
      workspaceId: 'ws-local-dev',
      selectedPolicy: POLICY,
      currentTier: 'HumanApprove',
      actionClasses: standingReadActions,
      routes: {
        'local-status': 'allow',
        'standing-read': 'allow',
        'browser-query': 'approval',
        'external-executor': 'deny',
      },
      toolRoutes: standingReadTools,
      strictEvidence: true,
      dryRunExecutors: true,
      rationale: 'Allow one-at-a-time standing email reads while keeping broad browser use gated.',
      now: new Date('2026-05-01T00:00:00.000Z'),
    });

    expect(proposal).toMatchObject({
      risk: 'Standard',
      approvalRequired: false,
    });
    expect(proposal.diff[0]?.after).toMatchObject({
      toolRoutes: [
        expect.objectContaining({
          toolName: 'calvin.standing_cloud_browser_query',
          currentDecision: 'approval',
          decision: 'allow',
          policyDecision: 'allow',
        }),
      ],
    });
  });
});
