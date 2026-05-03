// @ts-check

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { createIteration2Telemetry } from '../../../shared/iteration2-telemetry.js';

const EXPERIMENT_NAME = 'source-to-artifact-citation-loop';
const DEFAULT_RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results');
const FIXED_STARTED_AT_ISO = '2026-05-03T01:00:00.000Z';
const DEFAULT_ATTEMPT_ID = 'deterministic-cited-loop-v1';

const REQUIRED_ARTIFACTS = [
  'outcome.json',
  'queue-metrics.json',
  'evidence-summary.json',
  'report.md',
  'source-snapshots.json',
  'research-dossier.json',
  'downstream-artifacts.json',
  'operator-interventions.json',
  'citation-provenance.json',
];

function addMs(iso, ms) {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function assert(label, passed, detail) {
  return { label, passed, ...(detail ? { detail } : {}) };
}

function writeJsonArtifact(resultsDir, artifactName, value) {
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(join(resultsDir, artifactName), `${JSON.stringify(value, null, 2)}\n`);
}

function writeOutcome(resultsDir, outcome) {
  writeJsonArtifact(resultsDir, 'outcome.json', outcome);
}

function buildSourceSnapshots() {
  return [
    {
      schemaVersion: 1,
      sourceSnapshotId: 'source-snapshot-trusted-loop-v1',
      workspaceId: 'workspace-source-to-artifact',
      runId: 'run-source-to-artifact-citation-loop',
      retrievedAtIso: addMs(FIXED_STARTED_AT_ISO, 500),
      sourceClass: 'T1',
      locator: {
        kind: 'repo',
        uri: '.specify/specs/trusted-source-ingestion-citation-research-dossier-loop-v1.md',
        pinnedRef: 'bead-1099-spec-v1',
      },
      title: 'Trusted Source Ingestion, Citation, And Research Dossier Loop v1',
      publisher: 'Portarium specification',
      licenseOrUseNote: 'Internal project source; cite metadata and avoid copying long passages.',
      hashSha256: 'sha256-trusted-loop-fixture',
      redactionState: 'none',
      evidenceRef: 'worm://source-to-artifact/source-snapshot-trusted-loop-v1',
      freshnessRequiredBeforeIso: '2026-06-02T01:00:00.000Z',
    },
    {
      schemaVersion: 1,
      sourceSnapshotId: 'source-snapshot-software-first-choice-v1',
      workspaceId: 'workspace-source-to-artifact',
      runId: 'run-source-to-artifact-citation-loop',
      retrievedAtIso: addMs(FIXED_STARTED_AT_ISO, 700),
      sourceClass: 'T1',
      locator: {
        kind: 'repo',
        uri: 'docs/internal/governance/software-first-proving-choice.md',
        pinnedRef: 'bead-1098-decision-note-v1',
      },
      title: 'Software-First Proving Workflow Choice',
      publisher: 'Portarium governance note',
      licenseOrUseNote: 'Internal project source; authoritative for proving strategy.',
      hashSha256: 'sha256-software-first-choice-fixture',
      redactionState: 'none',
      evidenceRef: 'worm://source-to-artifact/source-snapshot-software-first-choice-v1',
      freshnessRequiredBeforeIso: '2026-06-02T01:00:00.000Z',
    },
    {
      schemaVersion: 1,
      sourceSnapshotId: 'source-snapshot-project-brief-v1',
      workspaceId: 'workspace-source-to-artifact',
      runId: 'run-source-to-artifact-citation-loop',
      retrievedAtIso: addMs(FIXED_STARTED_AT_ISO, 900),
      sourceClass: 'T1',
      locator: {
        kind: 'repo',
        uri: '.specify/specs/project-brief-artifact-acceptance-v1.md',
        pinnedRef: 'bead-1101-spec-v1',
      },
      title: 'Project Brief and Artifact Acceptance v1',
      publisher: 'Portarium specification',
      licenseOrUseNote: 'Internal project source; cite metadata and review contract fields.',
      hashSha256: 'sha256-project-brief-fixture',
      redactionState: 'none',
      evidenceRef: 'worm://source-to-artifact/source-snapshot-project-brief-v1',
      freshnessRequiredBeforeIso: '2026-06-02T01:00:00.000Z',
    },
  ];
}

function buildResearchDossier(sourceSnapshots) {
  const snapshotIds = sourceSnapshots.map((source) => source.sourceSnapshotId);

  return {
    schemaVersion: 1,
    dossierId: 'dossier-source-to-artifact-v1',
    workspaceId: 'workspace-source-to-artifact',
    runId: 'run-source-to-artifact-citation-loop',
    artifactKind: 'research-dossier',
    goal: 'Show that one cited source base can produce governed content and micro-SaaS candidate artifacts.',
    scopeBoundary: {
      inScope: [
        'source provenance',
        'artifact citation carry-forward',
        'operator taste, scope, and evidence-quality interventions',
      ],
      outOfScope: [
        'real outbound publishing',
        'autonomous implementation',
        'market-size claims without external corroboration',
      ],
    },
    sourceSnapshots: snapshotIds,
    claims: [
      {
        claimId: 'claim-loop-supports-multiple-artifact-profiles',
        text: 'The source loop can support content, micro-SaaS, and showcase artifacts when claims preserve citations and boundaries.',
        claimType: 'fact',
        citations: ['source-snapshot-trusted-loop-v1'],
        confidence: 'high',
        confidenceRationale:
          'The cited source explicitly defines the loop profiles and provenance contract.',
        claimBoundary:
          'This supports governed artifact generation, not real publication or autonomous execution.',
        stalenessState: 'fresh',
        conflictState: 'none',
        allowedUses: ['ideation', 'drafting', 'planning', 'approval-context'],
        forbiddenUses: ['autonomous-execution'],
      },
      {
        claimId: 'claim-primary-path-is-micro-saas-builder',
        text: 'The primary proving path is source-to-micro-SaaS builder, while content remains a secondary showcase path.',
        claimType: 'recommendation',
        citations: ['source-snapshot-software-first-choice-v1'],
        confidence: 'high',
        confidenceRationale: 'The cited governance note records the proving workflow choice.',
        claimBoundary:
          'This supports prioritising product artifacts over content proof, not claiming production readiness.',
        stalenessState: 'fresh',
        conflictState: 'none',
        allowedUses: ['planning', 'approval-context'],
        forbiddenUses: ['external-publication', 'autonomous-execution'],
      },
      {
        claimId: 'claim-artifact-review-needs-typed-feedback',
        text: 'Generated artifacts need typed review signals for taste, scope, evidence sufficiency, and acceptance.',
        claimType: 'fact',
        citations: ['source-snapshot-project-brief-v1'],
        confidence: 'high',
        confidenceRationale: 'The cited Project brief contract defines review signals and effects.',
        claimBoundary:
          'This supports artifact review routing, not bypassing Approval Gate or Policy requirements.',
        stalenessState: 'fresh',
        conflictState: 'none',
        allowedUses: ['drafting', 'planning', 'approval-context'],
        forbiddenUses: ['policy-change-without-review'],
      },
      {
        claimId: 'claim-content-output-is-demo-only-until-proven',
        text: 'Content artifacts can be generated from the source base, but the content studio path remains demo-only until it has separate evidence.',
        claimType: 'interpretation',
        citations: ['source-snapshot-trusted-loop-v1', 'source-snapshot-software-first-choice-v1'],
        confidence: 'medium',
        confidenceRationale:
          'The sources align on content support and demo-only posture, but content quality still needs operator taste review.',
        claimBoundary:
          'This supports internal content drafts and demos only; it does not support publishing.',
        stalenessState: 'fresh',
        conflictState: 'none',
        allowedUses: ['ideation', 'drafting'],
        forbiddenUses: ['external-publication', 'autonomous-execution'],
      },
    ],
    openQuestions: [
      'Which external customer or niche sources should be added before market claims are made?',
      'What acceptance threshold makes a micro-SaaS artifact useful enough for self-use?',
    ],
    conflicts: [],
    recommendedNextActions: ['draft-only', 'proceed-with-approval', 'request-more-evidence'],
    provenance: {
      createdFromEvidenceRefs: sourceSnapshots.map((source) => source.evidenceRef),
      derivedArtifactRefs: [
        'artifact-content-pack-source-to-artifact-v1',
        'artifact-micro-saas-brief-source-to-artifact-v1',
      ],
      decisionContextPacketRefs: ['packet-source-to-artifact-citation-loop-v1'],
    },
  };
}

function confidenceContextForClaims(dossier, claimIds) {
  return Object.fromEntries(
    dossier.claims
      .filter((claim) => claimIds.includes(claim.claimId))
      .map((claim) => [
        claim.claimId,
        {
          confidence: claim.confidence,
          confidenceRationale: claim.confidenceRationale,
          claimBoundary: claim.claimBoundary,
        },
      ]),
  );
}

function buildDownstreamArtifacts(dossier) {
  const sourceSnapshotIds = [...dossier.sourceSnapshots];
  const contentClaimIds = [
    'claim-loop-supports-multiple-artifact-profiles',
    'claim-content-output-is-demo-only-until-proven',
    'claim-artifact-review-needs-typed-feedback',
  ];
  const productClaimIds = [
    'claim-loop-supports-multiple-artifact-profiles',
    'claim-primary-path-is-micro-saas-builder',
    'claim-artifact-review-needs-typed-feedback',
  ];

  return [
    {
      artifactId: 'artifact-content-pack-source-to-artifact-v1',
      artifactClass: 'content',
      title: 'Demo-only source-to-content studio pack',
      readiness: 'internal-draft-only',
      dossierId: dossier.dossierId,
      claimIdsUsed: contentClaimIds,
      sourceSnapshotIds,
      transformations: ['summarized', 'rewritten'],
      confidenceContext: confidenceContextForClaims(dossier, contentClaimIds),
      boundaryChanged: false,
      evidenceRef: 'worm://source-to-artifact/artifact-content-pack-source-to-artifact-v1',
      body: {
        channels: ['demo-script', 'landing-page-copy', 'short-post'],
        headline: 'Turn trusted sources into governed artifacts',
        callToAction: 'Review the cited dossier before approving any publish path.',
        publicationGate: 'blocked-until-more-evidence',
      },
    },
    {
      artifactId: 'artifact-micro-saas-brief-source-to-artifact-v1',
      artifactClass: 'micro-saas',
      title: 'Source-to-micro-SaaS builder opportunity brief',
      readiness: 'planning-ready-with-approval',
      dossierId: dossier.dossierId,
      claimIdsUsed: productClaimIds,
      sourceSnapshotIds,
      transformations: ['summarized', 'inferred', 'rewritten'],
      confidenceContext: confidenceContextForClaims(dossier, productClaimIds),
      boundaryChanged: false,
      evidenceRef: 'worm://source-to-artifact/artifact-micro-saas-brief-source-to-artifact-v1',
      body: {
        productSlice: 'Cited dossier to backlog and review packet',
        userValue:
          'A builder can turn source material into reviewable product work without losing evidence context.',
        nextBacklogItems: [
          'source snapshot intake fixture',
          'dossier claim sufficiency check',
          'artifact review packet export',
        ],
        implementationGate: 'scope-approval-required',
      },
    },
  ];
}

function buildOperatorInterventions(dossier, artifacts) {
  const content = artifacts.find((artifact) => artifact.artifactClass === 'content');
  const product = artifacts.find((artifact) => artifact.artifactClass === 'micro-saas');
  if (!content || !product) {
    throw new Error('Both content and micro-SaaS artifacts are required.');
  }

  return [
    {
      interventionId: 'intervention-content-taste-001',
      kind: 'taste-feedback',
      targetArtifactId: content.artifactId,
      signal: 'request-changes',
      effect: 'current-run-effect',
      rationale:
        'Content direction is viable, but the demo copy should be more concrete and less generic.',
      evidenceRefs: [content.evidenceRef],
      claimIds: content.claimIdsUsed,
      runPostureAfter: 'governed-assisted',
      nextAction: 'revise-current-content-artifact',
    },
    {
      interventionId: 'intervention-product-scope-001',
      kind: 'scope-correction',
      targetArtifactId: product.artifactId,
      signal: 'narrow-scope',
      effect: 'current-run-effect',
      rationale:
        'Limit the product slice to dossier-to-backlog and review packet export before any implementation plan.',
      evidenceRefs: [product.evidenceRef],
      claimIds: product.claimIdsUsed,
      runPostureAfter: 'governed-assisted',
      nextAction: 'continue-with-narrowed-product-brief',
    },
    {
      interventionId: 'intervention-evidence-quality-001',
      kind: 'evidence-quality',
      targetArtifactId: content.artifactId,
      signal: 'request-more-evidence',
      effect: 'current-run-effect',
      rationale:
        'External publishing remains blocked until customer, competitor, or channel evidence is added.',
      evidenceRefs: [content.evidenceRef, ...dossier.provenance.createdFromEvidenceRefs],
      claimIds: ['claim-content-output-is-demo-only-until-proven'],
      runPostureAfter: 'governed-assisted',
      nextAction: 'keep-content-draft-only-and-request-more-evidence',
    },
  ];
}

function buildCitationProvenance({ sourceSnapshots, dossier, artifacts, interventions }) {
  return {
    schemaVersion: 1,
    runId: dossier.runId,
    visibleChain:
      'Source Evidence -> Source Snapshot -> Research Dossier claim -> Derived Artifact -> Plan/Approval/Run/Action',
    sourceSnapshots: sourceSnapshots.map((source) => ({
      sourceSnapshotId: source.sourceSnapshotId,
      evidenceRef: source.evidenceRef,
      sourceClass: source.sourceClass,
      freshnessRequiredBeforeIso: source.freshnessRequiredBeforeIso,
    })),
    claimLinks: dossier.claims.map((claim) => ({
      claimId: claim.claimId,
      citations: claim.citations,
      confidence: claim.confidence,
      allowedUses: claim.allowedUses,
      forbiddenUses: claim.forbiddenUses,
    })),
    artifactLinks: artifacts.map((artifact) => ({
      artifactId: artifact.artifactId,
      artifactClass: artifact.artifactClass,
      dossierId: artifact.dossierId,
      claimIdsUsed: artifact.claimIdsUsed,
      sourceSnapshotIds: artifact.sourceSnapshotIds,
      readiness: artifact.readiness,
      confidenceContext: artifact.confidenceContext,
    })),
    interventionLinks: interventions.map((intervention) => ({
      interventionId: intervention.interventionId,
      targetArtifactId: intervention.targetArtifactId,
      signal: intervention.signal,
      effect: intervention.effect,
      nextAction: intervention.nextAction,
    })),
    sufficiency: {
      citations: 'sufficient',
      freshness: 'sufficient',
      contentPublication: 'blocked-pending-more-evidence',
      productPlanning: 'sufficient-with-operator-scope-correction',
    },
  };
}

function recordScenarioTelemetry(telemetry) {
  const approvals = [
    {
      approvalId: 'appr-source-dossier-sufficiency',
      sessionId: 'source-to-artifact-loop-run-1',
      tier: 'Assisted',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 2_000),
      status: 'approved',
      decidedAtIso: addMs(FIXED_STARTED_AT_ISO, 7_000),
      resumedAtIso: addMs(FIXED_STARTED_AT_ISO, 7_700),
    },
    {
      approvalId: 'appr-content-taste-review',
      sessionId: 'source-to-artifact-loop-run-1',
      tier: 'Assisted',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 4_000),
      status: 'request_changes',
      decidedAtIso: addMs(FIXED_STARTED_AT_ISO, 9_000),
    },
    {
      approvalId: 'appr-product-scope-review',
      sessionId: 'source-to-artifact-loop-run-1',
      tier: 'Human-approve',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 6_000),
      status: 'approved',
      decidedAtIso: addMs(FIXED_STARTED_AT_ISO, 12_000),
      resumedAtIso: addMs(FIXED_STARTED_AT_ISO, 12_900),
    },
    {
      approvalId: 'appr-content-publish-evidence-quality',
      sessionId: 'source-to-artifact-loop-run-1',
      tier: 'Human-approve',
      requestedAtIso: addMs(FIXED_STARTED_AT_ISO, 8_000),
      status: 'request_changes',
      decidedAtIso: addMs(FIXED_STARTED_AT_ISO, 14_000),
    },
  ];

  for (const approval of approvals) {
    telemetry.recordApprovalRequested({
      approvalId: approval.approvalId,
      sessionId: approval.sessionId,
      tier: approval.tier,
      requestedAtIso: approval.requestedAtIso,
    });
  }

  telemetry.recordQueueDepth({ timestampIso: addMs(FIXED_STARTED_AT_ISO, 5_000), depth: 3 });

  for (const approval of approvals) {
    telemetry.recordApprovalDecision({
      approvalId: approval.approvalId,
      status: approval.status,
      decidedAtIso: approval.decidedAtIso,
    });
    telemetry.recordSessionBlocked({
      sessionId: approval.sessionId,
      blockedAtIso: approval.requestedAtIso,
      unblockedAtIso: approval.decidedAtIso,
    });
    if (approval.status === 'approved' && approval.resumedAtIso) {
      telemetry.recordResume({
        sessionId: approval.sessionId,
        approvalId: approval.approvalId,
        decidedAtIso: approval.decidedAtIso,
        resumedAtIso: approval.resumedAtIso,
        successful: true,
      });
      telemetry.recordDuplicateExecution(`${approval.sessionId}:${approval.approvalId}:resume`);
    }
  }

  telemetry.recordQueueDepth({ timestampIso: addMs(FIXED_STARTED_AT_ISO, 15_000), depth: 0 });

  return approvals;
}

