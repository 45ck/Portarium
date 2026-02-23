// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PolicyRule } from '@portarium/cockpit-types';
import { PolicyRulePanel } from './policy-rule-panel';

const BASE_RULE: PolicyRule = {
  ruleId: 'pol-001',
  tier: 'T1',
  trigger: 'production-deploy',
  blastRadius: ['main-db', '3 records'],
  irreversibility: 'full',
};

describe('PolicyRulePanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the rule ID and tier', () => {
    render(<PolicyRulePanel rule={BASE_RULE} />);
    expect(screen.getByText('pol-001')).toBeTruthy();
    expect(screen.getByText('T1')).toBeTruthy();
  });

  it('renders the trigger', () => {
    render(<PolicyRulePanel rule={BASE_RULE} />);
    expect(screen.getByText('production-deploy')).toBeTruthy();
  });

  it('shows "Fully irreversible" for full irreversibility', () => {
    render(<PolicyRulePanel rule={BASE_RULE} />);
    expect(screen.getByText('Fully irreversible')).toBeTruthy();
  });

  it('shows "Partially reversible" for partial', () => {
    render(<PolicyRulePanel rule={{ ...BASE_RULE, irreversibility: 'partial' }} />);
    expect(screen.getByText('Partially reversible')).toBeTruthy();
  });

  it('shows "Reversible" for none', () => {
    render(<PolicyRulePanel rule={{ ...BASE_RULE, irreversibility: 'none' }} />);
    expect(screen.getByText('Reversible')).toBeTruthy();
  });

  it('renders blast radius items', () => {
    render(<PolicyRulePanel rule={BASE_RULE} />);
    expect(screen.getByText('main-db')).toBeTruthy();
    expect(screen.getByText('3 records')).toBeTruthy();
  });
});
