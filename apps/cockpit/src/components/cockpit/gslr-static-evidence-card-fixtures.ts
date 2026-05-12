import type { GslrStaticEvidenceCardExport } from './gslr-static-evidence-card-view';

const BOUNDARY_WARNINGS = [
  'Static R&D evidence only; do not execute production actions from this export.',
  'No live prompt-language manifest ingestion is implied by this export.',
  'No Cockpit runtime card, queue, database table, or SSE stream is created by this export.',
  'No MacquarieCollege connector observation, source-system read, write, or raw data movement is authorized.',
] as const;

export const GSLR_STATIC_ENGINEERING_EVIDENCE_CARD_EXPORTS = [
  {
    contentType: 'application/vnd.portarium.engineering-evidence-card+json',
    routeHint: '/cockpit/engineering/evidence-cards/static',
    source: {
      system: 'prompt-language',
      area: 'harness-arena',
      manifestSchemaVersion: 2,
    },
    title: 'gslr8-route-record-compiler',
    subtitle:
      'prompt-language/harness-arena run gslr8-route-record-compiler-live-2026-05-13-01-local-diagnostic',
    actionStatus: 'research-only',
    operatorDecision: 'research-only-no-action',
    routeBadge: {
      label: 'Route',
      value: 'local-screen via local-only',
      tone: 'success',
    },
    modelBadge: {
      label: 'Model',
      value: 'ollama/qwen3-coder:30b',
      tone: 'success',
    },
    actionBadge: {
      label: 'Boundary',
      value: 'research-only',
      tone: 'warning',
    },
    metricRows: [
      {
        label: 'Frontier tokens',
        value: 0,
        tone: 'success',
        detail: 'No Codex/frontier intervention was needed for this bounded local-screen hook.',
      },
      {
        label: 'Cached prompt tokens',
        value: 0,
        tone: 'neutral',
      },
      {
        label: 'Provider cost',
        value: '$0.00',
        tone: 'success',
      },
      {
        label: 'Local wall time',
        value: '22.175s',
        tone: 'neutral',
      },
    ],
    gateRows: [
      {
        label: 'Final verdict',
        value: 'pass',
        tone: 'success',
      },
      {
        label: 'Private oracle',
        value: 'pass',
        tone: 'success',
      },
      {
        label: 'Review defects',
        value: 'none',
        tone: 'success',
      },
    ],
    artifactRefs: [
      {
        label: 'Run manifest',
        path: 'prompt-language/harness-arena/runs/gslr8-route-record-compiler-live-2026-05-13-01-local-diagnostic/manifest.json',
      },
      {
        label: 'Route record compiler',
        path: 'prompt-language/harness-arena/routes/gslr8_route_record_compiler.py',
      },
      {
        label: 'GSLR-10 Cockpit export test',
        path: 'Portarium/src/domain/evidence/engineering-evidence-card-cockpit-export-v1.test.ts',
      },
    ],
    boundaryWarnings: BOUNDARY_WARNINGS,
  },
  {
    contentType: 'application/vnd.portarium.engineering-evidence-card+json',
    routeHint: '/cockpit/engineering/evidence-cards/static',
    source: {
      system: 'prompt-language',
      area: 'harness-arena',
      manifestSchemaVersion: 2,
    },
    title: 'gslr7-scaffolded-route-record',
    subtitle:
      'prompt-language/harness-arena run gslr7-scaffolded-route-record-live-2026-05-13-v2-01-local-repeat',
    actionStatus: 'blocked',
    operatorDecision: 'blocked-no-action',
    routeBadge: {
      label: 'Route',
      value: 'frontier-baseline via local-only',
      tone: 'warning',
    },
    modelBadge: {
      label: 'Model',
      value: 'ollama/qwen3-coder:30b',
      tone: 'success',
    },
    actionBadge: {
      label: 'Boundary',
      value: 'blocked',
      tone: 'danger',
    },
    metricRows: [
      {
        label: 'Frontier tokens',
        value: 0,
        tone: 'success',
      },
      {
        label: 'Cached prompt tokens',
        value: 0,
        tone: 'neutral',
      },
      {
        label: 'Provider cost',
        value: '$0.00',
        tone: 'success',
      },
      {
        label: 'Local wall time',
        value: '82.961s',
        tone: 'neutral',
      },
    ],
    gateRows: [
      {
        label: 'Final verdict',
        value: 'fail',
        tone: 'danger',
      },
      {
        label: 'Private oracle',
        value: 'fail',
        tone: 'danger',
      },
      {
        label: 'Review defects',
        value: '1 blocking',
        tone: 'danger',
        detail:
          'Accepted oracle command because normalized input was compared with unnormalized constants.',
      },
    ],
    artifactRefs: [
      {
        label: 'Run manifest',
        path: 'prompt-language/harness-arena/runs/gslr7-scaffolded-route-record-live-2026-05-13-v2-01-local-repeat/manifest.json',
      },
      {
        label: 'Review findings',
        path: 'prompt-language/harness-arena/runs/gslr7-scaffolded-route-record-live-2026-05-13-v2-01-local-repeat/review.json',
      },
      {
        label: 'GSLR-9 projection test',
        path: 'Portarium/src/domain/evidence/gslr-engineering-evidence-card-projection-v1.test.ts',
      },
    ],
    boundaryWarnings: BOUNDARY_WARNINGS,
  },
] as const satisfies readonly GslrStaticEvidenceCardExport[];
