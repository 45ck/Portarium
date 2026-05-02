import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AGENT_OBSERVABILITY_LIFECYCLE_POLICY_V1,
  AgentObservabilityLifecyclePolicyParseError,
  evaluateAgentObservabilityVisibility,
  getAgentObservabilityLifecycleRule,
  isAgentObservabilityDispositionBlocked,
  parseAgentObservabilityLifecyclePolicyV1,
  resolveAgentObservabilityTraceDepth,
  type AgentObservabilityLifecyclePolicyV1,
} from './agent-observability-lifecycle-policy-v1.js';

function validPolicy(
  overrides: Partial<AgentObservabilityLifecyclePolicyV1> = {},
): AgentObservabilityLifecyclePolicyV1 {
  return {
    ...DEFAULT_AGENT_OBSERVABILITY_LIFECYCLE_POLICY_V1,
    ...overrides,
  };
}

describe('Agent observability lifecycle policy v1 contract', () => {
  it('parses the default lifecycle policy and covers every operator telemetry surface', () => {
    const policy = parseAgentObservabilityLifecyclePolicyV1(
      DEFAULT_AGENT_OBSERVABILITY_LIFECYCLE_POLICY_V1,
    );

    expect(policy.rules.map((rule) => rule.telemetryKind)).toEqual([
      'AgentTranscript',
      'ToolTrace',
      'Screenshot',
      'Timeline',
      'EvidenceArtifact',
    ]);
    expect(getAgentObservabilityLifecycleRule(policy, 'EvidenceArtifact')).toMatchObject({
      retentionClass: 'Compliance',
      disposition: 'Quarantine',
      legalHoldEligible: true,
    });
  });

  it('maps experimental deep tracing to production-safe trace depth caps', () => {
    const policy = parseAgentObservabilityLifecyclePolicyV1(
      DEFAULT_AGENT_OBSERVABILITY_LIFECYCLE_POLICY_V1,
    );

    expect(
      resolveAgentObservabilityTraceDepth({
        policy,
        telemetryKind: 'ToolTrace',
        environment: 'experiment',
        requestedDepth: 'deep',
      }).effectiveDepth,
    ).toBe('deep');

    expect(
      resolveAgentObservabilityTraceDepth({
        policy,
        telemetryKind: 'ToolTrace',
        environment: 'production',
        requestedDepth: 'deep',
      }).effectiveDepth,
    ).toBe('metadata');
  });

  it('applies stricter per-surface caps for screenshots even outside production', () => {
    const policy = parseAgentObservabilityLifecyclePolicyV1(
      DEFAULT_AGENT_OBSERVABILITY_LIFECYCLE_POLICY_V1,
    );

    const decision = resolveAgentObservabilityTraceDepth({
      policy,
      telemetryKind: 'Screenshot',
      environment: 'experiment',
      requestedDepth: 'deep',
    });

    expect(decision.effectiveDepth).toBe('standard');
    expect(decision.ruleCap).toBe('standard');
  });

  it('enforces tenant, Workspace, and role visibility boundaries', () => {
    const policy = parseAgentObservabilityLifecyclePolicyV1(
      DEFAULT_AGENT_OBSERVABILITY_LIFECYCLE_POLICY_V1,
    );

    expect(
      evaluateAgentObservabilityVisibility({
        policy,
        telemetryKind: 'ToolTrace',
        actorTenantId: 'tenant-1',
        recordTenantId: 'tenant-2',
        actorWorkspaceId: 'ws-1',
        recordWorkspaceId: 'ws-1',
        actorRoles: ['operator'],
        requestPayload: true,
      }),
    ).toMatchObject({ allowed: false, reason: 'TenantMismatch', payloadVisible: false });

    expect(
      evaluateAgentObservabilityVisibility({
        policy,
        telemetryKind: 'ToolTrace',
        actorTenantId: 'tenant-1',
        recordTenantId: 'tenant-1',
        actorWorkspaceId: 'ws-1',
        recordWorkspaceId: 'ws-2',
        actorRoles: ['operator'],
        requestPayload: true,
      }),
    ).toMatchObject({ allowed: false, reason: 'WorkspaceMismatch', payloadVisible: false });

    expect(
      evaluateAgentObservabilityVisibility({
        policy,
        telemetryKind: 'ToolTrace',
        actorTenantId: 'tenant-1',
        recordTenantId: 'tenant-1',
        actorWorkspaceId: 'ws-1',
        recordWorkspaceId: 'ws-1',
        actorRoles: ['approver'],
        requestPayload: true,
      }),
    ).toMatchObject({ allowed: false, reason: 'RoleDenied', payloadVisible: false });

    expect(
      evaluateAgentObservabilityVisibility({
        policy,
        telemetryKind: 'ToolTrace',
        actorTenantId: 'tenant-1',
        recordTenantId: 'tenant-1',
        actorWorkspaceId: 'ws-1',
        recordWorkspaceId: 'ws-1',
        actorRoles: ['operator'],
        requestPayload: true,
      }),
    ).toMatchObject({ allowed: true, reason: 'Allowed', payloadVisible: true });
  });

  it('keeps evidence artifact payloads metadata-only for operators but visible to auditors', () => {
    const policy = parseAgentObservabilityLifecyclePolicyV1(
      DEFAULT_AGENT_OBSERVABILITY_LIFECYCLE_POLICY_V1,
    );

    expect(
      evaluateAgentObservabilityVisibility({
        policy,
        telemetryKind: 'EvidenceArtifact',
        actorTenantId: 'tenant-1',
        recordTenantId: 'tenant-1',
        actorWorkspaceId: 'ws-1',
        recordWorkspaceId: 'ws-1',
        actorRoles: ['operator'],
        requestPayload: true,
      }),
    ).toMatchObject({ allowed: false, reason: 'RoleDenied', payloadVisible: false });

    expect(
      evaluateAgentObservabilityVisibility({
        policy,
        telemetryKind: 'EvidenceArtifact',
        actorTenantId: 'tenant-1',
        recordTenantId: 'tenant-1',
        actorWorkspaceId: 'ws-1',
        recordWorkspaceId: 'ws-1',
        actorRoles: ['auditor'],
        requestPayload: true,
      }),
    ).toMatchObject({
      allowed: true,
      reason: 'Allowed',
      operatorVisibility: 'MetadataOnly',
      payloadVisible: false,
    });
  });

  it('blocks disposition while legal hold is active and after retention has not expired', () => {
    const policy = parseAgentObservabilityLifecyclePolicyV1(
      DEFAULT_AGENT_OBSERVABILITY_LIFECYCLE_POLICY_V1,
    );
    const transcript = getAgentObservabilityLifecycleRule(policy, 'AgentTranscript');

    expect(
      isAgentObservabilityDispositionBlocked({
        rule: transcript,
        legalHoldActive: true,
        retentionExpired: true,
      }),
    ).toBe(true);

    expect(
      isAgentObservabilityDispositionBlocked({
        rule: transcript,
        legalHoldActive: false,
        retentionExpired: false,
      }),
    ).toBe(true);

    expect(
      isAgentObservabilityDispositionBlocked({
        rule: transcript,
        legalHoldActive: false,
        retentionExpired: true,
      }),
    ).toBe(false);
  });

  it('rejects policies that make production deep tracing the default cap', () => {
    expect(() =>
      parseAgentObservabilityLifecyclePolicyV1(
        validPolicy({
          environmentTraceDepthCaps: {
            experiment: 'deep',
            pilot: 'standard',
            production: 'deep',
          },
        }),
      ),
    ).toThrow(/production trace-depth cap/i);
  });

  it('rejects uncontrolled transcript and screenshot payload visibility', () => {
    const policy = validPolicy({
      rules: DEFAULT_AGENT_OBSERVABILITY_LIFECYCLE_POLICY_V1.rules.map((rule) =>
        rule.telemetryKind === 'AgentTranscript'
          ? {
              ...rule,
              operatorVisibility: 'Full',
            }
          : rule,
      ),
    });

    expect(() => parseAgentObservabilityLifecyclePolicyV1(policy)).toThrow(
      /AgentTranscript cannot use Full operator visibility/i,
    );
  });

  it('rejects missing lifecycle coverage and weak evidence artifact governance', () => {
    expect(() =>
      parseAgentObservabilityLifecyclePolicyV1(
        validPolicy({
          rules: DEFAULT_AGENT_OBSERVABILITY_LIFECYCLE_POLICY_V1.rules.filter(
            (rule) => rule.telemetryKind !== 'Timeline',
          ),
        }),
      ),
    ).toThrow(/Missing lifecycle rule.*Timeline/i);

    expect(() =>
      parseAgentObservabilityLifecyclePolicyV1(
        validPolicy({
          rules: DEFAULT_AGENT_OBSERVABILITY_LIFECYCLE_POLICY_V1.rules.map((rule) =>
            rule.telemetryKind === 'EvidenceArtifact'
              ? {
                  ...rule,
                  retentionClass: 'Operational',
                }
              : rule,
          ),
        }),
      ),
    ).toThrow(AgentObservabilityLifecyclePolicyParseError);
  });
});
