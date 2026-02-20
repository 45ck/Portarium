import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

import { describe, expect, it } from 'vitest';

import type {
  ActionId,
  AgentId,
  CorrelationId,
  MachineId,
  RunId,
  TenantId,
} from '../../domain/primitives/index.js';
import { OpenClawGatewayMachineInvoker } from './openclaw-gateway-machine-invoker.js';

type StubResponse = Readonly<{
  status: number;
  headers?: Readonly<Record<string, string>>;
  body: unknown;
}>;

type CapturedRequest = Readonly<{
  method: string;
  path: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  bodyText: string;
}>;

type GatewayStub = Readonly<{
  baseUrl: string;
  requests: readonly CapturedRequest[];
  close: () => Promise<void>;
}>;

const BASE_RUN_AGENT_INPUT = {
  tenantId: 'tenant-int-1' as TenantId,
  runId: 'run-int-1' as RunId,
  actionId: 'action-int-1' as ActionId,
  correlationId: 'corr-int-1' as CorrelationId,
  machineId: 'machine-int-1' as MachineId,
  agentId: 'agent-int-1' as AgentId,
  prompt: 'Summarize this deterministic fixture.',
};

const BASE_INVOKE_TOOL_INPUT = {
  tenantId: 'tenant-int-1' as TenantId,
  runId: 'run-int-2' as RunId,
  actionId: 'action-int-2' as ActionId,
  correlationId: 'corr-int-2' as CorrelationId,
  machineId: 'machine-int-1' as MachineId,
  toolName: 'read:file',
  parameters: { path: '/tmp/data.json' },
  policyTier: 'Auto' as const,
};

