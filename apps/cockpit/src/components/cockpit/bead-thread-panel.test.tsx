// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BeadThreadPanel } from './bead-thread-panel';
import type { BeadThreadStreamState } from '@/hooks/queries/use-bead-thread-stream';

afterEach(() => {
  cleanup();
});

const LIVE_STATE: BeadThreadStreamState = {
  status: 'open',
  error: null,
  lastEventId: 'evt-2',
  entries: [
    {
      id: 'tc-read',
      toolName: 'read_file',
      args: { path: 'apps/cockpit/src/routes.tsx' },
      status: 'success',
      policyTier: 'Auto',
      blastRadius: 'low',
      agentId: 'agent:openclaw',
    },
    {
      id: 'tc-push',
      toolName: 'git_push',
      args: { remote: 'origin', branch: 'main' },
      status: 'awaiting_approval',
      policyTier: 'HumanApprove',
      blastRadius: 'critical',
      approvalId: 'appr-0975',
      policyRuleId: 'INFRA-WRITE-002',
      message: 'Review push to main',
    },
  ],
};

describe('BeadThreadPanel', () => {
  it('renders a mobile-friendly live feed with policy and blast-radius badges', () => {
    render(
      <BeadThreadPanel
        workspaceId=""
        beadId="bead-0975"
        beadTitle="Build bead thread panel"
        streamState={LIVE_STATE}
      />,
    );

    expect(screen.getByText('bead-0975: Build bead thread panel')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('read_file')).toBeTruthy();
    expect(screen.getByText('git_push')).toBeTruthy();
    expect(screen.getByText('AUTO')).toBeTruthy();
    expect(screen.getByText('HUMAN-APPROVE')).toBeTruthy();
    expect(screen.getByText('critical')).toBeTruthy();
    expect(screen.getByText('1 awaiting')).toBeTruthy();
  });

  it('exposes a review affordance for approval gates', () => {
    const onReviewApproval = vi.fn();

    render(
      <BeadThreadPanel
        workspaceId=""
        beadId="bead-0975"
        streamState={LIVE_STATE}
        onReviewApproval={onReviewApproval}
      />,
    );

    expect(screen.getByText('Approval Gate')).toBeTruthy();
    expect(screen.getByText('Review push to main')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /review/i }));

    expect(onReviewApproval).toHaveBeenCalledTimes(1);
    expect(onReviewApproval).toHaveBeenCalledWith(
      'appr-0975',
      expect.objectContaining({ id: 'tc-push' }),
    );
  });

  it('renders empty and error states', () => {
    render(
      <BeadThreadPanel
        workspaceId=""
        beadId="bead-0975"
        streamState={{
          status: 'reconnecting',
          error: 'Stream failed with status 503',
          lastEventId: null,
          entries: [],
        }}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('Stream failed with status 503');
    expect(screen.getByText('Waiting for bead events.')).toBeTruthy();
    expect(screen.getByText('Reconnecting')).toBeTruthy();
  });
});
