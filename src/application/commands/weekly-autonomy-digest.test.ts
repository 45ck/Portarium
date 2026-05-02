import { describe, expect, it, vi } from 'vitest';

import { HashSha256 } from '../../domain/primitives/index.js';
import { toAppContext } from '../common/index.js';
import type {
  AuthorizationPort,
  EvidenceEntryAppendInput,
  EvidenceLogPort,
  EvidencePayloadStorePort,
  WeeklyAutonomyDigestActivityStore,
} from '../ports/index.js';
import type { WeeklyAutonomyDigestActionObservationV1 } from '../../domain/runs/index.js';
import {
  acknowledgeWeeklyAutonomyDigest,
  draftPolicyCalibrationShortcutFromDigest,
  generateWeeklyAutonomyDigestArtifact,
} from './weekly-autonomy-digest.js';

const ctx = toAppContext({
  tenantId: 'ws-1',
  principalId: 'user-1',
  roles: ['operator'],
  correlationId: 'corr-1',
});

const allowAll: AuthorizationPort = {
  isAllowed: vi.fn(async () => true),
};

function deps(
  overrides: Partial<{
    evidence: EvidenceEntryAppendInput[];
    ids: string[];
    activityStore: WeeklyAutonomyDigestActivityStore;
  }> = {},
) {
  const evidence = overrides.evidence ?? [];
  const ids = [...(overrides.ids ?? ['art-digest-1', 'ev-digest-1', 'draft-1', 'ev-shortcut-1'])];
  const evidenceLog: EvidenceLogPort = {
    appendEntry: vi.fn(async (_tenantId, entry) => {
      evidence.push(entry);
      return {
        ...entry,
        hashSha256: HashSha256('0'.repeat(64)),
      };
    }),
  };
  const defaultObservations: readonly WeeklyAutonomyDigestActionObservationV1[] = [
    {
      actionClass: 'write:small-refactor',
      executionTier: 'Assisted',
      occurredAtIso: '2026-03-24T00:00:00.000Z',
      anomaly: false,
      reversal: false,
    },
  ];
  const defaultActivityStore: WeeklyAutonomyDigestActivityStore = {
    listObservations: vi.fn(async () => defaultObservations),
  };
  const payloadStore: EvidencePayloadStorePort = {
    put: vi.fn(async () => undefined),
    applyWormControls: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
  return {
    evidence,
    payloadStore,
    evidenceLog,
    deps: {
      authorization: allowAll,
      activityStore: overrides.activityStore ?? defaultActivityStore,
      payloadStore,
      evidenceLog,
      clock: { nowIso: () => '2026-03-31T01:00:00.000Z' },
      idGenerator: { generateId: () => ids.shift() ?? 'id-extra' },
    },
  };
}

describe('weekly autonomy digest commands', () => {
  it('writes the Markdown artifact payload and evidence entry with hash semantics', async () => {
    const state = deps();

    const result = await generateWeeklyAutonomyDigestArtifact(state.deps, ctx, {
      workspaceId: 'ws-1',
      runId: 'run-digest-1',
      periodStartIso: '2026-03-24T00:00:00.000Z',
      periodEndIso: '2026-03-31T00:00:00.000Z',
      historyWindowStartIso: '2026-01-01T00:00:00.000Z',
      currentPolicyTiers: { 'write:small-refactor': 'Assisted' },
      artifactLocation: { bucket: 'evidence', key: 'weekly/digest.md' },
      retentionSchedule: {
        retentionClass: 'Compliance',
        retainUntilIso: '2033-03-31T00:00:00.000Z',
        legalHold: false,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(state.payloadStore.put).toHaveBeenCalledWith({
      location: { bucket: 'evidence', key: 'weekly/digest.md' },
      bytes: expect.any(Uint8Array),
    });
    expect(state.payloadStore.applyWormControls).toHaveBeenCalled();
    expect(result.value.artifact.mimeType).toBe('text/markdown');
    expect(result.value.artifact.storageRef).toBe('worm://evidence/weekly/digest.md');
    expect(result.value.digest.digestHashSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(state.evidence[0]).toEqual(
      expect.objectContaining({
        category: 'System',
        payloadRefs: [
          expect.objectContaining({
            kind: 'Artifact',
            uri: 'worm://evidence/weekly/digest.md',
            contentType: 'text/markdown',
            sha256: result.value.digest.digestHashSha256,
          }),
        ],
      }),
    );
  });

  it('records operator acknowledgement against the digest artifact in the evidence log', async () => {
    const state = deps({ ids: ['ev-ack-1'] });
    const digestHashSha256 = 'a'.repeat(64);

    const result = await acknowledgeWeeklyAutonomyDigest(state.deps, ctx, {
      workspaceId: 'ws-1',
      artifactId: 'art-digest-1',
      artifactUri: 'worm://evidence/weekly/digest.md',
      digestHashSha256,
      periodStartIso: '2026-03-24T00:00:00.000Z',
      periodEndIso: '2026-03-31T00:00:00.000Z',
      rationale: 'Reviewed AUTO activity.',
    });

    expect(result.ok).toBe(true);
    expect(state.evidence).toHaveLength(1);
    expect(state.evidence[0]).toEqual(
      expect.objectContaining({
        category: 'System',
        summary: expect.stringContaining('acknowledged by user-1'),
        actor: { kind: 'User', userId: 'user-1' },
        payloadRefs: [expect.objectContaining({ kind: 'Artifact', sha256: digestHashSha256 })],
      }),
    );
  });

  it('drafts a policy calibration shortcut as auditable intent without saving policy', async () => {
    const state = deps({ ids: ['draft-1', 'ev-shortcut-1'] });
    const digestHashSha256 = 'b'.repeat(64);

    const result = await draftPolicyCalibrationShortcutFromDigest(state.deps, ctx, {
      workspaceId: 'ws-1',
      artifactId: 'art-digest-1',
      artifactUri: 'worm://evidence/weekly/digest.md',
      digestHashSha256,
      recommendationId: 'promote:write:small-refactor:Assisted->Auto',
      actionClass: 'write:small-refactor',
      adjustment: 'promote',
      currentTier: 'Assisted',
      recommendedTier: 'Auto',
      rationale: 'Ninety day history is clean.',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        draftId: 'draft-1',
        artifactId: 'art-digest-1',
        evidenceId: 'ev-shortcut-1',
        effect: 'draft-policy-change-only',
      },
    });
    expect(state.evidence[0]).toEqual(
      expect.objectContaining({
        category: 'Policy',
        summary: expect.stringContaining('drafted from digest art-digest-1'),
        payloadRefs: [
          expect.objectContaining({ kind: 'Artifact', sha256: digestHashSha256 }),
          expect.objectContaining({
            kind: 'Snapshot',
            uri: 'portarium://policy-calibration-drafts/draft-1',
          }),
        ],
      }),
    );
  });
});
