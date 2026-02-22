import { describe, expect, it } from 'vitest';

import { PolicyId, UserId, WorkspaceId } from '../primitives/index.js';
import {
  evaluatePolicyPipeline,
  type ApprovalPipelineInputV1,
  type PolicyEvaluationPipelineResultV1,
} from './policy-evaluation-pipeline-v1.js';
import type { PolicyV1 } from './policy-v1.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW_ISO = '2026-02-22T12:00:00.000Z';
const wsId = WorkspaceId('ws-1');
const creatorId = UserId('user-creator');

function makePolicy(overrides: Partial<PolicyV1> & { id?: string; name?: string }): PolicyV1 {
  return {
    schemaVersion: 1,
    policyId: PolicyId(overrides.id ?? 'policy-1'),
    workspaceId: wsId,
    name: overrides.name ?? 'Test Policy',
    active: overrides.active ?? true,
    priority: overrides.priority ?? 100,
    version: 1,
    createdAtIso: NOW_ISO,
    createdByUserId: creatorId,
    ...overrides,
  };
}

const BASE_INPUT: ApprovalPipelineInputV1 = {
  payloadKind: 'RunStart',
  riskTags: ['low-risk'],
  dataClassification: 'public',
  blastRadius: 'single-resource',
};

// ---------------------------------------------------------------------------
// Empty / no policies
// ---------------------------------------------------------------------------

