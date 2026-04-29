import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Connects to the workspace SSE event stream and auto-invalidates approval
 * query caches when approval lifecycle events arrive.
 *
 * Usage:
 *   useApprovalEventStream(wsId);
 *
 * The hook manages its own EventSource lifecycle — reconnects on error,
 * cleans up on unmount, and is a no-op when wsId is falsy.
 */

const APPROVAL_EVENT_TYPES = [
  'com.portarium.approval.ApprovalRequested',
  'com.portarium.approval.ApprovalGranted',
  'com.portarium.approval.ApprovalDenied',
  'com.portarium.approval.ApprovalChangesRequested',
] as const;

const RECONNECT_DELAY_MS = 3_000;

export function useApprovalEventStream(wsId: string): void {
  const qc = useQueryClient();
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!wsId) return;
    if (typeof EventSource === 'undefined') return;

    let es: EventSource | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;

      const url = `/v1/workspaces/${encodeURIComponent(wsId)}/events:stream`;
      es = new EventSource(url);

      for (const eventType of APPROVAL_EVENT_TYPES) {
        es.addEventListener(eventType, () => {
          void qc.invalidateQueries({ queryKey: ['approvals', wsId] });
          void qc.invalidateQueries({ queryKey: ['runs', wsId] });
        });
      }

      es.onerror = () => {
        if (disposed) return;
        es?.close();
        es = null;
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      disposed = true;
      es?.close();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [wsId, qc]);
}
