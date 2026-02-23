// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { RunStatus } from '@portarium/cockpit-types';
import { RunStatusBadge } from './run-status-badge';

describe('RunStatusBadge', () => {
  afterEach(() => {
    cleanup();
  });

  const statuses: RunStatus[] = [
    'Pending',
    'Running',
    'WaitingForApproval',
    'Paused',
    'Succeeded',
    'Failed',
    'Cancelled',
  ];

  it.each(statuses)('renders label for status %s', (status) => {
    render(<RunStatusBadge status={status} />);
    const expectedLabels: Record<RunStatus, string> = {
      Pending: 'Pending',
      Running: 'Running',
      WaitingForApproval: 'Waiting',
      Paused: 'Paused',
      Succeeded: 'Succeeded',
      Failed: 'Failed',
      Cancelled: 'Cancelled',
    };
    expect(screen.getByText(expectedLabels[status])).toBeTruthy();
  });

  it('renders without error for every RunStatus variant', () => {
    for (const status of statuses) {
      const { unmount } = render(<RunStatusBadge status={status} />);
      unmount();
    }
  });
});
