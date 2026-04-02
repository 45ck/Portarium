// @ts-check

import { createHash, randomBytes } from 'node:crypto';
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  watch,
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
const REPRO_DIR = join(EXPERIMENT_DIR, 'repro');
const RESULTS_DIR = join(EXPERIMENT_DIR, 'results');
const RUNTIME_DIR = join(RESULTS_DIR, 'runtime');
const OPENCLAW_HOME_DIR = join(RUNTIME_DIR, 'home');
const WORKSPACE_DIR = join(RUNTIME_DIR, 'workspace');
const INPUTS_DIR = join(WORKSPACE_DIR, 'inputs');
const OUTPUTS_DIR = join(WORKSPACE_DIR, 'outputs');
const OPENCLAW_STATE_DIR = join(RUNTIME_DIR, 'openclaw-state');
const OPENCLAW_CONFIG_PATH = join(RUNTIME_DIR, 'openclaw.json');
const OPENCLAW_TEMPLATE_PATH = join(REPRO_DIR, 'openclaw.template.json');
const CONTROL_PLANE_LOG = join(RESULTS_DIR, 'control-plane.log');
const AGENT_STDOUT_LOG = join(RESULTS_DIR, 'agent.stdout.log');
const AGENT_STDERR_LOG = join(RESULTS_DIR, 'agent.stderr.log');
const OPENCLAW_DOCTOR_LOG = join(RESULTS_DIR, 'openclaw-doctor.log');
const PLUGIN_DOCTOR_LOG = join(RESULTS_DIR, 'plugin-doctor.log');
const APPROVALS_SNAPSHOT = join(RESULTS_DIR, 'approvals.json');
const EVIDENCE_SNAPSHOT = join(RESULTS_DIR, 'evidence.json');
const OUTPUTS_SNAPSHOT = join(RESULTS_DIR, 'outputs.snapshot.json');
const RUN_CONTEXT = join(RESULTS_DIR, 'run-context.json');
const TIMELINE_PATH = join(RESULTS_DIR, 'timeline.ndjson');
const SESSION_ID = `growth-studio-live-${Date.now()}`;
const TIMELINE_START_MS = Date.now();

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

const WORKSPACE_BOOTSTRAP = `# BOOTSTRAP.md

This workspace is already configured for a controlled experiment.

Do not run an identity bootstrap.
Do not ask the user what to do next.
Do not pause for clarification.

Read \`TASK.md\` and execute it autonomously now.
`;

const WORKSPACE_AGENTS = `# AGENTS.md

You are running inside a scientific experiment workspace.

Rules:

- Act autonomously.
- Use local filesystem tools only.
- Do not use shell, exec, browser, or network tools.
- Read from \`./inputs/\`.
- Write deliverables to \`./outputs/\`.
- If a write tool requires approval, wait and continue after approval.
- Do not ask follow-up questions unless the task is physically impossible.
`;

const WORKSPACE_TASK = `# TASK.md

Complete a Growth Studio rehearsal using the local input files.

Inputs:

- ./inputs/icp.json
- ./inputs/prospect.json
- ./inputs/content-brief.md

Deliverables:

- ./outputs/research-summary.md
- ./outputs/outreach-plan.json
- ./outputs/email-draft.md
- ./outputs/execution-queue.json
- ./outputs/metrics-baseline.json

Requirements:

- Ground all content in the supplied inputs.
- Mention Northstar Pipeline where relevant.
- Stage execution as a queued outreach artifact only; do not pretend to send anything.
- Keep outputs concise and operator-friendly.
- Finish by summarizing what you created.
`;

