// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ApprovalSummary } from '@portarium/cockpit-types';
import { buildApprovalCardContract } from './approval-card-contract';
import { TriageDefaultContent } from './triage-default-content';

const APPROVAL: ApprovalSummary = {
  schemaVersion: 1,
  approvalId: 'approval-approval-experience-v2',
  workspaceId: 'ws-public-safe',
  runId: 'run-public-safe',
  planId: 'plan-public-safe',
  prompt: 'Review a bounded mailbox summary',
  status: 'Pending',
  requestedAtIso: '2026-06-15T00:00:00.000Z',
  requestedByUserId: 'agent-public-safe',
  approvalPacket: {
    schemaVersion: 1,
    packetId: 'packet-public-safe',
    operatorBrief: {
      schemaVersion: 1,
      action: 'Review a bounded mailbox summary.',
      whyGated: 'This touches a live account, so the scope must be checked first.',
      whatApprovingAllows: ['Read visible message metadata for a redacted priority summary.'],
      whatApprovingDoesNotAllow: [
        'No replies, deletes, downloads, raw bodies, or settings changes.',
      ],
      risk: 'Elevated: this touches identity/account context.',
      rollback: 'Close the browser surface and discard the draft summary.',
      recommendation: 'Request changes unless the scope is exact.',
      userVisibleConsequence: 'Approval records intent only and does not send email.',
      authority: 'sensitive read with a scoped boundary',
    },
    decisionViews: [
      {
        id: 'recommended',
        label: 'Recommended path',
        stance: 'Decision brief',
        summary: 'Request changes unless the scope is exact.',
        bullets: ['Decide whether this exact mailbox view should be reviewed.'],
        kind: 'recommendation',
      },
      {
        id: 'privacy-security',
        label: 'Privacy and security',
        stance: 'Data boundary',
        summary: 'Secrets and raw provider payloads remain denied.',
        bullets: ['No raw mailbox body is returned.'],
        kind: 'risk',
        items: [
          {
            label: 'Denied',
            value: 'Raw mailbox body return',
            tone: 'critical',
          },
        ],
      },
      {
        id: 'approval-flow',
        label: 'Approval flow',
        stance: 'Mermaid/UML view',
        summary: 'OpenClaw must pass through policy, Cockpit, and a separate executor gate.',
        bullets: ['The approval card records intent only.'],
        kind: 'flow',
        diagram:
          'flowchart LR\n  proposal["OpenClaw proposal"] --> cockpit["Cockpit approval view"]',
        items: [
          {
            label: 'Executor gate',
            value: 'Separate fail-closed gate after approval.',
            tone: 'warning',
          },
        ],
      },
      {
        id: 'screenshot-acceptance',
        label: 'Screenshot acceptance',
        stance: 'Visual proof',
        summary: 'Render screenshot-specific approval information in the Evidence view.',
        bullets: ['The image is available only after the stored visual-evidence artifact exists.'],
        kind: 'evidence',
        items: [
          {
            label: 'Artifact state',
            value: 'Metadata-only until execution stores a renderable image.',
            tone: 'info',
          },
        ],
      },
    ],
    artifacts: [
      {
        artifactId: 'artifact-public-safe',
        title: 'Synthetic approval request',
        mimeType: 'application/json',
        role: 'primary',
      },
    ],
    reviewDocs: [{ title: 'Review brief', markdown: '# Review\n\nSynthetic evidence only.' }],
    requestedCapabilities: [
      {
        capabilityId: 'openclaw.email_query',
        reason: 'Review redacted signal before follow-up proposals.',
        required: true,
      },
    ],
    planScope: {
      planId: 'plan-public-safe',
      summary: 'Decide whether the synthetic mailbox summary may be reviewed.',
      actionIds: ['action-public-safe'],
      plannedEffectIds: ['effect-public-safe'],
    },
  },
};

afterEach(() => cleanup());

describe('TriageDefaultContent approval packet views', () => {
  it('renders the compact brief first and exposes flow, debate, risk, and evidence views', () => {
    const cardContract = buildApprovalCardContract({
      approval: APPROVAL,
      plannedEffects: [],
      evidenceEntries: [],
    });

    render(
      <TriageDefaultContent approval={APPROVAL} plannedEffects={[]} cardContract={cardContract} />,
    );

    expect(screen.getByRole('button', { name: 'Brief' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Review a bounded mailbox summary.')).not.toBeNull();
    expect(screen.getAllByText('Request changes unless the scope is exact.').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Flow' }));
    expect(screen.getByText('Approval flow')).not.toBeNull();
    expect(screen.getByLabelText('Approval flow diagram').textContent).toContain('flowchart LR');
    expect(screen.getByText('Executor gate')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Debate' }));
    expect(screen.getByText('Recommended path')).not.toBeNull();
    expect(screen.getByText('Privacy and security')).not.toBeNull();
    expect(screen.queryByText('Approval flow')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Risk' }));
    expect(screen.getByText('Approving allows')).not.toBeNull();
    expect(
      screen.getByText('No replies, deletes, downloads, raw bodies, or settings changes.'),
    ).not.toBeNull();
    expect(screen.getByText('Raw mailbox body return')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Evidence' }));
    expect(screen.getByText('Screenshot acceptance')).not.toBeNull();
    expect(screen.getByText('Artifact state')).not.toBeNull();
    expect(screen.getByText('Plan scope')).not.toBeNull();
    expect(screen.getAllByText('openclaw.email_query').length).toBeGreaterThan(0);
    expect(screen.getByText('Review brief')).not.toBeNull();
  });

  it('renders approval-packet visual evidence without a linked evidence row', () => {
    const approval: ApprovalSummary = {
      ...APPROVAL,
      approvalPacket: {
        ...APPROVAL.approvalPacket!,
        artifacts: [
          ...APPROVAL.approvalPacket!.artifacts,
          {
            artifactId: 'visual-packet-only',
            title: 'Packet-only browser checkpoint',
            mimeType: 'image/png',
            role: 'decision-evidence',
            thumbnailUrl:
              'http://127.0.0.1:19037/visual-evidence/visual-packet-only/thumbnail?sig=test',
            fullUrl: 'http://127.0.0.1:19037/visual-evidence/visual-packet-only/full?sig=test',
            dataClass: 'public-browser-observation',
            displayPolicy: 'public-approved-browser-use',
          },
        ],
      },
    };
    const cardContract = buildApprovalCardContract({
      approval,
      plannedEffects: [],
      evidenceEntries: [],
    });

    render(
      <TriageDefaultContent approval={approval} plannedEffects={[]} cardContract={cardContract} />,
    );

    expect(screen.getByText('Packet-only browser checkpoint')).not.toBeNull();
    expect(screen.getByAltText('Packet-only browser checkpoint')).not.toBeNull();
  });
});
