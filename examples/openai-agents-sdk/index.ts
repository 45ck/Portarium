/**
 * Example: Wrap Portarium runs as an OpenAI Agents SDK tool.
 *
 * This demonstrates how an OpenAI-Agents-based application can invoke
 * Portarium workflow runs through the control-plane API, so every SoR
 * side-effect is governed, audited, and approved.
 *
 * Prerequisites:
 *   1. A running Portarium control plane (`npm run dev` in the root).
 *   2. A valid workspace + bearer token (see `PORTARIUM_TOKEN`).
 *   3. `npm install` in this directory.
 *
 * Usage:
 *   PORTARIUM_BASE_URL=http://localhost:3100 PORTARIUM_TOKEN=<jwt> npm start
 */

// -- Configuration -----------------------------------------------------------

const PORTARIUM_BASE_URL = process.env['PORTARIUM_BASE_URL'] ?? 'http://localhost:3100';
const PORTARIUM_TOKEN = process.env['PORTARIUM_TOKEN'] ?? '';
const PORTARIUM_WORKSPACE_ID = process.env['PORTARIUM_WORKSPACE_ID'] ?? 'ws-default';

// -- Portarium API helpers ---------------------------------------------------

interface StartRunRequest {
  workflowId: string;
  inputPayload?: Record<string, unknown>;
  correlationId?: string;
}

interface RunStatus {
  runId: string;
  status: string;
  result?: unknown;
}

async function startRun(req: StartRunRequest): Promise<RunStatus> {
  const res = await fetch(`${PORTARIUM_BASE_URL}/api/v1/workspaces/${PORTARIUM_WORKSPACE_ID}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PORTARIUM_TOKEN}`,
    },
    body: JSON.stringify({
      workflowId: req.workflowId,
      inputPayload: req.inputPayload ?? {},
      correlationId: req.correlationId,
    }),
  });
  if (!res.ok) throw new Error(`Portarium startRun failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as RunStatus;
}

async function getRunStatus(runId: string): Promise<RunStatus> {
  const res = await fetch(
    `${PORTARIUM_BASE_URL}/api/v1/workspaces/${PORTARIUM_WORKSPACE_ID}/runs/${encodeURIComponent(runId)}`,
    {
      headers: { Authorization: `Bearer ${PORTARIUM_TOKEN}` },
    },
  );
  if (!res.ok) throw new Error(`Portarium getRunStatus failed: ${res.status}`);
  return (await res.json()) as RunStatus;
}

// -- OpenAI Agents SDK tool definition ---------------------------------------

/**
 * Tool definition compatible with the OpenAI Agents SDK `tools` array.
 * Register this in your agent's tool list so the agent can kick off
 * governed Portarium runs instead of calling SoR APIs directly.
 */
export const portariumRunTool = {
  type: 'function' as const,
  function: {
    name: 'portarium_start_run',
    description:
      'Start a governed workflow run through Portarium. ' +
      'All side-effects are policy-checked and audited.',
    parameters: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'ID of the workflow definition to execute.',
        },
        inputPayload: {
          type: 'object',
          description: 'Optional key-value payload passed to the workflow.',
        },
      },
      required: ['workflowId'],
    },
  },
};

/**
 * Handler invoked when the agent calls the `portarium_start_run` tool.
 * Wire this into your agent loop's tool-call dispatch.
 */
export async function handlePortariumRunTool(args: {
  workflowId: string;
  inputPayload?: Record<string, unknown>;
}): Promise<string> {
  const run = await startRun({
    workflowId: args.workflowId,
    inputPayload: args.inputPayload,
  });

  // Poll for completion (simple strategy; production code should use SSE).
  const MAX_POLLS = 30;
  const POLL_INTERVAL_MS = 2_000;
  let current = run;
  for (let i = 0; i < MAX_POLLS; i++) {
    if (current.status === 'Completed' || current.status === 'Failed') break;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    current = await getRunStatus(run.runId);
  }

  return JSON.stringify(current);
}

// -- Entrypoint (demo) -------------------------------------------------------

async function main(): Promise<void> {
  console.log('Portarium + OpenAI Agents SDK example');
  console.log(`  Base URL:     ${PORTARIUM_BASE_URL}`);
  console.log(`  Workspace:    ${PORTARIUM_WORKSPACE_ID}`);
  console.log(`  Token set:    ${PORTARIUM_TOKEN ? 'yes' : 'NO (set PORTARIUM_TOKEN)'}`);
  console.log();
  console.log('Tool definition:');
  console.log(JSON.stringify(portariumRunTool, null, 2));
  console.log();
  console.log('Register `portariumRunTool` in your agent and dispatch');
  console.log('tool calls to `handlePortariumRunTool`.');
}

main().catch(console.error);
