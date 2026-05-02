import { WORKSPACE_USER_ROLES, type WorkspaceUserRole } from '../primitives/index.js';
import {
  readBoolean,
  readEnum,
  readInteger,
  readRecord,
  readString,
} from '../validation/parse-utils.js';
import type { DispositionAction } from './evidence-governance-v1.js';
import type { RetentionClass } from './retention-schedule-v1.js';

export const AGENT_OBSERVABILITY_TELEMETRY_KINDS = [
  'AgentTranscript',
  'ToolTrace',
  'Screenshot',
  'Timeline',
  'EvidenceArtifact',
] as const;

export type AgentObservabilityTelemetryKind = (typeof AGENT_OBSERVABILITY_TELEMETRY_KINDS)[number];

export const AGENT_OBSERVABILITY_ENVIRONMENTS = ['experiment', 'pilot', 'production'] as const;

export type AgentObservabilityEnvironment = (typeof AGENT_OBSERVABILITY_ENVIRONMENTS)[number];

export const AGENT_OBSERVABILITY_TRACE_DEPTHS = [
  'metadata',
  'standard',
  'deep',
  'forensic',
] as const;

export type AgentObservabilityTraceDepth = (typeof AGENT_OBSERVABILITY_TRACE_DEPTHS)[number];

export const AGENT_OBSERVABILITY_PAYLOAD_TREATMENTS = [
  'NoPayload',
  'RedactedPayload',
  'RestrictedPayload',
  'EvidencePayload',
] as const;

export type AgentObservabilityPayloadTreatment =
  (typeof AGENT_OBSERVABILITY_PAYLOAD_TREATMENTS)[number];

export const AGENT_OBSERVABILITY_OPERATOR_VISIBILITIES = [
  'MetadataOnly',
  'Redacted',
  'Full',
] as const;

export type AgentObservabilityOperatorVisibility =
  (typeof AGENT_OBSERVABILITY_OPERATOR_VISIBILITIES)[number];

export const AGENT_OBSERVABILITY_PRIVACY_BOUNDARIES = [
  'OpaqueIdsOnly',
  'RedactedContent',
  'RestrictedContent',
] as const;

export type AgentObservabilityPrivacyBoundary =
  (typeof AGENT_OBSERVABILITY_PRIVACY_BOUNDARIES)[number];

export type AgentObservabilityLifecycleRuleV1 = Readonly<{
  telemetryKind: AgentObservabilityTelemetryKind;
  retentionClass: RetentionClass;
  retentionDays: number;
  disposition: DispositionAction;
  payloadTreatment: AgentObservabilityPayloadTreatment;
  operatorVisibility: AgentObservabilityOperatorVisibility;
  allowedRoles: readonly WorkspaceUserRole[];
  legalHoldEligible: boolean;
  maxTraceDepth: AgentObservabilityTraceDepth;
  privacyBoundary: AgentObservabilityPrivacyBoundary;
}>;

export type AgentObservabilityLifecyclePolicyV1 = Readonly<{
  schemaVersion: 1;
  policyId: string;
  defaultEnvironment: AgentObservabilityEnvironment;
  environmentTraceDepthCaps: Readonly<
    Record<AgentObservabilityEnvironment, AgentObservabilityTraceDepth>
  >;
  rules: readonly AgentObservabilityLifecycleRuleV1[];
}>;

export type AgentObservabilityTraceDepthDecision = Readonly<{
  telemetryKind: AgentObservabilityTelemetryKind;
  environment: AgentObservabilityEnvironment;
  requestedDepth: AgentObservabilityTraceDepth;
  effectiveDepth: AgentObservabilityTraceDepth;
  environmentCap: AgentObservabilityTraceDepth;
  ruleCap: AgentObservabilityTraceDepth;
}>;

export type AgentObservabilityVisibilityDecision = Readonly<{
  allowed: boolean;
  reason: 'Allowed' | 'TenantMismatch' | 'WorkspaceMismatch' | 'RoleDenied';
  payloadVisible: boolean;
  operatorVisibility?: AgentObservabilityOperatorVisibility;
}>;

export class AgentObservabilityLifecyclePolicyParseError extends Error {
  public override readonly name = 'AgentObservabilityLifecyclePolicyParseError';

  public constructor(message: string) {
    super(message);
  }
}

const RETENTION_CLASSES = ['Operational', 'Compliance', 'Forensic'] as const;
const DISPOSITION_ACTIONS = ['Destroy', 'DeIdentify', 'Quarantine'] as const;
const TRACE_DEPTH_RANK: Record<AgentObservabilityTraceDepth, number> = {
  metadata: 0,
  standard: 1,
  deep: 2,
  forensic: 3,
};

