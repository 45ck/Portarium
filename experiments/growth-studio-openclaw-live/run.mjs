// @ts-check

import { randomBytes } from 'node:crypto';
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { assert, runExperiment } from '../shared/experiment-runner.js';

const EXPERIMENT_NAME = 'growth-studio-openclaw-live';
const __filename = fileURLToPath(import.meta.url);
const EXPERIMENT_DIR = dirname(__filename);
const REPO_ROOT = resolve(EXPERIMENT_DIR, '..', '..');
const FIXTURES_DIR = join(EXPERIMENT_DIR, 'fixtures');
const RESULTS_DIR = join(EXPERIMENT_DIR, 'results');
const RUNTIME_DIR = join(RESULTS_DIR, 'runtime');
const WORKSPACE_DIR = join(RUNTIME_DIR, 'workspace');
const INPUTS_DIR = join(WORKSPACE_DIR, 'inputs');
const OUTPUTS_DIR = join(WORKSPACE_DIR, 'outputs');
const OPENCLAW_STATE_DIR = join(RUNTIME_DIR, 'openclaw-state');
const OPENCLAW_CONFIG_PATH = join(RUNTIME_DIR, 'openclaw.json');
const CONTROL_PLANE_LOG = join(RESULTS_DIR, 'control-plane.log');
const AGENT_STDOUT_LOG = join(RESULTS_DIR, 'agent.stdout.log');
const AGENT_STDERR_LOG = join(RESULTS_DIR, 'agent.stderr.log');
const PLUGIN_DOCTOR_LOG = join(RESULTS_DIR, 'plugin-doctor.log');
const APPROVALS_SNAPSHOT = join(RESULTS_DIR, 'approvals.json');
const EVIDENCE_SNAPSHOT = join(RESULTS_DIR, 'evidence.json');
const OUTPUTS_SNAPSHOT = join(RESULTS_DIR, 'outputs.snapshot.json');
const RUN_CONTEXT = join(RESULTS_DIR, 'run-context.json');
const SESSION_ID = `growth-studio-live-${Date.now()}`;

const WORKSPACE_ID = process.env['PORTARIUM_WORKSPACE_ID'] ?? 'ws-growth-studio-live';
const TENANT_ID = process.env['PORTARIUM_TENANT_ID'] ?? 'default';
const AGENT_TOKEN = process.env['PORTARIUM_BEARER_TOKEN'] ?? 'growth-studio-agent-token';
const OPERATOR_TOKEN = process.env['PORTARIUM_OPERATOR_TOKEN'] ?? 'growth-studio-operator-token';
const MODEL_PRIMARY = process.env['OPENROUTER_MODEL'] ?? 'openrouter/minimax/minimax-m2.5';

const FIXTURE_FILES = ['icp.json', 'prospect.json', 'content-brief.md'];

const OUTPUT_FILES = [
  'research-summary.md',
  'outreach-plan.json',
  'email-draft.md',
  'execution-queue.json',
  'metrics-baseline.json',
];

const AGENT_MESSAGE = [
  'You are running a controlled Growth Studio rehearsal inside the current workspace.',
  'Use filesystem tools only.',
  'Do not use shell, exec, terminal, browser, or network tools.',
  'Read these files in ./inputs/: icp.json, prospect.json, content-brief.md.',
  'Then create these files in ./outputs/:',
  '- research-summary.md',
  '- outreach-plan.json',
  '- email-draft.md',
  '- execution-queue.json',
  '- metrics-baseline.json',
  'Keep the content concise, factual, and grounded in the inputs.',
  'The execution queue should stage one operator-approved outreach action rather than sending anything live.',
  'After writing the files, reply with a short summary of what you produced.',
].join('\n');

/**
 * @typedef {{
 *   key: string | null;
 *   source: string | null;
 *   baseUrl: string;
 * }} OpenRouterCredentialDiscovery
 */

/**
 * @typedef {{
 *   approvalId: string;
 *   statusBefore?: string;
 *   statusAfter?: string;
 *   toolName?: string;
 *   approvedAtIso?: string;
 * }} ApprovalTrace
 */

