/**
 * Core eval: deterministic agent governance loop.
 *
 * This is the OSS-safe eval for the core product promise:
 * a simulated agent attempts a safe action and a governed action, policy
 * creates an approval, the live event stream surfaces the request, a human
 * decision is recorded, and the agent can continue with the approval id.
 *
 * No live LLM keys are required.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type JsonObject = Record<string, unknown>;

type CapturedSseEvent = Readonly<{
  type: string;
  data: JsonObject;
}>;

let proxyUrl: string;
let closeProxy: () => void;

beforeAll(async () => {
  // @ts-expect-error -- untyped .mjs demo module
  const proxyMod = await import('../demo/portarium-tool-proxy.mjs');
  const handle = await proxyMod.startPolicyProxy(0);
  proxyUrl = handle.url;
  closeProxy = handle.close;
});

afterAll(() => {
  closeProxy?.();
});

async function invokeToolRaw(
  toolName: string,
  parameters: Record<string, unknown> = {},
  opts: { policyTier?: string; approvalId?: string } = {},
) {
  const body: Record<string, unknown> = {
    toolName,
    parameters,
    policyTier: opts.policyTier ?? 'Auto',
  };
  if (opts.approvalId) body['approvalId'] = opts.approvalId;

  const resp = await fetch(`${proxyUrl}/tools/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: resp.status, body: (await resp.json()) as JsonObject };
}

async function submitDecision(approvalId: string, decision: 'approved' | 'denied') {
  const resp = await fetch(`${proxyUrl}/approvals/${approvalId}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
  return { status: resp.status, body: (await resp.json()) as JsonObject };
}

async function executeApproval(approvalId: string) {
  const resp = await fetch(`${proxyUrl}/approvals/${approvalId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return { status: resp.status, body: (await resp.json()) as JsonObject };
}

async function startEventCapture(url: string) {
  const controller = new AbortController();
  const response = await fetch(url, {
    headers: { Accept: 'text/event-stream' },
    signal: controller.signal,
  });
  expect(response.status).toBe(200);
  expect(response.body).toBeTruthy();

  const events: CapturedSseEvent[] = [];
  const waiters: {
    type: string;
    resolve: (event: CapturedSseEvent) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }[] = [];

  function dispatchFrame(frame: string) {
    let type = '';
    const dataLines: string[] = [];

    for (const rawLine of frame.split('\n')) {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
      if (line.startsWith(':') || line.trim() === '') continue;
      if (line.startsWith('event:')) type = line.slice('event:'.length).trim();
      if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim());
    }

    if (!type) return;
    const data = JSON.parse(dataLines.join('\n') || '{}') as JsonObject;
    const event = { type, data };
    events.push(event);

    for (const waiter of [...waiters]) {
      if (waiter.type !== type) continue;
      clearTimeout(waiter.timer);
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(event);
    }
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const pump = (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\n\n|\r\n\r\n/);
        buffer = frames.pop() ?? '';
        for (const frame of frames) dispatchFrame(frame);
      }
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    }
  })();

  return {
    events,
    waitForEvent(type: string, timeoutMs = 3_000): Promise<CapturedSseEvent> {
      const existing = events.find((event) => event.type === type);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const waiter = waiters.find((item) => item.type === type && item.resolve === resolve);
          if (waiter) waiters.splice(waiters.indexOf(waiter), 1);
          reject(new Error(`Timed out waiting for SSE event ${type}`));
        }, timeoutMs);
        waiters.push({ type, resolve, reject, timer });
      });
    },
    async close() {
      controller.abort();
      await reader.cancel().catch(() => undefined);
      await pump.catch(() => undefined);
      for (const waiter of waiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error('Event capture closed'));
      }
    },
  };
}

describe('Core eval -- simulated agent approval governance loop', { timeout: 15_000 }, () => {
  it('gates a governed action, streams the approval, records a decision, and resumes', async () => {
    const stream = await startEventCapture(`${proxyUrl}/v1/workspaces/ws-proxy-demo/events:stream`);

    try {
      const safe = await invokeToolRaw('read:file', { path: 'README.md' });
      expect(safe.status).toBe(200);
      expect(safe.body['decision']).toBe('Allow');
      expect(safe.body['allowed']).toBe(true);

      const requestedEvent = stream.waitForEvent('com.portarium.approval.ApprovalRequested');
      const governed = await invokeToolRaw('write:file', {
        path: 'core-eval-output.txt',
        content: 'agent-generated content',
      });

      expect(governed.status).toBe(202);
      expect(governed.body['status']).toBe('awaiting_approval');
      expect(governed.body['minimumTier']).toBe('HumanApprove');
      const approvalId = governed.body['approvalId'];
      expect(typeof approvalId).toBe('string');

      const requested = await requestedEvent;
      expect(requested.data['type']).toBe('com.portarium.approval.ApprovalRequested');
      expect((requested.data['data'] as JsonObject)['approvalId']).toBe(approvalId);

      const grantedEvent = stream.waitForEvent('com.portarium.approval.ApprovalGranted');
      const decision = await submitDecision(approvalId as string, 'approved');
      expect(decision.status).toBe(200);
      expect(decision.body['status']).toBe('approved');

      const granted = await grantedEvent;
      expect(granted.data['type']).toBe('com.portarium.approval.ApprovalGranted');
      expect((granted.data['data'] as JsonObject)['approvalId']).toBe(approvalId);

      const resumed = await invokeToolRaw(
        'write:file',
        { path: 'core-eval-output.txt', content: 'agent-generated content' },
        { approvalId: approvalId as string },
      );
      expect(resumed.status).toBe(200);
      expect(resumed.body['approvedByHuman']).toBe(true);
      expect(resumed.body['decision']).toBe('Allow');

      const executed = await executeApproval(approvalId as string);
      expect(executed.status).toBe(200);
      expect(executed.body['status']).toBe('Executed');
    } finally {
      await stream.close();
    }
  });
});