function recordRequiredArtifacts(telemetry) {
  for (const artifactName of REQUIRED_ARTIFACTS) {
    telemetry.recordEvidenceArtifact({ artifactName, present: true });
  }
}

function sameSourceBase(artifacts, sourceSnapshots) {
  const expected = sourceSnapshots.map((source) => source.sourceSnapshotId).sort();
  return artifacts.every((artifact) => {
    const actual = [...artifact.sourceSnapshotIds].sort();
    return JSON.stringify(actual) === JSON.stringify(expected);
  });
}

function artifactsCarryCitationContext(artifacts, dossier) {
  const claimIds = new Set(dossier.claims.map((claim) => claim.claimId));
  return artifacts.every(
    (artifact) =>
      artifact.claimIdsUsed.length > 0 &&
      artifact.claimIdsUsed.every((claimId) => claimIds.has(claimId)) &&
      artifact.sourceSnapshotIds.length > 0 &&
      artifact.claimIdsUsed.every((claimId) => artifact.confidenceContext[claimId] != null),
  );
}

function materialClaimsAreCited(dossier) {
  return dossier.claims.every(
    (claim) =>
      claim.citations.length > 0 &&
      claim.confidence !== 'unknown' &&
      claim.stalenessState === 'fresh' &&
      claim.conflictState === 'none',
  );
}

