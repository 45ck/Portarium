// @vitest-environment jsdom

import React from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  normalizeBeadThreadFrame,
  parseSseFrames,
  useBeadThreadStream,
} from './use-bead-thread-stream';

type StreamHarness = {
  response: Response;
  write: (text: string) => void;
  close: () => void;
};

function makeStreamResponse(): StreamHarness {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

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
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('parseSseFrames', () => {
  it('parses event, id, and multi-line JSON data', () => {
    const frames = parseSseFrames(
      'event: com.portarium.agent.AgentActionProposed\nid: evt-1\ndata: {"toolName":"git:diff",\ndata: "toolCallId":"tc-1"}\n\n',
    );

    expect(frames).toEqual([
      {
        event: 'com.portarium.agent.AgentActionProposed',
        id: 'evt-1',
        data: { toolName: 'git:diff', toolCallId: 'tc-1' },
      },
    ]);
  });

  it('ignores heartbeat comments', () => {
    expect(parseSseFrames(': heartbeat\n\n')).toEqual([]);
  });
});

describe('normalizeBeadThreadFrame', () => {
  it('normalizes approval requested payloads into awaiting approval entries', () => {
    const entry = normalizeBeadThreadFrame({
      event: 'com.portarium.approval.ApprovalRequested',
      id: 'evt-1',
      data: {
        approvalId: 'appr-1',
        proposalId: 'prop-1',
        toolName: 'git:push',
        args: { remote: 'origin' },
        blastRadiusTier: 'HumanApprove',
        policyRule: { ruleId: 'INFRA-WRITE-002', tier: 'HumanApprove', blastRadius: ['main'] },
        prompt: 'Review push to main',
      },
    });

    expect(entry).toMatchObject({
      id: 'prop-1',
      toolName: 'git:push',
      status: 'awaiting_approval',
      policyTier: 'HumanApprove',
      blastRadius: 'medium',
      approvalId: 'appr-1',
      policyRuleId: 'INFRA-WRITE-002',
      message: 'Review push to main',
    });
  });
});

describe('useBeadThreadStream', () => {
  it('hydrates a thread snapshot and connects to the bead SSE endpoint', async () => {
    const stream = makeStreamResponse();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                toolCallId: 'tc-read',
                toolName: 'read_file',
                status: 'success',
                policyTier: 'Auto',
                blastRadius: 'low',
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(stream.response);

    const { result } = renderHook(() => useBeadThreadStream('workspace 1', 'bead-0975'));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
      '/v1/workspaces/workspace%201/beads/bead-0975/thread',
    );
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe(
      '/v1/workspaces/workspace%201/beads/bead-0975/events',
    );

    await waitFor(() => expect(result.current.entries[0]?.toolName).toBe('read_file'));
    expect(result.current.status).toBe('open');
  });

  it('merges live SSE frames into the existing tool-call feed', async () => {
    const stream = makeStreamResponse();
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(stream.response);

    const { result } = renderHook(() => useBeadThreadStream('ws-1', 'bead-0975'));
    await waitFor(() => expect(result.current.status).toBe('open'));

    stream.write(
      'event: com.portarium.agent.AgentActionProposed\nid: evt-1\ndata: {"toolCallId":"tc-1","toolName":"run_tests","args":{"command":"npm test"},"policyTier":"Auto","blastRadius":"low"}\n\n',
    );

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0]).toMatchObject({
        id: 'tc-1',
        toolName: 'run_tests',
        status: 'pending',
      });
      expect(result.current.lastEventId).toBe('evt-1');
    });

    stream.write(
      'event: com.portarium.agent.AgentActionExecuted\nid: evt-2\ndata: {"toolCallId":"tc-1","status":"success"}\n\n',
    );

    await waitFor(() => expect(result.current.entries[0]?.status).toBe('success'));
    expect(result.current.entries).toHaveLength(1);
  });

  it('is idle without identifiers', () => {
    const { result } = renderHook(() => useBeadThreadStream('', ''));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });
});
