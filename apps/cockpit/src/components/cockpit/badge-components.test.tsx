// @vitest-environment jsdom
// Tests for simple badge components: EvidenceCategoryBadge, ExecutionTierBadge, HumanTaskStatusBadge

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { EvidenceCategory, HumanTaskStatus } from '@portarium/cockpit-types';
import { EvidenceCategoryBadge } from './evidence-category-badge';
import { ExecutionTierBadge } from './execution-tier-badge';
import { HumanTaskStatusBadge } from './human-task-status-badge';
import { BlastRadiusBadge } from './blast-radius-badge';
import { PolicyTierBadge } from './policy-tier-badge';

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
    'OperatorSurface',
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
      OperatorSurface: 'Operator Surface',
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

describe('PolicyTierBadge', () => {
  afterEach(() => {
    cleanup();
  });

  const tiers: Array<'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly'> = [
    'Auto',
    'Assisted',
    'HumanApprove',
    'ManualOnly',
  ];

  it.each(tiers)('renders label for policy tier %s', (tier) => {
    render(<PolicyTierBadge tier={tier} />);
    const expectedLabels = {
      Auto: 'AUTO',
      Assisted: 'ASSISTED',
      HumanApprove: 'HUMAN-APPROVE',
      ManualOnly: 'MANUAL-ONLY',
    };
    expect(screen.getByText(expectedLabels[tier])).toBeTruthy();
  });
});

describe('BlastRadiusBadge', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(['low', 'medium', 'high', 'critical'] as const)('renders label for %s blast', (level) => {
    render(<BlastRadiusBadge level={level} />);
    expect(screen.getByText(level)).toBeTruthy();
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
