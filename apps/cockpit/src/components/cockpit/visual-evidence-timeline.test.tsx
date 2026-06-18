// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ApprovalPacket, EvidenceEntry } from '@portarium/cockpit-types';
import { VisualEvidenceTimeline } from './visual-evidence-timeline';

function evidence(overrides: Partial<EvidenceEntry> = {}): EvidenceEntry {
  return {
    schemaVersion: 1,
    evidenceId: 'ev-visual-1',
    workspaceId: 'ws-visual',
    occurredAtIso: '2026-06-15T00:00:00.000Z',
    category: 'System',
    summary: 'Browser Use screenshot captured',
    actor: { kind: 'System' },
    links: { runId: 'run-visual', approvalId: 'approval-visual' },
    hashSha256: 'a'.repeat(64),
    payloadRefs: [
      {
        kind: 'Snapshot',
        uri: 'visual-evidence://visual-1/full',
        contentType: 'image/png',
        sha256: 'b'.repeat(64),
        artifactId: 'visual-1',
        thumbnailUrl: 'http://127.0.0.1:19037/visual-evidence/visual-1/thumbnail?sig=test',
        fullUrl: 'http://127.0.0.1:19037/visual-evidence/visual-1/full?sig=test',
        sourceFamily: 'Browser Use Cloud Public Job Discovery',
        dataClass: 'public-browser-observation',
        displayPolicy: 'public-approved-browser-use',
        caption: 'Search results after the first browser step',
      },
    ],
    ...overrides,
  };
}

function approvalPacket(overrides: Partial<ApprovalPacket> = {}): ApprovalPacket {
  return {
    schemaVersion: 1,
    packetId: 'packet-visual-1',
    artifacts: [
      {
        artifactId: 'approval-card-json',
        title: 'Approval registry card',
        mimeType: 'application/json',
        role: 'primary',
      },
      {
        artifactId: 'visual-packet-1',
        title: 'Browser checkpoint',
        mimeType: 'image/png',
        role: 'decision-evidence',
        uri: 'visual-evidence://visual-packet-1/thumbnail',
        thumbnailUri: 'visual-evidence://visual-packet-1/thumbnail',
        fullUri: 'visual-evidence://visual-packet-1/full',
        thumbnailUrl: 'http://127.0.0.1:19037/visual-evidence/visual-packet-1/thumbnail?sig=test',
        fullUrl: 'http://127.0.0.1:19037/visual-evidence/visual-packet-1/full?sig=test',
        sourceFamily: 'Browser Use Cloud Public Job Discovery',
        dataClass: 'public-browser-observation',
        displayPolicy: 'public-approved-browser-use',
        caption: 'Packet-only browser checkpoint',
        sha256: 'd'.repeat(64),
      },
    ],
    visualEvidenceTimeline: [
      {
        artifactId: 'visual-packet-1',
        title: 'Browser checkpoint',
        mimeType: 'image/png',
        role: 'decision-evidence',
        uri: 'visual-evidence://visual-packet-1/thumbnail',
        thumbnailUrl: 'http://127.0.0.1:19037/visual-evidence/visual-packet-1/thumbnail?sig=test',
        fullUrl: 'http://127.0.0.1:19037/visual-evidence/visual-packet-1/full?sig=test',
        sourceFamily: 'Browser Use Cloud Public Job Discovery',
        dataClass: 'public-browser-observation',
        displayPolicy: 'public-approved-browser-use',
        caption: 'Packet-only browser checkpoint',
        sha256: 'd'.repeat(64),
      },
    ],
    reviewDocs: [{ title: 'Review brief', markdown: '# Review' }],
    requestedCapabilities: [
      {
        capabilityId: 'openclaw.browser_use_public_job_discovery',
        reason: 'Review visual evidence before deciding.',
        required: true,
      },
    ],
    planScope: {
      planId: 'plan-visual',
      summary: 'Review the visual evidence before approving.',
      actionIds: ['action-visual'],
      plannedEffectIds: ['effect-visual'],
    },
    ...overrides,
  };
}

afterEach(() => cleanup());