const AGENT_MESSAGE = [
  'You are running a controlled Growth Studio rehearsal inside the current workspace.',
  'The workspace is already bootstrapped for this experiment.',
  'Do not ask questions.',
  'Do not offer options.',
  'Act autonomously until the task is complete.',
  'Read TASK.md first, then execute it.',
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
    appendTimelineEvent('experiment.setup_started', { experiment: EXPERIMENT_NAME });
    ensureDir(RUNTIME_DIR);
    ensureDir(OPENCLAW_HOME_DIR);
    ensureDir(WORKSPACE_DIR);
    ensureDir(INPUTS_DIR);
    ensureDir(OUTPUTS_DIR);
    ensureDir(OPENCLAW_STATE_DIR);
    ensureDir(join(OPENCLAW_STATE_DIR, 'credentials'));
    ensureDir(join(OPENCLAW_STATE_DIR, 'completions'));
    ensureDir(join(OPENCLAW_STATE_DIR, 'agents', 'main', 'sessions'));
    ctx.state.outputWatcher = startOutputWatcher();

    for (const file of FIXTURE_FILES) {
      copyFileSync(join(FIXTURES_DIR, file), join(INPUTS_DIR, file));
      appendTimelineEvent('workspace.input_copied', { file, target: join(INPUTS_DIR, file) });
    }
    writeFileSync(join(WORKSPACE_DIR, 'BOOTSTRAP.md'), WORKSPACE_BOOTSTRAP, 'utf8');
    writeFileSync(join(WORKSPACE_DIR, 'AGENTS.md'), WORKSPACE_AGENTS, 'utf8');
    writeFileSync(join(WORKSPACE_DIR, 'TASK.md'), WORKSPACE_TASK, 'utf8');
    appendTimelineEvent('workspace.control_file_written', { file: 'BOOTSTRAP.md' });
    appendTimelineEvent('workspace.control_file_written', { file: 'AGENTS.md' });
    appendTimelineEvent('workspace.control_file_written', { file: 'TASK.md' });

    const credentials = discoverOpenRouterCredentials();
    ctx.state.credentials = {
      keySource: credentials.source,
      keyDiscovered: credentials.key !== null,
      baseUrl: credentials.baseUrl,
    };
    appendTimelineEvent('openrouter.credentials_discovered', {
      discovered: credentials.key !== null,
      source: credentials.source ?? 'none',
      baseUrl: credentials.baseUrl,
    });

    const controlPlanePort = await findFreePort();
    const gatewayPort = await findFreePort();
    ctx.state.portariumUrl = `http://127.0.0.1:${controlPlanePort}`;
    ctx.state.gatewayPort = gatewayPort;
    ctx.state.sessionId = SESSION_ID;
    appendTimelineEvent('runtime.ports_reserved', {
      controlPlanePort,
      gatewayPort,
      sessionId: SESSION_ID,
    });

    const openClawLocator = await locateOpenClawBinary();
    const renderedConfig = buildOpenClawConfig({
      gatewayPort,
      portariumUrl: /** @type {string} */ (ctx.state.portariumUrl),
      openRouterApiKey: credentials.key,
      openRouterBaseUrl: credentials.baseUrl,
    });
    writeJson(OPENCLAW_CONFIG_PATH, renderedConfig);
    appendTimelineEvent('openclaw.config_rendered', {
      templatePath: OPENCLAW_TEMPLATE_PATH,
      outputPath: OPENCLAW_CONFIG_PATH,
    });

    const version = await runOpenClawCommand(['--version'], buildOpenClawRuntimeEnv(), 90_000);
    const resolvedOpenClawVersion = extractOpenClawVersion(version.stdout, version.stderr);
    ctx.state.openClawVersion = {
      exitCode: version.exitCode,
      stdout: version.stdout.trim(),
      stderr: version.stderr.trim(),
      locator: openClawLocator,
    };
    appendTimelineEvent('openclaw.version_checked', {
      exitCode: version.exitCode,
      version: resolvedOpenClawVersion,
      locator: openClawLocator,
    });

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
      openClawVersion: resolvedOpenClawVersion,
      openClawVersionExitCode: version.exitCode,
      openClawBinary: openClawLocator.primary,
      openClawBinaryCandidates: openClawLocator.candidates,
      openClawOfficialWebsite: 'https://openclaw.ai/',
      openClawOfficialRepository: 'https://github.com/openclaw/openclaw',
      openClawTrackedTemplatePath: OPENCLAW_TEMPLATE_PATH,
      workspaceDir: WORKSPACE_DIR,
      outputsDir: OUTPUTS_DIR,
      generatedAt: new Date().toISOString(),
    });
    appendTimelineEvent('experiment.run_context_written', { path: RUN_CONTEXT });

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
    pipeChildOutput(
      controlPlane,
      CONTROL_PLANE_LOG,
      CONTROL_PLANE_LOG,
      '[control-plane]',
      'control-plane',
    );
    ctx.state.controlPlane = controlPlane;
    ctx.state.controlPlanePid = controlPlane.pid ?? null;
    appendTimelineEvent('process.spawned', {
      process: 'control-plane',
      pid: controlPlane.pid ?? null,
    });

    await waitForHealth(/** @type {string} */ (ctx.state.portariumUrl));
    ctx.state.health = await getJson(`${ctx.state.portariumUrl}/health`);
    appendTimelineEvent('control-plane.healthy', {
      health: ctx.state.health,
    });

    appendTimelineEvent('openclaw.plugins_doctor_started', {});
    const doctor = await runOpenClawCommand(
      ['plugins', 'doctor'],
      buildOpenClawRuntimeEnv(),
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
    appendTimelineEvent('openclaw.plugins_doctor_finished', {
      exitCode: doctor.exitCode,
    });

    appendTimelineEvent('openclaw.doctor_started', {});
    const fullDoctor = await runOpenClawCommand(['doctor'], buildOpenClawRuntimeEnv(), 90_000);
    writeFileSync(
      OPENCLAW_DOCTOR_LOG,
      [fullDoctor.stdout, fullDoctor.stderr].filter(Boolean).join('\n').trim() + '\n',
      'utf8',
    );
    ctx.state.openClawDoctor = {
      exitCode: fullDoctor.exitCode,
      stdout: fullDoctor.stdout,
      stderr: fullDoctor.stderr,
    };
    appendTimelineEvent('openclaw.doctor_finished', {
      exitCode: fullDoctor.exitCode,
    });
  },

  async execute(ctx) {
    const portariumUrl = /** @type {string} */ (ctx.state.portariumUrl);
    const credentials =
      /** @type {{ keySource: string | null; keyDiscovered: boolean; baseUrl: string }} */ (
        ctx.state.credentials
      );
    appendTimelineEvent('experiment.execute_started', {
      portariumUrl,
      workspaceId: WORKSPACE_ID,
    });

    const approvalTraces = /** @type {ApprovalTrace[]} */ ([]);
    const seenApprovalIds = new Set();
    let stopApprovalLoop = false;

    const approvalWorker = (async () => {
      while (!stopApprovalLoop) {
        const approvalsBody = await getJson(
          `${portariumUrl}/v1/workspaces/${encodeURIComponent(WORKSPACE_ID)}/approvals`,
          agentHeaders(),
        ).catch(() => null);
        const items = Array.isArray(approvalsBody?.items)
          ? approvalsBody.items.filter(
              (item) => String(item.status ?? '').toLowerCase() === 'pending',
            )
          : [];
        for (const item of items) {
          const approvalId = String(item.id ?? item.approvalId ?? '');
          if (!approvalId || seenApprovalIds.has(approvalId)) {
            continue;
          }
          seenApprovalIds.add(approvalId);
          appendTimelineEvent('approval.pending_detected', {
            approvalId,
            toolName: String(item.toolName ?? ''),
            status: String(item.status ?? ''),
          });
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
          appendTimelineEvent('approval.decided', {
            approvalId,
            toolName: String(before?.toolName ?? item.toolName ?? ''),
            statusBefore: String(before?.status ?? ''),
            statusAfter: String(after?.status ?? ''),
          });
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
        ...buildOpenClawRuntimeEnv(),
        ...(credentials.keySource && credentials.keyDiscovered
          ? { OPENROUTER_API_KEY: discoverOpenRouterCredentials().key ?? '' }
          : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    pipeChildOutput(agent, AGENT_STDOUT_LOG, AGENT_STDERR_LOG, '[agent]', 'agent');
    ctx.state.agentPid = agent.pid ?? null;
    appendTimelineEvent('process.spawned', {
      process: 'agent',
      pid: agent.pid ?? null,
      sessionId: SESSION_ID,
    });

    const agentExit = await waitForExit(agent, 240_000);
    stopApprovalLoop = true;
    await approvalWorker;

    ctx.state.agentExit = agentExit;
    ctx.state.approvalTraces = approvalTraces;
    appendTimelineEvent('process.exited', {
      process: 'agent',
      exitCode: agentExit.exitCode,
      signal: agentExit.signal,
      timedOut: agentExit.timedOut,
    });

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
    appendTimelineEvent('snapshot.captured', {
      approvals: Array.isArray(approvals.items) ? approvals.items.length : 0,
      evidence: Array.isArray(evidence.items) ? evidence.items.length : 0,
    });

    const outputSnapshot = snapshotOutputs();
    writeJson(OUTPUTS_SNAPSHOT, outputSnapshot);
    ctx.state.outputSnapshot = outputSnapshot;
    appendTimelineEvent('outputs.snapshot_captured', {
      files: Object.fromEntries(
        Object.entries(outputSnapshot).map(([file, meta]) => [
          file,
          { exists: meta.exists, bytes: meta.bytes, sha256: meta.sha256 },
        ]),
      ),
    });

    const combinedLogs = [
      safeRead(AGENT_STDOUT_LOG),
      safeRead(AGENT_STDERR_LOG),
      safeRead(CONTROL_PLANE_LOG),
    ].join('\n');
    ctx.state.observedToolCalls = extractToolCalls(combinedLogs);
    ctx.state.combinedLogs = combinedLogs;
    appendTimelineEvent('experiment.execute_finished', {
      observedToolCalls: ctx.state.observedToolCalls,
    });
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
      /** @type {Record<string, { exists: boolean; bytes: number; sha256: string; content: string }>} */ (
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
        'OpenClaw doctor completed without a command failure',
        Number((ctx.state.openClawDoctor ?? {}).exitCode ?? 1) === 0,
        `exitCode=${String((ctx.state.openClawDoctor ?? {}).exitCode ?? 'unknown')}`,
      ),
      assert(
        'OpenClaw agent process exited cleanly',
        agentExit.exitCode === 0 && agentExit.timedOut === false,
        `exitCode=${String(agentExit.exitCode)}, timedOut=${String(agentExit.timedOut)}, signal=${String(agentExit.signal)}`,
      ),
      assert(
        'Observed at least one governed write:file mutation',
        observedToolCalls.includes('write:file') || observedToolCalls.includes('write'),
        observedToolCalls.join(', '),
      ),
      assert(
        'Observed at least one read:file access for research inputs',
        observedToolCalls.includes('read:file') || observedToolCalls.includes('read'),
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
        (outputSnapshot['research-summary.md']?.content.includes('Northstar Pipeline') ?? false) &&
          ((outputSnapshot['email-draft.md']?.content.includes('Northstar Pipeline') ?? false) ||
            (outputSnapshot['email-draft.md']?.content.includes('Northstar') ?? false)),
        'Expected Northstar Pipeline in research-summary.md and Northstar/Northstar Pipeline in email-draft.md',
      ),
    ];
  },

  async teardown(ctx) {
    const outputWatcher = /** @type {import('node:fs').FSWatcher | undefined} */ (
      ctx.state.outputWatcher
    );
    outputWatcher?.close();
    appendTimelineEvent('workspace.output_watch_stopped', {});

    const controlPlane = /** @type {import('node:child_process').ChildProcess | undefined} */ (
      ctx.state.controlPlane
    );
    if (controlPlane && controlPlane.exitCode === null) {
      controlPlane.kill();
      const controlPlaneExit = await waitForExit(controlPlane, 15_000).catch(() => null);
      if (controlPlaneExit) {
        appendTimelineEvent('process.exited', {
          process: 'control-plane',
          exitCode: controlPlaneExit.exitCode,
          signal: controlPlaneExit.signal,
          timedOut: controlPlaneExit.timedOut,
        });
      }
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
  return pruneNullishFields(
    renderJsonTemplate(OPENCLAW_TEMPLATE_PATH, {
      OPENROUTER_API_KEY: input.openRouterApiKey,
      OPENROUTER_BASE_URL: input.openRouterBaseUrl,
      GATEWAY_AUTH_TOKEN: gatewayToken,
      MODEL_PRIMARY,
      EXPERIMENT_WORKSPACE_DIR: WORKSPACE_DIR,
      GATEWAY_PORT: input.gatewayPort,
      PORTARIUM_PLUGIN_PATH: join(REPO_ROOT, 'packages', 'openclaw-plugin'),
      PORTARIUM_URL: input.portariumUrl,
      WORKSPACE_ID,
      AGENT_TOKEN,
      TENANT_ID,
    }),
  );
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
    OPENCLAW_DOCTOR_LOG,
    APPROVALS_SNAPSHOT,
    EVIDENCE_SNAPSHOT,
    OUTPUTS_SNAPSHOT,
    RUN_CONTEXT,
    TIMELINE_PATH,
  ]) {
    rmSync(file, { force: true });
  }
}

function appendTimelineEvent(type, data = {}) {
  ensureDir(RESULTS_DIR);
  appendFileSync(
    TIMELINE_PATH,
    JSON.stringify({
      atIso: new Date().toISOString(),
      tRelMs: Date.now() - TIMELINE_START_MS,
      type,
      data,
    }) + '\n',
    'utf8',
  );
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function safeRead(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function pipeChildOutput(child, stdoutPath, stderrPath, label, source) {
  attachStreamCapture(child.stdout, stdoutPath, label, source, 'stdout');
  attachStreamCapture(child.stderr, stderrPath, label, source, 'stderr');
}

function attachStreamCapture(stream, targetPath, label, source, streamName) {
  if (!stream) {
    return;
  }

  let buffered = '';
  const flushBufferedLines = (force = false) => {
    const lines = buffered.split(/\r?\n/);
    buffered = force ? '' : (lines.pop() ?? '');
    for (const line of force ? lines.filter((item) => item.length > 0) : lines) {
      appendTimelineEvent('process.output_line', {
        source,
        stream: streamName,
        line,
      });
    }
  };

  stream.on('data', (chunk) => {
    const text = chunk.toString();
    appendFileSync(targetPath, text, 'utf8');
    process.stdout.write(`${label} ${text}`);
    buffered += text;
    flushBufferedLines(false);
  });
  stream.on('end', () => {
    flushBufferedLines(true);
  });
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
  const startedMs = Date.now();
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    appendTimelineEvent('http.response', {
      method: 'GET',
      url: sanitizeUrlForTimeline(url),
      status: response.status,
      durationMs: Date.now() - startedMs,
    });
    if (!response.ok) {
      throw new Error(`GET ${url} failed: HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    appendTimelineEvent('http.error', {
      method: 'GET',
      url: sanitizeUrlForTimeline(url),
      durationMs: Date.now() - startedMs,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function postJson(url, body, headers = {}) {
  const startedMs = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    appendTimelineEvent('http.response', {
      method: 'POST',
      url: sanitizeUrlForTimeline(url),
      status: response.status,
      durationMs: Date.now() - startedMs,
      body: redactTimelineBody(body),
    });
    if (!response.ok) {
      throw new Error(`POST ${url} failed: HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    appendTimelineEvent('http.error', {
      method: 'POST',
      url: sanitizeUrlForTimeline(url),
      durationMs: Date.now() - startedMs,
      body: redactTimelineBody(body),
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function snapshotOutputs() {
  /** @type {Record<string, { exists: boolean; bytes: number; sha256: string; content: string }>} */
  const snapshot = {};
  for (const file of OUTPUT_FILES) {
    const path = join(OUTPUTS_DIR, file);
    if (!existsSync(path)) {
      snapshot[file] = { exists: false, bytes: 0, sha256: '', content: '' };
      continue;
    }
    const content = readFileSync(path, 'utf8');
    snapshot[file] = {
      exists: true,
      bytes: Buffer.byteLength(content, 'utf8'),
      sha256: sha256(content),
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

function buildOpenClawRuntimeEnv() {
  return {
    OPENCLAW_CONFIG_PATH,
    OPENCLAW_STATE_DIR,
    HOME: OPENCLAW_HOME_DIR,
    USERPROFILE: OPENCLAW_HOME_DIR,
  };
}

function renderJsonTemplate(templatePath, replacements) {
  const template = JSON.parse(readFileSync(templatePath, 'utf8'));
  return substituteTemplateValue(template, replacements);
}

function pruneNullishFields(value) {
  if (Array.isArray(value)) {
    return value.map((item) => pruneNullishFields(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== null && item !== undefined)
        .map(([key, item]) => [key, pruneNullishFields(item)]),
    );
  }
  return value;
}

function substituteTemplateValue(value, replacements) {
  if (typeof value === 'string') {
    const exact = value.match(/^\$\{([A-Z0-9_]+)\}$/);
    if (exact) {
      return replacements[exact[1]];
    }
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, key) => String(replacements[key] ?? ''));
  }
  if (Array.isArray(value)) {
    return value.map((item) => substituteTemplateValue(item, replacements));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        substituteTemplateValue(key, replacements),
        substituteTemplateValue(item, replacements),
      ]),
    );
  }
  return value;
}

function sanitizeUrlForTimeline(url) {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

function redactTimelineBody(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      /token|secret|key|authorization/i.test(key) ? '[REDACTED]' : item,
    ]),
  );
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function startOutputWatcher() {
  ensureDir(OUTPUTS_DIR);
  const pendingTimers = new Map();
  const watcher = watch(OUTPUTS_DIR, { persistent: false }, (eventType, filename) => {
    const file = filename?.toString();
    if (!file) {
      return;
    }

    const existing = pendingTimers.get(file);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      pendingTimers.delete(file);
      const path = join(OUTPUTS_DIR, file);
      const exists = existsSync(path);
      const content = exists ? readFileSync(path, 'utf8') : '';
      appendTimelineEvent('workspace.output_changed', {
        eventType,
        file,
        exists,
        bytes: exists ? Buffer.byteLength(content, 'utf8') : 0,
        sha256: exists ? sha256(content) : '',
      });
    }, 75);
    pendingTimers.set(file, timer);
  });

  appendTimelineEvent('workspace.output_watch_started', { path: OUTPUTS_DIR });
  return watcher;
}

function extractOpenClawVersion(stdout, stderr) {
  const versionPattern = /\b\d{4}\.\d+\.\d+\b/;
  return (
    stdout.match(versionPattern)?.[0] ??
    stderr.match(versionPattern)?.[0] ??
    stdout.trim() ??
    stderr.trim() ??
    ''
  );
}

async function locateOpenClawBinary() {
  const locator =
    process.platform === 'win32'
      ? await runShortCommand('where', ['openclaw'], {}, 10_000).catch(() => null)
      : await runShortCommand('which', ['openclaw'], {}, 10_000).catch(() => null);
  const candidates = (locator?.stdout || locator?.stderr || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    primary: candidates[0] ?? 'unresolved',
    candidates,
  };
}
