/**
 * EventStreamBroadcast port — workspace-scoped real-time event distribution.
 *
 * Implementations fan out events to all active SSE connections subscribed to
 * a given workspace.  The port deliberately uses a simple synchronous
 * callback model (no Promises) so that SSE handlers can write to the response
 * stream synchronously without back-pressure concerns.
 */

export type WorkspaceStreamEvent = Readonly<{
  /** CloudEvents-compatible event type, e.g. "com.portarium.run.RunStarted". */
  type: string;
  /** Globally unique event ID. */
  id: string;
  /** Workspace (tenant) the event belongs to. */
  workspaceId: string;
  /** ISO-8601 timestamp when the event occurred. */
  time: string;
  /** Optional structured payload. */
  data?: unknown;
}>;

export type EventStreamUnsubscribe = () => void;

export interface EventStreamBroadcast {
  /**
   * Publish an event to all subscribers for the given workspace.
   * Fire-and-forget — does not throw.
   */
  publish(event: WorkspaceStreamEvent): void;

  /**
   * Subscribe to events for a specific workspace.
   * Returns an unsubscribe function; callers MUST invoke it when the
   * SSE connection is closed to prevent memory leaks.
   */
  subscribe(
    workspaceId: string,
    handler: (event: WorkspaceStreamEvent) => void,
  ): EventStreamUnsubscribe;
}
