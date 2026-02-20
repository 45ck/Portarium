import { describe, expect, it } from 'vitest';

import { appendEvidenceEntryV1 } from '../evidence/evidence-chain-v1.js';
import type { EvidenceHasher } from '../evidence/evidence-hasher.js';
import { HashSha256 } from '../primitives/index.js';
import { parsePolicyV1 } from '../policy/policy-v1.js';
import { parseRunV1 } from '../runs/run-v1.js';
import { parseWorkItemV1 } from '../work-items/work-item-v1.js';
import { parseWorkspaceV1 } from '../workspaces/workspace-v1.js';
import {
  CANONICAL_SEED_IDS_V1,
  createCanonicalSeedBundleV1,
} from './canonical-seeds-v1.js';

const testHasher: EvidenceHasher = {
  sha256Hex(input: string) {
    void input;
    return HashSha256('ab'.repeat(32));
  },
};

describe('canonical seed bundle v1', () => {
  it('provides parseable workspace, policy, run, and work-item seeds', () => {
    const seeds = createCanonicalSeedBundleV1();

    expect(() => parseWorkspaceV1(seeds.workspace)).not.toThrow();
    expect(() => parsePolicyV1(seeds.policy)).not.toThrow();
    expect(() => parseRunV1(seeds.run)).not.toThrow();
    expect(() => parseWorkItemV1(seeds.workItem)).not.toThrow();

    const evidence = appendEvidenceEntryV1({
      previous: undefined,
      next: seeds.evidence,
      hasher: testHasher,
    });

    expect(evidence.links?.runId).toBe(seeds.run.runId);
    expect(evidence.links?.workItemId).toBe(seeds.workItem.workItemId);
    expect(seeds.workItem.links?.evidenceIds?.[0]).toBe(CANONICAL_SEED_IDS_V1.evidenceId);
  });

  it('supports independent overrides without mutating baseline values', () => {
    const baseline = createCanonicalSeedBundleV1();
    const custom = createCanonicalSeedBundleV1({
      workspace: { name: 'Custom Workspace' },
      run: { status: 'Paused' },
      workItem: { status: 'InProgress' },
    });

    expect(custom.workspace.name).toBe('Custom Workspace');
    expect(custom.run.status).toBe('Paused');
    expect(custom.workItem.status).toBe('InProgress');

    expect(baseline.workspace.name).toBe('Primary Workspace Seed');
    expect(baseline.run.status).toBe('Running');
    expect(baseline.workItem.status).toBe('Open');
  });
});
