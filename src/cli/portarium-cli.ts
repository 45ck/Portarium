/**
 * Portarium CLI -- developer-facing command-line interface.
 *
 * Subcommands:
 *   login       OAuth2 device-flow authentication (stub)
 *   generate    Scaffold integration projects (adapter / agent-wrapper)
 *   workspace   Select active workspace
 *   agent       Register or heartbeat an agent
 *   run         Start, status, or cancel a workflow run
 *   approve     Submit an approval decision
 *   events      Tail workspace events via SSE
 *
 * Internally delegates to the Portarium control-plane HTTP API.
 */

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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

  return {
    command,
    flags,
    positional: positional.slice(2),
    ...(subcommand !== undefined ? { subcommand } : {}),
  };
}

// -- Configuration -----------------------------------------------------------

function getBaseUrl(flags: Record<string, string | boolean>): string {
  return String(flags['base-url'] ?? process.env['PORTARIUM_BASE_URL'] ?? 'http://localhost:3100');
}

function getToken(flags: Record<string, string | boolean>): string {
  return String(flags['token'] ?? process.env['PORTARIUM_TOKEN'] ?? '');
}

function getWorkspaceId(flags: Record<string, string | boolean>): string {
  return String(flags['workspace'] ?? process.env['PORTARIUM_WORKSPACE_ID'] ?? 'ws-default');
}

// -- HTTP client helper ------------------------------------------------------

interface ApiFetchRequest {
  method: string;
  path: string;
  body?: unknown;
}

type FlagMap = Record<string, string | boolean>;
type SubcommandHandler = (flags: FlagMap) => Promise<void>;
type SubcommandTable = Readonly<Record<string, SubcommandHandler>>;
type StreamReadChunk = Readonly<{ done: boolean; value?: Uint8Array }>;

