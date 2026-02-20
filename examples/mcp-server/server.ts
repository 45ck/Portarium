/**
 * Minimal MCP server template for Portarium.
 *
 * Exposes Portarium control-plane operations as MCP tools so any
 * MCP-compatible AI client can start governed runs, check status,
 * submit approvals, and tail events.
 *
 * Usage:
 *   PORTARIUM_BASE_URL=http://localhost:3100 \
 *   PORTARIUM_TOKEN=<jwt> \
 *     npm start
 *
 * Then point your MCP client at stdio (or configure the transport
 * in your claude_desktop_config.json / cursor settings).
 */

// -- Configuration -----------------------------------------------------------

const PORTARIUM_BASE_URL = process.env['PORTARIUM_BASE_URL'] ?? 'http://localhost:3100';
const PORTARIUM_TOKEN = process.env['PORTARIUM_TOKEN'] ?? '';
const PORTARIUM_WORKSPACE_ID = process.env['PORTARIUM_WORKSPACE_ID'] ?? 'ws-default';

// -- Portarium API client (minimal) -----------------------------------------

async function portariumFetch(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const url = `${PORTARIUM_BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PORTARIUM_TOKEN}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Portarium ${method} ${path} failed: ${res.status} ${text}`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
}

// -- MCP tool definitions ----------------------------------------------------

interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const tools: McpToolDefinition[] = [
  {
    name: 'portarium_start_run',
    description: 'Start a governed workflow run through Portarium.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'Workflow definition ID.' },
        inputPayload: { type: 'object', description: 'Optional input data.' },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'portarium_get_run',
    description: 'Get the current status of a Portarium run.',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: 'Run ID to query.' },
      },
      required: ['runId'],
    },
  },
  {
    name: 'portarium_cancel_run',
    description: 'Cancel an in-progress Portarium run.',
    inputSchema: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: 'Run ID to cancel.' },
      },
      required: ['runId'],
    },
  },
  {
    name: 'portarium_submit_approval',
    description: 'Submit an approval decision for a pending run.',
    inputSchema: {
      type: 'object',
      properties: {
        approvalId: { type: 'string', description: 'Approval request ID.' },
        decision: {
          type: 'string',
          enum: ['Approved', 'Denied', 'RequestChanges'],
          description: 'Approval decision.',
        },
        reason: { type: 'string', description: 'Optional reason for the decision.' },
      },
      required: ['approvalId', 'decision'],
    },
  },
];

// -- MCP tool handlers -------------------------------------------------------

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

const handlers: Record<string, ToolHandler> = {
  portarium_start_run: async (args) =>
    portariumFetch('POST', `/api/v1/workspaces/${PORTARIUM_WORKSPACE_ID}/runs`, {
      workflowId: args['workflowId'],
      inputPayload: args['inputPayload'] ?? {},
    }),

  portarium_get_run: async (args) =>
    portariumFetch(
      'GET',
      `/api/v1/workspaces/${PORTARIUM_WORKSPACE_ID}/runs/${encodeURIComponent(String(args['runId']))}`,
    ),

  portarium_cancel_run: async (args) =>
    portariumFetch(
      'POST',
      `/api/v1/workspaces/${PORTARIUM_WORKSPACE_ID}/runs/${encodeURIComponent(String(args['runId']))}/cancel`,
    ),

  portarium_submit_approval: async (args) =>
    portariumFetch(
      'POST',
      `/api/v1/workspaces/${PORTARIUM_WORKSPACE_ID}/approvals/${encodeURIComponent(String(args['approvalId']))}/decisions`,
      { decision: args['decision'], reason: args['reason'] },
    ),
};

// -- MCP stdio protocol (simplified) -----------------------------------------

/**
 * Minimal MCP stdio server loop.
 *
 * Production deployments should use the @modelcontextprotocol/sdk Server
 * class for full protocol compliance. This template shows the message
 * structure for clarity.
 */
async function main(): Promise<void> {
  const readline = await import('node:readline');
  const rl = readline.createInterface({ input: process.stdin });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let message: { id?: string | number; method?: string; params?: Record<string, unknown> };
    try {
      message = JSON.parse(trimmed) as typeof message;
    } catch {
      continue;
    }

    const id = message.id;

    if (message.method === 'initialize') {
      respond(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'portarium-mcp', version: '0.1.0' },
      });
    } else if (message.method === 'tools/list') {
      respond(id, { tools });
    } else if (message.method === 'tools/call') {
      const toolName = String(message.params?.['name'] ?? '');
      const toolArgs = (message.params?.['arguments'] ?? {}) as Record<string, unknown>;
      const handler = handlers[toolName];
      if (!handler) {
        respond(id, { isError: true, content: [{ type: 'text', text: `Unknown tool: ${toolName}` }] });
      } else {
        try {
          const result = await handler(toolArgs);
          respond(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          respond(id, { isError: true, content: [{ type: 'text', text: msg }] });
        }
      }
    }
  }
}

function respond(id: string | number | undefined, result: unknown): void {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(msg + '\n');
}

main().catch(console.error);
