/**
 * Portarium CLI -- developer-facing command-line interface.
 *
 * Subcommands:
 *   login       OAuth2 device-flow authentication (stub)
 *   workspace   Select active workspace
 *   agent       Register or heartbeat an agent
 *   run         Start, status, or cancel a workflow run
 *   approve     Submit an approval decision
 *   events      Tail workspace events via SSE
 *
 * Internally delegates to the Portarium control-plane HTTP API.
 */

// -- Argument parsing --------------------------------------------------------

export interface CliArgs {
  command: string;
  subcommand?: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

/**
 * Parse argv into a structured CliArgs object.
 * Supports `--flag value`, `--flag=value`, and `--bool-flag` patterns.
 */
export function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2); // skip node + script
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;
    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex > -1) {
        flags[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
      } else {
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          flags[arg.slice(2)] = next;
          i++;
        } else {
          flags[arg.slice(2)] = true;
        }
      }
    } else {
      positional.push(arg);
    }
    i++;
  }

  const command = positional[0] ?? 'help';
  const subcommand = positional[1];

  return { command, subcommand, flags, positional: positional.slice(2) };
}

// -- Configuration -----------------------------------------------------------

function getBaseUrl(flags: Record<string, string | boolean>): string {
  return String(flags['base-url'] ?? process.env['PORTARIUM_BASE_URL'] ?? 'http://localhost:3100');
}

function getToken(flags: Record<string, string | boolean>): string {
  return String(flags['token'] ?? process.env['PORTARIUM_TOKEN'] ?? '');
}

function getWorkspaceId(flags: Record<string, string | boolean>): string {
  return String(
    flags['workspace'] ?? process.env['PORTARIUM_WORKSPACE_ID'] ?? 'ws-default',
  );
}

// -- HTTP client helper ------------------------------------------------------

