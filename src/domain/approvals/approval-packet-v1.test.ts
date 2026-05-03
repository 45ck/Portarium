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

describe('parseApprovalPacketV1', () => {
  it('parses artifact-first review packet content', () => {
    const packet = parseApprovalPacketV1(VALID_PACKET);

    expect(packet.artifacts[0]?.role).toBe('primary');
    expect(packet.reviewDocs[0]?.markdown).toContain('# Review');
    expect(packet.requestedCapabilities[0]?.capabilityId).toBe('marketing.campaign.write');
    expect(packet.planScope.actionIds).toEqual(['action-render', 'action-publish']);
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
});