export const DEFAULT_AGENT_OBSERVABILITY_LIFECYCLE_POLICY_V1: AgentObservabilityLifecyclePolicyV1 =
  {
    schemaVersion: 1,
    policyId: 'agent-observability-lifecycle-default-v1',
    defaultEnvironment: 'production',
    environmentTraceDepthCaps: {
      experiment: 'deep',
      pilot: 'standard',
      production: 'metadata',
    },
    rules: [
      {
        telemetryKind: 'AgentTranscript',
        retentionClass: 'Operational',
        retentionDays: 14,
        disposition: 'DeIdentify',
        payloadTreatment: 'RedactedPayload',
        operatorVisibility: 'Redacted',
        allowedRoles: ['admin', 'operator', 'auditor'],
        legalHoldEligible: true,
        maxTraceDepth: 'deep',
        privacyBoundary: 'RedactedContent',
      },
      {
        telemetryKind: 'ToolTrace',
        retentionClass: 'Operational',
        retentionDays: 30,
        disposition: 'DeIdentify',
        payloadTreatment: 'RedactedPayload',
        operatorVisibility: 'Redacted',
        allowedRoles: ['admin', 'operator', 'auditor'],
        legalHoldEligible: true,
        maxTraceDepth: 'deep',
        privacyBoundary: 'RedactedContent',
      },
      {
        telemetryKind: 'Screenshot',
        retentionClass: 'Operational',
        retentionDays: 7,
        disposition: 'DeIdentify',
        payloadTreatment: 'RestrictedPayload',
        operatorVisibility: 'Redacted',
        allowedRoles: ['admin', 'operator', 'auditor'],
        legalHoldEligible: true,
        maxTraceDepth: 'standard',
        privacyBoundary: 'RestrictedContent',
      },
      {
        telemetryKind: 'Timeline',
        retentionClass: 'Operational',
        retentionDays: 90,
        disposition: 'Destroy',
        payloadTreatment: 'NoPayload',
        operatorVisibility: 'MetadataOnly',
        allowedRoles: ['admin', 'operator', 'approver', 'auditor'],
        legalHoldEligible: true,
        maxTraceDepth: 'standard',
        privacyBoundary: 'OpaqueIdsOnly',
      },
      {
        telemetryKind: 'EvidenceArtifact',
        retentionClass: 'Compliance',
        retentionDays: 365,
        disposition: 'Quarantine',
        payloadTreatment: 'EvidencePayload',
        operatorVisibility: 'MetadataOnly',
        allowedRoles: ['admin', 'auditor'],
        legalHoldEligible: true,
        maxTraceDepth: 'forensic',
        privacyBoundary: 'RestrictedContent',
      },
    ],
  };

export function parseAgentObservabilityLifecyclePolicyV1(
  value: unknown,
): AgentObservabilityLifecyclePolicyV1 {
  const record = readRecord(
    value,
    'AgentObservabilityLifecyclePolicyV1',
    AgentObservabilityLifecyclePolicyParseError,
  );

  const schemaVersion = readInteger(
    record,
    'schemaVersion',
    AgentObservabilityLifecyclePolicyParseError,
  );
  if (schemaVersion !== 1) {
    throw new AgentObservabilityLifecyclePolicyParseError(
      `schemaVersion must be 1, got: ${schemaVersion}.`,
    );
  }

  const policy: AgentObservabilityLifecyclePolicyV1 = {
    schemaVersion: 1,
    policyId: readString(record, 'policyId', AgentObservabilityLifecyclePolicyParseError),
    defaultEnvironment: readEnum(
      record,
      'defaultEnvironment',
      AGENT_OBSERVABILITY_ENVIRONMENTS,
      AgentObservabilityLifecyclePolicyParseError,
    ),
    environmentTraceDepthCaps: parseEnvironmentTraceDepthCaps(record['environmentTraceDepthCaps']),
    rules: parseRules(record['rules']),
  };

  assertPolicyInvariants(policy);
  return policy;
}

export function getAgentObservabilityLifecycleRule(
  policy: AgentObservabilityLifecyclePolicyV1,
  telemetryKind: AgentObservabilityTelemetryKind,
): AgentObservabilityLifecycleRuleV1 {
  const rule = policy.rules.find((candidate) => candidate.telemetryKind === telemetryKind);
  if (!rule) {
    throw new AgentObservabilityLifecyclePolicyParseError(
      `Missing lifecycle rule for telemetryKind: ${telemetryKind}.`,
    );
  }
  return rule;
}

