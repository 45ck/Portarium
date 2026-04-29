// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useApprovalEventStream } from './use-approval-event-stream';

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

type EventSourceListener = (event: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  listeners = new Map<string, EventSourceListener[]>();
  onerror: ((event: Event) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventSourceListener): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  close(): void {
    this.closed = true;
  }

  // Test helper: simulate an event
  emit(type: string, data?: unknown): void {
    const handlers = this.listeners.get(type) ?? [];
    for (const h of handlers) {
      h(new MessageEvent(type, { data: JSON.stringify(data ?? null) }));
    }
  }
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useApprovalEventStream', () => {
  it('connects to the SSE endpoint for the given workspace', () => {
    renderHook(() => useApprovalEventStream('ws-1'), { wrapper });

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]!.url).toBe('/v1/workspaces/ws-1/events:stream');
  });

  it('URL-encodes workspace identifiers in the SSE endpoint', () => {
    renderHook(() => useApprovalEventStream('workspace with spaces'), { wrapper });

    expect(MockEventSource.instances[0]!.url).toBe(
      '/v1/workspaces/workspace%20with%20spaces/events:stream',
    );
  });

  it('listens for approval event types', () => {
    renderHook(() => useApprovalEventStream('ws-1'), { wrapper });

    const es = MockEventSource.instances[0]!;
    expect(es.listeners.has('com.portarium.approval.ApprovalRequested')).toBe(true);
    expect(es.listeners.has('com.portarium.approval.ApprovalGranted')).toBe(true);
    expect(es.listeners.has('com.portarium.approval.ApprovalDenied')).toBe(true);
    expect(es.listeners.has('com.portarium.approval.ApprovalChangesRequested')).toBe(true);
  });

  it('does not connect when wsId is empty', () => {
    renderHook(() => useApprovalEventStream(''), { wrapper });
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('does not connect when EventSource is unavailable', () => {
    vi.stubGlobal('EventSource', undefined);
    renderHook(() => useApprovalEventStream('ws-1'), { wrapper });
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() => useApprovalEventStream('ws-1'), { wrapper });
    const es = MockEventSource.instances[0]!;
    expect(es.closed).toBe(false);

    unmount();
    expect(es.closed).toBe(true);
  });

  it('invalidates approval and run queries when an approval event arrives', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    function testWrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: qc }, children);
    }

    renderHook(() => useApprovalEventStream('ws-1'), { wrapper: testWrapper });

    const es = MockEventSource.instances[0]!;
    es.emit('com.portarium.approval.ApprovalGranted', { approvalId: 'a-1' });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['approvals', 'ws-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['runs', 'ws-1'] });
  });
});
