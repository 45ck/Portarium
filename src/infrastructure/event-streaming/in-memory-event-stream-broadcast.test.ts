import { describe, it, expect, vi } from 'vitest';
import { InMemoryEventStreamBroadcast } from './in-memory-event-stream-broadcast.js';
import type { WorkspaceStreamEvent } from '../../application/ports/event-stream.js';

function makeEvent(overrides: Partial<WorkspaceStreamEvent> = {}): WorkspaceStreamEvent {
  return {
    type: 'com.portarium.run.RunStarted',
    id: 'evt-1',
    workspaceId: 'ws-a',
    time: '2026-01-01T00:00:00.000Z',
    data: { runId: 'run-1' },
    ...overrides,
  };
}

describe('InMemoryEventStreamBroadcast', () => {
  it('delivers published events to workspace subscribers', () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    const handler = vi.fn();
    broadcast.subscribe('ws-a', handler);

    const event = makeEvent();
    broadcast.publish(event);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('does not deliver events to subscribers of a different workspace', () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    broadcast.subscribe('ws-a', handlerA);
    broadcast.subscribe('ws-b', handlerB);

    broadcast.publish(makeEvent({ workspaceId: 'ws-a' }));

    expect(handlerA).toHaveBeenCalledOnce();
    expect(handlerB).not.toHaveBeenCalled();
  });

  it('unsubscribes correctly and stops delivering events', () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    const handler = vi.fn();
    const unsubscribe = broadcast.subscribe('ws-a', handler);

    unsubscribe();
    broadcast.publish(makeEvent());

    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers for the same workspace', () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    broadcast.subscribe('ws-a', handler1);
    broadcast.subscribe('ws-a', handler2);

    broadcast.publish(makeEvent());

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('does not throw when publishing to workspace with no subscribers', () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    expect(() => broadcast.publish(makeEvent({ workspaceId: 'no-subs' }))).not.toThrow();
  });

  it('tracks subscriberCount correctly', () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    expect(broadcast.subscriberCount).toBe(0);

    const unsubscribe1 = broadcast.subscribe('ws-a', vi.fn());
    const unsubscribe2 = broadcast.subscribe('ws-a', vi.fn());
    const unsubscribe3 = broadcast.subscribe('ws-b', vi.fn());
    expect(broadcast.subscriberCount).toBe(3);

    unsubscribe1();
    expect(broadcast.subscriberCount).toBe(2);

    unsubscribe2();
    unsubscribe3();
    expect(broadcast.subscriberCount).toBe(0);
  });

  it('isolates subscriber errors from other subscribers', () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    const throwing = vi.fn().mockImplementation(() => {
      throw new Error('subscriber error');
    });
    const healthy = vi.fn();
    broadcast.subscribe('ws-a', throwing);
    broadcast.subscribe('ws-a', healthy);

    broadcast.publish(makeEvent());

    expect(healthy).toHaveBeenCalledOnce();
  });
});
