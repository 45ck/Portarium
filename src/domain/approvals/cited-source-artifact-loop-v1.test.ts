import { describe, expect, it } from 'vitest';

import {
  assessCitedSourceArtifactLoopV1,
  buildDecisionContextPacketFromCitedArtifactV1,
  makeEvidenceId,
  makePlanId,
  makeRunId,
  makeWorkspaceId,
  validateCitedSourceArtifactLoopV1,
  type CitedSourceArtifactLoopV1,
} from './cited-source-artifact-loop-v1.js';
import { assessDecisionContextSufficiency } from './decision-context-packet-v1.js';

const loop: CitedSourceArtifactLoopV1 = {
  schemaVersion: 1,
  workspaceId: makeWorkspaceId('ws-source-loop'),
  runId: makeRunId('run-source-loop'),
  assembledAtIso: '2026-05-03T01:00:00.000Z',
  sourceSnapshots: [
    {
      sourceSnapshotId: 'source-official-spec',
      evidenceId: makeEvidenceId('ev-source-official-spec'),
      sourceClass: 'T1',
      retrievedAtIso: '2026-05-03T00:00:00.000Z',
      freshnessRequiredBeforeIso: '2026-06-03T00:00:00.000Z',
      title: 'Trusted source loop spec',
      locator: '.specify/specs/trusted-source-ingestion-citation-research-dossier-loop-v1.md',
    },
    {
      sourceSnapshotId: 'source-proving-choice',
      evidenceId: makeEvidenceId('ev-source-proving-choice'),
      sourceClass: 'T1',
      retrievedAtIso: '2026-05-03T00:01:00.000Z',
      freshnessRequiredBeforeIso: '2026-06-03T00:00:00.000Z',
      title: 'Software-first proving choice',
      locator: 'docs/internal/governance/software-first-proving-choice.md',
    },
  ],
  dossier: {
    schemaVersion: 1,
    dossierId: 'dossier-source-loop',
    workspaceId: makeWorkspaceId('ws-source-loop'),
    runId: makeRunId('run-source-loop'),
    artifactKind: 'opportunity-brief',
    goal: 'Produce cited artifacts for content and micro-SaaS candidate review.',
    scopeBoundary: {
      inScope: ['source provenance', 'artifact citation carry-forward'],
      outOfScope: ['autonomous execution', 'external publication'],
    },
    sourceSnapshots: ['source-official-spec', 'source-proving-choice'],
    claims: [
      {
        claimId: 'claim-source-loop-supports-two-artifacts',
        text: 'One cited source base can produce both content and micro-SaaS candidate artifacts.',
        claimType: 'fact',
        citations: ['source-official-spec'],
        confidence: 'high',
        confidenceRationale: 'The source loop spec defines both supported profiles.',
        claimBoundary: 'Supports draft artifacts, not external publishing.',
        stalenessState: 'fresh',
        conflictState: 'none',
        allowedUses: ['ideation', 'drafting', 'planning', 'approval-context'],
        forbiddenUses: ['autonomous-execution'],
      },
      {
        claimId: 'claim-micro-saas-is-primary',
        text: 'The micro-SaaS builder is the primary self-use proving workflow.',
        claimType: 'recommendation',
        citations: ['source-proving-choice'],
        confidence: 'high',
        confidenceRationale: 'The governance note records this choice.',
        claimBoundary: 'Supports planning and approval context only.',
        stalenessState: 'fresh',
        conflictState: 'none',
        allowedUses: ['planning', 'approval-context'],
        forbiddenUses: ['autonomous-execution'],
      },
    ],
    openQuestions: ['Which external customer source should be added before publication?'],
    conflicts: [],
    recommendedNextActions: ['proceed-with-approval', 'request-more-evidence'],
  },
  downstreamArtifacts: [
    {
      artifactId: 'artifact-content-draft',
      artifactClass: 'content',
      title: 'Draft content pack',
      readiness: 'internal-draft-only',
      dossierId: 'dossier-source-loop',
      claimIdsUsed: ['claim-source-loop-supports-two-artifacts'],
      sourceSnapshotIds: ['source-official-spec'],
      transformations: ['summarized', 'rewritten'],
      boundaryChanged: false,
      evidenceId: makeEvidenceId('ev-artifact-content-draft'),
    },
    {
      artifactId: 'artifact-micro-saas-brief',
      artifactClass: 'micro-saas',
      title: 'Micro-SaaS opportunity brief',
      readiness: 'approval-context-ready',
      dossierId: 'dossier-source-loop',
      claimIdsUsed: ['claim-source-loop-supports-two-artifacts', 'claim-micro-saas-is-primary'],
      sourceSnapshotIds: ['source-official-spec', 'source-proving-choice'],
      transformations: ['summarized', 'inferred'],
      boundaryChanged: false,
      evidenceId: makeEvidenceId('ev-artifact-micro-saas-brief'),
    },
  ],
};

describe('cited source artifact loop v1', () => {
  it('accepts a cited source-to-artifact packet as approval context', () => {
    validateCitedSourceArtifactLoopV1(loop);

    expect(assessCitedSourceArtifactLoopV1(loop)).toMatchObject({
      status: 'sufficient',
      canUseForApprovalContext: true,
      canUseForExecutionInput: false,
      canUseForExternalPublication: false,
      citedClaimIds: ['claim-micro-saas-is-primary', 'claim-source-loop-supports-two-artifacts'],
      artifactIds: ['artifact-content-draft', 'artifact-micro-saas-brief'],
    });
  });

  it('blocks claims lacking citations or unresolved claims from silently driving approvals', () => {
    const invalid: CitedSourceArtifactLoopV1 = {
      ...loop,
      dossier: {
        ...loop.dossier,
        claims: [
          {
            ...loop.dossier.claims[0]!,
            citations: [],
            confidence: 'unknown',
            conflictState: 'unresolved',
          },
        ],
      },
      downstreamArtifacts: [
        {
          ...loop.downstreamArtifacts[0]!,
          claimIdsUsed: ['claim-source-loop-supports-two-artifacts'],
        },
      ],
    };

    const sufficiency = assessCitedSourceArtifactLoopV1(invalid);

    expect(sufficiency.status).toBe('blocked');
    expect(sufficiency.canUseForApprovalContext).toBe(false);
    expect(sufficiency.missingEvidenceSignals).toContain(
      'claim-source-loop-supports-two-artifacts: missing or unknown citation.',
    );
    expect(sufficiency.blockingReasons).toContain(
      'claim-source-loop-supports-two-artifacts: unknown confidence cannot support approval context.',
    );
  });

  it('builds a Decision Context Packet with cited artifact provenance', () => {
    const packet = buildDecisionContextPacketFromCitedArtifactV1({
      packetId: 'packet-source-loop',
      loop,
      planId: makePlanId('plan-source-loop'),
      policyId: 'policy-cited-artifacts',
      proposedChangeSummary: 'Approve the cited micro-SaaS brief for planning.',
      assembledAtIso: '2026-05-03T01:10:00.000Z',
    });

    expect(packet.evidence.artifacts).toHaveLength(2);
    expect(packet.provenance.materialInputSummaries).toEqual([
      'claim-source-loop-supports-two-artifacts',
      'claim-micro-saas-is-primary',
    ]);
    expect(assessDecisionContextSufficiency(packet)).toMatchObject({
      status: 'sufficient',
      canSubmitDecision: true,
    });
  });
});