export function resolveAgentObservabilityTraceDepth(input: {
  policy: AgentObservabilityLifecyclePolicyV1;
  telemetryKind: AgentObservabilityTelemetryKind;
  environment: AgentObservabilityEnvironment;
  requestedDepth: AgentObservabilityTraceDepth;
}): AgentObservabilityTraceDepthDecision {
  const rule = getAgentObservabilityLifecycleRule(input.policy, input.telemetryKind);
  const environmentCap = input.policy.environmentTraceDepthCaps[input.environment];
  const effectiveDepth = minimumTraceDepth(
    input.requestedDepth,
    environmentCap,
    rule.maxTraceDepth,
  );

  return {
    telemetryKind: input.telemetryKind,
    environment: input.environment,
    requestedDepth: input.requestedDepth,
    effectiveDepth,
    environmentCap,
    ruleCap: rule.maxTraceDepth,
  };
}

export function evaluateAgentObservabilityVisibility(input: {
  policy: AgentObservabilityLifecyclePolicyV1;
  telemetryKind: AgentObservabilityTelemetryKind;
  actorTenantId: string;
  recordTenantId: string;
  actorWorkspaceId: string;
  recordWorkspaceId: string;
  actorRoles: readonly WorkspaceUserRole[];
  requestPayload?: boolean;
}): AgentObservabilityVisibilityDecision {
  if (input.actorTenantId !== input.recordTenantId) {
    return { allowed: false, reason: 'TenantMismatch', payloadVisible: false };
  }
  if (input.actorWorkspaceId !== input.recordWorkspaceId) {
    return { allowed: false, reason: 'WorkspaceMismatch', payloadVisible: false };
  }

  const rule = getAgentObservabilityLifecycleRule(input.policy, input.telemetryKind);
  const roleAllowed = input.actorRoles.some((role) => rule.allowedRoles.includes(role));
  if (!roleAllowed) {
    return { allowed: false, reason: 'RoleDenied', payloadVisible: false };
  }

  return {
    allowed: true,
    reason: 'Allowed',
    payloadVisible: Boolean(input.requestPayload) && rule.operatorVisibility !== 'MetadataOnly',
    operatorVisibility: rule.operatorVisibility,
  };
}

export function isAgentObservabilityDispositionBlocked(input: {
  rule: AgentObservabilityLifecycleRuleV1;
  legalHoldActive: boolean;
  retentionExpired: boolean;
}): boolean {
  if (input.legalHoldActive && input.rule.legalHoldEligible) return true;
  return !input.retentionExpired;
}

function parseEnvironmentTraceDepthCaps(
  value: unknown,
): AgentObservabilityLifecyclePolicyV1['environmentTraceDepthCaps'] {
  const record = readRecord(
    value,
    'environmentTraceDepthCaps',
    AgentObservabilityLifecyclePolicyParseError,
  );

  return {
    experiment: readEnum(
      record,
      'experiment',
      AGENT_OBSERVABILITY_TRACE_DEPTHS,
      AgentObservabilityLifecyclePolicyParseError,
    ),
    pilot: readEnum(
      record,
      'pilot',
      AGENT_OBSERVABILITY_TRACE_DEPTHS,
      AgentObservabilityLifecyclePolicyParseError,
    ),
    production: readEnum(
      record,
      'production',
      AGENT_OBSERVABILITY_TRACE_DEPTHS,
      AgentObservabilityLifecyclePolicyParseError,
    ),
  };
}

function parseRules(value: unknown): readonly AgentObservabilityLifecycleRuleV1[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AgentObservabilityLifecyclePolicyParseError('rules must be a non-empty array.');
  }

  return value.map((entry, index) => parseRule(entry, `rules[${index}]`));
}

