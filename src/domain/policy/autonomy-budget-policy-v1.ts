import type {
  PolicyId as PolicyIdType,
  RunId as RunIdType,
  WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  readBoolean,
  readEnum,
  readInteger,
  readIsoString,
  readOptionalInteger,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export type AutonomyBudgetMetricV1 =
  | 'ModelSpendCents'
  | 'ToolCalls'
  | 'OutboundActions'
  | 'ApprovalRequests';

export type AutonomyBudgetScopeV1 = 'Workspace' | 'Run';

export type AutonomyBudgetHardStopModeV1 =
  | 'FreezeRun'
  | 'FreezeWorkspace'
  | 'KillRun'
  | 'KillWorkspaceAutomation';

export type AutonomyBudgetV1 = Readonly<{
  budgetId: string;
  scope: AutonomyBudgetScopeV1;
  metric: AutonomyBudgetMetricV1;
  warningAt: number;
  hardStopAt: number;
  hardStopMode: AutonomyBudgetHardStopModeV1;
  rationale: string;
}>;

export type AutonomyBudgetPolicySourceV1 = Readonly<{
  policyId: PolicyIdType;
  active: boolean;
  autonomyBudgets?: readonly AutonomyBudgetV1[];
}>;

export type AutonomyBudgetConsumptionV1 = Readonly<{
  scope: AutonomyBudgetScopeV1;
  metric: AutonomyBudgetMetricV1;
  used: number;
  pending?: number;
}>;

export type AutonomyBudgetEvaluationContextV1 = Readonly<{
  workspaceId: WorkspaceIdType;
  runId?: RunIdType;
  usage: readonly AutonomyBudgetConsumptionV1[];
  evaluatedAtIso: string;
  workspaceFrozen?: boolean;
  runFrozen?: boolean;
  workspaceKillSwitch?: boolean;
  runKillSwitch?: boolean;
  runawayDetected?: boolean;
  runawayRationale?: string;
}>;

export type AutonomyBudgetDecisionV1 = 'Allow' | 'Warn' | 'HardStop';

export type AutonomyBudgetTriggerKindV1 =
  | 'BudgetWarning'
  | 'BudgetHardStop'
  | 'WorkspaceFrozen'
  | 'RunFrozen'
  | 'WorkspaceKillSwitch'
  | 'RunKillSwitch'
  | 'RunawayHardStop';

export type AutonomyBudgetTriggerV1 = Readonly<{
  kind: AutonomyBudgetTriggerKindV1;
  policyId?: PolicyIdType;
  budgetId?: string;
  scope: AutonomyBudgetScopeV1;
  metric?: AutonomyBudgetMetricV1;
  used?: number;
  pending?: number;
  evaluatedUsage?: number;
  threshold?: number;
  hardStopMode?: AutonomyBudgetHardStopModeV1;
  operatorVisibleRationale: string;
}>;

export type AutonomyBudgetEvidenceV1 = Readonly<{
  category: 'Policy';
  decision: AutonomyBudgetDecisionV1;
  stopClass: 'none' | 'budget' | 'policy-control' | 'runaway';
  evaluatedPolicyIds: readonly PolicyIdType[];
  triggerKinds: readonly AutonomyBudgetTriggerKindV1[];
  operatorVisibleRationale: string;
  evaluatedAtIso: string;
}>;

export type AutonomyBudgetEvaluationResultV1 = Readonly<{
  schemaVersion: 1;
  decision: AutonomyBudgetDecisionV1;
  evaluatedPolicyIds: readonly PolicyIdType[];
  warnings: readonly AutonomyBudgetTriggerV1[];
  hardStops: readonly AutonomyBudgetTriggerV1[];
  operatorVisibleRationale: string;
  evidence: AutonomyBudgetEvidenceV1;
  evaluatedAtIso: string;
}>;

export class AutonomyBudgetPolicyParseError extends Error {
  public override readonly name = 'AutonomyBudgetPolicyParseError';

  public constructor(message: string) {
    super(message);
  }
}

const METRICS = ['ModelSpendCents', 'ToolCalls', 'OutboundActions', 'ApprovalRequests'] as const;

const SCOPES = ['Workspace', 'Run'] as const;

const HARD_STOP_MODES = [
  'FreezeRun',
  'FreezeWorkspace',
  'KillRun',
  'KillWorkspaceAutomation',
] as const;

const METRIC_ORDER: Record<AutonomyBudgetMetricV1, number> = {
  ModelSpendCents: 0,
  ToolCalls: 1,
  OutboundActions: 2,
  ApprovalRequests: 3,
};

const SCOPE_ORDER: Record<AutonomyBudgetScopeV1, number> = {
  Workspace: 0,
  Run: 1,
};

const TRIGGER_ORDER: Record<AutonomyBudgetTriggerKindV1, number> = {
  WorkspaceKillSwitch: 0,
  RunKillSwitch: 1,
  RunawayHardStop: 2,
  WorkspaceFrozen: 3,
  RunFrozen: 4,
  BudgetHardStop: 5,
  BudgetWarning: 6,
};

export function parseAutonomyBudgetsV1(value: unknown): readonly AutonomyBudgetV1[] {
  if (!Array.isArray(value)) {
    throw new AutonomyBudgetPolicyParseError('autonomyBudgets must be an array.');
  }
  return Object.freeze(value.map((item, idx) => parseAutonomyBudgetV1(item, idx)));
}

export function parseAutonomyBudgetV1(value: unknown, index = 0): AutonomyBudgetV1 {
  const path = `autonomyBudgets[${index}]`;
  const record = readRecord(value, path, AutonomyBudgetPolicyParseError);
  const budgetId = readString(record, 'budgetId', AutonomyBudgetPolicyParseError);
  const scope = readEnum(record, 'scope', SCOPES, AutonomyBudgetPolicyParseError);
  const metric = readEnum(record, 'metric', METRICS, AutonomyBudgetPolicyParseError);
  const warningAt = readInteger(record, 'warningAt', AutonomyBudgetPolicyParseError);
  const hardStopAt = readInteger(record, 'hardStopAt', AutonomyBudgetPolicyParseError);
  const hardStopMode = readEnum(
    record,
    'hardStopMode',
    HARD_STOP_MODES,
    AutonomyBudgetPolicyParseError,
  );
  const rationale = readString(record, 'rationale', AutonomyBudgetPolicyParseError);

  if (warningAt < 0) {
    throw new AutonomyBudgetPolicyParseError(`${path}.warningAt must be >= 0.`);
  }
  if (hardStopAt < 1) {
    throw new AutonomyBudgetPolicyParseError(`${path}.hardStopAt must be >= 1.`);
  }
  if (warningAt >= hardStopAt) {
    throw new AutonomyBudgetPolicyParseError(`${path}.warningAt must be less than hardStopAt.`);
  }

  return {
    budgetId,
    scope,
    metric,
    warningAt,
    hardStopAt,
    hardStopMode,
    rationale,
  };
}

export function parseAutonomyBudgetEvaluationContextV1(
  value: unknown,
): AutonomyBudgetEvaluationContextV1 {
  const record = readRecord(
    value,
    'AutonomyBudgetEvaluationContext',
    AutonomyBudgetPolicyParseError,
  );
  const workspaceId = readString(record, 'workspaceId', AutonomyBudgetPolicyParseError);
  const runId = readOptionalString(record, 'runId', AutonomyBudgetPolicyParseError);
  const evaluatedAtIso = readIsoString(record, 'evaluatedAtIso', AutonomyBudgetPolicyParseError);
  const usageRaw = record['usage'];
  if (!Array.isArray(usageRaw)) {
    throw new AutonomyBudgetPolicyParseError('usage must be an array.');
  }

  return {
    workspaceId: workspaceId as WorkspaceIdType,
    ...(runId ? { runId: runId as RunIdType } : {}),
    usage: Object.freeze(usageRaw.map((item, idx) => parseConsumption(item, idx))),
    evaluatedAtIso,
    ...readOptionalControlFlags(record),
  };
}

export function evaluateAutonomyBudgetsV1(params: {
  policies: readonly AutonomyBudgetPolicySourceV1[];
  context: AutonomyBudgetEvaluationContextV1;
}): AutonomyBudgetEvaluationResultV1 {
  const activePolicies = params.policies.filter((policy) => policy.active);
  const evaluatedPolicyIds = Object.freeze(activePolicies.map((policy) => policy.policyId));
  const controlStops = buildControlStops(params.context);
  const budgetTriggers = buildBudgetTriggers(activePolicies, params.context);

  const warnings = Object.freeze(
    budgetTriggers.filter((trigger) => trigger.kind === 'BudgetWarning').sort(compareTriggers),
  );
  const hardStops = Object.freeze(
    [
      ...controlStops,
      ...budgetTriggers.filter((trigger) => trigger.kind === 'BudgetHardStop'),
    ].sort(compareTriggers),
  );

  const decision: AutonomyBudgetDecisionV1 =
    hardStops.length > 0 ? 'HardStop' : warnings.length > 0 ? 'Warn' : 'Allow';
  const operatorVisibleRationale = buildOperatorRationale(decision, hardStops, warnings);

  const result: AutonomyBudgetEvaluationResultV1 = {
    schemaVersion: 1,
    decision,
    evaluatedPolicyIds,
    warnings,
    hardStops,
    operatorVisibleRationale,
    evidence: {
      category: 'Policy',
      decision,
      stopClass: deriveStopClass(hardStops),
      evaluatedPolicyIds,
      triggerKinds: Object.freeze([...hardStops, ...warnings].map((trigger) => trigger.kind)),
      operatorVisibleRationale,
      evaluatedAtIso: params.context.evaluatedAtIso,
    },
    evaluatedAtIso: params.context.evaluatedAtIso,
  };

  return deepFreeze(result);
}

function parseConsumption(value: unknown, index: number): AutonomyBudgetConsumptionV1 {
  const path = `usage[${index}]`;
  const record = readRecord(value, path, AutonomyBudgetPolicyParseError);
  const scope = readEnum(record, 'scope', SCOPES, AutonomyBudgetPolicyParseError);
  const metric = readEnum(record, 'metric', METRICS, AutonomyBudgetPolicyParseError);
  const used = readInteger(record, 'used', AutonomyBudgetPolicyParseError);
  const pending = readOptionalInteger(record, 'pending', AutonomyBudgetPolicyParseError);

  if (used < 0) {
    throw new AutonomyBudgetPolicyParseError(`${path}.used must be >= 0.`);
  }
  if (pending !== undefined && pending < 0) {
    throw new AutonomyBudgetPolicyParseError(`${path}.pending must be >= 0 when provided.`);
  }

  return {
    scope,
    metric,
    used,
    ...(pending !== undefined ? { pending } : {}),
  };
}

function readOptionalControlFlags(
  record: Record<string, unknown>,
): Omit<AutonomyBudgetEvaluationContextV1, 'workspaceId' | 'runId' | 'usage' | 'evaluatedAtIso'> {
  const workspaceFrozen = readBooleanWithDefault(record, 'workspaceFrozen');
  const runFrozen = readBooleanWithDefault(record, 'runFrozen');
  const workspaceKillSwitch = readBooleanWithDefault(record, 'workspaceKillSwitch');
  const runKillSwitch = readBooleanWithDefault(record, 'runKillSwitch');
  const runawayDetected = readBooleanWithDefault(record, 'runawayDetected');
  const runawayRationale = readOptionalString(
    record,
    'runawayRationale',
    AutonomyBudgetPolicyParseError,
  );

  return {
    ...(workspaceFrozen ? { workspaceFrozen } : {}),
    ...(runFrozen ? { runFrozen } : {}),
    ...(workspaceKillSwitch ? { workspaceKillSwitch } : {}),
    ...(runKillSwitch ? { runKillSwitch } : {}),
    ...(runawayDetected ? { runawayDetected } : {}),
    ...(runawayRationale ? { runawayRationale } : {}),
  };
}

function readBooleanWithDefault(record: Record<string, unknown>, key: string): boolean {
  if (record[key] === undefined) return false;
  return readBoolean(record, key, AutonomyBudgetPolicyParseError);
}

function buildControlStops(
  context: AutonomyBudgetEvaluationContextV1,
): readonly AutonomyBudgetTriggerV1[] {
  const stops: AutonomyBudgetTriggerV1[] = [];

  if (context.workspaceKillSwitch === true) {
    stops.push({
      kind: 'WorkspaceKillSwitch',
      scope: 'Workspace',
      hardStopMode: 'KillWorkspaceAutomation',
      operatorVisibleRationale:
        'Workspace kill-switch is active; autonomous work is blocked before execution.',
    });
  }

  if (context.runKillSwitch === true) {
    stops.push({
      kind: 'RunKillSwitch',
      scope: 'Run',
      hardStopMode: 'KillRun',
      operatorVisibleRationale:
        'Run kill-switch is active; this Run is blocked before the next autonomous action.',
    });
  }

  if (context.runawayDetected === true) {
    stops.push({
      kind: 'RunawayHardStop',
      scope: 'Run',
      hardStopMode: 'KillRun',
      operatorVisibleRationale:
        context.runawayRationale ??
        'Runaway behaviour was detected; this Run is blocked for operator review.',
    });
  }

  if (context.workspaceFrozen === true) {
    stops.push({
      kind: 'WorkspaceFrozen',
      scope: 'Workspace',
      hardStopMode: 'FreezeWorkspace',
      operatorVisibleRationale:
        'Workspace autonomy is frozen; autonomous work must wait for operator intervention.',
    });
  }

  if (context.runFrozen === true) {
    stops.push({
      kind: 'RunFrozen',
      scope: 'Run',
      hardStopMode: 'FreezeRun',
      operatorVisibleRationale:
        'Run autonomy is frozen; this Run must wait for operator intervention.',
    });
  }

  return stops;
}

function buildBudgetTriggers(
  policies: readonly AutonomyBudgetPolicySourceV1[],
  context: AutonomyBudgetEvaluationContextV1,
): readonly AutonomyBudgetTriggerV1[] {
  const triggers: AutonomyBudgetTriggerV1[] = [];
  for (const policy of policies) {
    for (const budget of policy.autonomyBudgets ?? []) {
      const usage = findUsage(context.usage, budget.scope, budget.metric);
      const used = usage?.used ?? 0;
      const pending = usage?.pending ?? 0;
      const evaluatedUsage = used + pending;
      if (evaluatedUsage >= budget.hardStopAt) {
        triggers.push(buildBudgetTrigger('BudgetHardStop', policy.policyId, budget, used, pending));
      } else if (evaluatedUsage >= budget.warningAt) {
        triggers.push(buildBudgetTrigger('BudgetWarning', policy.policyId, budget, used, pending));
      }
    }
  }
  return triggers;
}

function findUsage(
  usage: readonly AutonomyBudgetConsumptionV1[],
  scope: AutonomyBudgetScopeV1,
  metric: AutonomyBudgetMetricV1,
): AutonomyBudgetConsumptionV1 | undefined {
  return usage.find((item) => item.scope === scope && item.metric === metric);
}

function buildBudgetTrigger(
  kind: 'BudgetWarning' | 'BudgetHardStop',
  policyId: PolicyIdType,
  budget: AutonomyBudgetV1,
  used: number,
  pending: number,
): AutonomyBudgetTriggerV1 {
  const evaluatedUsage = used + pending;
  const threshold = kind === 'BudgetHardStop' ? budget.hardStopAt : budget.warningAt;
  const action =
    kind === 'BudgetHardStop' ? `hard-stop mode ${budget.hardStopMode}` : 'warning threshold';

  return {
    kind,
    policyId,
    budgetId: budget.budgetId,
    scope: budget.scope,
    metric: budget.metric,
    used,
    pending,
    evaluatedUsage,
    threshold,
    hardStopMode: budget.hardStopMode,
    operatorVisibleRationale:
      `${budget.scope} ${budget.metric} budget "${budget.budgetId}" reached ${evaluatedUsage} ` +
      `against ${action} ${threshold}. ${budget.rationale}`,
  };
}

function buildOperatorRationale(
  decision: AutonomyBudgetDecisionV1,
  hardStops: readonly AutonomyBudgetTriggerV1[],
  warnings: readonly AutonomyBudgetTriggerV1[],
): string {
  if (decision === 'HardStop') {
    return hardStops[0]?.operatorVisibleRationale ?? 'Autonomy hard stop triggered.';
  }
  if (decision === 'Warn') {
    return warnings[0]?.operatorVisibleRationale ?? 'Autonomy budget warning triggered.';
  }
  return 'Autonomy budgets allow this governed work to continue.';
}

function deriveStopClass(
  hardStops: readonly AutonomyBudgetTriggerV1[],
): AutonomyBudgetEvidenceV1['stopClass'] {
  if (hardStops.length === 0) return 'none';
  const first = hardStops[0];
  if (first?.kind === 'BudgetHardStop') return 'budget';
  if (first?.kind === 'RunawayHardStop') return 'runaway';
  return 'policy-control';
}

function compareTriggers(a: AutonomyBudgetTriggerV1, b: AutonomyBudgetTriggerV1): number {
  return (
    TRIGGER_ORDER[a.kind] - TRIGGER_ORDER[b.kind] ||
    SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope] ||
    metricRank(a.metric) - metricRank(b.metric) ||
    (a.policyId ?? '').localeCompare(b.policyId ?? '') ||
    (a.budgetId ?? '').localeCompare(b.budgetId ?? '')
  );
}

function metricRank(metric: AutonomyBudgetMetricV1 | undefined): number {
  return metric === undefined ? -1 : METRIC_ORDER[metric];
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj as object)) {
    const child = (obj as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return obj;
}