function interventionsKeepRunGoverned(interventions) {
  const kinds = new Set(interventions.map((intervention) => intervention.kind));
  return (
    kinds.has('taste-feedback') &&
    kinds.has('scope-correction') &&
    kinds.has('evidence-quality') &&
    interventions.every((intervention) => intervention.runPostureAfter === 'governed-assisted')
  );
}

function buildAssertions({
  sourceSnapshots,
  dossier,
  artifacts,
  interventions,
  queueMetrics,
  evidenceSummary,
  citationProvenance,
  trace,
}) {
  const contentArtifact = artifacts.find((artifact) => artifact.artifactClass === 'content');
  const productArtifact = artifacts.find((artifact) => artifact.artifactClass === 'micro-saas');

  return [
    assert(
      'same source base produces content and micro-SaaS artifacts',
      Boolean(contentArtifact) &&
        Boolean(productArtifact) &&
        sameSourceBase(artifacts, sourceSnapshots),
      `sources=${sourceSnapshots.length}, artifacts=${artifacts.length}`,
    ),
    assert(
      'Research Dossier material claims are cited and fresh',
      materialClaimsAreCited(dossier),
      `claims=${dossier.claims.length}`,
    ),
    assert(
      'downstream artifacts carry citation and confidence context',
      artifactsCarryCitationContext(artifacts, dossier),
      JSON.stringify(artifacts.map((artifact) => artifact.artifactId)),
    ),
    assert(
      'operator interventions adjust taste, scope, and evidence quality without manual collapse',
      interventionsKeepRunGoverned(interventions),
      JSON.stringify(
        interventions.map((intervention) => `${intervention.kind}:${intervention.signal}`),
      ),
    ),
    assert(
      'evidence-quality intervention blocks publication while product planning continues',
      contentArtifact?.readiness === 'internal-draft-only' &&
        productArtifact?.readiness === 'planning-ready-with-approval' &&
        citationProvenance.sufficiency.contentPublication === 'blocked-pending-more-evidence',
      `content=${contentArtifact?.readiness ?? 'missing'}, product=${productArtifact?.readiness ?? 'missing'}`,
    ),
    assert(
      'telemetry metrics record approvals, request changes, and resumes',
      Number(queueMetrics.metrics.request_changes_count) === 2 &&
        Number(queueMetrics.metrics.successful_resume_count) === 2 &&
        Number(queueMetrics.metrics.duplicate_execution_count) === 0,
      `requestChanges=${String(queueMetrics.metrics.request_changes_count)}, resumes=${String(queueMetrics.metrics.successful_resume_count)}`,
    ),
    assert(
      'evidence artifacts are complete',
      evidenceSummary.complete === true &&
        evidenceSummary.evidenceCompletenessCount >= REQUIRED_ARTIFACTS.length,
      `present=${evidenceSummary.evidenceCompletenessCount}, missing=${evidenceSummary.missingArtifacts.join(',')}`,
    ),
    assert(
      'threshold assertions pass',
      trace.thresholdAssertions.every((item) => item.passed),
      JSON.stringify(trace.thresholdAssertions),
    ),
  ];
}

