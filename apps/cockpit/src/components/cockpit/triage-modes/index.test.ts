import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRelevantModes } from './index';
import type { ApprovalContext } from './lib/approval-context';

const CONTEXT: ApprovalContext = {
  domain: 'general',
  portFamilies: new Set(['Itsm']),
  hasRobots: false,
  hasAgents: true,
  hasEffects: true,
  hasEvidence: true,
  sorCount: 1,
  executionTier: 'HumanApprove',
};

describe('triage modes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('hides high-fidelity modes by default', () => {
    expect(getRelevantModes(CONTEXT).map((mode) => mode.id)).toEqual([
      'agent-overview',
      'default',
      'traffic-signals',
      'diff-view',
      'evidence-chain',
      'compliance-checklist',
    ]);
  });

  it('shows high-fidelity modes only when explicitly enabled', () => {
    vi.stubEnv('VITE_PORTARIUM_SHOW_ADVANCED_TRIAGE', 'true');

    expect(getRelevantModes(CONTEXT).map((mode) => mode.id)).toEqual(
      expect.arrayContaining([
        'briefing',
        'risk-radar',
        'blast-map',
        'action-replay',
        'story-timeline',
        'policy-precedent',
      ]),
    );
  });
});