const outcome = await runExperiment({
  name: EXPERIMENT_NAME,
  hypothesis:
    'A live OpenClaw agent using OpenRouter and the Portarium governance plugin can read Growth Studio inputs, pause on each write:file mutation, resume after operator approval, and produce a local Growth Studio output bundle with recorded evidence.',

  async setup(ctx) {
    ensureDir(RESULTS_DIR);
    resetGeneratedArtifacts();
    ensureDir(RUNTIME_DIR);
    ensureDir(WORKSPACE_DIR);
    ensureDir(INPUTS_DIR);
    ensureDir(OUTPUTS_DIR);
    ensureDir(OPENCLAW_STATE_DIR);

    for (const file of FIXTURE_FILES) {
      copyFileSync(join(FIXTURES_DIR, file), join(INPUTS_DIR, file));
    }

    const credentials = discoverOpenRouterCredentials();
    ctx.state.credentials = {
      keySource: credentials.source,
      keyDiscovered: credentials.key !== null,
      baseUrl: credentials.baseUrl,
    };

    const controlPlanePort = await findFreePort();
    const gatewayPort = await findFreePort();
    ctx.state.portariumUrl = `http://127.0.0.1:${controlPlanePort}`;
    ctx.state.gatewayPort = gatewayPort;
    ctx.state.sessionId = SESSION_ID;

    writeJson(RUN_CONTEXT, {
      experiment: EXPERIMENT_NAME,
      sessionId: SESSION_ID,
      workspaceId: WORKSPACE_ID,
      tenantId: TENANT_ID,
      modelPrimary: MODEL_PRIMARY,
      portariumUrl: ctx.state.portariumUrl,
      gatewayPort,
      openRouterKeySource: credentials.source,
      openRouterKeyDiscovered: credentials.key !== null,
      workspaceDir: WORKSPACE_DIR,
      outputsDir: OUTPUTS_DIR,
      generatedAt: new Date().toISOString(),
    });

    writeJson(
      OPENCLAW_CONFIG_PATH,
      buildOpenClawConfig({
        gatewayPort,
        portariumUrl: /** @type {string} */ (ctx.state.portariumUrl),
        openRouterApiKey: credentials.key,
        openRouterBaseUrl: credentials.baseUrl,
      }),
    );

    const controlPlane = spawn(
      process.execPath,
      ['node_modules/tsx/dist/cli.mjs', 'src/presentation/runtime/control-plane.ts'],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          DEV_STUB_STORES: 'true',
          NODE_ENV: 'development',
          ENABLE_DEV_AUTH: 'true',
          PORTARIUM_DEV_TOKEN: AGENT_TOKEN,
          PORTARIUM_DEV_USER_ID: 'growth-studio-agent',
          PORTARIUM_DEV_TOKEN_2: OPERATOR_TOKEN,
          PORTARIUM_DEV_USER_ID_2: 'growth-studio-operator',
          PORTARIUM_DEV_WORKSPACE_ID: WORKSPACE_ID,
          PORTARIUM_HTTP_PORT: String(controlPlanePort),
          PORTARIUM_APPROVAL_SCHEDULER_DISABLED: 'true',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );
    pipeChildOutput(controlPlane, CONTROL_PLANE_LOG, '[control-plane]');
    ctx.state.controlPlane = controlPlane;
    ctx.state.controlPlanePid = controlPlane.pid ?? null;

    await waitForHealth(/** @type {string} */ (ctx.state.portariumUrl));
    ctx.state.health = await getJson(`${ctx.state.portariumUrl}/health`);

    const doctor = await runOpenClawCommand(
      ['plugins', 'doctor'],
      {
        OPENCLAW_CONFIG_PATH,
        OPENCLAW_STATE_DIR,
      },
      60_000,
    );
    writeFileSync(
      PLUGIN_DOCTOR_LOG,
      [doctor.stdout, doctor.stderr].filter(Boolean).join('\n').trim() + '\n',
      'utf8',
    );
    ctx.state.pluginDoctor = {
      exitCode: doctor.exitCode,
      stdout: doctor.stdout,
      stderr: doctor.stderr,
    };
  },

  async execute(ctx) {
    const portariumUrl = /** @type {string} */ (ctx.state.portariumUrl);
    const credentials =
      /** @type {{ keySource: string | null; keyDiscovered: boolean; baseUrl: string }} */ (
        ctx.state.credentials
      );

    const approvalTraces = /** @type {ApprovalTrace[]} */ ([]);
    const seenApprovalIds = new Set();
    let stopApprovalLoop = false;

    const approvalWorker = (async () => {
      while (!stopApprovalLoop) {
        const approvalsBody = await getJson(
          `${portariumUrl}/v1/workspaces/${encodeURIComponent(WORKSPACE_ID)}/approvals?status=pending`,
          agentHeaders(),
        ).catch(() => null);
        const items = Array.isArray(approvalsBody?.items) ? approvalsBody.items : [];
        for (const item of items) {
          const approvalId = String(item.id ?? item.approvalId ?? '');
          if (!approvalId || seenApprovalIds.has(approvalId)) {
            continue;
          }
          seenApprovalIds.add(approvalId);
          const before = await getJson(
            `${portariumUrl}/v1/workspaces/${encodeURIComponent(WORKSPACE_ID)}/approvals/${encodeURIComponent(approvalId)}`,
            agentHeaders(),
          ).catch(() => null);
          await postJson(
            `${portariumUrl}/v1/workspaces/${encodeURIComponent(WORKSPACE_ID)}/approvals/${encodeURIComponent(approvalId)}/decide`,
            { decision: 'Approved', rationale: 'Growth Studio live experiment auto-approval' },
            operatorHeaders(),
          );
          const after = await getJson(
            `${portariumUrl}/v1/workspaces/${encodeURIComponent(WORKSPACE_ID)}/approvals/${encodeURIComponent(approvalId)}`,
            agentHeaders(),
          ).catch(() => null);
          approvalTraces.push({
            approvalId,
            toolName: String(before?.toolName ?? item.toolName ?? ''),
            statusBefore: String(before?.status ?? ''),
            statusAfter: String(after?.status ?? ''),
            approvedAtIso: new Date().toISOString(),
          });
          writeJson(APPROVALS_SNAPSHOT, approvalTraces);
        }
        await delay(1_000);
      }
    })();

    const agentCommand = openClawCommand([
      'agent',
      '--local',
      '--agent',
      'main',
      '--session-id',
      SESSION_ID,
      '--thinking',
      'low',
      '--timeout',
      '180',
      '--message',
      AGENT_MESSAGE,
    ]);
    const agent = spawn(agentCommand.command, agentCommand.args, {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OPENCLAW_CONFIG_PATH,
        OPENCLAW_STATE_DIR,
        ...(credentials.keySource && credentials.keyDiscovered
          ? { OPENROUTER_API_KEY: discoverOpenRouterCredentials().key ?? '' }
          : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    pipeChildOutput(agent, AGENT_STDOUT_LOG, '[agent]');
    pipeChildOutput(agent, AGENT_STDERR_LOG, '[agent]');
    ctx.state.agentPid = agent.pid ?? null;

    const agentExit = await waitForExit(agent, 240_000);
    stopApprovalLoop = true;
    await approvalWorker;

    ctx.state.agentExit = agentExit;
    ctx.state.approvalTraces = approvalTraces;

    const approvals = await getJson(
      `${portariumUrl}/v1/workspaces/${encodeURIComponent(WORKSPACE_ID)}/approvals`,
      agentHeaders(),
    ).catch(() => ({ items: [] }));
    const evidence = await getJson(
      `${portariumUrl}/v1/workspaces/${encodeURIComponent(WORKSPACE_ID)}/evidence`,
      agentHeaders(),
    ).catch(() => ({ items: [] }));
    writeJson(APPROVALS_SNAPSHOT, approvals);
    writeJson(EVIDENCE_SNAPSHOT, evidence);
    ctx.state.approvals = approvals;
    ctx.state.evidence = evidence;

    const outputSnapshot = snapshotOutputs();
    writeJson(OUTPUTS_SNAPSHOT, outputSnapshot);
    ctx.state.outputSnapshot = outputSnapshot;

    const combinedLogs = [
      safeRead(AGENT_STDOUT_LOG),
      safeRead(AGENT_STDERR_LOG),
      safeRead(CONTROL_PLANE_LOG),
    ].join('\n');
    ctx.state.observedToolCalls = extractToolCalls(combinedLogs);
    ctx.state.combinedLogs = combinedLogs;
  },

  async verify(ctx) {
    const credentials =
      /** @type {{ keySource: string | null; keyDiscovered: boolean; baseUrl: string }} */ (
        ctx.state.credentials
      );
    const agentExit =
      /** @type {{ exitCode: number | null; signal: NodeJS.Signals | null; timedOut: boolean }} */ (
        ctx.state.agentExit
      );
    const approvals = /** @type {{ items?: Array<Record<string, unknown>> }} */ (
      ctx.state.approvals
    );
    const evidence = /** @type {{ items?: Array<Record<string, unknown>> }} */ (ctx.state.evidence);
    const outputSnapshot =
      /** @type {Record<string, { exists: boolean; bytes: number; content: string }>} */ (
        ctx.state.outputSnapshot
      );
    const observedToolCalls = /** @type {string[]} */ (ctx.state.observedToolCalls ?? []);

    const approvalItems = Array.isArray(approvals.items) ? approvals.items : [];
    const evidenceItems = Array.isArray(evidence.items) ? evidence.items : [];

    return [
      assert(
        'OpenRouter credential discovered for live run',
        credentials.keyDiscovered,
        `source=${credentials.keySource ?? 'none'}`,
      ),
      assert(
        'Portarium control plane reported healthy',
        ctx.state.health !== undefined,
        JSON.stringify(ctx.state.health ?? null),
      ),
      assert(
        'OpenClaw plugin doctor completed without a command failure',
        Number((ctx.state.pluginDoctor ?? {}).exitCode ?? 1) === 0,
        `exitCode=${String((ctx.state.pluginDoctor ?? {}).exitCode ?? 'unknown')}`,
      ),
      assert(
        'OpenClaw agent process exited cleanly',
        agentExit.exitCode === 0 && agentExit.timedOut === false,
        `exitCode=${String(agentExit.exitCode)}, timedOut=${String(agentExit.timedOut)}, signal=${String(agentExit.signal)}`,
      ),
      assert(
        'Observed at least one governed write:file mutation',
        observedToolCalls.includes('write:file'),
        observedToolCalls.join(', '),
      ),
      assert(
        'Observed at least one read:file access for research inputs',
        observedToolCalls.includes('read:file'),
        observedToolCalls.join(', '),
      ),
      assert(
        'At least one approval record was created',
        approvalItems.length > 0,
        `approvals=${approvalItems.length}`,
      ),
      assert(
        'All captured approvals reached Approved status',
        approvalItems.length > 0 &&
          approvalItems.every((item) => String(item.status ?? '').toLowerCase() === 'approved'),
        approvalItems
          .map((item) => `${String(item.toolName ?? 'unknown')}:${String(item.status ?? '')}`)
          .join(', '),
      ),
      assert(
        'Evidence records were captured for the run',
        evidenceItems.length > 0,
        `evidence=${evidenceItems.length}`,
      ),
      assert(
        'Growth Studio output bundle exists',
        OUTPUT_FILES.every((file) => outputSnapshot[file]?.exists === true),
        OUTPUT_FILES.filter((file) => outputSnapshot[file]?.exists !== true).join(', ') ||
          'all-present',
      ),
      assert(
        'Draft artifacts mention the target company',
        ['research-summary.md', 'email-draft.md'].every((file) =>
          outputSnapshot[file]?.content.includes('Northstar Pipeline'),
        ),
        'Expected Northstar Pipeline in research-summary.md and email-draft.md',
      ),
    ];
  },

  async teardown(ctx) {
    const controlPlane = /** @type {import('node:child_process').ChildProcess | undefined} */ (
      ctx.state.controlPlane
    );
    if (controlPlane && controlPlane.exitCode === null) {
      controlPlane.kill();
      await waitForExit(controlPlane, 15_000).catch(() => {});
    }
  },
});

console.log(`Result: ${outcome.outcome} (${outcome.duration_ms}ms)`);
for (const item of outcome.assertions) {
  const mark = item.passed ? 'PASS' : 'FAIL';
  const detail = item.detail ? ` -- ${item.detail}` : '';
  console.log(`  ${mark}: ${item.label}${detail}`);
}
if (outcome.error) {
  console.log(`Error: ${outcome.error}`);
}

process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;

function buildOpenClawConfig(input) {
  const gatewayToken = randomBytes(20).toString('hex');
  return {
    env: {
      ...(input.openRouterApiKey ? { OPENROUTER_API_KEY: input.openRouterApiKey } : {}),
      OPENROUTER_BASE_URL: input.openRouterBaseUrl,
      GATEWAY_AUTH_TOKEN: gatewayToken,
    },
    auth: {
      profiles: {
        'openrouter:default': {
          provider: 'openrouter',
          mode: 'api_key',
        },
      },
    },
    models: {
      mode: 'merge',
    },
    agents: {
      defaults: {
        model: {
          primary: MODEL_PRIMARY,
          fallbacks: [],
        },
        models: {
          [MODEL_PRIMARY]: {},
        },
        workspace: WORKSPACE_DIR,
        userTimezone: 'Australia/Sydney',
        thinkingDefault: 'low',
        sandbox: {
          mode: 'off',
        },
      },
      list: [
        {
          id: 'main',
          default: true,
          name: 'Growth Studio Lab',
          workspace: WORKSPACE_DIR,
          identity: {
            name: 'Growth Studio Lab',
          },
          tools: {
            profile: 'coding',
            alsoAllow: ['group:fs'],
          },
        },
      ],
    },
    gateway: {
      port: input.gatewayPort,
      mode: 'local',
      bind: 'loopback',
      auth: {
        mode: 'token',
        token: '${GATEWAY_AUTH_TOKEN}',
      },
      tailscale: {
        mode: 'off',
        resetOnExit: false,
      },
    },
    plugins: {
      load: {
        paths: [join(REPO_ROOT, 'packages', 'openclaw-plugin')],
      },
      entries: {
        'openclaw-plugin': {
          enabled: true,
          config: {
            portariumUrl: input.portariumUrl,
            workspaceId: WORKSPACE_ID,
            bearerToken: AGENT_TOKEN,
            tenantId: TENANT_ID,
            failClosed: true,
            approvalTimeoutMs: 900_000,
            pollIntervalMs: 1_000,
            defaultPolicyIds: ['default-governance'],
            defaultExecutionTier: 'HumanApprove',
          },
        },
      },
    },
  };
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function resetGeneratedArtifacts() {
  rmSync(RUNTIME_DIR, { recursive: true, force: true });
  for (const file of [
    CONTROL_PLANE_LOG,
    AGENT_STDOUT_LOG,
    AGENT_STDERR_LOG,
    PLUGIN_DOCTOR_LOG,
    APPROVALS_SNAPSHOT,
    EVIDENCE_SNAPSHOT,
    OUTPUTS_SNAPSHOT,
    RUN_CONTEXT,
  ]) {
    rmSync(file, { force: true });
  }
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function safeRead(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function pipeChildOutput(child, targetPath, label) {
  const append = (chunk) => {
    const text = chunk.toString();
    appendFileSync(targetPath, text, 'utf8');
    process.stdout.write(`${label} ${text}`);
  };
  child.stdout?.on('data', append);
  child.stderr?.on('data', append);
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolveResult, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) {
        return;
      }
      finished = true;
      child.kill();
      resolveResult({ exitCode: child.exitCode, signal: child.signalCode, timedOut: true });
    }, timeoutMs);

    child.once('error', (error) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      reject(error);
    });

    child.once('exit', (exitCode, signal) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      resolveResult({ exitCode, signal, timedOut: false });
    });
  });
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      if (response.ok) {
        return;
      }
    } catch (error) {
      void error;
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for Portarium health at ${baseUrl}`);
}

function agentHeaders() {
  return {
    authorization: `Bearer ${AGENT_TOKEN}`,
    'content-type': 'application/json',
    'x-portarium-tenant-id': TENANT_ID,
    'x-portarium-workspace-id': WORKSPACE_ID,
  };
}

function operatorHeaders() {
  return {
    authorization: `Bearer ${OPERATOR_TOKEN}`,
    'content-type': 'application/json',
    'x-portarium-tenant-id': TENANT_ID,
    'x-portarium-workspace-id': WORKSPACE_ID,
  };
}

async function getJson(url, headers = {}) {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  }
  return await response.json();
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`POST ${url} failed: HTTP ${response.status}`);
  }
  return await response.json();
}

function snapshotOutputs() {
  /** @type {Record<string, { exists: boolean; bytes: number; content: string }>} */
  const snapshot = {};
  for (const file of OUTPUT_FILES) {
    const path = join(OUTPUTS_DIR, file);
    if (!existsSync(path)) {
      snapshot[file] = { exists: false, bytes: 0, content: '' };
      continue;
    }
    const content = readFileSync(path, 'utf8');
    snapshot[file] = {
      exists: true,
      bytes: Buffer.byteLength(content, 'utf8'),
      content,
    };
  }
  return snapshot;
}

function extractToolCalls(logText) {
  const matches = [...logText.matchAll(/Governing tool call: ([^\r\n]+)/g)];
  return [...new Set(matches.map((match) => String(match[1] ?? '').trim()).filter(Boolean))];
}

function openClawCommand(args) {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'openclaw', ...args],
    };
  }
  return {
    command: 'openclaw',
    args,
  };
}

function discoverOpenRouterCredentials() {
  const envKey = process.env['OPENROUTER_API_KEY'];
  if (envKey) {
    return {
      key: envKey,
      source: 'process.env.OPENROUTER_API_KEY',
      baseUrl: process.env['OPENROUTER_BASE_URL'] ?? 'https://openrouter.ai/api/v1',
    };
  }

  const homeEnvPath = join(resolveHomeDir(), '.openclaw', '.env');
  if (existsSync(homeEnvPath)) {
    const parsed = parseEnvFile(homeEnvPath);
    if (parsed['OPENROUTER_API_KEY']) {
      return {
        key: parsed['OPENROUTER_API_KEY'],
        source: homeEnvPath,
        baseUrl: parsed['OPENROUTER_BASE_URL'] ?? 'https://openrouter.ai/api/v1',
      };
    }
  }

  const legacyConfigPath = 'D:\\CLAW\\context\\openclaw.json';
  if (existsSync(legacyConfigPath)) {
    try {
      const parsed = JSON.parse(readFileSync(legacyConfigPath, 'utf8'));
      const env = parsed?.env ?? {};
      if (typeof env.OPENROUTER_API_KEY === 'string' && env.OPENROUTER_API_KEY.length > 0) {
        return {
          key: env.OPENROUTER_API_KEY,
          source: legacyConfigPath,
          baseUrl:
            typeof env.OPENROUTER_BASE_URL === 'string'
              ? env.OPENROUTER_BASE_URL
              : 'https://openrouter.ai/api/v1',
        };
      }
    } catch (error) {
      void error;
    }
  }

  return {
    key: null,
    source: null,
    baseUrl: 'https://openrouter.ai/api/v1',
  };
}

function resolveHomeDir() {
  return process.env['USERPROFILE'] ?? process.env['HOME'] ?? tmpdir();
}

function parseEnvFile(path) {
  /** @type {Record<string, string>} */
  const values = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    if (!line || line.trimStart().startsWith('#')) {
      continue;
    }
    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    values[key] = value;
  }
  return values;
}

async function findFreePort() {
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to resolve free port'));
        return;
      }
      server.close(() => resolvePort(address.port));
    });
  });
}

function runShortCommand(command, args, extraEnv, timeoutMs) {
  return new Promise((resolveResult, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      child.kill();
      resolveResult({
        exitCode: null,
        stdout,
        stderr: `${stderr}\nTimed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (exitCode) => {
      clearTimeout(timer);
      resolveResult({ exitCode, stdout, stderr });
    });
  });
}

function runOpenClawCommand(args, extraEnv, timeoutMs) {
  const command = openClawCommand(args);
  return runShortCommand(command.command, command.args, extraEnv, timeoutMs);
}