describe('OpenClawGatewayMachineInvoker integration', () => {
  it('captures agent output and includes correlation metadata for evidence linkage', async () => {
    const responseFixture = await loadFixture('run-agent.success.json');
    const gateway = await startGatewayStub({
      '/v1/responses': [{ status: 200, body: responseFixture }],
    });

    try {
      const invoker = new OpenClawGatewayMachineInvoker({
        baseUrl: gateway.baseUrl,
        resolveBearerToken: async () => 'vault-token-int',
      });

      const result = await invoker.runAgent(BASE_RUN_AGENT_INPUT);

      expect(result).toEqual({ ok: true, output: responseFixture });
      expect(gateway.requests).toHaveLength(1);
      const request = gateway.requests[0];
      if (!request) throw new Error('Expected one gateway request.');
      expect(request.path).toBe('/v1/responses');
      expect(header(request.headers, 'authorization')).toBe('Bearer vault-token-int');

      const parsedRequest = JSON.parse(request.bodyText) as {
        model: string;
        metadata: {
          tenantId: string;
          runId: string;
          actionId: string;
          correlationId: string;
        };
      };
      expect(parsedRequest.model).toBe('openclaw:agent-int-1');
      expect(parsedRequest.metadata).toEqual({
        tenantId: 'tenant-int-1',
        runId: 'run-int-1',
        actionId: 'action-int-1',
        correlationId: 'corr-int-1',
      });
    } finally {
      await gateway.close();
    }
  });

  it('respects Retry-After for 429 and retries with deterministic fixture response', async () => {
    const responseFixture = await loadFixture('invoke-tool.success.json');
    const gateway = await startGatewayStub({
      '/tools/invoke': [
        {
          status: 429,
          headers: { 'retry-after': '1' },
          body: { error: 'rate_limited' },
        },
        { status: 200, body: responseFixture },
      ],
    });
    const sleepCalls: number[] = [];

    try {
      const invoker = new OpenClawGatewayMachineInvoker({
        baseUrl: gateway.baseUrl,
        resolveBearerToken: async () => 'vault-token-int',
        retry: { maxAttempts: 2, initialBackoffMs: 10 },
        sleep: async (ms) => {
          sleepCalls.push(ms);
        },
      });

      const result = await invoker.invokeTool(BASE_INVOKE_TOOL_INPUT);

      expect(result).toEqual({ ok: true, output: responseFixture });
      expect(sleepCalls).toEqual([1_000]);
      expect(gateway.requests.filter((request) => request.path === '/tools/invoke')).toHaveLength(
        2,
      );
    } finally {
      await gateway.close();
    }
  });

  it('returns PolicyBlocked for dangerous tools without dispatching HTTP calls', async () => {
    const gateway = await startGatewayStub({});

    try {
      const invoker = new OpenClawGatewayMachineInvoker({
        baseUrl: gateway.baseUrl,
        resolveBearerToken: async () => 'vault-token-int',
      });

      const result = await invoker.invokeTool({
        ...BASE_INVOKE_TOOL_INPUT,
        toolName: 'shell.exec',
      });

      expect(result).toEqual({
        ok: false,
        errorKind: 'PolicyDenied',
        runState: 'PolicyBlocked',
        message: 'Policy blocked tool "shell.exec" for tier "Auto"; requires "ManualOnly".',
      });
      expect(gateway.requests).toHaveLength(0);
    } finally {
      await gateway.close();
    }
  });

  it('forwards dry-run mode and session key on /tools/invoke requests', async () => {
    const responseFixture = await loadFixture('invoke-tool.success.json');
    const gateway = await startGatewayStub({
      '/tools/invoke': [{ status: 200, body: responseFixture }],
    });

    try {
      const invoker = new OpenClawGatewayMachineInvoker({
        baseUrl: gateway.baseUrl,
        resolveBearerToken: async () => 'vault-token-int',
      });

      const result = await invoker.invokeTool({
        ...BASE_INVOKE_TOOL_INPUT,
        sessionKey: 'session-int-42',
        dryRun: true,
      });

      expect(result).toEqual({ ok: true, output: responseFixture });
      expect(gateway.requests).toHaveLength(1);
      const request = gateway.requests[0];
      if (!request) throw new Error('Expected one gateway request.');
      expect(header(request.headers, 'x-openclaw-session-key')).toBe('session-int-42');

      const parsedBody = JSON.parse(request.bodyText) as {
        dryRun: boolean;
        metadata: { dryRun: boolean; sessionKey: string };
      };
      expect(parsedBody.dryRun).toBe(true);
      expect(parsedBody.metadata.dryRun).toBe(true);
      expect(parsedBody.metadata.sessionKey).toBe('session-int-42');
    } finally {
      await gateway.close();
    }
  });
});

async function startGatewayStub(
  responsesByPath: Readonly<Record<string, readonly StubResponse[]>>,
): Promise<GatewayStub> {
  const requestLog: CapturedRequest[] = [];
  const responseState = new Map<string, StubResponse[]>(
    Object.entries(responsesByPath).map(([path, responses]) => [path, [...responses]]),
  );

  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    request.on('end', () => {
      const path = request.url ?? '/';
      requestLog.push({
        method: request.method ?? '',
        path,
        headers: request.headers,
        bodyText: Buffer.concat(chunks).toString('utf8'),
      });

      const queue = responseState.get(path) ?? [];
      const next = queue.shift();
      responseState.set(path, queue);

      if (!next) {
        response.statusCode = 404;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ error: 'no_stub_response' }));
        return;
      }

      response.statusCode = next.status;
      response.setHeader('content-type', 'application/json');
      for (const [name, value] of Object.entries(next.headers ?? {})) {
        response.setHeader(name, value);
      }
      response.end(JSON.stringify(next.body));
    });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Unable to resolve gateway stub address.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests: requestLog,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

async function loadFixture(fileName: string): Promise<unknown> {
  const fixtureUrl = new URL(`../../../test/fixtures/openclaw/${fileName}`, import.meta.url);
  const raw = await readFile(fixtureUrl, 'utf8');
  return JSON.parse(raw) as unknown;
}

function header(
  headers: Readonly<Record<string, string | string[] | undefined>>,
  name: string,
): string | undefined {
  const value = headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
}
