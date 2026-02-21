/**
 * Portarium MCP (Model Context Protocol) server.
 *
 * Exposes Portarium control-plane operations as MCP tools using JSON-RPC 2.0
 * semantics. Each tool maps to a PortariumClient method.
 *
 * Transport-agnostic: callers pass JSON-RPC request objects and receive
 * JSON-RPC response objects. HTTP/SSE/stdio transport is wired externally.
 */

import { MCP_TOOLS, findToolSchema, type McpToolSchema } from './mcp-tool-schemas.js';

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 types
// ---------------------------------------------------------------------------

export type JsonRpcRequest = Readonly<{
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}>;

export type JsonRpcResponse =
  | Readonly<{ jsonrpc: '2.0'; id: string | number; result: unknown }>
  | Readonly<{
      jsonrpc: '2.0';
      id: string | number | null;
      error: JsonRpcError;
    }>;

export type JsonRpcError = Readonly<{
  code: number;
  message: string;
  data?: unknown;
}>;

// Standard JSON-RPC error codes
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

// ---------------------------------------------------------------------------
// PortariumClient interface (adapter boundary)
// ---------------------------------------------------------------------------

export interface PortariumClient {
  startRun(params: {
    workspaceId: string;
    workflowId: string;
    input?: Record<string, unknown>;
  }): Promise<unknown>;

  getRun(params: { workspaceId: string; runId: string }): Promise<unknown>;

  cancelRun(params: { workspaceId: string; runId: string; reason?: string }): Promise<unknown>;

  listWorkItems(params: { workspaceId: string; runId?: string; status?: string }): Promise<unknown>;

  submitApproval(params: {
    workspaceId: string;
    approvalId: string;
    decision: string;
    comment?: string;
  }): Promise<unknown>;

  registerAgent(params: {
    workspaceId: string;
    machineId: string;
    agentId: string;
    displayName: string;
    capabilities?: readonly string[];
  }): Promise<unknown>;

  agentHeartbeat(params: {
    workspaceId: string;
    machineId: string;
    agentId: string;
    status?: string;
  }): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

export class PortariumMcpServer {
  readonly #client: PortariumClient;
  readonly #allowedTools: ReadonlySet<string> | undefined;

  public constructor(client: PortariumClient, opts?: { allowedTools?: ReadonlySet<string> }) {
    this.#client = client;
    this.#allowedTools = opts?.allowedTools;
  }

  public async handleRequest(request: unknown): Promise<JsonRpcResponse> {
    const parsed = parseJsonRpcRequest(request);
    if (!parsed.ok) {
      return {
        jsonrpc: '2.0',
        id: parsed.id ?? null,
        error: parsed.error,
      };
    }

    const { id, method, params } = parsed.request;

    switch (method) {
      case 'initialize':
        return jsonRpcOk(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'portarium-mcp-server', version: '1.0.0' },
        });

      case 'tools/list':
        return jsonRpcOk(id, { tools: this.#getVisibleTools() });

      case 'tools/call':
        return this.#handleToolCall(id, params);

      default:
        return jsonRpcError(id, METHOD_NOT_FOUND, `Unknown method: ${method}`);
    }
  }

  #getVisibleTools(): readonly McpToolSchema[] {
    if (!this.#allowedTools) return MCP_TOOLS;
    return MCP_TOOLS.filter((t) => this.#allowedTools!.has(t.name));
  }

  async #handleToolCall(id: string | number, params: unknown): Promise<JsonRpcResponse> {
    if (!isRecord(params)) {
      return jsonRpcError(id, INVALID_PARAMS, 'params must be an object.');
    }

    const toolName = asString(params['name']);
    if (!toolName) {
      return jsonRpcError(id, INVALID_PARAMS, 'Missing tool name.');
    }

    const schema = findToolSchema(toolName);
    if (!schema) {
      return jsonRpcError(id, METHOD_NOT_FOUND, `Unknown tool: ${toolName}`);
    }

    if (this.#allowedTools && !this.#allowedTools.has(toolName)) {
      return jsonRpcError(id, METHOD_NOT_FOUND, `Tool not available: ${toolName}`);
    }

    const toolArgs = isRecord(params['arguments']) ? params['arguments'] : {};

    try {
      const result = await this.#dispatch(toolName, toolArgs);
      return jsonRpcOk(id, {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool execution failed.';
      return jsonRpcError(id, INTERNAL_ERROR, message);
    }
  }

  async #dispatch(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const handlers: Record<string, () => Promise<unknown>> = {
      portarium_run_start: async () => this.#dispatchStartRun(args),
      portarium_run_get: async () => this.#dispatchRunGet(args),
      portarium_run_cancel: async () => this.#dispatchRunCancel(args),
      portarium_work_items_list: async () => this.#dispatchListWorkItems(args),
      portarium_approval_submit: async () => this.#dispatchSubmitApproval(args),
      portarium_agent_register: async () => this.#dispatchRegisterAgent(args),
      portarium_agent_heartbeat: async () => this.#dispatchAgentHeartbeat(args),
    };
    const handler = handlers[toolName];
    if (!handler) throw new Error(`Unimplemented tool: ${toolName}`);
    return handler();
  }

