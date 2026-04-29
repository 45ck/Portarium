// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useApprovalEventStream } from './use-approval-event-stream';

// ---------------------------------------------------------------------------
// Mock fetch-stream SSE response
// ---------------------------------------------------------------------------

type StreamHarness = {
  response: Response;
  write: (text: string) => void;
  close: () => void;
};

function makeStreamResponse(): StreamHarness {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const encoder = new TextEncoder();

  return {
    response: new Response(stream, { status: 200 }),
    write(text: string) {
      controller?.enqueue(encoder.encode(text));
    },
    close() {
      controller?.close();
    },
  };
}

beforeEach(() => {
  const stream = makeStreamResponse();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));
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
  it('connects to the SSE endpoint for the given workspace through fetch', async () => {
    renderHook(() => useApprovalEventStream('ws-1'), { wrapper });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/v1/workspaces/ws-1/events:stream');
    expect(new Headers(init.headers).get('Accept')).toBe('text/event-stream');
  });

  it('URL-encodes workspace identifiers in the SSE endpoint', async () => {
    renderHook(() => useApprovalEventStream('workspace with spaces'), { wrapper });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe(
      '/v1/workspaces/workspace%20with%20spaces/events:stream',
    );
  });

  it('does not connect when wsId is empty', () => {
    renderHook(() => useApprovalEventStream(''), { wrapper });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not connect when fetch is unavailable', () => {
    vi.stubGlobal('fetch', undefined);
    renderHook(() => useApprovalEventStream('ws-1'), { wrapper });
    expect(fetch).toBeUndefined();
  });

  it('aborts the stream on unmount', async () => {
    const { unmount } = renderHook(() => useApprovalEventStream('ws-1'), { wrapper });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const signal = init.signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('invalidates approval and run queries when an approval event arrives', async () => {
    const stream = makeStreamResponse();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    function testWrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: qc }, children);
    }

    renderHook(() => useApprovalEventStream('ws-1'), { wrapper: testWrapper });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    stream.write('event: com.portarium.approval.ApprovalGranted\n');
    stream.write('id: evt-1\n');
    stream.write('data: {"approvalId":"a-1"}\n\n');

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['approvals', 'ws-1'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['runs', 'ws-1'] });
    });
  });

  it('ignores non-approval stream events', async () => {
    const stream = makeStreamResponse();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    function testWrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: qc }, children);
    }

    renderHook(() => useApprovalEventStream('ws-1'), { wrapper: testWrapper });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    stream.write('event: com.portarium.run.RunStarted\n');
    stream.write('data: {"runId":"run-1"}\n\n');

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
