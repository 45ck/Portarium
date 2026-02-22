/**
 * In-memory implementation of EventStreamBroadcast.
 *
 * Suitable for development and test environments where all processes run
 * in the same Node.js process.  Uses a per-workspace subscriber map so
 * that publish() is O(k) where k is the number of active SSE connections
 * for the target workspace.
 *
 * Thread-safety: Node.js is single-threaded; no locking required.
 */

import type {
  EventStreamBroadcast,
  EventStreamUnsubscribe,
  WorkspaceStreamEvent,
} from '../../application/ports/event-stream.js';

type SubscriberHandler = (event: WorkspaceStreamEvent) => void;

export class InMemoryEventStreamBroadcast implements EventStreamBroadcast {
  readonly #subscribers = new Map<string, Set<SubscriberHandler>>();

  public publish(event: WorkspaceStreamEvent): void {
    const handlers = this.#subscribers.get(event.workspaceId);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(event);
      } catch {
        // Subscriber errors must not break the publish loop.
      }
    }
  }

  public subscribe(workspaceId: string, handler: SubscriberHandler): EventStreamUnsubscribe {
    let handlers = this.#subscribers.get(workspaceId);
    if (!handlers) {
      handlers = new Set();
      this.#subscribers.set(workspaceId, handlers);
    }
    handlers.add(handler);

    return () => {
      const set = this.#subscribers.get(workspaceId);
      if (!set) return;
      set.delete(handler);
      if (set.size === 0) {
        this.#subscribers.delete(workspaceId);
      }
    };
  }

  /** Returns the number of active subscribers across all workspaces. */
  public get subscriberCount(): number {
    let total = 0;
    for (const set of this.#subscribers.values()) {
      total += set.size;
    }
    return total;
  }
}