function parseRule(value: unknown, path: string): AgentObservabilityLifecycleRuleV1 {
  const record = readRecord(value, path, AgentObservabilityLifecyclePolicyParseError);
  const retentionDays = readInteger(
    record,
    'retentionDays',
    AgentObservabilityLifecyclePolicyParseError,
  );
  if (retentionDays < 1) {
    throw new AgentObservabilityLifecyclePolicyParseError(`${path}.retentionDays must be >= 1.`);
  }

  return {
    telemetryKind: readEnum(
      record,
      'telemetryKind',
      AGENT_OBSERVABILITY_TELEMETRY_KINDS,
      AgentObservabilityLifecyclePolicyParseError,
    ),
    retentionClass: readEnum(
      record,
      'retentionClass',
      RETENTION_CLASSES,
      AgentObservabilityLifecyclePolicyParseError,
    ),
    retentionDays,
    disposition: readEnum(
      record,
      'disposition',
      DISPOSITION_ACTIONS,
      AgentObservabilityLifecyclePolicyParseError,
    ),
    payloadTreatment: readEnum(
      record,
      'payloadTreatment',
      AGENT_OBSERVABILITY_PAYLOAD_TREATMENTS,
      AgentObservabilityLifecyclePolicyParseError,
    ),
    operatorVisibility: readEnum(
      record,
      'operatorVisibility',
      AGENT_OBSERVABILITY_OPERATOR_VISIBILITIES,
      AgentObservabilityLifecyclePolicyParseError,
    ),
    allowedRoles: parseWorkspaceRoles(record['allowedRoles'], `${path}.allowedRoles`),
    legalHoldEligible: readBoolean(
      record,
      'legalHoldEligible',
      AgentObservabilityLifecyclePolicyParseError,
    ),
    maxTraceDepth: readEnum(
      record,
      'maxTraceDepth',
      AGENT_OBSERVABILITY_TRACE_DEPTHS,
      AgentObservabilityLifecyclePolicyParseError,
    ),
    privacyBoundary: readEnum(
      record,
      'privacyBoundary',
      AGENT_OBSERVABILITY_PRIVACY_BOUNDARIES,
      AgentObservabilityLifecyclePolicyParseError,
    ),
  };
}

function parseWorkspaceRoles(value: unknown, label: string): readonly WorkspaceUserRole[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AgentObservabilityLifecyclePolicyParseError(`${label} must be a non-empty array.`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'string' || !WORKSPACE_USER_ROLES.includes(entry as WorkspaceUserRole)) {
      throw new AgentObservabilityLifecyclePolicyParseError(
        `${label}[${index}] must be one of: ${WORKSPACE_USER_ROLES.join(', ')}.`,
      );
    }
    return entry as WorkspaceUserRole;
  });
}

function assertPolicyInvariants(policy: AgentObservabilityLifecyclePolicyV1): void {
  assertAllTelemetryKindsCovered(policy.rules);

  if (isTraceDepthAbove(policy.environmentTraceDepthCaps.production, 'standard')) {
    throw new AgentObservabilityLifecyclePolicyParseError(
      'production trace-depth cap must not exceed standard.',
    );
  }

  for (const rule of policy.rules) {
    if (
      (rule.telemetryKind === 'AgentTranscript' || rule.telemetryKind === 'Screenshot') &&
      rule.operatorVisibility === 'Full'
    ) {
      throw new AgentObservabilityLifecyclePolicyParseError(
        `${rule.telemetryKind} cannot use Full operator visibility; use redacted or metadata-only views.`,
      );
    }

    if (rule.operatorVisibility === 'Full' && rule.privacyBoundary !== 'RestrictedContent') {
      throw new AgentObservabilityLifecyclePolicyParseError(
        'Full operator visibility requires RestrictedContent privacy boundary.',
      );
    }

    if (rule.telemetryKind === 'EvidenceArtifact') {
      if (rule.retentionClass === 'Operational') {
        throw new AgentObservabilityLifecyclePolicyParseError(
          'EvidenceArtifact lifecycle rule must use Compliance or Forensic retention.',
        );
      }
      if (!rule.legalHoldEligible) {
        throw new AgentObservabilityLifecyclePolicyParseError(
          'EvidenceArtifact lifecycle rule must be legal-hold eligible.',
        );
      }
    }
  }
}

function assertAllTelemetryKindsCovered(rules: readonly AgentObservabilityLifecycleRuleV1[]): void {
  const seen = new Set<AgentObservabilityTelemetryKind>();
  for (const rule of rules) {
    if (seen.has(rule.telemetryKind)) {
      throw new AgentObservabilityLifecyclePolicyParseError(
        `Duplicate lifecycle rule for telemetryKind: ${rule.telemetryKind}.`,
      );
    }
    seen.add(rule.telemetryKind);
  }

  for (const telemetryKind of AGENT_OBSERVABILITY_TELEMETRY_KINDS) {
    if (!seen.has(telemetryKind)) {
      throw new AgentObservabilityLifecyclePolicyParseError(
        `Missing lifecycle rule for telemetryKind: ${telemetryKind}.`,
      );
    }
  }
}

function minimumTraceDepth(
  ...depths: readonly AgentObservabilityTraceDepth[]
): AgentObservabilityTraceDepth {
  return depths.reduce((lowest, current) =>
    TRACE_DEPTH_RANK[current] < TRACE_DEPTH_RANK[lowest] ? current : lowest,
  );
}

function isTraceDepthAbove(
  actual: AgentObservabilityTraceDepth,
  ceiling: AgentObservabilityTraceDepth,
): boolean {
  return TRACE_DEPTH_RANK[actual] > TRACE_DEPTH_RANK[ceiling];
}
