import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Connects to the workspace SSE event stream and auto-invalidates approval
 * query caches when approval lifecycle events arrive.
 *
 * Usage:
 *   useApprovalEventStream(wsId);
 *
 * The hook manages its own fetch-stream lifecycle — reconnects on error,
 * cleans up on unmount, and is a no-op when wsId is falsy.
 */

const APPROVAL_EVENT_TYPES = [
  'com.portarium.approval.ApprovalRequested',
  'com.portarium.approval.ApprovalGranted',
  'com.portarium.approval.ApprovalDenied',
  'com.portarium.approval.ApprovalChangesRequested',
] as const;

const RECONNECT_DELAY_MS = 3_000;

type ApprovalEventType = (typeof APPROVAL_EVENT_TYPES)[number];

function isApprovalEventType(type: string | null): type is ApprovalEventType {
  return APPROVAL_EVENT_TYPES.includes(type as ApprovalEventType);
}

export function useApprovalEventStream(wsId: string): void {
  const qc = useQueryClient();
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!wsId) return;
    if (typeof fetch === 'undefined') return;

    let disposed = false;
    let controller: AbortController | null = null;

    function invalidateApprovalQueries() {
      void qc.invalidateQueries({ queryKey: ['approvals', wsId] });
      void qc.invalidateQueries({ queryKey: ['runs', wsId] });
    }

    function dispatchFrame(frame: string) {
      let eventType: string | null = null;

      for (const rawLine of frame.split('\n')) {
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
        if (line.startsWith('event:')) {
          eventType = line.slice('event:'.length).trim();
        }
      }

      if (isApprovalEventType(eventType)) {
        invalidateApprovalQueries();
      }
    }

    function scheduleReconnect() {
      if (disposed || reconnectTimerRef.current) return;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        void connect();
      }, RECONNECT_DELAY_MS);
    }

    async function connect() {
      if (disposed) return;

      const url = `/v1/workspaces/${encodeURIComponent(wsId)}/events:stream`;
      controller = new AbortController();

      try {
        const response = await fetch(url, {
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          scheduleReconnect();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split(/\n\n|\r\n\r\n/);
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            dispatchFrame(frame);
          }
        }

        if (buffer.trim()) dispatchFrame(buffer);
        scheduleReconnect();
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) {
          scheduleReconnect();
        }
      }
    }

    void connect();

    return () => {
      disposed = true;
      controller?.abort();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [wsId, qc]);
}
