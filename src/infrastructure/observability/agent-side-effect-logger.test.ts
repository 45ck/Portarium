import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

import {
  AgentSideEffectLogger,
  buildTraceparent,
  classifyUrl,
  type SideEffectLogEntry,
  type SideEffectLogSink,
} from './agent-side-effect-logger.js';

// -- Unit tests for classifyUrl ----------------------------------------------

describe('classifyUrl', () => {
  const cpUrls = ['http://localhost:3100', 'https://api.portarium.example.com'];

  it('classifies control-plane URLs as routed', () => {
    expect(classifyUrl('http://localhost:3100/api/v1/runs', cpUrls)).toBe('control-plane-routed');
    expect(classifyUrl('https://api.portarium.example.com/api/v1/runs', cpUrls)).toBe(
      'control-plane-routed',
    );
  });

  it('classifies other URLs as direct-sor-call', () => {
    expect(classifyUrl('https://erp.example.com/invoices', cpUrls)).toBe('direct-sor-call');
    expect(classifyUrl('http://localhost:8080/api', cpUrls)).toBe('direct-sor-call');
  });

  it('is case-insensitive', () => {
    expect(classifyUrl('HTTP://LOCALHOST:3100/api/v1/runs', cpUrls)).toBe('control-plane-routed');
  });
});

// -- Unit tests for buildTraceparent -----------------------------------------

describe('buildTraceparent', () => {
  it('formats a valid W3C traceparent', () => {
    const tp = buildTraceparent('abcdef1234567890abcdef1234567890', 'abcdef1234567890');
    expect(tp).toBe('00-abcdef1234567890abcdef1234567890-abcdef1234567890-01');
  });
});

// -- Tests for AgentSideEffectLogger -----------------------------------------

describe('AgentSideEffectLogger', () => {
  const cpUrls = ['http://localhost:3100'];
  let logger: AgentSideEffectLogger;
  let sinkEntries: SideEffectLogEntry[];
  let sink: SideEffectLogSink;

  beforeEach(() => {
    sinkEntries = [];
    sink = { write: (entry) => sinkEntries.push(entry) };
    logger = new AgentSideEffectLogger({
      controlPlaneBaseUrls: cpUrls,
      agentId: 'agent-1',
      workspaceId: 'ws-1',
      sink,
    });

    // Mock global fetch.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('logs a control-plane-routed call', async () => {
    await logger.instrumentedFetch('http://localhost:3100/api/v1/runs', {
      method: 'POST',
    });

    expect(sinkEntries).toHaveLength(1);
    expect(sinkEntries[0]!.classification).toBe('control-plane-routed');
    expect(sinkEntries[0]!.method).toBe('POST');
    expect(sinkEntries[0]!.agentId).toBe('agent-1');
    expect(sinkEntries[0]!.workspaceId).toBe('ws-1');
  });

  it('logs a direct-sor-call', async () => {
    await logger.instrumentedFetch('https://erp.example.com/invoices');

    expect(sinkEntries).toHaveLength(1);
    expect(sinkEntries[0]!.classification).toBe('direct-sor-call');
    expect(sinkEntries[0]!.method).toBe('GET');
  });

  it('injects traceparent header', async () => {
    await logger.instrumentedFetch('http://localhost:3100/api/v1/runs');

    const mockFetch = vi.mocked(fetch);
    const callArgs = mockFetch.mock.calls[0]!;
    const headers = callArgs[1]?.headers as Headers;
    const traceparent = headers.get('traceparent');
    expect(traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it('does not overwrite existing traceparent', async () => {
    await logger.instrumentedFetch('http://localhost:3100/api/v1/runs', {
      headers: { traceparent: '00-existing-span-01' },
    });

    const mockFetch = vi.mocked(fetch);
    const callArgs = mockFetch.mock.calls[0]!;
    const headers = callArgs[1]?.headers as Headers;
    expect(headers.get('traceparent')).toBe('00-existing-span-01');
  });

  it('records statusCode and durationMs', async () => {
    await logger.instrumentedFetch('http://localhost:3100/api/v1/runs');

    expect(sinkEntries[0]!.statusCode).toBe(200);
    expect(typeof sinkEntries[0]!.durationMs).toBe('number');
  });

  it('still logs on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    await expect(logger.instrumentedFetch('http://localhost:3100/api/v1/runs')).rejects.toThrow(
      'network error',
    );

    expect(sinkEntries).toHaveLength(1);
    expect(sinkEntries[0]!.statusCode).toBeUndefined();
  });

  it('counts entries by classification', async () => {
    await logger.instrumentedFetch('http://localhost:3100/api/v1/runs');
    await logger.instrumentedFetch('https://erp.example.com/invoices');
    await logger.instrumentedFetch('http://localhost:3100/api/v1/approvals');

    const counts = logger.getCounts();
    expect(counts['control-plane-routed']).toBe(2);
    expect(counts['direct-sor-call']).toBe(1);
  });

  it('calculates routing compliance percentage', async () => {
    await logger.instrumentedFetch('http://localhost:3100/api/v1/runs');
    await logger.instrumentedFetch('http://localhost:3100/api/v1/runs');
    await logger.instrumentedFetch('https://erp.example.com/invoices');

    expect(logger.getRoutingCompliancePercent()).toBe(67);
  });

  it('returns 100% compliance when no calls recorded', () => {
    expect(logger.getRoutingCompliancePercent()).toBe(100);
  });

  it('getEntries returns a copy', async () => {
    await logger.instrumentedFetch('http://localhost:3100/api/v1/runs');
    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);

    logger.reset();
    expect(logger.getEntries()).toHaveLength(0);
    // Original copy is not affected.
    expect(entries).toHaveLength(1);
  });
});
