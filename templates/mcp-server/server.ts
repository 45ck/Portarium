/**
 * MCP Server exposing Portarium control-plane operations as tools.
 *
 * Agents connecting via MCP automatically route work through Portarium
 * governance (policy evaluation, approval gates, evidence capture).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const PORTARIUM_BASE_URL = process.env.PORTARIUM_BASE_URL || 'http://localhost:3000';
const PORTARIUM_TOKEN = process.env.PORTARIUM_TOKEN || '';
const PORTARIUM_WORKSPACE_ID = process.env.PORTARIUM_WORKSPACE_ID || '';

/** Helper: make authenticated request to Portarium control plane. */
async function portariumFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const url = `${PORTARIUM_BASE_URL}${path}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${PORTARIUM_TOKEN}`,
      'X-Workspace-Id': PORTARIUM_WORKSPACE_ID,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Portarium API error ${resp.status}: ${body}`);
  }
  return resp.json();
}

// --- MCP Server ---

const server = new McpServer({
  name: 'portarium',
  version: '1.0.0',
});

// Tool: Start a workflow run
server.tool(
  'portarium_start_run',
  'Start a workflow run in a Portarium workspace',
  {
    workspace_id: z.string().optional().describe('Workspace ID (defaults to env)'),
    workflow_id: z.string().describe('Workflow definition ID'),
    input: z.record(z.unknown()).optional().describe('Workflow input parameters'),
  },
  async ({ workspace_id, workflow_id, input }) => {
    const wsId = workspace_id || PORTARIUM_WORKSPACE_ID;
    const result = await portariumFetch(`/v1/workspaces/${wsId}/runs`, {
      method: 'POST',
      body: JSON.stringify({ workflowId: workflow_id, input: input || {} }),
    });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  },
);

// Tool: Get run status
server.tool(
  'portarium_get_run',
  'Get the status of a workflow run',
  {
    workspace_id: z.string().optional(),
    run_id: z.string().describe('Run ID to query'),
  },
  async ({ workspace_id, run_id }) => {
    const wsId = workspace_id || PORTARIUM_WORKSPACE_ID;
    const result = await portariumFetch(`/v1/workspaces/${wsId}/runs/${run_id}`);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  },
);

// Tool: List pending approvals
server.tool(
  'portarium_list_approvals',
  'List pending approvals in a workspace',
  {
    workspace_id: z.string().optional(),
    status: z.enum(['Pending', 'Approved', 'Denied']).optional(),
    limit: z.number().optional(),
  },
  async ({ workspace_id, status, limit }) => {
    const wsId = workspace_id || PORTARIUM_WORKSPACE_ID;
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const result = await portariumFetch(`/v1/workspaces/${wsId}/approvals${qs}`);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  },
);

// Tool: Decide an approval
server.tool(
  'portarium_decide_approval',
  'Approve or deny a pending approval',
  {
    workspace_id: z.string().optional(),
    approval_id: z.string().describe('Approval ID'),
    decision: z.enum(['Approved', 'Denied', 'RequestChanges']).describe('Decision'),
    reason: z.string().optional().describe('Reason for the decision'),
  },
  async ({ workspace_id, approval_id, decision, reason }) => {
    const wsId = workspace_id || PORTARIUM_WORKSPACE_ID;
    const result = await portariumFetch(`/v1/workspaces/${wsId}/approvals/${approval_id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  },
);

// Tool: Query evidence
server.tool(
  'portarium_query_evidence',
  'Query the evidence/audit trail for a workspace',
  {
    workspace_id: z.string().optional(),
    run_id: z.string().optional().describe('Filter by run ID'),
    category: z.string().optional().describe('Filter by evidence category'),
    limit: z.number().optional(),
  },
  async ({ workspace_id, run_id, category, limit }) => {
    const wsId = workspace_id || PORTARIUM_WORKSPACE_ID;
    const params = new URLSearchParams();
    if (run_id) params.set('runId', run_id);
    if (category) params.set('category', category);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const result = await portariumFetch(`/v1/workspaces/${wsId}/evidence${qs}`);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  },
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