describe('evaluatePolicyPipeline — no policies', () => {
  it('returns overall pass when no policies provided', () => {
    const result = evaluatePolicyPipeline([], BASE_INPUT, NOW_ISO);
    expect(result.overallOutcome).toBe('pass');
    expect(result.policyResults).toHaveLength(0);
  });

  it('result is frozen', () => {
    const result = evaluatePolicyPipeline([], BASE_INPUT, NOW_ISO);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('includes evaluatedAtIso', () => {
    const result = evaluatePolicyPipeline([], BASE_INPUT, NOW_ISO);
    expect(result.evaluatedAtIso).toBe(NOW_ISO);
  });
});

// ---------------------------------------------------------------------------
// Inactive policies are skipped
// ---------------------------------------------------------------------------

describe('evaluatePolicyPipeline — inactive policies', () => {
  it('skips inactive policies', () => {
    const policy = makePolicy({
      active: false,
      rules: [{ ruleId: 'r1', condition: 'true', effect: 'Deny' }],
    });
    const result = evaluatePolicyPipeline([policy], BASE_INPUT, NOW_ISO);
    expect(result.overallOutcome).toBe('pass');
    expect(result.policyResults).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Single policy — Allow rules
// ---------------------------------------------------------------------------

describe('evaluatePolicyPipeline — Allow rules', () => {
  it('passes when Allow rule matches', () => {
    const policy = makePolicy({
      rules: [{ ruleId: 'r-allow', condition: 'payloadKind eq "RunStart"', effect: 'Allow' }],
    });
    const result = evaluatePolicyPipeline([policy], BASE_INPUT, NOW_ISO);
    expect(result.overallOutcome).toBe('pass');
    expect(result.policyResults[0]?.outcome).toBe('pass');
  });

  it('passes when no rules defined', () => {
    const policy = makePolicy({});
    const result = evaluatePolicyPipeline([policy], BASE_INPUT, NOW_ISO);
    expect(result.overallOutcome).toBe('pass');
    expect(result.policyResults[0]?.outcome).toBe('pass');
  });

  it('passes when Allow rule does not match but no Deny rules exist', () => {
    const policy = makePolicy({
      rules: [{ ruleId: 'r-allow', condition: 'payloadKind eq "ToolCall"', effect: 'Allow' }],
    });
    const result = evaluatePolicyPipeline([policy], BASE_INPUT, NOW_ISO);
    expect(result.overallOutcome).toBe('pass');
  });
});

// ---------------------------------------------------------------------------
// Single policy — Deny rules
// ---------------------------------------------------------------------------

describe('evaluatePolicyPipeline — Deny rules', () => {
  it('fails when Deny rule matches', () => {
    const policy = makePolicy({
      rules: [{ ruleId: 'r-deny', condition: 'payloadKind eq "RunStart"', effect: 'Deny' }],
    });
    const result = evaluatePolicyPipeline([policy], BASE_INPUT, NOW_ISO);
    expect(result.overallOutcome).toBe('fail');
    expect(result.policyResults[0]?.outcome).toBe('fail');
  });

  it('passes when Deny rule does not match', () => {
    const policy = makePolicy({
      rules: [{ ruleId: 'r-deny', condition: 'payloadKind eq "ToolCall"', effect: 'Deny' }],
    });
    const result = evaluatePolicyPipeline([policy], BASE_INPUT, NOW_ISO);
    expect(result.overallOutcome).toBe('pass');
  });

  it('Allow wins when both Allow and Deny rules match', () => {
    const policy = makePolicy({
      rules: [
        { ruleId: 'r-deny', condition: 'payloadKind eq "RunStart"', effect: 'Deny' },
        { ruleId: 'r-allow', condition: 'dataClassification eq "public"', effect: 'Allow' },
      ],
    });
    const result = evaluatePolicyPipeline([policy], BASE_INPUT, NOW_ISO);
    expect(result.overallOutcome).toBe('pass');
    expect(result.policyResults[0]?.outcome).toBe('pass');
  });
});

// ---------------------------------------------------------------------------
// SoD constraints → needs_human
// ---------------------------------------------------------------------------

describe('evaluatePolicyPipeline — SoD constraints', () => {
  it('needs_human when policy has SoD constraints', () => {
    const policy = makePolicy({
      sodConstraints: [{ kind: 'MakerChecker' }],
    });
    const result = evaluatePolicyPipeline([policy], BASE_INPUT, NOW_ISO);
    expect(result.overallOutcome).toBe('needs_human');
    expect(result.policyResults[0]?.outcome).toBe('needs_human');
  });

  it('fail takes precedence over needs_human', () => {
    const denyPolicy = makePolicy({
      id: 'p-deny',
      name: 'Deny Policy',
      priority: 200,
      rules: [{ ruleId: 'r1', condition: 'payloadKind eq "RunStart"', effect: 'Deny' }],
    });
    const sodPolicy = makePolicy({
      id: 'p-sod',
      name: 'SoD Policy',
      priority: 100,
      sodConstraints: [{ kind: 'MakerChecker' }],
    });
    const result = evaluatePolicyPipeline([denyPolicy, sodPolicy], BASE_INPUT, NOW_ISO);
    expect(result.overallOutcome).toBe('fail');
  });

  it('SpecialistApproval SoD produces needs_human with rationale in explanation', () => {
    const policy = makePolicy({
      sodConstraints: [
        {
          kind: 'SpecialistApproval',
          requiredRoles: ['safety-engineer'],
          rationale: 'High-risk operation requires safety sign-off.',
        },
      ],
    });
    const result = evaluatePolicyPipeline([policy], BASE_INPUT, NOW_ISO);
    expect(result.overallOutcome).toBe('needs_human');
    expect(result.policyResults[0]?.explanation).toContain('SoD');
  });
});

// ---------------------------------------------------------------------------
// Multiple policies — priority ordering
// ---------------------------------------------------------------------------

describe('evaluatePolicyPipeline — multiple policies', () => {
  it('evaluates all active policies, aggregates to fail if any fails', () => {
    const p1 = makePolicy({
      id: 'p1',
      name: 'Pass Policy',
      priority: 100,
      rules: [{ ruleId: 'r1', condition: 'dataClassification eq "public"', effect: 'Allow' }],
    });
    const p2 = makePolicy({
      id: 'p2',
      name: 'Deny Policy',
      priority: 50,
      rules: [{ ruleId: 'r2', condition: 'blastRadius eq "single-resource"', effect: 'Deny' }],
    });
    const result = evaluatePolicyPipeline([p1, p2], BASE_INPUT, NOW_ISO);
    expect(result.overallOutcome).toBe('fail');
    expect(result.policyResults).toHaveLength(2);
  });

  it('results are sorted highest priority first', () => {
    const p1 = makePolicy({ id: 'p1', name: 'Low', priority: 10 });
    const p2 = makePolicy({ id: 'p2', name: 'High', priority: 200 });
    const result = evaluatePolicyPipeline([p1, p2], BASE_INPUT, NOW_ISO);
    expect(result.policyResults[0]?.policyName).toBe('High');
    expect(result.policyResults[1]?.policyName).toBe('Low');
  });

  it('overall pass when all policies pass', () => {
    const p1 = makePolicy({ id: 'p1', name: 'P1' });
    const p2 = makePolicy({ id: 'p2', name: 'P2' });
    const result = evaluatePolicyPipeline([p1, p2], BASE_INPUT, NOW_ISO);
    expect(result.overallOutcome).toBe('pass');
  });
});

// ---------------------------------------------------------------------------
// Rule trace explainability
// ---------------------------------------------------------------------------

describe('evaluatePolicyPipeline — rule traces', () => {
  it('includes a trace for each rule', () => {
    const policy = makePolicy({
      rules: [
        { ruleId: 'r1', condition: 'payloadKind eq "RunStart"', effect: 'Allow' },
        { ruleId: 'r2', condition: 'payloadKind eq "ToolCall"', effect: 'Deny' },
      ],
    });
    const result = evaluatePolicyPipeline([policy], BASE_INPUT, NOW_ISO);
    const traces = result.policyResults[0]?.ruleTraces ?? [];
    expect(traces).toHaveLength(2);
    expect(traces.find((t) => t.ruleId === 'r1')?.outcome).toBe('matched');
    expect(traces.find((t) => t.ruleId === 'r2')?.outcome).toBe('not_matched');
  });

  it('trace explanation is non-empty for matched rule', () => {
    const policy = makePolicy({
      rules: [{ ruleId: 'r1', condition: 'payloadKind eq "RunStart"', effect: 'Allow' }],
    });
    const result = evaluatePolicyPipeline([policy], BASE_INPUT, NOW_ISO);
    const trace = result.policyResults[0]?.ruleTraces[0];
    expect(typeof trace?.explanation).toBe('string');
    expect(trace?.explanation.length).toBeGreaterThan(0);
  });

  it('trace outcome is error for invalid DSL', () => {
    const policy = makePolicy({
      rules: [{ ruleId: 'r-bad', condition: '%%%invalid%%%', effect: 'Deny' }],
    });
    const result = evaluatePolicyPipeline([policy], BASE_INPUT, NOW_ISO);
    const trace = result.policyResults[0]?.ruleTraces[0];
    expect(trace?.outcome).toBe('error');
    expect(trace?.explanation).toContain('Rule could not be evaluated');
  });

  it('policy explanation references the triggering deny rule', () => {
    const policy = makePolicy({
      rules: [{ ruleId: 'deny-high-risk', condition: 'payloadKind eq "RunStart"', effect: 'Deny' }],
    });
    const result = evaluatePolicyPipeline([policy], BASE_INPUT, NOW_ISO);
    expect(result.policyResults[0]?.explanation).toContain('deny-high-risk');
  });
});

// ---------------------------------------------------------------------------
// Context field access in DSL
// ---------------------------------------------------------------------------

describe('evaluatePolicyPipeline — context field access', () => {
  it('can access riskTags via contains operator', () => {
    const input: ApprovalPipelineInputV1 = {
      payloadKind: 'RunStart',
      riskTags: ['high-risk', 'irreversible'],
    };
    const policy = makePolicy({
      rules: [{ ruleId: 'r1', condition: 'riskTags contains "high-risk"', effect: 'Deny' }],
    });
    const result = evaluatePolicyPipeline([policy], input, NOW_ISO);
    expect(result.overallOutcome).toBe('fail');
  });

  it('can access dataClassification via eq operator', () => {
    const input: ApprovalPipelineInputV1 = {
      payloadKind: 'RunStart',
      dataClassification: 'confidential',
    };
    const policy = makePolicy({
      rules: [{ ruleId: 'r1', condition: 'dataClassification eq "confidential"', effect: 'Deny' }],
    });
    const result = evaluatePolicyPipeline([policy], input, NOW_ISO);
    expect(result.overallOutcome).toBe('fail');
  });

  it('can access blastRadius via eq operator', () => {
    const input: ApprovalPipelineInputV1 = {
      payloadKind: 'RunStart',
      blastRadius: 'cross-workspace',
    };
    const policy = makePolicy({
      rules: [{ ruleId: 'r1', condition: 'blastRadius eq "cross-workspace"', effect: 'Deny' }],
    });
    const result = evaluatePolicyPipeline([policy], input, NOW_ISO);
    expect(result.overallOutcome).toBe('fail');
  });
});

// ---------------------------------------------------------------------------
// Snapshot / immutability guarantees
// ---------------------------------------------------------------------------

describe('evaluatePolicyPipeline — snapshot immutability', () => {
  it('result is deeply frozen', () => {
    const policy = makePolicy({
      rules: [{ ruleId: 'r1', condition: 'true', effect: 'Allow' }],
    });
    const result: PolicyEvaluationPipelineResultV1 = evaluatePolicyPipeline(
      [policy],
      BASE_INPUT,
      NOW_ISO,
    );
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.policyResults)).toBe(true);
    expect(Object.isFrozen(result.requiredApproverIds)).toBe(true);
  });

  it('evaluatedAtIso defaults to current time when not provided', () => {
    const before = new Date().toISOString();
    const result = evaluatePolicyPipeline([], BASE_INPUT);
    const after = new Date().toISOString();
    expect(result.evaluatedAtIso >= before).toBe(true);
    expect(result.evaluatedAtIso <= after).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// requiredApproverIds aggregation
// ---------------------------------------------------------------------------

describe('evaluatePolicyPipeline — requiredApproverIds', () => {
  it('returns empty array when no SoD constraints', () => {
    const result = evaluatePolicyPipeline([makePolicy({})], BASE_INPUT, NOW_ISO);
    expect(result.requiredApproverIds).toEqual([]);
  });

  it('returns empty array even with MakerChecker (IDs resolved at application layer)', () => {
    const policy = makePolicy({ sodConstraints: [{ kind: 'MakerChecker' }] });
    const result = evaluatePolicyPipeline([policy], BASE_INPUT, NOW_ISO);
    expect(result.requiredApproverIds).toEqual([]);
  });
});