async function apiFetch(baseUrl: string, token: string, req: ApiFetchRequest): Promise<unknown> {
  const { method, path, body } = req;
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
  generate adapter              Scaffold a connector adapter project
  generate agent-wrapper        Scaffold an agent-wrapper service project
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

export interface AdapterScaffoldParams {
  outputDir: string;
  adapterName: string;
  providerSlug: string;
  portFamily: string;
  force?: boolean;
}

export interface AgentWrapperScaffoldParams {
  outputDir: string;
  wrapperName: string;
  runtimeSlug: string;
  force?: boolean;
}

function parseBooleanFlag(value: string | boolean | undefined): boolean {
  if (value === true) {
    return true;
  }
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function ensureWritableOutputDir(outputDir: string, force: boolean): void {
  if (existsSync(outputDir)) {
    const hasContent = readdirSync(outputDir).length > 0;
    if (hasContent && !force) {
      throw new Error(`Output directory already exists and is not empty: ${outputDir}`);
    }
    if (hasContent && force) {
      rmSync(outputDir, { recursive: true, force: true });
    }
  }
  mkdirSync(outputDir, { recursive: true });
}

function writeTextFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

export function generateAdapterScaffold(params: AdapterScaffoldParams): void {
  const outputDir = resolve(params.outputDir);
  const force = params.force ?? false;
  ensureWritableOutputDir(outputDir, force);

  const manifest = {
    schemaVersion: 1,
    adapterName: params.adapterName,
    providerSlug: params.providerSlug,
    portFamily: params.portFamily,
    capabilities: [
      { capability: 'ticket:read', operation: 'listTickets' },
      { capability: 'ticket:write', operation: 'createTicket' },
    ],
    executionPolicy: {
      tenantIsolationMode: 'PerTenantWorker',
      egressAllowlist: ['https://api.example.com'],
      credentialScope: 'capabilityMatrix',
      sandboxVerified: false,
      sandboxAvailable: true,
    },
  };

  writeTextFile(
    resolve(outputDir, 'README.md'),
    `# ${params.adapterName}\n\n` +
      'Generated adapter scaffold for Portarium integration work.\n\n' +
      '## Next steps\n\n' +
      '1. Update `adapter.manifest.json` capability entries and execution policy.\n' +
      '2. Implement provider calls in `src/index.ts`.\n' +
      '3. Add provider-specific contract and integration tests.\n',
  );
  writeTextFile(resolve(outputDir, 'adapter.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeTextFile(
    resolve(outputDir, 'src/index.ts'),
    `export interface AdapterInvocation {\n` +
      `  tenantId: string;\n` +
      `  capability: string;\n` +
      `  input: Record<string, unknown>;\n` +
      `}\n\n` +
      `export interface AdapterInvocationResult {\n` +
      `  ok: boolean;\n` +
      `  output?: Record<string, unknown>;\n` +
      `  error?: string;\n` +
      `}\n\n` +
      `export async function invokeAdapter(\n` +
      `  request: AdapterInvocation,\n` +
      `): Promise<AdapterInvocationResult> {\n` +
      `  // TODO: Replace stub with provider-specific API call.\n` +
      `  return {\n` +
      `    ok: true,\n` +
      `    output: {\n` +
      `      provider: '${params.providerSlug}',\n` +
      `      capability: request.capability,\n` +
      `      tenantId: request.tenantId,\n` +
      `    },\n` +
      `  };\n` +
      `}\n`,
  );
  writeTextFile(
    resolve(outputDir, 'src/index.test.ts'),
    `import { describe, expect, it } from 'vitest';\n\n` +
      `import { invokeAdapter } from './index.js';\n\n` +
      `describe('${params.adapterName} adapter scaffold', () => {\n` +
      `  it('returns a stubbed success payload', async () => {\n` +
      `    const result = await invokeAdapter({\n` +
      `      tenantId: 'ws-demo',\n` +
      `      capability: 'ticket:read',\n` +
      `      input: {},\n` +
      `    });\n` +
      `\n` +
      `    expect(result.ok).toBe(true);\n` +
      `  });\n` +
      `});\n`,
  );
}

export function generateAgentWrapperScaffold(params: AgentWrapperScaffoldParams): void {
  const outputDir = resolve(params.outputDir);
  const force = params.force ?? false;
  ensureWritableOutputDir(outputDir, force);

  const manifest = {
    schemaVersion: 1,
    wrapperName: params.wrapperName,
    runtimeSlug: params.runtimeSlug,
    endpoints: {
      healthz: '/healthz',
      invoke: '/v1/responses',
    },
    policyDefaults: {
      requiresApproval: true,
      auditEvidence: true,
      egressAllowlist: ['https://api.example.com'],
    },
  };

  writeTextFile(
    resolve(outputDir, 'README.md'),
    `# ${params.wrapperName}\n\n` +
      'Generated agent-wrapper scaffold for Portarium machine integration.\n\n' +
      '## Next steps\n\n' +
      '1. Configure runtime credentials and policy in `.env.example`.\n' +
      '2. Implement guarded invocation logic in `src/server.ts`.\n' +
      '3. Register this machine wrapper in Portarium and run smoke tests.\n',
  );
  writeTextFile(resolve(outputDir, 'agent-wrapper.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeTextFile(
    resolve(outputDir, '.env.example'),
    `PORT=8080\n` +
      `RUNTIME_BASE_URL=https://api.example.com\n` +
      `RUNTIME_API_KEY=replace-me\n` +
      `WORKSPACE_ID=ws-default\n`,
  );
  writeTextFile(
    resolve(outputDir, 'src/server.ts'),
    `import { createServer } from 'node:http';\n\n` +
      `const port = Number(process.env['PORT'] ?? 8080);\n\n` +
      `const server = createServer((req, res) => {\n` +
      `  if (req.url === '/healthz') {\n` +
      `    res.writeHead(200, { 'Content-Type': 'application/json' });\n` +
      `    res.end(JSON.stringify({ ok: true, runtime: '${params.runtimeSlug}' }));\n` +
      `    return;\n` +
      `  }\n` +
      `\n` +
      `  if (req.method === 'POST' && req.url === '/v1/responses') {\n` +
      `    res.writeHead(202, { 'Content-Type': 'application/json' });\n` +
      `    res.end(JSON.stringify({ status: 'accepted', wrapper: '${params.wrapperName}' }));\n` +
      `    return;\n` +
      `  }\n` +
      `\n` +
      `  res.writeHead(404, { 'Content-Type': 'application/json' });\n` +
      `  res.end(JSON.stringify({ error: 'not_found' }));\n` +
      `});\n\n` +
      `server.listen(port, () => {\n` +
      `  console.log('${params.wrapperName} listening on http://127.0.0.1:' + port);\n` +
      `});\n`,
  );
}

function readRequiredFlag(flags: FlagMap, key: string): string {
  const value = flags[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`--${key} is required`);
  }
  return value.trim();
}

async function handleGenerateAdapter(flags: FlagMap): Promise<void> {
  const adapterName = readRequiredFlag(flags, 'name');
  const providerSlug = String(flags['provider-slug'] ?? adapterName);
  const portFamily = String(flags['port-family'] ?? 'CrmSales');
  const outputDir = String(flags['output'] ?? `scaffolds/adapters/${providerSlug}`);
  const force = parseBooleanFlag(flags['force']);

  generateAdapterScaffold({
    outputDir,
    adapterName,
    providerSlug,
    portFamily,
    force,
  });

  console.log(`Adapter scaffold generated at ${resolve(outputDir)}`);
}

async function handleGenerateAgentWrapper(flags: FlagMap): Promise<void> {
  const wrapperName = readRequiredFlag(flags, 'name');
  const runtimeSlug = String(flags['runtime'] ?? 'openclaw');
  const outputDir = String(flags['output'] ?? `scaffolds/agent-wrappers/${wrapperName}`);
  const force = parseBooleanFlag(flags['force']);

  generateAgentWrapperScaffold({
    outputDir,
    wrapperName,
    runtimeSlug,
    force,
  });

  console.log(`Agent-wrapper scaffold generated at ${resolve(outputDir)}`);
}

function handleLogin(): void {
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
  console.log(
    'Once implemented, the CLI will poll the token endpoint and store the token locally.',
  );
}

async function handleWorkspaceSelect(flags: Record<string, string | boolean>): Promise<void> {
  const baseUrl = getBaseUrl(flags);
  const token = getToken(flags);
  const result = await apiFetch(baseUrl, token, { method: 'GET', path: '/api/v1/workspaces' });
  console.log(JSON.stringify(result, null, 2));
}

async function handleAgentRegister(flags: Record<string, string | boolean>): Promise<void> {
  const baseUrl = getBaseUrl(flags);
  const token = getToken(flags);
  const ws = getWorkspaceId(flags);
  const name = String(flags['name'] ?? 'cli-agent');
  const result = await apiFetch(baseUrl, token, {
    method: 'POST',
    path: `/api/v1/workspaces/${ws}/agents`,
    body: { name, capabilities: [] },
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
  const result = await apiFetch(baseUrl, token, {
    method: 'POST',
    path: `/api/v1/workspaces/${ws}/agents/${encodeURIComponent(agentId)}/heartbeat`,
  });
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
  const result = await apiFetch(baseUrl, token, {
    method: 'POST',
    path: `/api/v1/workspaces/${ws}/runs`,
    body: { workflowId, inputPayload: {} },
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
  const result = await apiFetch(baseUrl, token, {
    method: 'GET',
    path: `/api/v1/workspaces/${ws}/runs/${encodeURIComponent(runId)}`,
  });
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
  const result = await apiFetch(baseUrl, token, {
    method: 'POST',
    path: `/api/v1/workspaces/${ws}/runs/${encodeURIComponent(runId)}/cancel`,
  });
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
  const result = await apiFetch(baseUrl, token, {
    method: 'POST',
    path: `/api/v1/workspaces/${ws}/approvals/${encodeURIComponent(approvalId)}/decisions`,
    body: { decision, ...(reason ? { reason } : {}) },
  });
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
      const readResult: unknown = await reader.read();
      if (!isReadableChunk(readResult)) {
        throw new Error('Invalid event stream chunk shape.');
      }
      if (readResult.done) break;
      if (readResult.value !== undefined) {
        process.stdout.write(decoder.decode(readResult.value, { stream: true }));
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function isReadableChunk(value: unknown): value is StreamReadChunk {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as { done?: unknown; value?: unknown };
  if (typeof record.done !== 'boolean') {
    return false;
  }
  return record.value === undefined || record.value instanceof Uint8Array;
}

async function runSubcommand(
  command: string,
  subcommand: string | undefined,
  flags: FlagMap,
  table: SubcommandTable,
): Promise<void> {
  const handler = subcommand !== undefined ? table[subcommand] : undefined;
  if (!handler) {
    console.error(`Unknown ${command} subcommand: ${subcommand ?? '(none)'}`);
    process.exitCode = 1;
    return;
  }
  await handler(flags);
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
      handleLogin();
      break;
    case 'generate':
      await runSubcommand('generate', parsed.subcommand, parsed.flags, {
        adapter: handleGenerateAdapter,
        'agent-wrapper': handleGenerateAgentWrapper,
      });
      break;
    case 'workspace':
      await runSubcommand('workspace', parsed.subcommand, parsed.flags, {
        select: handleWorkspaceSelect,
      });
      break;
    case 'agent':
      await runSubcommand('agent', parsed.subcommand, parsed.flags, {
        register: handleAgentRegister,
        heartbeat: handleAgentHeartbeat,
      });
      break;
    case 'run':
      await runSubcommand('run', parsed.subcommand, parsed.flags, {
        start: handleRunStart,
        status: handleRunStatus,
        cancel: handleRunCancel,
      });
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
