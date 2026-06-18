import { describe, expect, it } from 'vitest';

import { parseApprovalPacketV1 } from './approval-packet-v1.js';

const VALID_PACKET = {
  schemaVersion: 1,
  packetId: 'packet-1',
  artifacts: [
    {
      artifactId: 'artifact-1',
      title: 'Generated launch brief',
      mimeType: 'text/markdown',
      role: 'primary',
      evidenceId: 'evidence-1',
      sha256: 'sha256-abc',
    },
  ],
  reviewDocs: [{ title: 'Review brief', markdown: '# Review\n\nCheck the proposed copy.' }],
  requestedCapabilities: [
    {
      capabilityId: 'marketing.campaign.write',
      reason: 'Publish approved campaign assets.',
      required: true,
    },
  ],
  planScope: {
    planId: 'plan-1',
    summary: 'Publish the generated artifact and update campaign metadata.',
    actionIds: ['action-render', 'action-publish'],
    plannedEffectIds: ['effect-1', 'effect-2'],
  },
} as const;

const VALID_PACKET_WITH_APPROVAL_EXPERIENCE = {
  ...VALID_PACKET,
  operatorBrief: {
    schemaVersion: 1,
    action: 'Review a bounded mailbox summary.',
    whyGated: 'This touches a live account, so the scope must be checked first.',
    whatApprovingAllows: ['Read visible message metadata for a redacted priority summary.'],
    whatApprovingDoesNotAllow: ['No replies, deletes, downloads, raw bodies, or settings changes.'],
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
      kind: 'flow',
      diagram: 'flowchart LR\n  proposal["OpenClaw proposal"] --> cockpit["Cockpit approval view"]',
      items: [
        {
          label: 'Authority',
          value: 'sensitive read with a scoped boundary',
          tone: 'warning',
        },
      ],
    },
  ],
} as const;

const VALID_PACKET_WITH_VISUAL_EVIDENCE = {
  ...VALID_PACKET,
  artifacts: [
    ...VALID_PACKET.artifacts,
    {
      artifactId: 'visual-artifact-1',
      title: 'Browser checkpoint',
      mimeType: 'image/png',
      role: 'decision-evidence',
      uri: 'visual-evidence://visual-artifact-1/thumbnail',
      thumbnailUri: 'visual-evidence://visual-artifact-1/thumbnail',
      fullUri: 'visual-evidence://visual-artifact-1/full',
      thumbnailUrl: 'http://127.0.0.1:19037/visual-evidence/visual-artifact-1/thumbnail?sig=test',
      fullUrl: 'http://127.0.0.1:19037/visual-evidence/visual-artifact-1/full?sig=test',
      evidenceKind: 'Snapshot',
      sourceFamily: 'Browser Use Cloud Public Job Discovery',
      sourceId: 'browser-use-cloud',
      dataClass: 'public-browser-observation',
      retention: 'private artifact',
      displayPolicy: 'public-approved-browser-use',
      caption: 'Search result checkpoint',
      capturedAtUtc: '2026-06-15T00:00:00.000Z',
      runId: 'run-visual',
      approvalId: 'approval-visual',
      messageId: 'message-2',
      correlationId: 'corr-visual',
      sha256: 'b'.repeat(64),
    },
  ],
  visualEvidenceTimeline: [
    {
      artifactId: 'visual-artifact-1',
      title: 'Browser checkpoint',
      mimeType: 'image/png',
      role: 'decision-evidence',
      thumbnailUrl: 'http://127.0.0.1:19037/visual-evidence/visual-artifact-1/thumbnail?sig=test',
      displayPolicy: 'public-approved-browser-use',
    },
  ],
} as const;

