import {
  parseEngineeringEvidenceCardInputV1,
  type EngineeringEvidenceCardActionStatus,
  type EngineeringEvidenceCardInputV1,
} from './engineering-evidence-card-v1.js';

export const ENGINEERING_EVIDENCE_CARD_COCKPIT_EXPORT_V1_CONTENT_TYPE =
  'application/vnd.portarium.engineering-evidence-card+json' as const;

export const ENGINEERING_EVIDENCE_CARD_COCKPIT_EXPORT_V1_ROUTE_HINT =
  '/cockpit/engineering/evidence-cards/static' as const;

export type EngineeringEvidenceCardCockpitExportToneV1 =
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';

export type EngineeringEvidenceCardCockpitExportBadgeV1 = Readonly<{
  label: string;
  value: string;
  tone: EngineeringEvidenceCardCockpitExportToneV1;
}>;

export type EngineeringEvidenceCardCockpitExportMetricRowV1 = Readonly<{
  key: 'frontierTokens' | 'cachedInputTokens' | 'providerUsd' | 'localWallSeconds';
  label: string;
  value: number;
  unit: 'tokens' | 'usd' | 'seconds';
  tone: EngineeringEvidenceCardCockpitExportToneV1;
}>;

export type EngineeringEvidenceCardCockpitExportGateRowV1 = Readonly<{
  key: 'finalVerdict' | 'privateOracle' | 'blockingReviewDefects';
  label: string;
  value: string;
  tone: EngineeringEvidenceCardCockpitExportToneV1;
  details: readonly string[];
}>;

export type EngineeringEvidenceCardCockpitExportArtifactRefV1 = Readonly<{
  kind: 'manifest' | 'oracleStdout' | 'oracleStderr';
  label: string;
  ref: string | null;
}>;

export type EngineeringEvidenceCardCockpitExportV1 = Readonly<{
  contentType: typeof ENGINEERING_EVIDENCE_CARD_COCKPIT_EXPORT_V1_CONTENT_TYPE;
  routeHint: typeof ENGINEERING_EVIDENCE_CARD_COCKPIT_EXPORT_V1_ROUTE_HINT;
  source: EngineeringEvidenceCardInputV1['source'];
  title: string;
  subtitle: string;
  actionStatus: EngineeringEvidenceCardActionStatus;
  operatorDecision: 'research-only-no-action' | 'blocked-no-action';
  routeBadge: EngineeringEvidenceCardCockpitExportBadgeV1;
  modelBadge: EngineeringEvidenceCardCockpitExportBadgeV1;
  actionBadge: EngineeringEvidenceCardCockpitExportBadgeV1;
  metricRows: readonly EngineeringEvidenceCardCockpitExportMetricRowV1[];
  gateRows: readonly EngineeringEvidenceCardCockpitExportGateRowV1[];
  artifactRefs: readonly EngineeringEvidenceCardCockpitExportArtifactRefV1[];
  boundaryWarnings: readonly string[];
}>;

export function buildEngineeringEvidenceCardCockpitExportV1(
  value: unknown,
): EngineeringEvidenceCardCockpitExportV1 {
  const card = parseEngineeringEvidenceCardInputV1(value);
  const exportModel = {
    contentType: ENGINEERING_EVIDENCE_CARD_COCKPIT_EXPORT_V1_CONTENT_TYPE,
    routeHint: ENGINEERING_EVIDENCE_CARD_COCKPIT_EXPORT_V1_ROUTE_HINT,
    source: card.source,
    title: card.workItem.id,
    subtitle: `${card.source.system}/${card.source.area} run ${card.workItem.runId}`,
    actionStatus: card.actionBoundary.status,
    operatorDecision:
      card.actionBoundary.status === 'research-only'
        ? 'research-only-no-action'
        : 'blocked-no-action',
    routeBadge: routeBadge(card),
    modelBadge: modelBadge(card),
    actionBadge: actionBadge(card),
    metricRows: metricRows(card),
    gateRows: gateRows(card),
    artifactRefs: artifactRefs(card),
    boundaryWarnings: [
      'Static R&D evidence only; do not execute production actions from this export.',
      'No live prompt-language manifest ingestion is implied by this export.',
      'No Cockpit runtime card, queue, database table, or SSE stream is created by this export.',
      'No MacquarieCollege connector observation, source-system read, write, or raw data movement is authorized.',
    ],
  } satisfies EngineeringEvidenceCardCockpitExportV1;

  return deepFreeze(exportModel);
}

