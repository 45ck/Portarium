import { describe, expect, it, vi } from 'vitest';

import type {
  ActionId,
  AgentId,
  CorrelationId,
  MachineId,
  RunId,
  TenantId,
} from '../../domain/primitives/index.js';
import { OpenClawGatewayMachineInvoker } from './openclaw-gateway-machine-invoker.js';

const BASE_RUN_AGENT_INPUT = {
  tenantId: 'tenant-1' as TenantId,
  runId: 'run-1' as RunId,
  actionId: 'action-1' as ActionId,
  correlationId: 'corr-1' as CorrelationId,
  machineId: 'machine-1' as MachineId,
  agentId: 'agent-1' as AgentId,
  prompt: 'Hello from test',
};

const BASE_INVOKE_TOOL_INPUT = {
  tenantId: 'tenant-1' as TenantId,
  runId: 'run-1' as RunId,
  actionId: 'action-2' as ActionId,
  correlationId: 'corr-2' as CorrelationId,
  machineId: 'machine-1' as MachineId,
  toolName: 'read:file',
  parameters: { path: '/tmp/data.json' },
};

describe('OpenClawGatewayMachineInvoker', () => {
  it('posts to /v1/responses with model openclaw:<agentId>', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ id: 'resp-1', output: 'ok' }), { status: 200 }),
    );
    const resolveBearerToken = vi.fn(async () => 'vault-token');
    const invoker = new OpenClawGatewayMachineInvoker({
      baseUrl: 'https://gateway.example/',
      resolveBearerToken,
      fetchImpl,
    });

    const result = await invoker.runAgent(BASE_RUN_AGENT_INPUT);

    expect(result).toEqual({
      ok: true,
      output: { id: 'resp-1', output: 'ok' },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://gateway.example/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer vault-token',
          'content-type': 'application/json',
        }),
      }),
    );
    const requestBody = fetchImpl.mock.calls[0]?.[1]?.body;
    if (typeof requestBody !== 'string') {
      throw new Error('Expected request body to be a JSON string.');
    }
    const parsedBody = JSON.parse(requestBody) as {
      model: string;
      input: string;
      metadata: { tenantId: string; runId: string; actionId: string; correlationId: string };
    };
    expect(parsedBody.model).toBe('openclaw:agent-1');
    expect(parsedBody.input).toBe('Hello from test');
    expect(parsedBody.metadata.tenantId).toBe('tenant-1');
    expect(resolveBearerToken).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      machineId: 'machine-1',
    });
  });

  it('returns Unauthorized when bearer token cannot be resolved', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const invoker = new OpenClawGatewayMachineInvoker({
      baseUrl: 'https://gateway.example',
      resolveBearerToken: async () => undefined,
      fetchImpl,
    });

    const result = await invoker.runAgent(BASE_RUN_AGENT_INPUT);

    expect(result).toEqual({
      ok: false,
      errorKind: 'Unauthorized',
      message: 'Missing bearer-token credential for machine invocation.',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns RemoteError for non-retryable 4xx responses', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('bad request', { status: 400 }));
    const invoker = new OpenClawGatewayMachineInvoker({
      baseUrl: 'https://gateway.example',
      resolveBearerToken: async () => 'vault-token',
      fetchImpl,
    });

    const result = await invoker.runAgent(BASE_RUN_AGENT_INPUT);

    expect(result).toEqual({
      ok: false,
      errorKind: 'RemoteError',
      message: 'Gateway rejected the request with status 400.',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries 5xx responses with exponential backoff and succeeds', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('first failure', { status: 503 }))
      .mockResolvedValueOnce(new Response('second failure', { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'resp-2' }), { status: 200 }));
    const sleepCalls: number[] = [];

    const invoker = new OpenClawGatewayMachineInvoker({
      baseUrl: 'https://gateway.example',
      resolveBearerToken: async () => 'vault-token',
      fetchImpl,
      retry: {
        maxAttempts: 3,
        initialBackoffMs: 20,
        maxBackoffMs: 200,
        backoffMultiplier: 2,
      },
      sleep: async (ms) => {
        sleepCalls.push(ms);
      },
    });

    const result = await invoker.runAgent(BASE_RUN_AGENT_INPUT);

    expect(result).toEqual({
      ok: true,
      output: { id: 'resp-2' },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleepCalls).toEqual([20, 40]);
  });

  it('returns Timeout when request exceeds configured timeout', async () => {
    const fetchImpl = vi.fn<typeof fetch>((_input, init) => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
          once: true,
        });
      });
    });

    const invoker = new OpenClawGatewayMachineInvoker({
      baseUrl: 'https://gateway.example',
      resolveBearerToken: async () => 'vault-token',
      fetchImpl,
      requestTimeoutMs: 5,
      retry: { maxAttempts: 1 },
    });

    const result = await invoker.runAgent(BASE_RUN_AGENT_INPUT);

    expect(result).toEqual({
      ok: false,
      errorKind: 'Timeout',
      message: 'Gateway request timed out.',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('policy-blocks dangerous tools before dispatch and surfaces PolicyBlocked run state', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const invoker = new OpenClawGatewayMachineInvoker({
      baseUrl: 'https://gateway.example',
      resolveBearerToken: async () => 'vault-token',
      fetchImpl,
    });

    const result = await invoker.invokeTool({
      ...BASE_INVOKE_TOOL_INPUT,
      toolName: 'shell.exec',
      policyTier: 'Auto',
    });

    expect(result).toEqual({
      ok: false,
      errorKind: 'PolicyDenied',
      runState: 'PolicyBlocked',
      message: 'Policy blocked tool "shell.exec" for tier "Auto"; requires "ManualOnly".',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('routes invokeTool with session key header and dry-run payload', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ accepted: true }), { status: 200 }),
    );
    const invoker = new OpenClawGatewayMachineInvoker({
      baseUrl: 'https://gateway.example',
      resolveBearerToken: async () => 'vault-token',
      fetchImpl,
    });

    const result = await invoker.invokeTool({
      ...BASE_INVOKE_TOOL_INPUT,
      sessionKey: 'session-42',
      dryRun: true,
      policyTier: 'Auto',
    });

    expect(result).toEqual({
      ok: true,
      output: { accepted: true },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://gateway.example/tools/invoke',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-openclaw-session-key': 'session-42',
        }),
      }),
    );
    const requestBody = fetchImpl.mock.calls[0]?.[1]?.body;
    if (typeof requestBody !== 'string') {
      throw new Error('Expected invokeTool request body to be a JSON string.');
    }
    const parsedBody = JSON.parse(requestBody) as {
      dryRun: boolean;
      metadata: { sessionKey: string; dryRun: boolean };
    };
    expect(parsedBody.dryRun).toBe(true);
    expect(parsedBody.metadata.sessionKey).toBe('session-42');
    expect(parsedBody.metadata.dryRun).toBe(true);
  });

  it('respects Retry-After header on 429 responses', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('rate limited', {
          status: 429,
          headers: { 'retry-after': '2' },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ accepted: true }), { status: 200 }));
    const sleepCalls: number[] = [];

    const invoker = new OpenClawGatewayMachineInvoker({
      baseUrl: 'https://gateway.example',
      resolveBearerToken: async () => 'vault-token',
      fetchImpl,
      retry: { maxAttempts: 2, initialBackoffMs: 100 },
      sleep: async (ms) => {
        sleepCalls.push(ms);
      },
    });

    const result = await invoker.invokeTool({
      ...BASE_INVOKE_TOOL_INPUT,
      policyTier: 'Auto',
    });

    expect(result).toEqual({
      ok: true,
      output: { accepted: true },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleepCalls).toEqual([2_000]);
  });
});