describe('parseApprovalPacketV1', () => {
  it('parses artifact-first review packet content', () => {
    const packet = parseApprovalPacketV1(VALID_PACKET);

    expect(packet.artifacts[0]?.role).toBe('primary');
    expect(packet.reviewDocs[0]?.markdown).toContain('# Review');
    expect(packet.requestedCapabilities[0]?.capabilityId).toBe('marketing.campaign.write');
    expect(packet.planScope.actionIds).toEqual(['action-render', 'action-publish']);
  });

  it('parses optional operator brief and decision views', () => {
    const packet = parseApprovalPacketV1(VALID_PACKET_WITH_APPROVAL_EXPERIENCE);

    expect(packet.operatorBrief?.action).toBe('Review a bounded mailbox summary.');
    expect(packet.operatorBrief?.whatApprovingDoesNotAllow[0]).toContain('No replies');
    expect(packet.decisionViews?.[0]?.label).toBe('Recommended path');
    expect(packet.decisionViews?.[0]?.kind).toBe('flow');
    expect(packet.decisionViews?.[0]?.diagram).toContain('flowchart LR');
    expect(packet.decisionViews?.[0]?.items?.[0]?.tone).toBe('warning');
  });

  it('parses decision-evidence visual artifact metadata for review display', () => {
    const packet = parseApprovalPacketV1(VALID_PACKET_WITH_VISUAL_EVIDENCE);
    const artifact = packet.artifacts.find((item) => item.role === 'decision-evidence');

    expect(artifact?.artifactId).toBe('visual-artifact-1');
    expect(artifact?.thumbnailUrl).toContain('/visual-evidence/visual-artifact-1/thumbnail');
    expect(artifact?.displayPolicy).toBe('public-approved-browser-use');
    expect(artifact?.evidenceKind).toBe('Snapshot');
    expect(packet.visualEvidenceTimeline?.[0]?.role).toBe('decision-evidence');
  });

  it('requires a primary artifact', () => {
    expect(() =>
      parseApprovalPacketV1({
        ...VALID_PACKET,
        artifacts: [{ ...VALID_PACKET.artifacts[0], role: 'supporting' }],
      }),
    ).toThrow(/primary artifact/i);
  });

  it('requires markdown review docs, requested capabilities, and Plan scope ids', () => {
    expect(() => parseApprovalPacketV1({ ...VALID_PACKET, reviewDocs: [] })).toThrow(
      /reviewDocs must be a non-empty array/,
    );
    expect(() => parseApprovalPacketV1({ ...VALID_PACKET, requestedCapabilities: [] })).toThrow(
      /requestedCapabilities must be a non-empty array/,
    );
    expect(() =>
      parseApprovalPacketV1({
        ...VALID_PACKET,
        planScope: { ...VALID_PACKET.planScope, actionIds: [] },
      }),
    ).toThrow(/planScope\.actionIds must be a non-empty array/);
  });

  it('rejects duplicate Plan scope ids', () => {
    expect(() =>
      parseApprovalPacketV1({
        ...VALID_PACKET,
        planScope: { ...VALID_PACKET.planScope, actionIds: ['action-render', 'action-render'] },
      }),
    ).toThrow(/duplicate/);
  });

  it('requires complete approval experience metadata when present', () => {
    expect(() =>
      parseApprovalPacketV1({
        ...VALID_PACKET_WITH_APPROVAL_EXPERIENCE,
        operatorBrief: {
          ...VALID_PACKET_WITH_APPROVAL_EXPERIENCE.operatorBrief,
          recommendation: '',
        },
      }),
    ).toThrow(/operatorBrief\.recommendation must be a non-empty string/);
    expect(() =>
      parseApprovalPacketV1({
        ...VALID_PACKET_WITH_APPROVAL_EXPERIENCE,
        decisionViews: [],
      }),
    ).toThrow(/decisionViews must be a non-empty array/);
    expect(() =>
      parseApprovalPacketV1({
        ...VALID_PACKET_WITH_APPROVAL_EXPERIENCE,
        decisionViews: [
          {
            ...VALID_PACKET_WITH_APPROVAL_EXPERIENCE.decisionViews[0],
            kind: 'html',
          },
        ],
      }),
    ).toThrow(/decisionViews\[0\]\.kind must be/);
    expect(() =>
      parseApprovalPacketV1({
        ...VALID_PACKET_WITH_APPROVAL_EXPERIENCE,
        decisionViews: [
          {
            ...VALID_PACKET_WITH_APPROVAL_EXPERIENCE.decisionViews[0],
            items: [
              {
                label: 'Authority',
                value: 'sensitive read with a scoped boundary',
                tone: 'urgent',
              },
            ],
          },
        ],
      }),
    ).toThrow(/decisionViews\[0\]\.items\[0\]\.tone must be/);
  });
});