describe('VisualEvidenceTimeline', () => {
  it('renders authorized screenshot thumbnails and open evidence links', () => {
    render(<VisualEvidenceTimeline evidenceEntries={[evidence()]} />);

    expect(screen.getByText('Visual evidence')).not.toBeNull();
    expect(screen.getByAltText('Search results after the first browser step')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Open evidence' }).getAttribute('href')).toBe(
      'http://127.0.0.1:19037/visual-evidence/visual-1/full?sig=test',
    );
    expect(screen.getByText('public-browser-observation')).not.toBeNull();
  });

  it('degrades private or expired screenshot refs to metadata-only cards', () => {
    render(
      <VisualEvidenceTimeline
        evidenceEntries={[
          evidence({
            evidenceId: 'ev-private',
            payloadRefs: [
              {
                kind: 'Snapshot',
                uri: 'visual-evidence://private-1/full',
                contentType: 'image/png',
                sha256: 'c'.repeat(64),
                artifactId: 'private-1',
                dataClass: 'restricted-live-provider',
                displayPolicy: 'metadata-only',
                caption: 'Canvas grade detail checkpoint',
              },
            ],
          }),
        ]}
      />,
    );

    expect(screen.getByText('Canvas grade detail checkpoint')).not.toBeNull();
    expect(screen.getByText('Metadata only')).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Open evidence' })).toBeNull();
    expect(screen.getByText('restricted-live-provider')).not.toBeNull();
  });

  it('limits compact cards to the first three screenshots', () => {
    const entries = Array.from({ length: 4 }, (_, index) =>
      evidence({
        evidenceId: `ev-visual-${index}`,
        payloadRefs: [
          {
            kind: 'Snapshot',
            uri: `visual-evidence://visual-${index}/full`,
            contentType: 'image/png',
            artifactId: `visual-${index}`,
            thumbnailUrl: 'data:image/png;base64,AA==',
            caption: `Visual checkpoint ${index}`,
          },
        ],
      }),
    );

    render(<VisualEvidenceTimeline evidenceEntries={entries} variant="compact" maxItems={3} />);

    expect(screen.getByText('Visual checkpoint 0')).not.toBeNull();
    expect(screen.getByText('Visual checkpoint 2')).not.toBeNull();
    expect(screen.queryByText('Visual checkpoint 3')).toBeNull();
    expect(screen.getByText('+1 more visual evidence item in the full evidence view.')).not.toBeNull();
  });

  it('renders approval-packet visual evidence when no evidence entry is linked', () => {
    render(<VisualEvidenceTimeline evidenceEntries={[]} approvalPacket={approvalPacket()} />);

    expect(screen.getByText('Packet-only browser checkpoint')).not.toBeNull();
    expect(screen.getByAltText('Packet-only browser checkpoint')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Open evidence' }).getAttribute('href')).toBe(
      'http://127.0.0.1:19037/visual-evidence/visual-packet-1/full?sig=test',
    );
  });

  it('renders planned visual evidence as a pending screenshot placeholder', () => {
    render(
      <VisualEvidenceTimeline
        evidenceEntries={[]}
        approvalPacket={approvalPacket({
          visualEvidenceTimeline: [
            {
              artifactId: 'planned-screenshot',
              title: 'Expected screenshot after approval',
              mimeType: 'application/vnd.portarium.visual-evidence-plan+json',
              role: 'decision-evidence',
              sourceFamily: 'tenant-private-cloud-browser',
              sourceId: 'provider-notifications',
              dataClass: 'restricted-live-provider',
              displayPolicy: 'metadata-only',
            },
          ],
          artifacts: [
            {
              artifactId: 'approval-card-json',
              title: 'Approval registry card',
              mimeType: 'application/json',
              role: 'primary',
            },
            {
              artifactId: 'planned-screenshot',
              title: 'Expected screenshot after approval',
              mimeType: 'application/vnd.portarium.visual-evidence-plan+json',
              role: 'decision-evidence',
              sourceFamily: 'tenant-private-cloud-browser',
              sourceId: 'provider-notifications',
              dataClass: 'restricted-live-provider',
              displayPolicy: 'metadata-only',
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('Expected screenshot after approval')).not.toBeNull();
    expect(screen.getByText('Screenshot pending')).not.toBeNull();
    expect(screen.getByText('awaiting approved capture')).not.toBeNull();
    expect(
      screen.getByText('Image appears after approved execution stores a renderable artifact.'),
    ).not.toBeNull();
    expect(screen.queryByAltText('Expected screenshot after approval')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open evidence' })).toBeNull();
  });

  it('does not render raw provider screenshot URLs from approval packets', () => {
    render(
      <VisualEvidenceTimeline
        evidenceEntries={[]}
        approvalPacket={approvalPacket({
          visualEvidenceTimeline: undefined,
          artifacts: [
            {
              artifactId: 'approval-card-json',
              title: 'Approval registry card',
              mimeType: 'application/json',
              role: 'primary',
            },
            {
              artifactId: 'raw-provider-screenshot',
              title: 'Raw provider screenshot',
              mimeType: 'image/png',
              role: 'decision-evidence',
              thumbnailUrl: 'https://api.browser-use.com/sessions/123/screenshotUrl',
              fullUrl: 'https://api.browser-use.com/sessions/123/screenshotUrl/full',
              displayPolicy: 'public-approved-browser-use',
              dataClass: 'public-browser-observation',
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('Raw provider screenshot')).not.toBeNull();
    expect(screen.getByText('Metadata only')).not.toBeNull();
    expect(screen.queryByAltText('Raw provider screenshot')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open evidence' })).toBeNull();
  });
});
