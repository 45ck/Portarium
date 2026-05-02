import {
  ActionId,
  ApprovalId,
  PolicyChangeId,
  RunId,
  TenantId,
  UserId,
  WorkspaceId,
  WorkforceQueueId,
  isWorkspaceUserRole,
  type ActionId as ActionIdType,
  type ApprovalId as ApprovalIdType,
  type ExecutionTier,
  type PolicyChangeId as PolicyChangeIdType,
  type RunId as RunIdType,
  type TenantId as TenantIdType,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
  type WorkspaceUserRole,
  type WorkforceQueueId as WorkforceQueueIdType,
} from '../primitives/index.js';
import {
  assertNotBefore,
  readBoolean,
  readEnum,
  readInteger,
  readIsoString,
  readNonNegativeInteger,
  readOptionalBoolean,
  readOptionalIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export const AUTONOMY_SCOPE_PRECEDENCE_V1 = [
  'PlatformBaseline',
  'Tenant',
  'Workspace',
  'RoleOrQueue',
  'RunCharter',
  'Action',
] as const;

export type AutonomyScopeKindV1 = (typeof AUTONOMY_SCOPE_PRECEDENCE_V1)[number];
export type AutonomyControlKindV1 = 'execution-tier' | 'budget-limit' | 'action-prohibition';
export type AutonomyLimitStrengthV1 = 'default' | 'hard-limit' | 'platform-invariant';
export type AutonomyResolutionModeV1 = 'policy-authoring' | 'simulation' | 'runtime' | 'audit';

export type AutonomyScopeV1 =
  | Readonly<{ scopeKind: 'PlatformBaseline' }>
  | Readonly<{ scopeKind: 'Tenant'; tenantId: TenantIdType }>
  | Readonly<{ scopeKind: 'Workspace'; workspaceId: WorkspaceIdType }>
  | Readonly<{
      scopeKind: 'RoleOrQueue';
      workspaceId: WorkspaceIdType;
      role?: WorkspaceUserRole;
      workforceQueueId?: WorkforceQueueIdType;
    }>
  | Readonly<{ scopeKind: 'RunCharter'; workspaceId: WorkspaceIdType; runId: RunIdType }>
  | Readonly<{
      scopeKind: 'Action';
      workspaceId: WorkspaceIdType;
      actionId?: ActionIdType;
      actionClass?: string;
    }>;

export type AutonomyRuleControlV1 =
  | Readonly<{ kind: 'execution-tier'; tier: ExecutionTier }>
  | Readonly<{ kind: 'budget-limit'; amountMinor: number; currency: string }>
  | Readonly<{ kind: 'action-prohibition'; prohibited: boolean }>;

export type AutonomyControlRuleV1 = Readonly<{
  schemaVersion: 1;
  ruleId: string;
  scope: AutonomyScopeV1;
  control: AutonomyRuleControlV1;
  limitStrength: AutonomyLimitStrengthV1;
  rationale: string;
  allowWeakeningWithApproval?: boolean;
}>;

export type AutonomyWeakeningOverrideSourceV1 = 'policy-change-approval' | 'incident-break-glass';

export type AutonomyWeakeningOverrideV1 = Readonly<{
  schemaVersion: 1;
  overrideId: string;
  source: AutonomyWeakeningOverrideSourceV1;
  targetRuleId: string;
  weakeningRuleId: string;
  approvedByUserId: UserIdType;
  approvedAtIso: string;
  rationale: string;
  approvalId?: ApprovalIdType;
  policyChangeId?: PolicyChangeIdType;
  expiresAtIso?: string;
  postIncidentReviewRequired?: boolean;
}>;

export type AutonomyEvaluationTargetV1 = Readonly<{
  tenantId: TenantIdType;
  workspaceId: WorkspaceIdType;
  roles?: readonly WorkspaceUserRole[];
  workforceQueueId?: WorkforceQueueIdType;
  runId?: RunIdType;
  actionId?: ActionIdType;
  actionClass?: string;
}>;

export type AutonomyRuleTraceOutcomeV1 =
  | 'selected'
  | 'tightened'
  | 'precedence-overrode-default'
  | 'blocked-weakening'
  | 'override-weakened'
  | 'non-overridable-invariant';

export type AutonomyRuleTraceV1 = Readonly<{
  controlKey: string;
  ruleId: string;
  scopeKind: AutonomyScopeKindV1;
  controlKind: AutonomyControlKindV1;
  outcome: AutonomyRuleTraceOutcomeV1;
  explanation: string;
}>;

export type AutonomyBlockedWeakeningV1 = Readonly<{
  controlKey: string;
  higherRuleId: string;
  weakeningRuleId: string;
  reason:
    | 'higher-hard-limit'
    | 'platform-invariant'
    | 'missing-approved-override'
    | 'expired-or-invalid-override';
  requiredAuthoritySources: readonly AutonomyWeakeningOverrideSourceV1[];
  explanation: string;
}>;

export type EffectiveAutonomyControlV1 = Readonly<{
  controlKey: string;
  ruleId: string;
  scopeKind: AutonomyScopeKindV1;
  control: AutonomyRuleControlV1;
  limitStrength: AutonomyLimitStrengthV1;
  overrideApplied?: AutonomyWeakeningOverrideV1;
}>;

export type EffectiveAutonomyDecisionV1 = 'Allow' | 'RequireApproval' | 'Deny';

export type EffectiveAutonomyControlsV1 = Readonly<{
  schemaVersion: 1;
  mode: AutonomyResolutionModeV1;
  target: AutonomyEvaluationTargetV1;
  evaluatedAtIso: string;
  decision: EffectiveAutonomyDecisionV1;
  effectiveExecutionTier?: ExecutionTier;
  budgetLimits: readonly Readonly<{ amountMinor: number; currency: string; ruleId: string }>[];
  prohibited: boolean;
  effectiveControls: readonly EffectiveAutonomyControlV1[];
  traces: readonly AutonomyRuleTraceV1[];
  blockedWeakeningAttempts: readonly AutonomyBlockedWeakeningV1[];
  summary: string;
}>;

export class DelegatedAutonomyHierarchyParseError extends Error {
  public override readonly name = 'DelegatedAutonomyHierarchyParseError';

  public constructor(message: string) {
    super(message);
  }
}

const EXECUTION_TIERS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;
const LIMIT_STRENGTHS = ['default', 'hard-limit', 'platform-invariant'] as const;
const CONTROL_KINDS = ['execution-tier', 'budget-limit', 'action-prohibition'] as const;
const SCOPE_KINDS = AUTONOMY_SCOPE_PRECEDENCE_V1;
const OVERRIDE_SOURCES = ['policy-change-approval', 'incident-break-glass'] as const;

const TIER_RANK: Readonly<Record<ExecutionTier, number>> = {
  Auto: 0,
  Assisted: 1,
  HumanApprove: 2,
  ManualOnly: 3,
};

const SCOPE_RANK: Readonly<Record<AutonomyScopeKindV1, number>> = {
  PlatformBaseline: 0,
  Tenant: 1,
  Workspace: 2,
  RoleOrQueue: 3,
  RunCharter: 4,
  Action: 5,
};

const LIMIT_STRENGTH_RANK: Readonly<Record<AutonomyLimitStrengthV1, number>> = {
  default: 0,
  'hard-limit': 1,
  'platform-invariant': 2,
};

export function resolveAutonomyControlsV1(params: {
  rules: readonly AutonomyControlRuleV1[];
  target: AutonomyEvaluationTargetV1;
  evaluatedAtIso: string;
  mode: AutonomyResolutionModeV1;
  overrides?: readonly AutonomyWeakeningOverrideV1[];
}): EffectiveAutonomyControlsV1 {
  const applicableRules = params.rules
    .filter((rule) => isAutonomyRuleApplicableV1(rule, params.target))
    .map((rule, index) => ({ rule, index }))
    .sort(
      (a, b) =>
        SCOPE_RANK[a.rule.scope.scopeKind] - SCOPE_RANK[b.rule.scope.scopeKind] ||
        a.index - b.index,
    );

  const groups = new Map<string, AutonomyControlRuleV1[]>();
  for (const { rule } of applicableRules) {
    const key = controlKey(rule.control);
    groups.set(key, [...(groups.get(key) ?? []), rule]);
  }

  const effectiveControls: EffectiveAutonomyControlV1[] = [];
  const traces: AutonomyRuleTraceV1[] = [];
  const blockedWeakeningAttempts: AutonomyBlockedWeakeningV1[] = [];

  for (const [key, rules] of groups) {
    const resolved = resolveControlGroup({
      controlKey: key,
      rules,
      evaluatedAtIso: params.evaluatedAtIso,
      overrides: params.overrides ?? [],
    });
    effectiveControls.push(resolved.effectiveControl);
    traces.push(...resolved.traces);
    blockedWeakeningAttempts.push(...resolved.blockedWeakeningAttempts);
  }

  const sortedControls = effectiveControls.sort((a, b) => a.controlKey.localeCompare(b.controlKey));
  const executionTier = sortedControls.find(
    (control): control is EffectiveAutonomyControlV1 & { control: { kind: 'execution-tier' } } =>
      control.control.kind === 'execution-tier',
  )?.control.tier;
  const prohibited = sortedControls.some(
    (control) => control.control.kind === 'action-prohibition' && control.control.prohibited,
  );
  const budgetLimits = sortedControls
    .filter(
      (control): control is EffectiveAutonomyControlV1 & { control: { kind: 'budget-limit' } } =>
        control.control.kind === 'budget-limit',
    )
    .map((control) => ({
      amountMinor: control.control.amountMinor,
      currency: control.control.currency,
      ruleId: control.ruleId,
    }));

  const decision = deriveDecision({ prohibited, executionTier });

  return {
    schemaVersion: 1,
    mode: params.mode,
    target: params.target,
    evaluatedAtIso: params.evaluatedAtIso,
    decision,
    ...(executionTier !== undefined ? { effectiveExecutionTier: executionTier } : {}),
    budgetLimits,
    prohibited,
    effectiveControls: sortedControls,
    traces,
    blockedWeakeningAttempts,
    summary: summarizeEffectiveControls({
      decision,
      executionTier,
      prohibited,
      budgetLimits,
      blockedWeakeningAttempts,
    }),
  };
}

export function isAutonomyRuleApplicableV1(
  rule: AutonomyControlRuleV1,
  target: AutonomyEvaluationTargetV1,
): boolean {
  switch (rule.scope.scopeKind) {
    case 'PlatformBaseline':
      return true;
    case 'Tenant':
      return rule.scope.tenantId === target.tenantId;
    case 'Workspace':
      return rule.scope.workspaceId === target.workspaceId;
    case 'RoleOrQueue':
      return (
        rule.scope.workspaceId === target.workspaceId &&
        (rule.scope.role === undefined || (target.roles ?? []).includes(rule.scope.role)) &&
        (rule.scope.workforceQueueId === undefined ||
          rule.scope.workforceQueueId === target.workforceQueueId)
      );
    case 'RunCharter':
      return rule.scope.workspaceId === target.workspaceId && rule.scope.runId === target.runId;
    case 'Action':
      return (
        rule.scope.workspaceId === target.workspaceId &&
        (rule.scope.actionId === undefined || rule.scope.actionId === target.actionId) &&
        (rule.scope.actionClass === undefined || rule.scope.actionClass === target.actionClass)
      );
  }
}

export function compareAutonomyControlStrictnessV1(
  current: AutonomyRuleControlV1,
  candidate: AutonomyRuleControlV1,
): 'stricter' | 'weaker' | 'same' {
  if (current.kind !== candidate.kind) {
    throw new DelegatedAutonomyHierarchyParseError('Cannot compare different control kinds.');
  }

  if (current.kind === 'execution-tier' && candidate.kind === 'execution-tier') {
    return compareRank(TIER_RANK[candidate.tier], TIER_RANK[current.tier]);
  }

  if (current.kind === 'budget-limit' && candidate.kind === 'budget-limit') {
    if (current.currency !== candidate.currency) {
      throw new DelegatedAutonomyHierarchyParseError(
        'Cannot compare budget limits with different currencies.',
      );
    }
    return compareRank(current.amountMinor, candidate.amountMinor);
  }

  if (current.kind === 'action-prohibition' && candidate.kind === 'action-prohibition') {
    const currentRank = current.prohibited ? 1 : 0;
    const candidateRank = candidate.prohibited ? 1 : 0;
    return compareRank(candidateRank, currentRank);
  }

  return 'same';
}

export function parseAutonomyControlRuleV1(value: unknown): AutonomyControlRuleV1 {
  const record = readRecord(value, 'AutonomyControlRule', DelegatedAutonomyHierarchyParseError);
  const schemaVersion = readInteger(record, 'schemaVersion', DelegatedAutonomyHierarchyParseError);
  if (schemaVersion !== 1) {
    throw new DelegatedAutonomyHierarchyParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const allowWeakeningWithApproval = readOptionalBoolean(
    record,
    'allowWeakeningWithApproval',
    DelegatedAutonomyHierarchyParseError,
  );
  const rule: AutonomyControlRuleV1 = {
    schemaVersion: 1,
    ruleId: readString(record, 'ruleId', DelegatedAutonomyHierarchyParseError),
    scope: parseAutonomyScopeV1(record['scope']),
    control: parseAutonomyRuleControlV1(record['control']),
    limitStrength: readEnum(
      record,
      'limitStrength',
      LIMIT_STRENGTHS,
      DelegatedAutonomyHierarchyParseError,
    ),
    rationale: readString(record, 'rationale', DelegatedAutonomyHierarchyParseError),
    ...(allowWeakeningWithApproval !== undefined ? { allowWeakeningWithApproval } : {}),
  };

  validateRuleStrength(rule);
  return rule;
}

export function parseAutonomyWeakeningOverrideV1(value: unknown): AutonomyWeakeningOverrideV1 {
  const record = readRecord(
    value,
    'AutonomyWeakeningOverride',
    DelegatedAutonomyHierarchyParseError,
  );
  const schemaVersion = readInteger(record, 'schemaVersion', DelegatedAutonomyHierarchyParseError);
  if (schemaVersion !== 1) {
    throw new DelegatedAutonomyHierarchyParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const approvedAtIso = readIsoString(
    record,
    'approvedAtIso',
    DelegatedAutonomyHierarchyParseError,
  );
  const expiresAtIso = readOptionalIsoString(
    record,
    'expiresAtIso',
    DelegatedAutonomyHierarchyParseError,
  );
  if (expiresAtIso !== undefined) {
    assertNotBefore(approvedAtIso, expiresAtIso, DelegatedAutonomyHierarchyParseError, {
      anchorLabel: 'approvedAtIso',
      laterLabel: 'expiresAtIso',
    });
  }

  const source = readEnum(record, 'source', OVERRIDE_SOURCES, DelegatedAutonomyHierarchyParseError);
  const postIncidentReviewRequired = readOptionalBoolean(
    record,
    'postIncidentReviewRequired',
    DelegatedAutonomyHierarchyParseError,
  );
  if (source === 'incident-break-glass') {
    if (expiresAtIso === undefined) {
      throw new DelegatedAutonomyHierarchyParseError(
        'incident-break-glass overrides must include expiresAtIso.',
      );
    }
    if (postIncidentReviewRequired !== true) {
      throw new DelegatedAutonomyHierarchyParseError(
        'incident-break-glass overrides must require post-incident review.',
      );
    }
  }

  const approvalId = readOptionalString(record, 'approvalId', DelegatedAutonomyHierarchyParseError);
  const policyChangeId = readOptionalString(
    record,
    'policyChangeId',
    DelegatedAutonomyHierarchyParseError,
  );
  if (
    source === 'policy-change-approval' &&
    approvalId === undefined &&
    policyChangeId === undefined
  ) {
    throw new DelegatedAutonomyHierarchyParseError(
      'policy-change-approval overrides must reference an approvalId or policyChangeId.',
    );
  }

  return {
    schemaVersion: 1,
    overrideId: readString(record, 'overrideId', DelegatedAutonomyHierarchyParseError),
    source,
    targetRuleId: readString(record, 'targetRuleId', DelegatedAutonomyHierarchyParseError),
    weakeningRuleId: readString(record, 'weakeningRuleId', DelegatedAutonomyHierarchyParseError),
    approvedByUserId: UserId(
      readString(record, 'approvedByUserId', DelegatedAutonomyHierarchyParseError),
    ),
    approvedAtIso,
    rationale: readString(record, 'rationale', DelegatedAutonomyHierarchyParseError),
    ...(approvalId !== undefined ? { approvalId: ApprovalId(approvalId) } : {}),
    ...(policyChangeId !== undefined ? { policyChangeId: PolicyChangeId(policyChangeId) } : {}),
    ...(expiresAtIso !== undefined ? { expiresAtIso } : {}),
    ...(postIncidentReviewRequired !== undefined ? { postIncidentReviewRequired } : {}),
  };
}

function resolveControlGroup(params: {
  controlKey: string;
  rules: readonly AutonomyControlRuleV1[];
  evaluatedAtIso: string;
  overrides: readonly AutonomyWeakeningOverrideV1[];
}): Readonly<{
  effectiveControl: EffectiveAutonomyControlV1;
  traces: readonly AutonomyRuleTraceV1[];
  blockedWeakeningAttempts: readonly AutonomyBlockedWeakeningV1[];
}> {
  let current = params.rules[0];
  if (current === undefined) {
    throw new DelegatedAutonomyHierarchyParseError('Cannot resolve an empty control group.');
  }
  let overrideApplied: AutonomyWeakeningOverrideV1 | undefined;
  const traces: AutonomyRuleTraceV1[] = [
    trace(
      params.controlKey,
      current,
      'selected',
      `Selected ${current.ruleId} as the first applicable rule.`,
    ),
  ];
  const blockedWeakeningAttempts: AutonomyBlockedWeakeningV1[] = [];

  for (const candidate of params.rules.slice(1)) {
    const comparison = compareAutonomyControlStrictnessV1(current.control, candidate.control);

    if (comparison === 'same') {
      if (
        LIMIT_STRENGTH_RANK[candidate.limitStrength] < LIMIT_STRENGTH_RANK[current.limitStrength]
      ) {
        traces.push(
          trace(
            params.controlKey,
            candidate,
            'blocked-weakening',
            `${candidate.ruleId} matched ${current.ruleId} but did not replace its stronger limit strength.`,
          ),
        );
        continue;
      }
      current = candidate;
      overrideApplied = undefined;
      traces.push(
        trace(
          params.controlKey,
          candidate,
          'precedence-overrode-default',
          `${candidate.ruleId} has the same strictness and wins by lower-scope precedence.`,
        ),
      );
      continue;
    }

    if (comparison === 'stricter') {
      current = candidate;
      overrideApplied = undefined;
      traces.push(
        trace(
          params.controlKey,
          candidate,
          'tightened',
          `${candidate.ruleId} tightened the effective control at ${candidate.scope.scopeKind}.`,
        ),
      );
      continue;
    }

    const override = findValidWeakeningOverride({
      current,
      candidate,
      evaluatedAtIso: params.evaluatedAtIso,
      overrides: params.overrides,
    });
    if (override !== undefined) {
      current = candidate;
      overrideApplied = override;
      traces.push(
        trace(
          params.controlKey,
          candidate,
          'override-weakened',
          `${candidate.ruleId} weakened ${override.targetRuleId} through ${override.source}.`,
        ),
      );
      continue;
    }

    const blocked = describeBlockedWeakening(
      params.controlKey,
      current,
      candidate,
      params.overrides,
    );
    blockedWeakeningAttempts.push(blocked);
    traces.push(
      trace(
        params.controlKey,
        candidate,
        blocked.reason === 'platform-invariant' ? 'non-overridable-invariant' : 'blocked-weakening',
        blocked.explanation,
      ),
    );
  }

  return {
    effectiveControl: {
      controlKey: params.controlKey,
      ruleId: current.ruleId,
      scopeKind: current.scope.scopeKind,
      control: current.control,
      limitStrength: current.limitStrength,
      ...(overrideApplied !== undefined ? { overrideApplied } : {}),
    },
    traces,
    blockedWeakeningAttempts,
  };
}

function findValidWeakeningOverride(params: {
  current: AutonomyControlRuleV1;
  candidate: AutonomyControlRuleV1;
  evaluatedAtIso: string;
  overrides: readonly AutonomyWeakeningOverrideV1[];
}): AutonomyWeakeningOverrideV1 | undefined {
  if (params.current.limitStrength === 'platform-invariant') return undefined;
  if (params.current.limitStrength !== 'hard-limit') return undefined;
  if (params.current.allowWeakeningWithApproval !== true) return undefined;

  return params.overrides.find(
    (override) =>
      override.targetRuleId === params.current.ruleId &&
      override.weakeningRuleId === params.candidate.ruleId &&
      isOverrideLive(override, params.evaluatedAtIso),
  );
}

function isOverrideLive(override: AutonomyWeakeningOverrideV1, evaluatedAtIso: string): boolean {
  if (Date.parse(override.approvedAtIso) > Date.parse(evaluatedAtIso)) return false;
  if (
    override.expiresAtIso !== undefined &&
    Date.parse(override.expiresAtIso) <= Date.parse(evaluatedAtIso)
  ) {
    return false;
  }
  if (override.source === 'incident-break-glass') {
    return override.postIncidentReviewRequired === true && override.expiresAtIso !== undefined;
  }
  return override.approvalId !== undefined || override.policyChangeId !== undefined;
}

function describeBlockedWeakening(
  controlKey: string,
  current: AutonomyControlRuleV1,
  candidate: AutonomyControlRuleV1,
  overrides: readonly AutonomyWeakeningOverrideV1[],
): AutonomyBlockedWeakeningV1 {
  const matchingOverride = overrides.find(
    (override) =>
      override.targetRuleId === current.ruleId && override.weakeningRuleId === candidate.ruleId,
  );
  if (current.limitStrength === 'platform-invariant') {
    return {
      controlKey,
      higherRuleId: current.ruleId,
      weakeningRuleId: candidate.ruleId,
      reason: 'platform-invariant',
      requiredAuthoritySources: [],
      explanation: `${candidate.ruleId} cannot weaken non-overridable platform invariant ${current.ruleId}.`,
    };
  }
  if (current.limitStrength === 'hard-limit' && current.allowWeakeningWithApproval !== true) {
    return {
      controlKey,
      higherRuleId: current.ruleId,
      weakeningRuleId: candidate.ruleId,
      reason: 'higher-hard-limit',
      requiredAuthoritySources: [],
      explanation: `${candidate.ruleId} cannot weaken hard limit ${current.ruleId}; this limit does not allow weakening.`,
    };
  }
  if (matchingOverride !== undefined) {
    return {
      controlKey,
      higherRuleId: current.ruleId,
      weakeningRuleId: candidate.ruleId,
      reason: 'expired-or-invalid-override',
      requiredAuthoritySources: ['policy-change-approval', 'incident-break-glass'],
      explanation: `${candidate.ruleId} tried to weaken ${current.ruleId}, but the supplied override is expired or invalid.`,
    };
  }
  return {
    controlKey,
    higherRuleId: current.ruleId,
    weakeningRuleId: candidate.ruleId,
    reason: 'missing-approved-override',
    requiredAuthoritySources: ['policy-change-approval', 'incident-break-glass'],
    explanation: `${candidate.ruleId} tried to weaken hard limit ${current.ruleId} without an approved override.`,
  };
}

function parseAutonomyScopeV1(value: unknown): AutonomyScopeV1 {
  const record = readRecord(value, 'scope', DelegatedAutonomyHierarchyParseError);
  const scopeKind = readEnum(
    record,
    'scopeKind',
    SCOPE_KINDS,
    DelegatedAutonomyHierarchyParseError,
  );
  if (scopeKind === 'PlatformBaseline') return { scopeKind };
  if (scopeKind === 'Tenant') {
    return {
      scopeKind,
      tenantId: TenantId(readString(record, 'tenantId', DelegatedAutonomyHierarchyParseError)),
    };
  }
  if (scopeKind === 'Workspace') {
    return {
      scopeKind,
      workspaceId: WorkspaceId(
        readString(record, 'workspaceId', DelegatedAutonomyHierarchyParseError),
      ),
    };
  }
  if (scopeKind === 'RoleOrQueue') {
    const roleRaw = readOptionalString(record, 'role', DelegatedAutonomyHierarchyParseError);
    if (roleRaw !== undefined && !isWorkspaceUserRole(roleRaw)) {
      throw new DelegatedAutonomyHierarchyParseError('role must be a WorkspaceUserRole.');
    }
    const queueRaw = readOptionalString(
      record,
      'workforceQueueId',
      DelegatedAutonomyHierarchyParseError,
    );
    if (roleRaw === undefined && queueRaw === undefined) {
      throw new DelegatedAutonomyHierarchyParseError(
        'RoleOrQueue scope must include role or workforceQueueId.',
      );
    }
    return {
      scopeKind,
      workspaceId: WorkspaceId(
        readString(record, 'workspaceId', DelegatedAutonomyHierarchyParseError),
      ),
      ...(roleRaw !== undefined ? { role: roleRaw } : {}),
      ...(queueRaw !== undefined ? { workforceQueueId: WorkforceQueueId(queueRaw) } : {}),
    };
  }
  if (scopeKind === 'RunCharter') {
    return {
      scopeKind,
      workspaceId: WorkspaceId(
        readString(record, 'workspaceId', DelegatedAutonomyHierarchyParseError),
      ),
      runId: RunId(readString(record, 'runId', DelegatedAutonomyHierarchyParseError)),
    };
  }

  const actionIdRaw = readOptionalString(record, 'actionId', DelegatedAutonomyHierarchyParseError);
  const actionClass = readOptionalString(
    record,
    'actionClass',
    DelegatedAutonomyHierarchyParseError,
  );
  if (actionIdRaw === undefined && actionClass === undefined) {
    throw new DelegatedAutonomyHierarchyParseError(
      'Action scope must include actionId or actionClass.',
    );
  }
  return {
    scopeKind,
    workspaceId: WorkspaceId(
      readString(record, 'workspaceId', DelegatedAutonomyHierarchyParseError),
    ),
    ...(actionIdRaw !== undefined ? { actionId: ActionId(actionIdRaw) } : {}),
    ...(actionClass !== undefined ? { actionClass } : {}),
  };
}

function parseAutonomyRuleControlV1(value: unknown): AutonomyRuleControlV1 {
  const record = readRecord(value, 'control', DelegatedAutonomyHierarchyParseError);
  const kind = readEnum(record, 'kind', CONTROL_KINDS, DelegatedAutonomyHierarchyParseError);
  if (kind === 'execution-tier') {
    return {
      kind,
      tier: readEnum(record, 'tier', EXECUTION_TIERS, DelegatedAutonomyHierarchyParseError),
    };
  }
  if (kind === 'budget-limit') {
    return {
      kind,
      amountMinor: readNonNegativeInteger(
        record,
        'amountMinor',
        DelegatedAutonomyHierarchyParseError,
      ),
      currency: readString(record, 'currency', DelegatedAutonomyHierarchyParseError),
    };
  }
  const prohibited = readBoolean(record, 'prohibited', DelegatedAutonomyHierarchyParseError);
  return { kind, prohibited };
}

function validateRuleStrength(rule: AutonomyControlRuleV1): void {
  if (rule.limitStrength === 'platform-invariant' && rule.scope.scopeKind !== 'PlatformBaseline') {
    throw new DelegatedAutonomyHierarchyParseError(
      'platform-invariant rules must be scoped to PlatformBaseline.',
    );
  }
  if (rule.limitStrength === 'platform-invariant' && rule.allowWeakeningWithApproval === true) {
    throw new DelegatedAutonomyHierarchyParseError(
      'platform-invariant rules cannot allow weakening.',
    );
  }
}

function controlKey(control: AutonomyRuleControlV1): string {
  if (control.kind === 'budget-limit') return `${control.kind}:${control.currency}`;
  return control.kind;
}

function compareRank(candidateRank: number, currentRank: number): 'stricter' | 'weaker' | 'same' {
  if (candidateRank > currentRank) return 'stricter';
  if (candidateRank < currentRank) return 'weaker';
  return 'same';
}

function deriveDecision(params: {
  prohibited: boolean;
  executionTier: ExecutionTier | undefined;
}): EffectiveAutonomyDecisionV1 {
  if (params.prohibited) return 'Deny';
  if (params.executionTier === 'ManualOnly') return 'Deny';
  if (params.executionTier === 'HumanApprove') return 'RequireApproval';
  return 'Allow';
}

function trace(
  controlKey: string,
  rule: AutonomyControlRuleV1,
  outcome: AutonomyRuleTraceOutcomeV1,
  explanation: string,
): AutonomyRuleTraceV1 {
  return {
    controlKey,
    ruleId: rule.ruleId,
    scopeKind: rule.scope.scopeKind,
    controlKind: rule.control.kind,
    outcome,
    explanation,
  };
}

function summarizeEffectiveControls(input: {
  decision: EffectiveAutonomyDecisionV1;
  executionTier: ExecutionTier | undefined;
  prohibited: boolean;
  budgetLimits: readonly Readonly<{ amountMinor: number; currency: string; ruleId: string }>[];
  blockedWeakeningAttempts: readonly AutonomyBlockedWeakeningV1[];
}): string {
  const parts = [`Decision ${input.decision}`];
  if (input.executionTier !== undefined) parts.push(`effective tier ${input.executionTier}`);
  if (input.prohibited) parts.push('an action prohibition applies');
  if (input.budgetLimits.length > 0) {
    parts.push(
      `budget ${input.budgetLimits
        .map((limit) => `${limit.amountMinor} ${limit.currency} by ${limit.ruleId}`)
        .join(', ')}`,
    );
  }
  if (input.blockedWeakeningAttempts.length > 0) {
    parts.push(`${input.blockedWeakeningAttempts.length} weakening attempt blocked`);
  }
  return `${parts.join('; ')}.`;
}