function buildReportSections({
  sourceSnapshots,
  dossier,
  artifacts,
  interventions,
  citationProvenance,
}) {
  return [
    '## Source To Artifact Loop',
    '',
    '| Stage | Evidence | Count |',
    '| --- | --- | --- |',
    `| Source Snapshots | source-snapshots.json | ${sourceSnapshots.length} |`,
    `| Dossier claims | research-dossier.json | ${dossier.claims.length} |`,
    `| Downstream Artifacts | downstream-artifacts.json | ${artifacts.length} |`,
    `| Operator interventions | operator-interventions.json | ${interventions.length} |`,
    '',
    '## Artifact Profiles',
    '',
    '| Artifact | Class | Readiness | Claims Used |',
    '| --- | --- | --- | --- |',
    ...artifacts.map(
      (artifact) =>
        `| ${artifact.artifactId} | ${artifact.artifactClass} | ${artifact.readiness} | ${artifact.claimIdsUsed.length} |`,
    ),
    '',
    '## Operator Interventions',
    '',
    '| Intervention | Kind | Signal | Next Action |',
    '| --- | --- | --- | --- |',
    ...interventions.map(
      (intervention) =>
        `| ${intervention.interventionId} | ${intervention.kind} | ${intervention.signal} | ${intervention.nextAction} |`,
    ),
    '',
    '## Provenance Sufficiency',
    '',
    `Citations: ${citationProvenance.sufficiency.citations}`,
    `Freshness: ${citationProvenance.sufficiency.freshness}`,
    `Content publication: ${citationProvenance.sufficiency.contentPublication}`,
    `Product planning: ${citationProvenance.sufficiency.productPlanning}`,
    '',
  ];
}

