// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TriageProgressDots } from './triage-progress-dots';

describe('TriageProgressDots', () => {
  afterEach(() => {
    cleanup();
  });

  it('displays the correct position text', () => {
    render(<TriageProgressDots approvalId="appr-1" index={2} total={5} actionHistory={{}} />);
    expect(screen.getByText('3 of 5 pending')).toBeTruthy();
  });

  it('renders the correct number of dots', () => {
    const { container } = render(
      <TriageProgressDots approvalId="appr-1" index={0} total={4} actionHistory={{}} />,
    );
    const dotsContainer = container.querySelector('.flex.gap-1');
    expect(dotsContainer?.children.length).toBe(4);
  });
});
