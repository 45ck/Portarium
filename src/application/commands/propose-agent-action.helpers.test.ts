import { describe, expect, it } from 'vitest';

import { PolicyId, UserId, WorkspaceId } from '../../domain/primitives/index.js';
import type { ParsedProposeAgentActionInput } from './propose-agent-action.helpers.js';
import { generateIdempotencyKey } from './propose-agent-action.helpers.js';

function makeInput(
  overrides?: Partial<ParsedProposeAgentActionInput>,
): ParsedProposeAgentActionInput {
  return {
    workspaceId: WorkspaceId('ws-1'),
    agentId: 'agent-1',
    actionKind: 'comms:listEmails',
    toolName: 'email:list',
    executionTier: 'Auto',
    policyIds: [PolicyId('pol-1')],
    rationale: 'Read emails.',
    requestedByUserId: UserId('user-1'),
    ...overrides,
  };
}

describe('generateIdempotencyKey', () => {
  it('returns a deterministic key for identical inputs', () => {
    const input = makeInput();
    const key1 = generateIdempotencyKey(input);
    const key2 = generateIdempotencyKey(input);
    expect(key1).toBe(key2);
  });

  it('produces different keys for different toolNames', () => {
    const keyA = generateIdempotencyKey(makeInput({ toolName: 'email:list' }));
    const keyB = generateIdempotencyKey(makeInput({ toolName: 'email:send' }));
    expect(keyA).not.toBe(keyB);
  });

  it('produces different keys for different parameters', () => {
    const keyA = generateIdempotencyKey(makeInput({ parameters: { folder: 'inbox' } }));
    const keyB = generateIdempotencyKey(makeInput({ parameters: { folder: 'sent' } }));
    expect(keyA).not.toBe(keyB);
  });

  it('produces the same key regardless of parameter property order', () => {
    const keyA = generateIdempotencyKey(makeInput({ parameters: { a: 1, b: 2 } }));
    const keyB = generateIdempotencyKey(makeInput({ parameters: { b: 2, a: 1 } }));
    expect(keyA).toBe(keyB);
  });

  it('produces different keys for different agentIds', () => {
    const keyA = generateIdempotencyKey(makeInput({ agentId: 'agent-1' }));
    const keyB = generateIdempotencyKey(makeInput({ agentId: 'agent-2' }));
    expect(keyA).not.toBe(keyB);
  });

  it('produces different keys for different workspaceIds', () => {
    const keyA = generateIdempotencyKey(makeInput({ workspaceId: WorkspaceId('ws-1') }));
    const keyB = generateIdempotencyKey(makeInput({ workspaceId: WorkspaceId('ws-2') }));
    expect(keyA).not.toBe(keyB);
  });

  it('produces different keys for different actionKind values', () => {
    const keyA = generateIdempotencyKey(makeInput({ actionKind: 'comms:listEmails' }));
    const keyB = generateIdempotencyKey(makeInput({ actionKind: 'comms:sendEmail' }));
    expect(keyA).not.toBe(keyB);
  });

  it('prefixes auto-generated keys with "auto:"', () => {
    const key = generateIdempotencyKey(makeInput());
    expect(key).toMatch(/^auto:[0-9a-f]{64}$/);
  });

  it('produces different keys for different executionTier values', () => {
    const keyAuto = generateIdempotencyKey(makeInput({ executionTier: 'Auto' }));
    const keyHuman = generateIdempotencyKey(makeInput({ executionTier: 'HumanApprove' }));
    expect(keyAuto).not.toBe(keyHuman);
  });

  it('same action at Auto vs HumanApprove tier produces different keys', () => {
    const base = {
      agentId: 'agent-1',
      actionKind: 'comms:sendEmail',
      toolName: 'email:send',
      parameters: { to: 'user@example.com', body: 'hello' },
    };
    const keyAuto = generateIdempotencyKey(makeInput({ ...base, executionTier: 'Auto' }));
    const keyHuman = generateIdempotencyKey(makeInput({ ...base, executionTier: 'HumanApprove' }));
    expect(keyAuto).not.toBe(keyHuman);
  });

  it('treats undefined parameters as distinct from empty object', () => {
    const keyNone = generateIdempotencyKey(makeInput());
    const keyEmpty = generateIdempotencyKey(makeInput({ parameters: {} }));
    expect(keyNone).not.toBe(keyEmpty);
  });
});