function routeBadge(
  card: EngineeringEvidenceCardInputV1,
): EngineeringEvidenceCardCockpitExportBadgeV1 {
  const policyDecision = card.route.policyDecision ?? 'unclassified';
  return {
    label: 'Route',
    value: `${policyDecision} via ${card.route.arm}`,
    tone:
      policyDecision === 'local-screen'
        ? 'success'
        : policyDecision === 'frontier-baseline'
          ? 'warning'
          : 'neutral',
  };
}

function modelBadge(
  card: EngineeringEvidenceCardInputV1,
): EngineeringEvidenceCardCockpitExportBadgeV1 {
  const provider = card.route.selectedProvider ?? 'unknown-provider';
  const model = card.route.selectedModel ?? 'unknown-model';
  return {
    label: 'Model',
    value: `${provider}/${model}`,
    tone: provider === 'ollama' ? 'success' : 'neutral',
  };
}

function actionBadge(
  card: EngineeringEvidenceCardInputV1,
): EngineeringEvidenceCardCockpitExportBadgeV1 {
  return {
    label: 'Boundary',
    value: card.actionBoundary.status,
    tone: card.actionBoundary.status === 'research-only' ? 'warning' : 'danger',
  };
}

function metricRows(
  card: EngineeringEvidenceCardInputV1,
): readonly EngineeringEvidenceCardCockpitExportMetricRowV1[] {
  return [
    {
      key: 'frontierTokens',
      label: 'Frontier tokens',
      value: card.cost.frontierTokensTotal,
      unit: 'tokens',
      tone: card.cost.frontierTokensTotal === 0 ? 'success' : 'warning',
    },
    {
      key: 'cachedInputTokens',
      label: 'Cached input tokens',
      value: card.cost.cachedInputTokensTotal,
      unit: 'tokens',
      tone: 'neutral',
    },
    {
      key: 'providerUsd',
      label: 'Provider USD',
      value: card.cost.providerUsdTotal,
      unit: 'usd',
      tone: card.cost.providerUsdTotal === 0 ? 'success' : 'warning',
    },
    {
      key: 'localWallSeconds',
      label: 'Local wall time',
      value: card.cost.localWallSecondsTotal,
      unit: 'seconds',
      tone: card.cost.localWallSecondsTotal > 0 ? 'neutral' : 'warning',
    },
  ];
}

function gateRows(
  card: EngineeringEvidenceCardInputV1,
): readonly EngineeringEvidenceCardCockpitExportGateRowV1[] {
  return [
    {
      key: 'finalVerdict',
      label: 'Final verdict',
      value: String(card.gates.finalVerdict),
      tone: card.gates.finalVerdict === 'pass' ? 'success' : 'danger',
      details: [],
    },
    {
      key: 'privateOracle',
      label: 'Private oracle',
      value: card.gates.privateOracle,
      tone: card.gates.privateOracle === 'pass' ? 'success' : 'danger',
      details: [],
    },
    {
      key: 'blockingReviewDefects',
      label: 'Review defects',
      value:
        card.gates.blockingReviewDefects.length === 0
          ? 'none'
          : `${card.gates.blockingReviewDefects.length} blocking`,
      tone: card.gates.blockingReviewDefects.length === 0 ? 'success' : 'danger',
      details: [...card.gates.blockingReviewDefects],
    },
  ];
}

function artifactRefs(
  card: EngineeringEvidenceCardInputV1,
): readonly EngineeringEvidenceCardCockpitExportArtifactRefV1[] {
  return [
    {
      kind: 'manifest',
      label: 'Manifest',
      ref: card.artifactRefs.manifest,
    },
    {
      kind: 'oracleStdout',
      label: 'Oracle stdout',
      ref: card.artifactRefs.oracleStdout,
    },
    {
      kind: 'oracleStderr',
      label: 'Oracle stderr',
      ref: card.artifactRefs.oracleStderr,
    },
  ];
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}
