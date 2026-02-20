import { describe, expect, it } from 'vitest';

import {
  assertCommandGuardrails,
  evaluateCommandGuardrails,
  type CommandGuardrailInput,
} from './command-guardrails.js';

function makeInput(overrides: Partial<CommandGuardrailInput> = {}): CommandGuardrailInput {
  return {
    commandName: 'CreateInvoice',
    executionTier: 'Auto',
    policyDecision: 'Allow',
    blastRadius: 1,
    blastRadiusLimit: 100,
    ...overrides,
  };
}

describe('evaluateCommandGuardrails', () => {
  it('allows when all checks pass', () => {
    const result = evaluateCommandGuardrails(makeInput());
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
    expect(result.violations).toHaveLength(0);
  });

  it('requires approval for HumanApprove tier', () => {
    const result = evaluateCommandGuardrails(
      makeInput({ executionTier: 'HumanApprove' }),
    );
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]!.code).toBe('TIER_REQUIRES_APPROVAL');
  });

  it('denies ManualOnly tier commands', () => {
    const result = evaluateCommandGuardrails(
      makeInput({ executionTier: 'ManualOnly' }),
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.code === 'POLICY_DENIED')).toBe(true);
  });

  it('denies when blast radius exceeds limit', () => {
    const result = evaluateCommandGuardrails(
      makeInput({ blastRadius: 200, blastRadiusLimit: 100 }),
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.code === 'BLAST_RADIUS_EXCEEDED')).toBe(true);
  });

  it('denies when policy decision is Deny', () => {
    const result = evaluateCommandGuardrails(
      makeInput({ policyDecision: 'Deny' }),
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.code === 'POLICY_DENIED')).toBe(true);
  });

  it('requires approval when policy decision is RequireApproval', () => {
    const result = evaluateCommandGuardrails(
      makeInput({ policyDecision: 'RequireApproval' }),
    );
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it('validates required fields in schema', () => {
    const result = evaluateCommandGuardrails(
      makeInput({
        schema: { required: ['amount', 'currency'] },
        payload: { amount: 100 },
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.some((v) => v.code === 'SCHEMA_INVALID')).toBe(true);
    expect(result.violations.some((v) => v.message.includes('currency'))).toBe(true);
  });

  it('rejects non-object payloads', () => {
    const result = evaluateCommandGuardrails(
      makeInput({
        schema: { required: ['amount'] },
        payload: 'not-an-object',
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.violations[0]!.code).toBe('SCHEMA_INVALID');
  });

  it('passes schema validation when all required fields are present', () => {
    const result = evaluateCommandGuardrails(
      makeInput({
        schema: { required: ['amount', 'currency'] },
        payload: { amount: 100, currency: 'USD' },
      }),
    );
    expect(result.allowed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('collects multiple violations', () => {
    const result = evaluateCommandGuardrails(
      makeInput({
        executionTier: 'ManualOnly',
        blastRadius: 500,
        blastRadiusLimit: 100,
        policyDecision: 'Deny',
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });
});

describe('assertCommandGuardrails', () => {
  it('returns ok Result when guardrails pass', () => {
    const result = assertCommandGuardrails(makeInput());
    expect(result.ok).toBe(true);
  });

  it('returns ValidationFailed when guardrails fail', () => {
    const result = assertCommandGuardrails(makeInput({ policyDecision: 'Deny' }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toContain('guardrail');
  });
});
