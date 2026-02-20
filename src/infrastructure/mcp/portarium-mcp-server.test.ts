import { describe, expect, it, vi } from 'vitest';

import {
  PortariumMcpServer,
  type JsonRpcResponse,
  type PortariumClient,
} from './portarium-mcp-server.js';

// ---------------------------------------------------------------------------
// Stub client
// ---------------------------------------------------------------------------

function makeStubClient(overrides?: Partial<PortariumClient>): PortariumClient {
  return {
    startRun: vi.fn().mockResolvedValue({ runId: 'run-1', status: 'running' }),
    getRun: vi.fn().mockResolvedValue({ runId: 'run-1', status: 'completed' }),
    cancelRun: vi.fn().mockResolvedValue({ cancelled: true }),
    listWorkItems: vi.fn().mockResolvedValue({ items: [] }),
    submitApproval: vi.fn().mockResolvedValue({ accepted: true }),
    registerAgent: vi.fn().mockResolvedValue({ registered: true }),
    agentHeartbeat: vi.fn().mockResolvedValue({ ack: true }),
    ...overrides,
  };
}

function asResult(response: JsonRpcResponse): unknown {
  if ('result' in response) return response.result;
  return undefined;
}

function asError(response: JsonRpcResponse): { code: number; message: string } | undefined {
  if ('error' in response) return response.error;
  return undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PortariumMcpServer', () => {
  describe('initialize', () => {
    it('returns server info and capabilities', async () => {
      const server = new PortariumMcpServer(makeStubClient());
      const res = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      });

      const result = asResult(res) as Record<string, unknown>;
      expect(result).toBeDefined();
      expect(result['protocolVersion']).toBe('2024-11-05');
      expect(result['serverInfo']).toHaveProperty('name', 'portarium-mcp-server');
    });
  });

  describe('tools/list', () => {
    it('returns all 7 tools', async () => {
      const server = new PortariumMcpServer(makeStubClient());
      const res = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });

      const result = asResult(res) as { tools: unknown[] };
      expect(result.tools).toHaveLength(7);
    });

    it('filters tools when allowedTools is set', async () => {
      const server = new PortariumMcpServer(makeStubClient(), {
        allowedTools: new Set(['portarium_run_get', 'portarium_run_start']),
      });
      const res = await server.handleRequest({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
      });

      const result = asResult(res) as { tools: { name: string }[] };
      expect(result.tools).toHaveLength(2);
      expect(result.tools.map((t) => t.name).sort()).toEqual([
        'portarium_run_get',
        'portarium_run_start',
      ]);
    });
  });

  describe('tools/call', () => {
    it('dispatches portarium_run_start to client.startRun', async () => {
      const client = makeStubClient();
      const server = new PortariumMcpServer(client);
      const res = await server.handleRequest({
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'portarium_run_start',
          arguments: { workspaceId: 'ws-1', workflowId: 'wf-1', input: { key: 'val' } },
        },
      });

      expect(asError(res)).toBeUndefined();
      expect(client.startRun).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        workflowId: 'wf-1',
        input: { key: 'val' },
      });
    });

    it('dispatches portarium_run_get to client.getRun', async () => {
      const client = makeStubClient();
      const server = new PortariumMcpServer(client);
      await server.handleRequest({
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'portarium_run_get',
          arguments: { workspaceId: 'ws-1', runId: 'run-1' },
        },
      });

      expect(client.getRun).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        runId: 'run-1',
      });
    });

    it('dispatches portarium_approval_submit to client.submitApproval', async () => {
      const client = makeStubClient();
      const server = new PortariumMcpServer(client);
      await server.handleRequest({
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'portarium_approval_submit',
          arguments: {
            workspaceId: 'ws-1',
            approvalId: 'apr-1',
            decision: 'Approved',
            comment: 'LGTM',
          },
        },
      });

      expect(client.submitApproval).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        approvalId: 'apr-1',
        decision: 'Approved',
        comment: 'LGTM',
      });
    });

    it('dispatches portarium_agent_heartbeat to client.agentHeartbeat', async () => {
      const client = makeStubClient();
      const server = new PortariumMcpServer(client);
      await server.handleRequest({
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
          name: 'portarium_agent_heartbeat',
          arguments: {
            workspaceId: 'ws-1',
            machineId: 'm-1',
            agentId: 'a-1',
            status: 'healthy',
          },
        },
      });

      expect(client.agentHeartbeat).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        machineId: 'm-1',
        agentId: 'a-1',
        status: 'healthy',
      });
    });

    it('returns error for unknown tool', async () => {
      const server = new PortariumMcpServer(makeStubClient());
      const res = await server.handleRequest({
        jsonrpc: '2.0',
        id: 20,
        method: 'tools/call',
        params: { name: 'nonexistent_tool', arguments: {} },
      });

      const err = asError(res);
      expect(err).toBeDefined();
      expect(err!.code).toBe(-32601);
    });

    it('returns error for missing required parameter', async () => {
      const server = new PortariumMcpServer(makeStubClient());
      const res = await server.handleRequest({
        jsonrpc: '2.0',
        id: 21,
        method: 'tools/call',
        params: { name: 'portarium_run_start', arguments: { workspaceId: 'ws-1' } },
      });

      const err = asError(res);
      expect(err).toBeDefined();
      expect(err!.code).toBe(-32603);
      expect(err!.message).toContain('workflowId');
    });

    it('returns error when tool is filtered by allowedTools', async () => {
      const server = new PortariumMcpServer(makeStubClient(), {
        allowedTools: new Set(['portarium_run_get']),
      });
      const res = await server.handleRequest({
        jsonrpc: '2.0',
        id: 22,
        method: 'tools/call',
        params: {
          name: 'portarium_run_start',
          arguments: { workspaceId: 'ws-1', workflowId: 'wf-1' },
        },
      });

      const err = asError(res);
      expect(err).toBeDefined();
      expect(err!.message).toContain('not available');
    });

    it('returns internal error when client throws', async () => {
      const client = makeStubClient({
        startRun: vi.fn().mockRejectedValue(new Error('connection refused')),
      });
      const server = new PortariumMcpServer(client);
      const res = await server.handleRequest({
        jsonrpc: '2.0',
        id: 30,
        method: 'tools/call',
        params: {
          name: 'portarium_run_start',
          arguments: { workspaceId: 'ws-1', workflowId: 'wf-1' },
        },
      });

      const err = asError(res);
      expect(err).toBeDefined();
      expect(err!.code).toBe(-32603);
      expect(err!.message).toContain('connection refused');
    });
  });

  describe('JSON-RPC validation', () => {
    it('rejects non-object input', async () => {
      const server = new PortariumMcpServer(makeStubClient());
      const res = await server.handleRequest('not an object');
      expect(asError(res)!.code).toBe(-32700);
    });

    it('rejects missing jsonrpc version', async () => {
      const server = new PortariumMcpServer(makeStubClient());
      const res = await server.handleRequest({ id: 1, method: 'initialize' });
      expect(asError(res)!.code).toBe(-32600);
    });

    it('rejects unknown method', async () => {
      const server = new PortariumMcpServer(makeStubClient());
      const res = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'unknown/method',
      });
      expect(asError(res)!.code).toBe(-32601);
    });
  });
});