export async function runSourceToArtifactCitationLoop(options = {}) {
  const startedAt = Date.now();
  const resultsDir = options.resultsDir ?? DEFAULT_RESULTS_DIR;
  const writeResults = options.writeResults ?? true;
  const log = options.log ?? console.log;
  const attemptId = options.attemptId ?? DEFAULT_ATTEMPT_ID;
  let trace = {};
  let assertions = [];
  let error;

  try {
    log('[source-to-artifact-citation-loop] building cited dossier and artifacts');
    const telemetry = createIteration2Telemetry({
      scenarioId: EXPERIMENT_NAME,
      attemptId,
      resultsDir,
      requiredEvidenceArtifacts: REQUIRED_ARTIFACTS,
    });

    const sourceSnapshots = buildSourceSnapshots();
    const dossier = buildResearchDossier(sourceSnapshots);
    const artifacts = buildDownstreamArtifacts(dossier);
    const interventions = buildOperatorInterventions(dossier, artifacts);
    const citationProvenance = buildCitationProvenance({
      sourceSnapshots,
      dossier,
      artifacts,
      interventions,
    });

    const approvalTrace = recordScenarioTelemetry(telemetry);
    recordRequiredArtifacts(telemetry);

    const observedAtIso = addMs(FIXED_STARTED_AT_ISO, 16_000);
    const thresholdAssertions = telemetry.evaluateThresholds(
      {
        maxDuplicateExecutionCount: 0,
        maxPendingAgeMsP95: 10_000,
        maxResumeLatencyMs: 1_000,
        minEvidenceCompletenessCount: REQUIRED_ARTIFACTS.length,
        minSuccessfulResumeCount: 2,
      },
      observedAtIso,
    );

    if (writeResults) {
      writeJsonArtifact(resultsDir, 'source-snapshots.json', {
        schemaVersion: 1,
        sourceSnapshots,
      });
      writeJsonArtifact(resultsDir, 'research-dossier.json', dossier);
      writeJsonArtifact(resultsDir, 'downstream-artifacts.json', {
        schemaVersion: 1,
        dossierId: dossier.dossierId,
        artifacts,
      });
      writeJsonArtifact(resultsDir, 'operator-interventions.json', {
        schemaVersion: 1,
        interventions,
      });
      writeJsonArtifact(resultsDir, 'citation-provenance.json', citationProvenance);
    }

    const artifactPaths = writeResults
      ? telemetry.writeArtifacts(
          observedAtIso,
          buildReportSections({
            sourceSnapshots,
            dossier,
            artifacts,
            interventions,
            citationProvenance,
          }),
        )
      : {};
    const queueMetrics = telemetry.buildQueueMetrics(observedAtIso);
    const evidenceSummary = telemetry.buildEvidenceSummary(observedAtIso);

    trace = {
      comparesTo: 'micro-saas-toolchain-redo',
      sourceSnapshots,
      dossier,
      artifacts,
      interventions,
      citationProvenance,
      approvalTrace,
      queueMetrics,
      evidenceSummary,
      artifactPaths,
      thresholdAssertions,
    };
    assertions = buildAssertions({
      sourceSnapshots,
      dossier,
      artifacts,
      interventions,
      queueMetrics,
      evidenceSummary,
      citationProvenance,
      trace,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const duration_ms = Date.now() - startedAt;
  const outcome =
    error != null
      ? 'inconclusive'
      : assertions.length > 0 && assertions.every((item) => item.passed)
        ? 'confirmed'
        : 'refuted';

  const result = {
    experiment: EXPERIMENT_NAME,
    attemptId,
    timestamp: new Date().toISOString(),
    outcome,
    duration_ms,
    assertions,
    trace,
    ...(error ? { error } : {}),
  };

  if (writeResults) {
    writeOutcome(resultsDir, result);
  }

  return result;
}

function printSummary(outcome, resultsDir = DEFAULT_RESULTS_DIR) {
  console.log(`\nResult: ${outcome.outcome.toUpperCase()} (${outcome.duration_ms}ms)`);
  for (const item of outcome.assertions) {
    const mark = item.passed ? 'PASS' : 'FAIL';
    const detail = item.detail ? ` - ${item.detail}` : '';
    console.log(`  ${mark}: ${item.label}${detail}`);
  }
  if (outcome.error) console.log(`\nError: ${outcome.error}`);
  console.log(`\nFull results written to: ${join(resultsDir, 'outcome.json')}`);
}

const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url).replace(/\\/g, '/') === process.argv[1].replace(/\\/g, '/');

if (isMain) {
  const { values } = parseArgs({
    options: {
      'results-dir': { type: 'string' },
      'attempt-id': { type: 'string' },
    },
  });

  const resultsDir = values['results-dir'] ?? DEFAULT_RESULTS_DIR;
  const outcome = await runSourceToArtifactCitationLoop({
    resultsDir,
    attemptId: values['attempt-id'],
  });
  printSummary(outcome, resultsDir);
  process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
}
