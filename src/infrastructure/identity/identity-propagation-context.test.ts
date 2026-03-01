import { describe, expect, it } from 'vitest';
import {
  buildIdentityHeaders,
  extractIdentityFromHeaders,
  IDENTITY_HEADERS,
  type IdentityPropagationContext,
} from './identity-propagation-context.js';

function fullContext(
  overrides: Partial<IdentityPropagationContext> = {},
): IdentityPropagationContext {
  return {
    subject: 'spiffe://portarium.io/ns/portarium-agents/sa/agent-ocr/tenant/ws-1',
    workspaceId: 'ws-1',
    tenantId: 'ws-1',
    agentSpiffeId: 'spiffe://portarium.io/ns/portarium-agents/sa/agent-ocr/tenant/ws-1',
    workflowRunId: 'wfr-42',
    scopes: ['execute:action', 'read:config'],
    correlationId: '550e8400-e29b-41d4-a716-446655440000',
    traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    tracestate: 'portarium=abc123',
    ...overrides,
  };
}

describe('buildIdentityHeaders', () => {
  it('includes all required fields', () => {
    const ctx = fullContext();
    const headers = buildIdentityHeaders(ctx);

    expect(headers[IDENTITY_HEADERS.subject]).toBe(ctx.subject);
    expect(headers[IDENTITY_HEADERS.workspaceId]).toBe(ctx.workspaceId);
    expect(headers[IDENTITY_HEADERS.tenantId]).toBe(ctx.tenantId);
    expect(headers[IDENTITY_HEADERS.correlationId]).toBe(ctx.correlationId);
  });

  it('includes optional fields when present', () => {
    const headers = buildIdentityHeaders(fullContext());

    expect(headers[IDENTITY_HEADERS.agentSpiffeId]).toContain('portarium.io');
    expect(headers[IDENTITY_HEADERS.workflowRunId]).toBe('wfr-42');
    expect(headers[IDENTITY_HEADERS.scopes]).toBe('execute:action read:config');
    expect(headers[IDENTITY_HEADERS.traceparent]).toContain('4bf92f35');
    expect(headers[IDENTITY_HEADERS.tracestate]).toBe('portarium=abc123');
  });

  it('omits optional fields when absent', () => {
    const ctx: IdentityPropagationContext = {
      subject: 'user@example.com',
      workspaceId: 'ws-1',
      tenantId: 'ws-1',
      correlationId: '550e8400-e29b-41d4-a716-446655440000',
    };
    const headers = buildIdentityHeaders(ctx);

    expect(headers[IDENTITY_HEADERS.agentSpiffeId]).toBeUndefined();
    expect(headers[IDENTITY_HEADERS.workflowRunId]).toBeUndefined();
    expect(headers[IDENTITY_HEADERS.scopes]).toBeUndefined();
    expect(headers[IDENTITY_HEADERS.traceparent]).toBeUndefined();
    expect(headers[IDENTITY_HEADERS.tracestate]).toBeUndefined();
  });

  it('omits scopes when empty array', () => {
    const headers = buildIdentityHeaders(fullContext({ scopes: [] }));
    expect(headers[IDENTITY_HEADERS.scopes]).toBeUndefined();
  });
});

describe('extractIdentityFromHeaders', () => {
  it('round-trips through build → extract', () => {
    const ctx = fullContext();
    const headers = buildIdentityHeaders(ctx);
    const extracted = extractIdentityFromHeaders(headers);

    expect(extracted).toBeDefined();
    expect(extracted!.subject).toBe(ctx.subject);
    expect(extracted!.workspaceId).toBe(ctx.workspaceId);
    expect(extracted!.tenantId).toBe(ctx.tenantId);
    expect(extracted!.correlationId).toBe(ctx.correlationId);
    expect(extracted!.agentSpiffeId).toBe(ctx.agentSpiffeId);
    expect(extracted!.workflowRunId).toBe(ctx.workflowRunId);
    expect(extracted!.scopes).toEqual(ctx.scopes);
    expect(extracted!.traceparent).toBe(ctx.traceparent);
    expect(extracted!.tracestate).toBe(ctx.tracestate);
  });

  it('returns undefined when subject is missing', () => {
    const headers = buildIdentityHeaders(fullContext());
    delete headers[IDENTITY_HEADERS.subject];
    expect(extractIdentityFromHeaders(headers)).toBeUndefined();
  });

  it('returns undefined when workspaceId is missing', () => {
    const headers = buildIdentityHeaders(fullContext());
    delete headers[IDENTITY_HEADERS.workspaceId];
    expect(extractIdentityFromHeaders(headers)).toBeUndefined();
  });

  it('returns undefined when correlationId is missing', () => {
    const headers = buildIdentityHeaders(fullContext());
    delete headers[IDENTITY_HEADERS.correlationId];
    expect(extractIdentityFromHeaders(headers)).toBeUndefined();
  });

  it('falls back to workspaceId when tenantId is missing', () => {
    const headers = buildIdentityHeaders(fullContext());
    delete headers[IDENTITY_HEADERS.tenantId];
    const extracted = extractIdentityFromHeaders(headers);
    expect(extracted).toBeDefined();
    expect(extracted!.tenantId).toBe('ws-1');
  });

  it('handles array header values (takes first)', () => {
    const headers: Record<string, string | string[]> = {
      [IDENTITY_HEADERS.subject]: ['sub-a', 'sub-b'],
      [IDENTITY_HEADERS.workspaceId]: 'ws-1',
      [IDENTITY_HEADERS.tenantId]: 'ws-1',
      [IDENTITY_HEADERS.correlationId]: 'corr-1',
    };
    const extracted = extractIdentityFromHeaders(headers);
    expect(extracted).toBeDefined();
    expect(extracted!.subject).toBe('sub-a');
  });

  it('handles minimal required headers only', () => {
    const headers: Record<string, string> = {
      [IDENTITY_HEADERS.subject]: 'user@example.com',
      [IDENTITY_HEADERS.workspaceId]: 'ws-1',
      [IDENTITY_HEADERS.tenantId]: 'ws-1',
      [IDENTITY_HEADERS.correlationId]: 'corr-1',
    };
    const extracted = extractIdentityFromHeaders(headers);
    expect(extracted).toBeDefined();
    expect(extracted!.agentSpiffeId).toBeUndefined();
    expect(extracted!.workflowRunId).toBeUndefined();
    expect(extracted!.scopes).toBeUndefined();
  });
});

describe('IDENTITY_HEADERS constants', () => {
  it('all header names use lowercase x-portarium- prefix or standard names', () => {
    for (const [key, value] of Object.entries(IDENTITY_HEADERS)) {
      if (key === 'traceparent' || key === 'tracestate') {
        expect(value).toBe(key);
      } else {
        expect(value).toMatch(/^x-portarium-/);
      }
    }
  });
});