  async #dispatchStartRun(args: Record<string, unknown>): Promise<unknown> {
    const input = asRecord(args['input']);
    return this.#client.startRun({
      workspaceId: requireString(args, 'workspaceId'),
      workflowId: requireString(args, 'workflowId'),
      ...(input !== undefined ? { input } : {}),
    });
  }

  async #dispatchRunGet(args: Record<string, unknown>): Promise<unknown> {
    return this.#client.getRun({
      workspaceId: requireString(args, 'workspaceId'),
      runId: requireString(args, 'runId'),
    });
  }

  async #dispatchRunCancel(args: Record<string, unknown>): Promise<unknown> {
    const reason = asString(args['reason']);
    return this.#client.cancelRun({
      workspaceId: requireString(args, 'workspaceId'),
      runId: requireString(args, 'runId'),
      ...(reason !== undefined ? { reason } : {}),
    });
  }

  async #dispatchListWorkItems(args: Record<string, unknown>): Promise<unknown> {
    const runId = asString(args['runId']);
    const status = asString(args['status']);
    return this.#client.listWorkItems({
      workspaceId: requireString(args, 'workspaceId'),
      ...(runId !== undefined ? { runId } : {}),
      ...(status !== undefined ? { status } : {}),
    });
  }

  async #dispatchSubmitApproval(args: Record<string, unknown>): Promise<unknown> {
    const comment = asString(args['comment']);
    return this.#client.submitApproval({
      workspaceId: requireString(args, 'workspaceId'),
      approvalId: requireString(args, 'approvalId'),
      decision: requireString(args, 'decision'),
      ...(comment !== undefined ? { comment } : {}),
    });
  }

  async #dispatchRegisterAgent(args: Record<string, unknown>): Promise<unknown> {
    const capabilities = asStringArray(args['capabilities']);
    return this.#client.registerAgent({
      workspaceId: requireString(args, 'workspaceId'),
      machineId: requireString(args, 'machineId'),
      agentId: requireString(args, 'agentId'),
      displayName: requireString(args, 'displayName'),
      ...(capabilities !== undefined ? { capabilities } : {}),
    });
  }

  async #dispatchAgentHeartbeat(args: Record<string, unknown>): Promise<unknown> {
    const status = asString(args['status']);
    return this.#client.agentHeartbeat({
      workspaceId: requireString(args, 'workspaceId'),
      machineId: requireString(args, 'machineId'),
      agentId: requireString(args, 'agentId'),
      ...(status !== undefined ? { status } : {}),
    });
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type ParseOk = Readonly<{ ok: true; request: JsonRpcRequest }>;
type ParseFail = Readonly<{
  ok: false;
  id: string | number | null;
  error: JsonRpcError;
}>;

function parseJsonRpcRequest(raw: unknown): ParseOk | ParseFail {
  if (!isRecord(raw)) {
    return {
      ok: false,
      id: null,
      error: { code: PARSE_ERROR, message: 'Request must be a JSON object.' },
    };
  }

  const id = raw['id'];
  const resolvedId = typeof id === 'string' || typeof id === 'number' ? id : null;

  if (raw['jsonrpc'] !== '2.0') {
    return {
      ok: false,
      id: resolvedId,
      error: { code: INVALID_REQUEST, message: 'jsonrpc must be "2.0".' },
    };
  }

  const method = raw['method'];
  if (typeof method !== 'string') {
    return {
      ok: false,
      id: resolvedId,
      error: { code: INVALID_REQUEST, message: 'method must be a string.' },
    };
  }

  return {
    ok: true,
    request: {
      jsonrpc: '2.0',
      id: resolvedId ?? 0,
      method,
      params: raw['params'],
    },
  };
}

function jsonRpcOk(id: string | number, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? 0, error: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function asStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((v): v is string => typeof v === 'string');
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required string parameter: ${key}`);
  }
  return value;
}
