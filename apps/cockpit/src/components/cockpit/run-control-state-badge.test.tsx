// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RunControlStateBadge } from './run-control-state-badge';

afterEach(() => {
  cleanup();
});

describe('RunControlStateBadge', () => {
  it('renders degraded recovery posture', () => {
    render(<RunControlStateBadge state="degraded" />);

    expect(screen.getByText('Degraded')).toBeTruthy();
  });

  it('renders nothing when a run has no control state', () => {
    const { container } = render(<RunControlStateBadge state={undefined} />);

    expect(container.textContent).toBe('');
  });
});
