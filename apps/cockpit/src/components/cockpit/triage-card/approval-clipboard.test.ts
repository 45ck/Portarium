import { describe, expect, it } from 'vitest';
import type { ApprovalSummary } from '@portarium/cockpit-types';
import { buildApprovalClipboardText } from './approval-clipboard';

const APPROVAL: ApprovalSummary = {
  schemaVersion: 1,
  approvalId: 'approval-copy-v2',
  workspaceId: 'ws-public-safe',
  runId: 'run-public-safe',
  planId: 'plan-public-safe',
  prompt: 'Review a bounded provider summary',
  status: 'Pending',
  requestedAtIso: '2026-06-15T00:00:00.000Z',
  requestedByUserId: 'agent-public-safe',
  approvalPacket: {
    schemaVersion: 1,
    packetId: 'packet-copy-v2',
    operatorBrief: {
      schemaVersion: 1,
      action: 'Review a bounded provider summary.',
      whyGated: 'This touches a live account, so the scope must be checked first.',
      whatApprovingAllows: ['Read scoped metadata for a redacted summary.'],
      whatApprovingDoesNotAllow: ['No account settings, raw payloads, or external mutations.'],
      risk: 'Elevated: this touches account context.',
      rollback: 'Stop the review and discard the draft summary.',
      recommendation: 'Approve only if the evidence and scope are exact.',
      userVisibleConsequence: 'Approval records operator intent only.',
      authority: 'sensitive read with a scoped boundary',
    },
    decisionViews: [
      {
        id: 'execution',
        label: 'Execution view',
        stance: 'What can run',
        summary: 'No action runs from this card by itself.',
        bullets: ['Separate execution gates still apply.'],
        kind: 'flow',
        diagram: 'flowchart LR\n  card["Approval card"] --> gate["Executor gate"]',
        items: [{ label: 'Executor gate', value: 'Separate fail-closed gate.', tone: 'warning' }],
      },
    ],
    artifacts: [
      {
        artifactId: 'artifact-copy-v2',
        title: 'Synthetic approval request',
        mimeType: 'application/json',
        role: 'primary',
      },
    ],
    reviewDocs: [{ title: 'Review brief', markdown: '# Review' }],
    requestedCapabilities: [
      {
        capabilityId: 'openclaw.provider_read',
        reason: 'Review redacted provider signal.',
        required: true,
      },
    ],
    planScope: {
      planId: 'plan-public-safe',
      summary: 'Review synthetic provider signal.',
      actionIds: ['action-public-safe'],
      plannedEffectIds: ['effect-public-safe'],
    },
  },
};

describe('buildApprovalClipboardText approval experience metadata', () => {
  it('copies the human brief and decision viewpoints', () => {
    const text = buildApprovalClipboardText({
      approval: APPROVAL,
      plannedEffects: [],
      evidenceEntries: [],
    });

    expect(text).toContain('Approval Brief');
    expect(text).toContain('Action: Review a bounded provider summary.');
    expect(text).toContain('What approving does not allow: No account settings');
    expect(text).toContain('Decision Views');
    expect(text).toContain('Execution view: No action runs from this card by itself.');
    expect(text).toContain('Notes: Separate execution gates still apply.');
    expect(text).toContain('Kind: flow');
    expect(text).toContain('Items: Executor gate=Separate fail-closed gate. (warning)');
    expect(text).toContain('Diagram: flowchart LR');
  });

  it('copies a recovered monitor title instead of an object placeholder prompt', () => {
    const text = buildApprovalClipboardText({
      approval: {
        ...APPROVAL,
        prompt: 'Review monitor item: [object Object]',
        approvalPacket: {
          ...APPROVAL.approvalPacket!,
          planScope: {
            planId: 'plan-monitor-proof',
            summary:
              'Review latest standing-read monitor attention item: Tenant learning admin signal.',
            actionIds: ['action-monitor-proof'],
            plannedEffectIds: ['effect-monitor-proof'],
          },
        },
      },
      plannedEffects: [],
      evidenceEntries: [],
    });

    expect(text).toContain('Prompt: Review monitor item: Tenant learning admin signal');
    expect(text).not.toContain('[object Object]');
  });
});
