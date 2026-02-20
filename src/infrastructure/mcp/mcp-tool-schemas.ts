/**
 * MCP tool definitions for the Portarium MCP server.
 *
 * Each tool maps to a control-plane operation. Tool names follow
 * the `portarium_<resource>_<verb>` convention.
 */

export type McpToolSchema = Readonly<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}>;

export const MCP_TOOLS: readonly McpToolSchema[] = [
  {
    name: 'portarium_run_start',
    description: 'Start a new workflow run in a workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Target workspace ID.' },
        workflowId: { type: 'string', description: 'Workflow definition ID to execute.' },
        input: {
          type: 'object',
          description: 'Input parameters for the workflow.',
          additionalProperties: true,
        },
      },
      required: ['workspaceId', 'workflowId'],
    },
  },
  {
    name: 'portarium_run_get',
    description: 'Get the current status and details of a workflow run.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID.' },
        runId: { type: 'string', description: 'Run ID to query.' },
      },
      required: ['workspaceId', 'runId'],
    },
  },
  {
    name: 'portarium_run_cancel',
    description: 'Cancel an active workflow run.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID.' },
        runId: { type: 'string', description: 'Run ID to cancel.' },
        reason: { type: 'string', description: 'Cancellation reason.' },
      },
      required: ['workspaceId', 'runId'],
    },
  },
  {
    name: 'portarium_work_items_list',
    description: 'List work items for a workspace, optionally filtered by run or status.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID.' },
        runId: { type: 'string', description: 'Optional run ID filter.' },
        status: {
          type: 'string',
          enum: ['pending', 'in-progress', 'completed', 'failed'],
          description: 'Optional status filter.',
        },
      },
      required: ['workspaceId'],
    },
  },
  {
    name: 'portarium_approval_submit',
    description: 'Submit an approval decision for a pending approval request.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID.' },
        approvalId: { type: 'string', description: 'Approval request ID.' },
        decision: {
          type: 'string',
          enum: ['Approved', 'Denied', 'RequestChanges'],
          description: 'Approval decision.',
        },
        comment: { type: 'string', description: 'Optional comment.' },
      },
      required: ['workspaceId', 'approvalId', 'decision'],
    },
  },
  {
    name: 'portarium_agent_register',
    description: 'Register an agent/machine with the control plane.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID.' },
        machineId: { type: 'string', description: 'Machine registration ID.' },
        agentId: { type: 'string', description: 'Agent configuration ID.' },
        displayName: { type: 'string', description: 'Human-readable display name.' },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Capability keys the agent supports.',
        },
      },
      required: ['workspaceId', 'machineId', 'agentId', 'displayName'],
    },
  },
  {
    name: 'portarium_agent_heartbeat',
    description: 'Send a heartbeat from an agent to indicate liveness.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID.' },
        machineId: { type: 'string', description: 'Machine registration ID.' },
        agentId: { type: 'string', description: 'Agent configuration ID.' },
        status: {
          type: 'string',
          enum: ['healthy', 'degraded', 'draining'],
          description: 'Agent health status.',
        },
      },
      required: ['workspaceId', 'machineId', 'agentId'],
    },
  },
] as const;

export function findToolSchema(name: string): McpToolSchema | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}

export function listToolNames(): readonly string[] {
  return MCP_TOOLS.map((t) => t.name);
}
