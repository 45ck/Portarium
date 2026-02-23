// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ActorBadge } from './actor-badge';

describe('ActorBadge', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows "User" label for a normal user ID', () => {
    render(<ActorBadge userId="alice" />);
    expect(screen.getByText('alice')).toBeTruthy();
    expect(screen.getByText('(User)')).toBeTruthy();
  });

  it('shows "Agent" label for an agent- prefixed ID', () => {
    render(<ActorBadge userId="agent-deploy" />);
    expect(screen.getByText('(Agent)')).toBeTruthy();
  });

  it('shows "Agent" label for a bot- prefixed ID', () => {
    render(<ActorBadge userId="bot-ci" />);
    expect(screen.getByText('(Agent)')).toBeTruthy();
  });

  it('shows "Workflow" label for a wf- prefixed ID', () => {
    render(<ActorBadge userId="wf-release" />);
    expect(screen.getByText('(Workflow)')).toBeTruthy();
  });

  it('shows "System" label for "system"', () => {
    render(<ActorBadge userId="system" />);
    expect(screen.getByText('(System)')).toBeTruthy();
  });

  it('shows "Agent" label for IDs containing "automation"', () => {
    render(<ActorBadge userId="my-automation-runner" />);
    expect(screen.getByText('(Agent)')).toBeTruthy();
  });
});
