/**
 * Contract tests for the workspace-scoped SSE event stream endpoint.
 * GET /v1/workspaces/:workspaceId/events:stream
 */

import { afterEach, describe, expect, it } from 'vitest';
import { ok } from '../../application/common/result.js';
import { toAppContext } from '../../application/common/context.js';
import { InMemoryEventStreamBroadcast } from '../../infrastructure/event-streaming/in-memory-event-stream-broadcast.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import { startHealthServer, type HealthServerHandle } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

function makeCtx() {
  return toAppContext({
    tenantId: 'ws-test',
    principalId: 'user-1',
    roles: ['admin' as const],
    correlationId: 'corr-1',
  });
}

type HandlerDeps = Parameters<typeof createControlPlaneHandler>[0];

function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    authentication: {
      authenticateBearerToken: async () => ok(makeCtx()),
    },
    authorization: { isAllowed: async () => true },
    workspaceStore: {
      getWorkspaceById: async () => null,
      getWorkspaceByName: async () => null,
      saveWorkspace: async () => undefined,
    },
    runStore: {
      getRunById: async () => null,
      saveRun: async () => undefined,
    },
    ...overrides,
  };
}

async function startWith(deps: HandlerDeps): Promise<string> {
  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(deps),
  });
  return `http://127.0.0.1:${handle.port}`;
}

/** Read SSE chunks until predicate matches or timeout. AbortErrors are swallowed. */
async function readSseUntil(
  body: ReadableStream<Uint8Array>,
  predicate: (text: string) => boolean,
  timeoutMs = 1000,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let received = '';
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      received += decoder.decode(value, { stream: true });
      if (predicate(received)) break;
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') throw err;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return received;
}

describe('GET /v1/workspaces/:workspaceId/events:stream', () => {
  it('returns 503 when eventStream is not in deps', async () => {
    const base = await startWith(makeDeps());
    const res = await fetch(`${base}/v1/workspaces/ws-test/events:stream`, {
      headers: { authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(503);
  });

  it('returns 401 when authentication fails', async () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    const base = await startWith(
      makeDeps({
        eventStream: broadcast,
        authentication: {
          authenticateBearerToken: async () => ({
            ok: false as const,
            error: { kind: 'Unauthorized' as const, message: 'No token' },
          }),
        },
      }),
    );
    const res = await fetch(`${base}/v1/workspaces/ws-test/events:stream`);
    expect(res.status).toBe(401);
  });

  it('returns text/event-stream content-type on successful connection', async () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    const base = await startWith(makeDeps({ eventStream: broadcast }));

    const ac = new AbortController();
    let res: Response;
    try {
      res = await fetch(`${base}/v1/workspaces/ws-test/events:stream`, {
        headers: { authorization: 'Bearer test-token' },
        signal: ac.signal,
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
    } finally {
      ac.abort();
    }
  });

  it('streams published events to connected client', async () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    const base = await startWith(makeDeps({ eventStream: broadcast }));

    const ac = new AbortController();
    let received = '';
    try {
      const res = await fetch(`${base}/v1/workspaces/ws-test/events:stream`, {
        headers: { authorization: 'Bearer test-token' },
        signal: ac.signal,
      });
      expect(res.status).toBe(200);

      // Give the subscription a tick to establish before publishing
      await new Promise((r) => setTimeout(r, 20));

      broadcast.publish({
        type: 'com.portarium.run.RunStarted',
        id: 'evt-run-1',
        workspaceId: 'ws-test',
        time: '2026-01-01T00:00:00.000Z',
        data: { runId: 'run-99' },
      });

      received = await readSseUntil(res.body!, (t) => t.includes('RunStarted'));
    } finally {
      ac.abort();
    }

    expect(received).toContain('event: com.portarium.run.RunStarted');
    expect(received).toContain('id: evt-run-1');
    expect(received).toContain('"runId":"run-99"');
  });

  it('does not stream events for a different workspace', async () => {
    const broadcast = new InMemoryEventStreamBroadcast();
    const base = await startWith(makeDeps({ eventStream: broadcast }));

    const ac = new AbortController();
    let received = '';
    try {
      const res = await fetch(`${base}/v1/workspaces/ws-test/events:stream`, {
        headers: { authorization: 'Bearer test-token' },
        signal: ac.signal,
      });

      await new Promise((r) => setTimeout(r, 20));

      // Publish to a DIFFERENT workspace — must not arrive
      broadcast.publish({
        type: 'com.portarium.run.RunStarted',
        id: 'evt-other',
        workspaceId: 'ws-OTHER',
        time: '2026-01-01T00:00:00.000Z',
      });

      // Sentinel to the CORRECT workspace so we know the stream is live
      await new Promise((r) => setTimeout(r, 20));
      broadcast.publish({
        type: 'com.portarium.sentinel',
        id: 'evt-sentinel',
        workspaceId: 'ws-test',
        time: '2026-01-01T00:00:00.000Z',
      });

      received = await readSseUntil(res.body!, (t) => t.includes('sentinel'));
    } finally {
      ac.abort();
    }

    expect(received).not.toContain('evt-other');
    expect(received).toContain('evt-sentinel');
  });
});
