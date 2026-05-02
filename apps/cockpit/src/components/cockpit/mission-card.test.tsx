// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MissionCard, MissionStatusIndicator } from './mission-card';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => true,
  };
});

afterEach(() => {
  cleanup();
});

describe('MissionCard', () => {
  it('renders the mission card pattern with status, metric, and footer', () => {
    render(
      <MissionCard
        eyebrow="Approval Gates"
        title="Approval Waits"
        status="waiting"
        metric="3"
        footer="agent sessions blocked on human approval"
      >
        <span>Queue pressure</span>
      </MissionCard>,
    );

    expect(screen.getByText('Approval Gates')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Approval Waits' })).toBeTruthy();
    expect(screen.getByText('Waiting')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('agent sessions blocked on human approval')).toBeTruthy();
    expect(screen.getByText('Queue pressure')).toBeTruthy();
  });

  it('allows explicit status labels for compact operator indicators', () => {
    render(<MissionStatusIndicator status="active" label="Telemetry live" />);

    expect(screen.getByText('Telemetry live')).toBeTruthy();
  });
});