async function apiFetch(
  baseUrl: string,
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// -- Command handlers --------------------------------------------------------

function printUsage(): void {
  console.log(`Usage: portarium <command> [subcommand] [options]

Commands:
  login                         Authenticate via OAuth2 device flow
  workspace select              Select active workspace
  agent register                Register an agent
  agent heartbeat               Send agent heartbeat
  run start --workflow-id <id>  Start a workflow run
  run status --run-id <id>      Get run status
  run cancel --run-id <id>      Cancel a run
  approve --approval-id <id> --decision <Approved|Denied|RequestChanges>
  events                        Tail workspace events via SSE

Global flags:
  --base-url <url>              Control plane URL (default: $PORTARIUM_BASE_URL or http://localhost:3100)
  --token <jwt>                 Bearer token (default: $PORTARIUM_TOKEN)
  --workspace <id>              Workspace ID (default: $PORTARIUM_WORKSPACE_ID or ws-default)
`);
}

async function handleLogin(): Promise<void> {
  console.log('OAuth2 Device Authorization Flow');
  console.log('--------------------------------');
  console.log('1. Visit: https://auth.portarium.dev/device');
  console.log('2. Enter the code displayed below.');
  console.log();
  // Stub: in a real implementation this would call the authorization server.
  const stubCode = 'ABCD-1234';
  console.log(`  User code: ${stubCode}`);
  console.log();
  console.log('Waiting for authorization... (stub -- not yet implemented)');
  console.log('Once implemented, the CLI will poll the token endpoint and store the token locally.');
}

async function handleWorkspaceSelect(flags: Record<string, string | boolean>): Promise<void> {
  const baseUrl = getBaseUrl(flags);
  const token = getToken(flags);
  const result = await apiFetch(baseUrl, token, 'GET', '/api/v1/workspaces');
  console.log(JSON.stringify(result, null, 2));
}

async function handleAgentRegister(flags: Record<string, string | boolean>): Promise<void> {
  const baseUrl = getBaseUrl(flags);
  const token = getToken(flags);
  const ws = getWorkspaceId(flags);
  const name = String(flags['name'] ?? 'cli-agent');
  const result = await apiFetch(baseUrl, token, 'POST', `/api/v1/workspaces/${ws}/agents`, {
    name,
    capabilities: [],
  });
  console.log(JSON.stringify(result, null, 2));
}

async function handleAgentHeartbeat(flags: Record<string, string | boolean>): Promise<void> {
  const baseUrl = getBaseUrl(flags);
  const token = getToken(flags);
  const ws = getWorkspaceId(flags);
  const agentId = String(flags['agent-id'] ?? '');
  if (!agentId) {
    console.error('Error: --agent-id is required');
    process.exitCode = 1;
    return;
  }
  const result = await apiFetch(
    baseUrl,
    token,
    'POST',
    `/api/v1/workspaces/${ws}/agents/${encodeURIComponent(agentId)}/heartbeat`,
  );
  console.log(JSON.stringify(result, null, 2));
}

async function handleRunStart(flags: Record<string, string | boolean>): Promise<void> {
  const baseUrl = getBaseUrl(flags);
  const token = getToken(flags);
  const ws = getWorkspaceId(flags);
  const workflowId = String(flags['workflow-id'] ?? '');
  if (!workflowId) {
    console.error('Error: --workflow-id is required');
    process.exitCode = 1;
    return;
  }
  const result = await apiFetch(baseUrl, token, 'POST', `/api/v1/workspaces/${ws}/runs`, {
    workflowId,
    inputPayload: {},
  });
  console.log(JSON.stringify(result, null, 2));
}

async function handleRunStatus(flags: Record<string, string | boolean>): Promise<void> {
  const baseUrl = getBaseUrl(flags);
  const token = getToken(flags);
  const ws = getWorkspaceId(flags);
  const runId = String(flags['run-id'] ?? '');
  if (!runId) {
    console.error('Error: --run-id is required');
    process.exitCode = 1;
    return;
  }
  const result = await apiFetch(
    baseUrl,
    token,
    'GET',
    `/api/v1/workspaces/${ws}/runs/${encodeURIComponent(runId)}`,
  );
  console.log(JSON.stringify(result, null, 2));
}

async function handleRunCancel(flags: Record<string, string | boolean>): Promise<void> {
  const baseUrl = getBaseUrl(flags);
  const token = getToken(flags);
  const ws = getWorkspaceId(flags);
  const runId = String(flags['run-id'] ?? '');
  if (!runId) {
    console.error('Error: --run-id is required');
    process.exitCode = 1;
    return;
  }
  const result = await apiFetch(
    baseUrl,
    token,
    'POST',
    `/api/v1/workspaces/${ws}/runs/${encodeURIComponent(runId)}/cancel`,
  );
  console.log(JSON.stringify(result, null, 2));
}

async function handleApprove(flags: Record<string, string | boolean>): Promise<void> {
  const baseUrl = getBaseUrl(flags);
  const token = getToken(flags);
  const ws = getWorkspaceId(flags);
  const approvalId = String(flags['approval-id'] ?? '');
  const decision = String(flags['decision'] ?? '');
  if (!approvalId || !decision) {
    console.error('Error: --approval-id and --decision are required');
    process.exitCode = 1;
    return;
  }
  const reason = flags['reason'] ? String(flags['reason']) : undefined;
  const result = await apiFetch(
    baseUrl,
    token,
    'POST',
    `/api/v1/workspaces/${ws}/approvals/${encodeURIComponent(approvalId)}/decisions`,
    { decision, ...(reason ? { reason } : {}) },
  );
  console.log(JSON.stringify(result, null, 2));
}

async function handleEvents(flags: Record<string, string | boolean>): Promise<void> {
  const baseUrl = getBaseUrl(flags);
  const token = getToken(flags);
  const ws = getWorkspaceId(flags);
  console.log(`Tailing events for workspace ${ws}...`);
  console.log(`  SSE endpoint: ${baseUrl}/api/v1/workspaces/${ws}/events/stream`);
  console.log();

  // SSE tailing via fetch streaming.
  const res = await fetch(`${baseUrl}/api/v1/workspaces/${ws}/events/stream`, {
    headers: {
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok || !res.body) {
    console.error(`Failed to connect: HTTP ${res.status}`);
    process.exitCode = 1;
    return;
  }

  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      process.stdout.write(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }
}

// -- Dispatch ----------------------------------------------------------------

export async function run(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv);

  switch (parsed.command) {
    case 'help':
    case '--help':
    case '-h':
      printUsage();
      break;
    case 'login':
      await handleLogin();
      break;
    case 'workspace':
      if (parsed.subcommand === 'select') {
        await handleWorkspaceSelect(parsed.flags);
      } else {
        console.error(`Unknown workspace subcommand: ${parsed.subcommand ?? '(none)'}`);
        process.exitCode = 1;
      }
      break;
    case 'agent':
      if (parsed.subcommand === 'register') {
        await handleAgentRegister(parsed.flags);
      } else if (parsed.subcommand === 'heartbeat') {
        await handleAgentHeartbeat(parsed.flags);
      } else {
        console.error(`Unknown agent subcommand: ${parsed.subcommand ?? '(none)'}`);
        process.exitCode = 1;
      }
      break;
    case 'run':
      if (parsed.subcommand === 'start') {
        await handleRunStart(parsed.flags);
      } else if (parsed.subcommand === 'status') {
        await handleRunStatus(parsed.flags);
      } else if (parsed.subcommand === 'cancel') {
        await handleRunCancel(parsed.flags);
      } else {
        console.error(`Unknown run subcommand: ${parsed.subcommand ?? '(none)'}`);
        process.exitCode = 1;
      }
      break;
    case 'approve':
      await handleApprove(parsed.flags);
      break;
    case 'events':
      await handleEvents(parsed.flags);
      break;
    default:
      console.error(`Unknown command: ${parsed.command}`);
      printUsage();
      process.exitCode = 1;
  }
}

// -- Entrypoint (when run directly) ------------------------------------------

const isDirectExecution =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('portarium-cli.ts') || process.argv[1].endsWith('portarium'));

if (isDirectExecution) {
  run(process.argv).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
