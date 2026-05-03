import { canonicalizeJson } from '../evidence/canonical-json.js';
import {
  HashSha256,
  type HashSha256 as HashSha256Type,
  type RunId as RunIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import type {
  AutonomyExceptionClassV1,
  AutonomyExceptionNextStepV1,
  AutonomyExceptionSeverityV1,
} from '../policy/delegated-autonomy-exceptions-v1.js';
import type { AutonomyScopeKindV1 } from '../policy/delegated-autonomy-hierarchy-v1.js';
import {
  assertNotBefore,
  readEnum,
  readInteger,
  readIsoString,
  readNonNegativeInteger,
  readOptionalString,
  readOptionalStringArray,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export const RUN_CHARTER_EVIDENCE_DEPTHS_V1 = ['minimal', 'standard', 'deep', 'forensic'] as const;

export type RunCharterEvidenceDepthV1 = (typeof RUN_CHARTER_EVIDENCE_DEPTHS_V1)[number];
export type RunCharterAuthorityBoundaryV1 = 'local-decision' | 'approval-gate' | 'intervention';
export type RunCharterAuthorityDecisionV1 = 'Allow' | 'RequireApproval' | 'Deny';
export type RunCharterLayerScopeKindV1 = Exclude<AutonomyScopeKindV1, 'Action'>;

export type RunCharterBudgetCapMetricV1 =
  | 'ModelSpendCents'
  | 'ToolCalls'
  | 'OutboundActions'
  | 'ApprovalRequests';

export type RunCharterBudgetCapV1 = Readonly<{
  metric: RunCharterBudgetCapMetricV1;
  hardStopAt: number;
  currency?: string;
}>;

export type RunCharterTimeWindowV1 = Readonly<{
  startsAtIso: string;
  endsAtIso: string;
}>;

export type RunCharterEscalationTriggerV1 = Readonly<{
  triggerId: string;
  exceptionClass: AutonomyExceptionClassV1;
  minSeverity: AutonomyExceptionSeverityV1;
  actionClass?: string;
  nextStepOptions: readonly AutonomyExceptionNextStepV1[];
  rationale: string;
}>;

export type RunCharterDecisionBoundaryV1 = Readonly<{
  localDecisionActionClasses: readonly string[];
  approvalGateActionClasses: readonly string[];
  interventionActionClasses: readonly string[];
}>;

export type RunCharterSourceLayerRefV1 = Readonly<{
  layerId: string;
  scopeKind: RunCharterLayerScopeKindV1;
  summary: string;
}>;

export type RunCharterV1 = Readonly<{
  schemaVersion: 1;
  charterId: string;
  version: number;
  goal: string;
  successCondition: string;
  scopeBoundary: string;
  allowedActionClasses: readonly string[];
  blockedActionClasses: readonly string[];
  budgetCaps: readonly RunCharterBudgetCapV1[];
  timeWindow: RunCharterTimeWindowV1;
  evidenceDepth: RunCharterEvidenceDepthV1;
  escalationTriggers: readonly RunCharterEscalationTriggerV1[];
  decisionBoundary: RunCharterDecisionBoundaryV1;
  sourceLayers: readonly RunCharterSourceLayerRefV1[];
  expandedAtIso: string;
  expansionEvidenceHashSha256?: HashSha256Type;
}>;

export type RunCharterAuthorityEvaluationV1 = Readonly<{
  schemaVersion: 1;
  charterId: string;
  charterVersion: number;
  actionClass: string;
  decision: RunCharterAuthorityDecisionV1;
  boundary: RunCharterAuthorityBoundaryV1;
  authoritySource: 'run-charter';
  requiresApprovalGate: boolean;
  requiresRunIntervention: boolean;
  permittedWithoutApprovalGate: boolean;
  reason: string;
}>;

export type RunCharterLayerV1 = Readonly<{
  schemaVersion: 1;
  layerId: string;
  scopeKind: RunCharterLayerScopeKindV1;
  goal?: string;
  successCondition?: string;
  scopeBoundary?: string;
  allowedActionClasses?: readonly string[];
  blockedActionClasses?: readonly string[];
  budgetCaps?: readonly RunCharterBudgetCapV1[];
  timeWindow?: RunCharterTimeWindowV1;
  evidenceDepth?: RunCharterEvidenceDepthV1;
  escalationTriggers?: readonly RunCharterEscalationTriggerV1[];
  decisionBoundary?: RunCharterDecisionBoundaryV1;
  summary: string;
}>;

export type RunCharterDiffKindV1 = 'selected' | 'tightened' | 'merged' | 'blocked-weakening';

export type RunCharterDiffV1 = Readonly<{
  field: string;
  layerId: string;
  scopeKind: RunCharterLayerScopeKindV1;
  kind: RunCharterDiffKindV1;
  summary: string;
}>;

export type RunCharterBlockedWeakeningV1 = Readonly<{
  field: string;
  higherLayerId: string;
  weakeningLayerId: string;
  reason:
    | 'action-class-expansion'
    | 'blocked-class-removal'
    | 'budget-cap-increase'
    | 'time-window-expansion'
    | 'evidence-depth-reduction'
    | 'authority-boundary-relaxation';
  summary: string;
}>;

export type ExpandedRunCharterV1 = Readonly<{
  charter: RunCharterV1;
  diffs: readonly RunCharterDiffV1[];
  blockedWeakeningAttempts: readonly RunCharterBlockedWeakeningV1[];
  cockpitSummary: RunCharterCockpitSummaryV1;
}>;

export type RunCharterCockpitSummaryV1 = Readonly<{
  title: string;
  goal: string;
  successCondition: string;
  scopeBoundary: string;
  localDecisionSummary: string;
  approvalGateSummary: string;
  interventionSummary: string;
  budgetSummary: string;
  timeWindowSummary: string;
  evidenceSummary: string;
  escalationSummary: string;
  blockedWeakeningCount: number;
}>;

export type RunCharterExpansionEvidenceV1 = Readonly<{
  schemaVersion: 1;
  evidenceKind: 'RunCharterExpansion';
  runId: RunIdType;
  workspaceId: WorkspaceIdType;
  charterId: string;
  occurredAtIso: string;
  charterHashSha256: HashSha256Type;
  sourceLayers: readonly RunCharterSourceLayerRefV1[];
  diffs: readonly RunCharterDiffV1[];
  blockedWeakeningAttempts: readonly RunCharterBlockedWeakeningV1[];
  cockpitSummary: RunCharterCockpitSummaryV1;
}>;

export type RunCharterHasherV1 = Readonly<{
  sha256Hex(input: string): HashSha256Type | string;
}>;

export class RunCharterParseError extends Error {
  public override readonly name = 'RunCharterParseError';

  public constructor(message: string) {
    super(message);
  }
}

const LAYER_SCOPE_ORDER: readonly RunCharterLayerScopeKindV1[] = [
  'PlatformBaseline',
  'Tenant',
  'Workspace',
  'RoleOrQueue',
  'RunCharter',
];

const BUDGET_METRICS: readonly RunCharterBudgetCapMetricV1[] = [
  'ModelSpendCents',
  'ToolCalls',
  'OutboundActions',
  'ApprovalRequests',
];

const EXCEPTION_CLASSES: readonly AutonomyExceptionClassV1[] = [
  'policy-violation',
  'evidence-gap',
  'anomaly-signal',
  'execution-failure',
  'capability-drift',
  'budget-threshold',
  'approval-fatigue',
  'stale-or-degraded-state',
  'unknown-risk',
];

const EXCEPTION_SEVERITIES: readonly AutonomyExceptionSeverityV1[] = [
  'info',
  'low',
  'medium',
  'high',
  'critical',
];

const NEXT_STEPS: readonly AutonomyExceptionNextStepV1[] = [
  'observe',
  'annotate',
  'acknowledge-digest',
  'open-work-item',
  'request-more-evidence',
  'pause-run',
  'reroute',
  'escalate',
  'freeze',
  'emergency-disable',
  'draft-policy-change',
];

const EVIDENCE_DEPTH_RANK: Readonly<Record<RunCharterEvidenceDepthV1, number>> = {
  minimal: 0,
  standard: 1,
  deep: 2,
  forensic: 3,
};

const SCOPE_RANK: Readonly<Record<RunCharterLayerScopeKindV1, number>> = {
  PlatformBaseline: 0,
  Tenant: 1,
  Workspace: 2,
  RoleOrQueue: 3,
  RunCharter: 4,
};

export function expandRunCharterV1(params: {
  charterId: string;
  version?: number;
  layers: readonly RunCharterLayerV1[];
  expandedAtIso: string;
  expansionEvidenceHashSha256?: string;
}): ExpandedRunCharterV1 {
  if (params.layers.length === 0) {
    throw new RunCharterParseError('Run charter expansion requires at least one layer.');
  }
  const expandedAtIso = readIsoString(
    { expandedAtIso: params.expandedAtIso },
    'expandedAtIso',
    RunCharterParseError,
  );
  const layers = params.layers
    .map(parseRunCharterLayerV1)
    .sort((left, right) => SCOPE_RANK[left.scopeKind] - SCOPE_RANK[right.scopeKind]);

  let goal: string | undefined;
  let successCondition: string | undefined;
  let scopeBoundary: string | undefined;
  let allowedActionClasses: readonly string[] | undefined;
  let allowedSource: RunCharterLayerV1 | undefined;
  let blockedActionClasses: readonly string[] = [];
  let budgetCaps: readonly RunCharterBudgetCapV1[] = [];
  let timeWindow: RunCharterTimeWindowV1 | undefined;
  let timeWindowSource: RunCharterLayerV1 | undefined;
  let evidenceDepth: RunCharterEvidenceDepthV1 | undefined;
  let evidenceDepthSource: RunCharterLayerV1 | undefined;
  let escalationTriggers: readonly RunCharterEscalationTriggerV1[] = [];
  let decisionBoundary: RunCharterDecisionBoundaryV1 = {
    localDecisionActionClasses: [],
    approvalGateActionClasses: [],
    interventionActionClasses: [],
  };
  let boundarySource: RunCharterLayerV1 | undefined;
  const diffs: RunCharterDiffV1[] = [];
  const blockedWeakeningAttempts: RunCharterBlockedWeakeningV1[] = [];

  for (const layer of layers) {
    if (layer.goal !== undefined) {
      goal = layer.goal;
      diffs.push(diff('goal', layer, 'selected', `Goal selected from ${layer.layerId}.`));
    }
    if (layer.successCondition !== undefined) {
      successCondition = layer.successCondition;
      diffs.push(
        diff(
          'successCondition',
          layer,
          'selected',
          `Success condition selected from ${layer.layerId}.`,
        ),
      );
    }
    if (layer.scopeBoundary !== undefined) {
      scopeBoundary = layer.scopeBoundary;
      diffs.push(
        diff('scopeBoundary', layer, 'selected', `Scope boundary selected from ${layer.layerId}.`),
      );
    }
    if (layer.allowedActionClasses !== undefined) {
      if (allowedActionClasses === undefined) {
        allowedActionClasses = uniqueSorted(layer.allowedActionClasses);
        allowedSource = layer;
        diffs.push(
          diff(
            'allowedActionClasses',
            layer,
            'selected',
            `Allowed Action classes selected from ${layer.layerId}.`,
          ),
        );
      } else {
        const intersection = allowedActionClasses.filter((value) =>
          layer.allowedActionClasses?.includes(value),
        );
        const attemptedExpansion = layer.allowedActionClasses.filter(
          (value) => !allowedActionClasses?.includes(value),
        );
        if (attemptedExpansion.length > 0 && allowedSource !== undefined) {
          blockedWeakeningAttempts.push({
            field: 'allowedActionClasses',
            higherLayerId: allowedSource.layerId,
            weakeningLayerId: layer.layerId,
            reason: 'action-class-expansion',
            summary: `${layer.layerId} attempted to add ${attemptedExpansion.join(', ')} outside ${allowedSource.layerId}.`,
          });
          diffs.push(
            diff(
              'allowedActionClasses',
              layer,
              'blocked-weakening',
              `Blocked Action class expansion: ${attemptedExpansion.join(', ')}.`,
            ),
          );
        }
        allowedActionClasses = uniqueSorted(intersection);
        allowedSource = layer;
        diffs.push(
          diff(
            'allowedActionClasses',
            layer,
            'tightened',
            `Allowed Action classes narrowed by ${layer.layerId}.`,
          ),
        );
      }
    }
    if (layer.blockedActionClasses !== undefined) {
      const before = blockedActionClasses;
      blockedActionClasses = uniqueSorted([...blockedActionClasses, ...layer.blockedActionClasses]);
      if (blockedActionClasses.length !== before.length) {
        diffs.push(
          diff(
            'blockedActionClasses',
            layer,
            'tightened',
            `Blocked Action classes merged from ${layer.layerId}.`,
          ),
        );
      }
    }
    if (layer.budgetCaps !== undefined) {
      const merged = mergeBudgetCaps(budgetCaps, layer.budgetCaps, layer, blockedWeakeningAttempts);
      budgetCaps = merged.budgetCaps;
      diffs.push(...merged.diffs);
    }
    if (layer.timeWindow !== undefined) {
      const merged = mergeTimeWindow(timeWindow, timeWindowSource, layer.timeWindow, layer);
      timeWindow = merged.timeWindow;
      timeWindowSource = layer;
      diffs.push(...merged.diffs);
      blockedWeakeningAttempts.push(...merged.blockedWeakeningAttempts);
    }
    if (layer.evidenceDepth !== undefined) {
      if (
        evidenceDepth !== undefined &&
        EVIDENCE_DEPTH_RANK[layer.evidenceDepth] < EVIDENCE_DEPTH_RANK[evidenceDepth] &&
        evidenceDepthSource !== undefined
      ) {
        blockedWeakeningAttempts.push({
          field: 'evidenceDepth',
          higherLayerId: evidenceDepthSource.layerId,
          weakeningLayerId: layer.layerId,
          reason: 'evidence-depth-reduction',
          summary: `${layer.layerId} attempted to reduce evidence depth ${evidenceDepth} -> ${layer.evidenceDepth}.`,
        });
        diffs.push(
          diff(
            'evidenceDepth',
            layer,
            'blocked-weakening',
            `Blocked evidence depth reduction to ${layer.evidenceDepth}.`,
          ),
        );
      } else {
        evidenceDepth = layer.evidenceDepth;
        evidenceDepthSource = layer;
        diffs.push(
          diff(
            'evidenceDepth',
            layer,
            evidenceDepth === undefined ? 'selected' : 'tightened',
            `Evidence depth set to ${layer.evidenceDepth}.`,
          ),
        );
      }
    }
    if (layer.escalationTriggers !== undefined) {
      escalationTriggers = mergeEscalationTriggers(escalationTriggers, layer.escalationTriggers);
      diffs.push(
        diff(
          'escalationTriggers',
          layer,
          'merged',
          `Escalation triggers merged from ${layer.layerId}.`,
        ),
      );
    }
    if (layer.decisionBoundary !== undefined) {
      const merged = mergeDecisionBoundary(
        decisionBoundary,
        boundarySource,
        layer.decisionBoundary,
        layer,
      );
      decisionBoundary = merged.boundary;
      boundarySource = layer;
      diffs.push(...merged.diffs);
      blockedWeakeningAttempts.push(...merged.blockedWeakeningAttempts);
    }
  }

  if (
    goal === undefined ||
    successCondition === undefined ||
    scopeBoundary === undefined ||
    allowedActionClasses === undefined ||
    allowedActionClasses.length === 0 ||
    timeWindow === undefined ||
    evidenceDepth === undefined
  ) {
    throw new RunCharterParseError(
      'Run charter expansion requires goal, successCondition, scopeBoundary, allowedActionClasses, timeWindow, and evidenceDepth.',
    );
  }

  const blockedSet = new Set(blockedActionClasses);
  const effectiveAllowed = allowedActionClasses.filter((value) => !blockedSet.has(value));
  const sanitizedBoundary = sanitizeDecisionBoundary(
    decisionBoundary,
    effectiveAllowed,
    blockedSet,
  );

  const charter: RunCharterV1 = {
    schemaVersion: 1,
    charterId: readString({ charterId: params.charterId }, 'charterId', RunCharterParseError),
    version: params.version ?? 1,
    goal,
    successCondition,
    scopeBoundary,
    allowedActionClasses: effectiveAllowed,
    blockedActionClasses,
    budgetCaps,
    timeWindow,
    evidenceDepth,
    escalationTriggers,
    decisionBoundary: sanitizedBoundary,
    sourceLayers: layers.map((layer) => ({
      layerId: layer.layerId,
      scopeKind: layer.scopeKind,
      summary: layer.summary,
    })),
    expandedAtIso,
    ...(params.expansionEvidenceHashSha256 !== undefined
      ? { expansionEvidenceHashSha256: HashSha256(params.expansionEvidenceHashSha256) }
      : {}),
  };
  const parsed = parseRunCharterV1(charter);
  const cockpitSummary = summarizeRunCharterForCockpitV1(parsed, blockedWeakeningAttempts.length);

  return { charter: parsed, diffs, blockedWeakeningAttempts, cockpitSummary };
}

export function evaluateRunCharterActionAuthorityV1(params: {
  charter: RunCharterV1;
  actionClass: string;
}): RunCharterAuthorityEvaluationV1 {
  const actionClass = readString(
    { actionClass: params.actionClass },
    'actionClass',
    RunCharterParseError,
  );
  const blocked = params.charter.blockedActionClasses.includes(actionClass);
  const allowed = params.charter.allowedActionClasses.includes(actionClass);
  const local = params.charter.decisionBoundary.localDecisionActionClasses.includes(actionClass);
  const approval = params.charter.decisionBoundary.approvalGateActionClasses.includes(actionClass);
  const intervention =
    params.charter.decisionBoundary.interventionActionClasses.includes(actionClass);

  if (blocked) {
    return authorityResult({
      charter: params.charter,
      actionClass,
      decision: 'Deny',
      boundary: 'intervention',
      reason: `${actionClass} is blocked by the active Run charter.`,
    });
  }
  if (!allowed) {
    return authorityResult({
      charter: params.charter,
      actionClass,
      decision: 'RequireApproval',
      boundary: 'approval-gate',
      reason: `${actionClass} is outside the active Run charter.`,
    });
  }
  if (intervention) {
    return authorityResult({
      charter: params.charter,
      actionClass,
      decision: 'Deny',
      boundary: 'intervention',
      reason: `${actionClass} requires operator intervention before continuing.`,
    });
  }
  if (approval) {
    return authorityResult({
      charter: params.charter,
      actionClass,
      decision: 'RequireApproval',
      boundary: 'approval-gate',
      reason: `${actionClass} requires an Approval Gate under the active Run charter.`,
    });
  }
  if (local) {
    return authorityResult({
      charter: params.charter,
      actionClass,
      decision: 'Allow',
      boundary: 'local-decision',
      reason: `${actionClass} is inside the active Run charter local-decision boundary.`,
    });
  }
  return authorityResult({
    charter: params.charter,
    actionClass,
    decision: 'RequireApproval',
    boundary: 'approval-gate',
    reason: `${actionClass} is allowed but has no local-decision boundary.`,
  });
}

export function parseRunCharterV1(value: unknown): RunCharterV1 {
  const record = readRecord(value, 'RunCharter', RunCharterParseError);
  const schemaVersion = readInteger(record, 'schemaVersion', RunCharterParseError);
  if (schemaVersion !== 1) {
    throw new RunCharterParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }
  const timeWindow = parseTimeWindow(record['timeWindow']);
  const expandedAtIso = readIsoString(record, 'expandedAtIso', RunCharterParseError);
  const expansionEvidenceHashSha256 = readOptionalString(
    record,
    'expansionEvidenceHashSha256',
    RunCharterParseError,
  );
  return {
    schemaVersion: 1,
    charterId: readString(record, 'charterId', RunCharterParseError),
    version: readVersion(record),
    goal: readString(record, 'goal', RunCharterParseError),
    successCondition: readString(record, 'successCondition', RunCharterParseError),
    scopeBoundary: readString(record, 'scopeBoundary', RunCharterParseError),
    allowedActionClasses: readStringList(record['allowedActionClasses'], 'allowedActionClasses', {
      minLength: 1,
    }),
    blockedActionClasses: readStringList(record['blockedActionClasses'], 'blockedActionClasses'),
    budgetCaps: parseBudgetCaps(record['budgetCaps']),
    timeWindow,
    evidenceDepth: readEnum(
      record,
      'evidenceDepth',
      RUN_CHARTER_EVIDENCE_DEPTHS_V1,
      RunCharterParseError,
    ),
    escalationTriggers: parseEscalationTriggers(record['escalationTriggers']),
    decisionBoundary: parseDecisionBoundary(record['decisionBoundary']),
    sourceLayers: parseSourceLayers(record['sourceLayers']),
    expandedAtIso,
    ...(expansionEvidenceHashSha256 !== undefined
      ? { expansionEvidenceHashSha256: HashSha256(expansionEvidenceHashSha256) }
      : {}),
  };
}

function authorityResult(params: {
  charter: RunCharterV1;
  actionClass: string;
  decision: RunCharterAuthorityDecisionV1;
  boundary: RunCharterAuthorityBoundaryV1;
  reason: string;
}): RunCharterAuthorityEvaluationV1 {
  return {
    schemaVersion: 1,
    charterId: params.charter.charterId,
    charterVersion: params.charter.version,
    actionClass: params.actionClass,
    decision: params.decision,
    boundary: params.boundary,
    authoritySource: 'run-charter',
    requiresApprovalGate: params.boundary === 'approval-gate',
    requiresRunIntervention: params.boundary === 'intervention',
    permittedWithoutApprovalGate: params.decision === 'Allow',
    reason: params.reason,
  };
}

function readVersion(record: Record<string, unknown>): number {
  const version = readInteger(record, 'version', RunCharterParseError);
  if (version < 1) throw new RunCharterParseError('version must be >= 1.');
  return version;
}

export function parseRunCharterLayerV1(value: unknown): RunCharterLayerV1 {
  const record = readRecord(value, 'RunCharterLayer', RunCharterParseError);
  const schemaVersion = readInteger(record, 'schemaVersion', RunCharterParseError);
  if (schemaVersion !== 1) {
    throw new RunCharterParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }
  const allowedActionClasses = readOptionalStringArray(
    record,
    'allowedActionClasses',
    RunCharterParseError,
    { minLength: 1 },
  );
  const blockedActionClasses = readOptionalStringArray(
    record,
    'blockedActionClasses',
    RunCharterParseError,
  );
  const budgetCaps =
    record['budgetCaps'] === undefined ? undefined : parseBudgetCaps(record['budgetCaps']);
  const timeWindow =
    record['timeWindow'] === undefined ? undefined : parseTimeWindow(record['timeWindow']);
  const evidenceDepth = readOptionalString(record, 'evidenceDepth', RunCharterParseError);
  const escalationTriggers =
    record['escalationTriggers'] === undefined
      ? undefined
      : parseEscalationTriggers(record['escalationTriggers']);
  const decisionBoundary =
    record['decisionBoundary'] === undefined
      ? undefined
      : parseDecisionBoundary(record['decisionBoundary']);
  const goal = readOptionalString(record, 'goal', RunCharterParseError);
  const successCondition = readOptionalString(record, 'successCondition', RunCharterParseError);
  const scopeBoundary = readOptionalString(record, 'scopeBoundary', RunCharterParseError);
  if (
    evidenceDepth !== undefined &&
    !RUN_CHARTER_EVIDENCE_DEPTHS_V1.includes(evidenceDepth as RunCharterEvidenceDepthV1)
  ) {
    throw new RunCharterParseError(
      `evidenceDepth must be one of: ${RUN_CHARTER_EVIDENCE_DEPTHS_V1.join(', ')}.`,
    );
  }
  return {
    schemaVersion: 1,
    layerId: readString(record, 'layerId', RunCharterParseError),
    scopeKind: readEnum(record, 'scopeKind', LAYER_SCOPE_ORDER, RunCharterParseError),
    ...(goal !== undefined ? { goal } : {}),
    ...(successCondition !== undefined ? { successCondition } : {}),
    ...(scopeBoundary !== undefined ? { scopeBoundary } : {}),
    ...(allowedActionClasses !== undefined ? { allowedActionClasses } : {}),
    ...(blockedActionClasses !== undefined ? { blockedActionClasses } : {}),
    ...(budgetCaps !== undefined ? { budgetCaps } : {}),
    ...(timeWindow !== undefined ? { timeWindow } : {}),
    ...(evidenceDepth !== undefined
      ? { evidenceDepth: evidenceDepth as RunCharterEvidenceDepthV1 }
      : {}),
    ...(escalationTriggers !== undefined ? { escalationTriggers } : {}),
    ...(decisionBoundary !== undefined ? { decisionBoundary } : {}),
    summary: readString(record, 'summary', RunCharterParseError),
  };
}

export function summarizeRunCharterForCockpitV1(
  charter: RunCharterV1,
  blockedWeakeningCount = 0,
): RunCharterCockpitSummaryV1 {
  return {
    title: `Run charter ${charter.charterId}`,
    goal: charter.goal,
    successCondition: charter.successCondition,
    scopeBoundary: charter.scopeBoundary,
    localDecisionSummary: formatClasses(charter.decisionBoundary.localDecisionActionClasses),
    approvalGateSummary: formatClasses(charter.decisionBoundary.approvalGateActionClasses),
    interventionSummary: formatClasses(charter.decisionBoundary.interventionActionClasses),
    budgetSummary:
      charter.budgetCaps.length === 0
        ? 'No budget caps declared'
        : charter.budgetCaps
            .map(
              (cap) =>
                `${cap.metric} <= ${cap.hardStopAt}${cap.currency ? ` ${cap.currency}` : ''}`,
            )
            .join('; '),
    timeWindowSummary: `${charter.timeWindow.startsAtIso} to ${charter.timeWindow.endsAtIso}`,
    evidenceSummary: `${charter.evidenceDepth} evidence required`,
    escalationSummary:
      charter.escalationTriggers.length === 0
        ? 'No escalation triggers declared'
        : `${charter.escalationTriggers.length} escalation trigger(s)`,
    blockedWeakeningCount,
  };
}

export function createRunCharterExpansionEvidenceV1(params: {
  runId: RunIdType;
  workspaceId: WorkspaceIdType;
  expanded: ExpandedRunCharterV1;
  occurredAtIso: string;
  hasher: RunCharterHasherV1;
}): RunCharterExpansionEvidenceV1 {
  const occurredAtIso = readIsoString(
    { occurredAtIso: params.occurredAtIso },
    'occurredAtIso',
    RunCharterParseError,
  );
  const canonical = canonicalizeJson(params.expanded.charter);
  const hash = HashSha256(String(params.hasher.sha256Hex(canonical)));
  return {
    schemaVersion: 1,
    evidenceKind: 'RunCharterExpansion',
    runId: params.runId,
    workspaceId: params.workspaceId,
    charterId: params.expanded.charter.charterId,
    occurredAtIso,
    charterHashSha256: hash,
    sourceLayers: params.expanded.charter.sourceLayers,
    diffs: params.expanded.diffs,
    blockedWeakeningAttempts: params.expanded.blockedWeakeningAttempts,
    cockpitSummary: params.expanded.cockpitSummary,
  };
}

function mergeBudgetCaps(
  currentCaps: readonly RunCharterBudgetCapV1[],
  candidateCaps: readonly RunCharterBudgetCapV1[],
  layer: RunCharterLayerV1,
  blockedWeakeningAttempts: RunCharterBlockedWeakeningV1[],
): Readonly<{ budgetCaps: readonly RunCharterBudgetCapV1[]; diffs: readonly RunCharterDiffV1[] }> {
  const byKey = new Map(currentCaps.map((cap) => [budgetKey(cap), cap]));
  const diffs: RunCharterDiffV1[] = [];
  for (const cap of candidateCaps) {
    const key = budgetKey(cap);
    const existing = byKey.get(key);
    if (existing === undefined || cap.hardStopAt <= existing.hardStopAt) {
      byKey.set(key, cap);
      diffs.push(
        diff(
          'budgetCaps',
          layer,
          existing === undefined ? 'selected' : 'tightened',
          `Budget cap ${key} set to ${cap.hardStopAt}.`,
        ),
      );
    } else {
      blockedWeakeningAttempts.push({
        field: 'budgetCaps',
        higherLayerId: 'previous-budget-cap',
        weakeningLayerId: layer.layerId,
        reason: 'budget-cap-increase',
        summary: `${layer.layerId} attempted to increase ${key} ${existing.hardStopAt} -> ${cap.hardStopAt}.`,
      });
      diffs.push(
        diff('budgetCaps', layer, 'blocked-weakening', `Blocked budget cap increase for ${key}.`),
      );
    }
  }
  return {
    budgetCaps: [...byKey.values()].sort((a, b) => budgetKey(a).localeCompare(budgetKey(b))),
    diffs,
  };
}

function mergeTimeWindow(
  current: RunCharterTimeWindowV1 | undefined,
  currentSource: RunCharterLayerV1 | undefined,
  candidate: RunCharterTimeWindowV1,
  layer: RunCharterLayerV1,
): Readonly<{
  timeWindow: RunCharterTimeWindowV1;
  diffs: readonly RunCharterDiffV1[];
  blockedWeakeningAttempts: readonly RunCharterBlockedWeakeningV1[];
}> {
  if (current === undefined) {
    return {
      timeWindow: candidate,
      diffs: [diff('timeWindow', layer, 'selected', `Time window selected from ${layer.layerId}.`)],
      blockedWeakeningAttempts: [],
    };
  }
  const startsAtIso =
    Date.parse(candidate.startsAtIso) > Date.parse(current.startsAtIso)
      ? candidate.startsAtIso
      : current.startsAtIso;
  const endsAtIso =
    Date.parse(candidate.endsAtIso) < Date.parse(current.endsAtIso)
      ? candidate.endsAtIso
      : current.endsAtIso;
  const blocked: RunCharterBlockedWeakeningV1[] = [];
  if (Date.parse(candidate.startsAtIso) < Date.parse(current.startsAtIso) && currentSource) {
    blocked.push({
      field: 'timeWindow.startsAtIso',
      higherLayerId: currentSource.layerId,
      weakeningLayerId: layer.layerId,
      reason: 'time-window-expansion',
      summary: `${layer.layerId} attempted to start before ${currentSource.layerId}.`,
    });
  }
  if (Date.parse(candidate.endsAtIso) > Date.parse(current.endsAtIso) && currentSource) {
    blocked.push({
      field: 'timeWindow.endsAtIso',
      higherLayerId: currentSource.layerId,
      weakeningLayerId: layer.layerId,
      reason: 'time-window-expansion',
      summary: `${layer.layerId} attempted to end after ${currentSource.layerId}.`,
    });
  }
  return {
    timeWindow: { startsAtIso, endsAtIso },
    diffs: [
      diff(
        'timeWindow',
        layer,
        blocked.length > 0 ? 'blocked-weakening' : 'tightened',
        `Time window merged from ${layer.layerId}.`,
      ),
    ],
    blockedWeakeningAttempts: blocked,
  };
}

function mergeDecisionBoundary(
  current: RunCharterDecisionBoundaryV1,
  currentSource: RunCharterLayerV1 | undefined,
  candidate: RunCharterDecisionBoundaryV1,
  layer: RunCharterLayerV1,
): Readonly<{
  boundary: RunCharterDecisionBoundaryV1;
  diffs: readonly RunCharterDiffV1[];
  blockedWeakeningAttempts: readonly RunCharterBlockedWeakeningV1[];
}> {
  const currentApprovalOrIntervention = new Set([
    ...current.approvalGateActionClasses,
    ...current.interventionActionClasses,
  ]);
  const attemptedLocalWeakening = candidate.localDecisionActionClasses.filter((value) =>
    currentApprovalOrIntervention.has(value),
  );
  const blocked = attemptedLocalWeakening.map(
    (actionClass): RunCharterBlockedWeakeningV1 => ({
      field: 'decisionBoundary.localDecisionActionClasses',
      higherLayerId: currentSource?.layerId ?? 'previous-decision-boundary',
      weakeningLayerId: layer.layerId,
      reason: 'authority-boundary-relaxation',
      summary: `${layer.layerId} attempted to move ${actionClass} from Approval Gate/intervention to local decision.`,
    }),
  );
  const local = uniqueSorted([
    ...current.localDecisionActionClasses,
    ...candidate.localDecisionActionClasses.filter(
      (value) => !currentApprovalOrIntervention.has(value),
    ),
  ]);
  const approval = uniqueSorted([
    ...current.approvalGateActionClasses,
    ...candidate.approvalGateActionClasses,
  ]);
  const intervention = uniqueSorted([
    ...current.interventionActionClasses,
    ...candidate.interventionActionClasses,
  ]);
  return {
    boundary: {
      localDecisionActionClasses: local.filter(
        (value) => !approval.includes(value) && !intervention.includes(value),
      ),
      approvalGateActionClasses: approval.filter((value) => !intervention.includes(value)),
      interventionActionClasses: intervention,
    },
    diffs: [
      diff(
        'decisionBoundary',
        layer,
        blocked.length > 0 ? 'blocked-weakening' : 'merged',
        `Decision boundary merged from ${layer.layerId}.`,
      ),
    ],
    blockedWeakeningAttempts: blocked,
  };
}

function sanitizeDecisionBoundary(
  boundary: RunCharterDecisionBoundaryV1,
  allowedActionClasses: readonly string[],
  blockedSet: ReadonlySet<string>,
): RunCharterDecisionBoundaryV1 {
  const allowedSet = new Set(allowedActionClasses);
  const local = uniqueSorted(
    boundary.localDecisionActionClasses.filter(
      (value) => allowedSet.has(value) && !blockedSet.has(value),
    ),
  );
  const intervention = uniqueSorted(
    boundary.interventionActionClasses.filter(
      (value) => allowedSet.has(value) && !blockedSet.has(value),
    ),
  );
  const approval = uniqueSorted(
    boundary.approvalGateActionClasses.filter(
      (value) => allowedSet.has(value) && !blockedSet.has(value) && !intervention.includes(value),
    ),
  );
  return {
    localDecisionActionClasses: local.filter(
      (value) => !approval.includes(value) && !intervention.includes(value),
    ),
    approvalGateActionClasses: approval,
    interventionActionClasses: intervention,
  };
}

function parseBudgetCaps(value: unknown): readonly RunCharterBudgetCapV1[] {
  if (!Array.isArray(value)) throw new RunCharterParseError('budgetCaps must be an array.');
  return value.map((item, index) => {
    const record = readRecord(item, `budgetCaps[${index}]`, RunCharterParseError);
    const currency = readOptionalString(record, 'currency', RunCharterParseError);
    const cap: RunCharterBudgetCapV1 = {
      metric: readEnum(record, 'metric', BUDGET_METRICS, RunCharterParseError),
      hardStopAt: readNonNegativeInteger(record, 'hardStopAt', RunCharterParseError),
      ...(currency !== undefined ? { currency } : {}),
    };
    if (cap.hardStopAt < 1) throw new RunCharterParseError('budgetCaps.hardStopAt must be >= 1.');
    return cap;
  });
}

function parseTimeWindow(value: unknown): RunCharterTimeWindowV1 {
  const record = readRecord(value, 'timeWindow', RunCharterParseError);
  const startsAtIso = readIsoString(record, 'startsAtIso', RunCharterParseError);
  const endsAtIso = readIsoString(record, 'endsAtIso', RunCharterParseError);
  assertNotBefore(startsAtIso, endsAtIso, RunCharterParseError, {
    anchorLabel: 'timeWindow.startsAtIso',
    laterLabel: 'timeWindow.endsAtIso',
  });
  return { startsAtIso, endsAtIso };
}

function parseEscalationTriggers(value: unknown): readonly RunCharterEscalationTriggerV1[] {
  if (!Array.isArray(value)) {
    throw new RunCharterParseError('escalationTriggers must be an array.');
  }
  return value.map((item, index) => {
    const record = readRecord(item, `escalationTriggers[${index}]`, RunCharterParseError);
    const actionClass = readOptionalString(record, 'actionClass', RunCharterParseError);
    return {
      triggerId: readString(record, 'triggerId', RunCharterParseError),
      exceptionClass: readEnum(record, 'exceptionClass', EXCEPTION_CLASSES, RunCharterParseError),
      minSeverity: readEnum(record, 'minSeverity', EXCEPTION_SEVERITIES, RunCharterParseError),
      ...(actionClass !== undefined ? { actionClass } : {}),
      nextStepOptions: readStringList(record['nextStepOptions'], 'nextStepOptions', {
        minLength: 1,
      }).map((step, stepIndex) => {
        if (!NEXT_STEPS.includes(step as AutonomyExceptionNextStepV1)) {
          throw new RunCharterParseError(
            `nextStepOptions[${stepIndex}] must be one of: ${NEXT_STEPS.join(', ')}.`,
          );
        }
        return step as AutonomyExceptionNextStepV1;
      }),
      rationale: readString(record, 'rationale', RunCharterParseError),
    };
  });
}

function parseDecisionBoundary(value: unknown): RunCharterDecisionBoundaryV1 {
  const record = readRecord(value, 'decisionBoundary', RunCharterParseError);
  return {
    localDecisionActionClasses: readStringList(
      record['localDecisionActionClasses'],
      'decisionBoundary.localDecisionActionClasses',
    ),
    approvalGateActionClasses: readStringList(
      record['approvalGateActionClasses'],
      'decisionBoundary.approvalGateActionClasses',
    ),
    interventionActionClasses: readStringList(
      record['interventionActionClasses'],
      'decisionBoundary.interventionActionClasses',
    ),
  };
}

function parseSourceLayers(value: unknown): readonly RunCharterSourceLayerRefV1[] {
  if (!Array.isArray(value)) throw new RunCharterParseError('sourceLayers must be an array.');
  if (value.length === 0) throw new RunCharterParseError('sourceLayers must be non-empty.');
  return value.map((item, index) => {
    const record = readRecord(item, `sourceLayers[${index}]`, RunCharterParseError);
    return {
      layerId: readString(record, 'layerId', RunCharterParseError),
      scopeKind: readEnum(record, 'scopeKind', LAYER_SCOPE_ORDER, RunCharterParseError),
      summary: readString(record, 'summary', RunCharterParseError),
    };
  });
}

function readStringList(
  value: unknown,
  label: string,
  opts: Readonly<{ minLength?: number }> = {},
): readonly string[] {
  if (!Array.isArray(value)) throw new RunCharterParseError(`${label} must be an array.`);
  if ((opts.minLength ?? 0) > 0 && value.length < opts.minLength!) {
    throw new RunCharterParseError(`${label} must be a non-empty array.`);
  }
  return uniqueSorted(
    value.map((item, index) =>
      readString({ value: item }, 'value', RunCharterParseError, { path: `${label}[${index}]` }),
    ),
  );
}

function mergeEscalationTriggers(
  current: readonly RunCharterEscalationTriggerV1[],
  candidate: readonly RunCharterEscalationTriggerV1[],
): readonly RunCharterEscalationTriggerV1[] {
  const byId = new Map(current.map((trigger) => [trigger.triggerId, trigger]));
  for (const trigger of candidate) byId.set(trigger.triggerId, trigger);
  return [...byId.values()].sort((left, right) => left.triggerId.localeCompare(right.triggerId));
}

function diff(
  field: string,
  layer: RunCharterLayerV1,
  kind: RunCharterDiffKindV1,
  summary: string,
): RunCharterDiffV1 {
  return { field, layerId: layer.layerId, scopeKind: layer.scopeKind, kind, summary };
}

function budgetKey(cap: RunCharterBudgetCapV1): string {
  return `${cap.metric}:${cap.currency ?? 'unit'}`;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function formatClasses(values: readonly string[]): string {
  return values.length === 0 ? 'None declared' : values.join(', ');
}
