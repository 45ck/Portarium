// @vitest-environment jsdom
// Tests for simple badge components: EvidenceCategoryBadge, ExecutionTierBadge, HumanTaskStatusBadge

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { EvidenceCategory, HumanTaskStatus } from '@portarium/cockpit-types';
import { EvidenceCategoryBadge } from './evidence-category-badge';
import { ExecutionTierBadge } from './execution-tier-badge';
import { HumanTaskStatusBadge } from './human-task-status-badge';

describe('EvidenceCategoryBadge', () => {
  afterEach(() => {
    cleanup();
  });

  const categories: EvidenceCategory[] = [
    'Plan',
    'Action',
    'Approval',
    'Policy',
    'PolicyViolation',
    'System',
  ];

  it.each(categories)('renders label for category %s', (category) => {
    render(<EvidenceCategoryBadge category={category} />);
    const expectedLabels: Record<EvidenceCategory, string> = {
      Plan: 'Plan',
      Action: 'Action',
      Approval: 'Approval',
      Policy: 'Policy',
      PolicyViolation: 'Policy Violation',
      System: 'System',
    };
    expect(screen.getByText(expectedLabels[category])).toBeTruthy();
  });
});

describe('ExecutionTierBadge', () => {
  afterEach(() => {
    cleanup();
  });

  const tiers: Array<'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly'> = [
    'Auto',
    'Assisted',
    'HumanApprove',
    'ManualOnly',
  ];

  it.each(tiers)('renders label for tier %s', (tier) => {
    render(<ExecutionTierBadge tier={tier} />);
    const expectedLabels = {
      Auto: 'Auto',
      Assisted: 'Assisted',
      HumanApprove: 'Human Approve',
      ManualOnly: 'Manual Only',
    };
    expect(screen.getByText(expectedLabels[tier])).toBeTruthy();
  });
});

describe('HumanTaskStatusBadge', () => {
  afterEach(() => {
    cleanup();
  });

  const statuses: HumanTaskStatus[] = [
    'pending',
    'assigned',
    'in-progress',
    'completed',
    'escalated',
  ];

  it.each(statuses)('renders label for status %s', (status) => {
    render(<HumanTaskStatusBadge status={status} />);
    const expectedLabels: Record<HumanTaskStatus, string> = {
      pending: 'Pending',
      assigned: 'Assigned',
      'in-progress': 'In Progress',
      completed: 'Completed',
      escalated: 'Escalated',
    };
    expect(screen.getByText(expectedLabels[status])).toBeTruthy();
  });
});
