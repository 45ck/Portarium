import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type FlagMap = Record<string, string | boolean>;

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
  writeTextFile(
    resolve(outputDir, 'adapter.manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
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
  writeTextFile(
    resolve(outputDir, 'agent-wrapper.manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
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

export function handleGenerateAdapter(flags: FlagMap): void {
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

export function handleGenerateAgentWrapper(flags: FlagMap): void {
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
