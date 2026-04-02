// @ts-check

import { createHash, randomBytes } from 'node:crypto';
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  watch,
  writeFileSync,
} from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { assert, runExperiment } from '../shared/experiment-runner.js';

const EXPERIMENT_NAME = 'micro-saas-agent-stack';
const __filename = fileURLToPath(import.meta.url);
const EXPERIMENT_DIR = dirname(__filename);
const REPO_ROOT = resolve(EXPERIMENT_DIR, '..', '..');
const FIXTURES_DIR = join(EXPERIMENT_DIR, 'fixtures');
const REPRO_DIR = join(EXPERIMENT_DIR, 'repro');
const TOOLING_DIR = join(REPRO_DIR, 'tooling');
const RESULTS_DIR = join(EXPERIMENT_DIR, 'results');
const RUNTIME_DIR = join(RESULTS_DIR, 'runtime');
const OPENCLAW_HOME_DIR = join(RUNTIME_DIR, 'home');
const OPENCLAW_STATE_DIR = join(RUNTIME_DIR, 'openclaw-state');
const OPENCLAW_CONFIG_PATH = join(RUNTIME_DIR, 'openclaw.json');
const OPENCLAW_TEMPLATE_PATH = join(REPRO_DIR, 'openclaw.template.json');
const WORKSPACE_DIR = join(RUNTIME_DIR, 'workspace');
const INPUTS_DIR = join(WORKSPACE_DIR, 'inputs');
const STUBS_DIR = join(WORKSPACE_DIR, 'stubs');
const OUTPUTS_DIR = join(WORKSPACE_DIR, 'outputs');
const SITE_DIR = join(WORKSPACE_DIR, 'site');
const TOOLS_DIR = join(WORKSPACE_DIR, 'tools');
const QA_DIR = join(WORKSPACE_DIR, 'qa');

const CONTROL_PLANE_LOG = join(RESULTS_DIR, 'control-plane.log');
const AGENT_STDOUT_LOG = join(RESULTS_DIR, 'agent.stdout.log');
const AGENT_STDERR_LOG = join(RESULTS_DIR, 'agent.stderr.log');
const OPENCLAW_DOCTOR_LOG = join(RESULTS_DIR, 'openclaw-doctor.log');
const PLUGIN_DOCTOR_LOG = join(RESULTS_DIR, 'plugin-doctor.log');
const APPROVALS_SNAPSHOT = join(RESULTS_DIR, 'approvals.json');
const EVIDENCE_SNAPSHOT = join(RESULTS_DIR, 'evidence.json');
const OUTPUTS_SNAPSHOT = join(RESULTS_DIR, 'outputs.snapshot.json');
const SITE_SNAPSHOT = join(RESULTS_DIR, 'site.snapshot.json');
const STUB_STATE_AFTER_AGENT = join(RESULTS_DIR, 'stub-state.after-agent.json');
const STUB_STATE_AFTER_QA = join(RESULTS_DIR, 'stub-state.after-qa.json');
const TOOLCHAIN_MANIFEST = join(RESULTS_DIR, 'toolchain-manifest.json');
const RUN_CONTEXT = join(RESULTS_DIR, 'run-context.json');
const TIMELINE_PATH = join(RESULTS_DIR, 'timeline.ndjson');
const PREVIEW_SERVER_LOG = join(RESULTS_DIR, 'preview-server.log');
const PREVIEW_SERVER_STATE = join(RESULTS_DIR, 'preview-server-state.json');
const QA_FLOW_PATH = join(RESULTS_DIR, 'qa-flow.json');
const MANUAL_QA_DIR = join(RESULTS_DIR, 'manual-qa');
const MANUAL_QA_BIN_ROOT = join(tmpdir(), 'vaop-micro-saas-agent-browser');
const MANUAL_QA_STDOUT_LOG = join(RESULTS_DIR, 'manual-qa.stdout.log');
const MANUAL_QA_STDERR_LOG = join(RESULTS_DIR, 'manual-qa.stderr.log');
const PLAYWRIGHT_QA_DIR = join(RESULTS_DIR, 'playwright-qa');
const PLAYWRIGHT_QA_REPORT = join(PLAYWRIGHT_QA_DIR, 'qa-report.json');
const PLAYWRIGHT_QA_SCREENSHOT = join(PLAYWRIGHT_QA_DIR, 'final-state.png');
const PROMPT_LANGUAGE_DEMO_PATH = join(RESULTS_DIR, 'prompt-language-demo.txt');

const SESSION_ID = `micro-saas-stack-${Date.now()}`;
const TIMELINE_START_MS = Date.now();

const WORKSPACE_ID = process.env['PORTARIUM_WORKSPACE_ID'] ?? 'ws-micro-saas-stack';
const TENANT_ID = process.env['PORTARIUM_TENANT_ID'] ?? 'default';
const AGENT_TOKEN = process.env['PORTARIUM_BEARER_TOKEN'] ?? 'micro-saas-agent-token';
const OPERATOR_TOKEN = process.env['PORTARIUM_OPERATOR_TOKEN'] ?? 'micro-saas-operator-token';
const DEFAULT_OPENROUTER_MODEL =
  process.env['OPENROUTER_MODEL'] ?? 'openrouter/minimax/minimax-m2.5';
const DEFAULT_OPENAI_MODEL = process.env['OPENAI_MODEL'] ?? 'openai/gpt-5.2';
const MODEL_PROVIDER_OVERRIDE = process.env['MICRO_SAAS_MODEL_PROVIDER'] ?? 'openrouter';

const TOOL_REPOS = [
  {
    id: 'openclaw',
    label: 'OpenClaw',
    envVar: 'OPENCLAW_REPO',
    defaultPath: 'D:/Visual Studio Projects/OpenClaw/openclaw',
    expectedRole: 'agent-runtime',
    requiredEntry: 'openclaw.mjs',
    ready: (root) => existsSync(join(root, 'openclaw.mjs')),
  },
  {
    id: 'content-machine',
    label: 'content-machine',
    envVar: 'CONTENT_MACHINE_REPO',
    defaultPath: 'D:/Visual Studio Projects/content-machine',
    expectedRole: 'agent-tool',
    requiredEntry: 'src/cli/index.ts',
    ready: (root) =>
      existsSync(join(root, 'src', 'cli', 'index.ts')) &&
      existsSync(join(root, 'node_modules')) &&
      existsSync(join(root, 'package.json')),
  },
  {
    id: 'demo-machine',
    label: 'demo-machine',
    envVar: 'DEMO_MACHINE_REPO',
    defaultPath: 'D:/Visual Studio Projects/demo-machine',
    expectedRole: 'agent-tool',
    requiredEntry: 'dist/cli.js',
    ready: (root) => existsSync(join(root, 'dist', 'cli.js')),
  },
  {
    id: 'manual-qa-machine',
    label: 'manual-qa-machine',
    envVar: 'MANUAL_QA_MACHINE_REPO',
    defaultPath: 'D:/Visual Studio Projects/manual-qa-machine',
    expectedRole: 'verification-tool',
    requiredEntry: 'dist/cli.js',
    ready: (root) => existsSync(join(root, 'dist', 'cli.js')),
  },
  {
    id: 'prompt-language',
    label: 'prompt-language',
    envVar: 'PROMPT_LANGUAGE_REPO',
    defaultPath: 'D:/Visual Studio Projects/prompt-language',
    expectedRole: 'runtime-harness',
    requiredEntry: 'bin/cli.mjs',
    ready: (root) =>
      existsSync(join(root, 'bin', 'cli.mjs')) &&
      existsSync(join(root, 'dist')) &&
      existsSync(join(root, 'node_modules')),
  },
];

const REQUIRED_FILES = [
  'hypothesis.md',
  'setup.md',
  'plan.md',
  'report.md',
  'fixtures/brief.json',
  'fixtures/fake-social.stub.json',
  'fixtures/fake-email.stub.json',
  'fixtures/fake-analytics.stub.json',
  'fixtures/fake-crm.stub.json',
  'repro/README.md',
  'repro/.env.example',
  'repro/openclaw.template.json',
  'repro/tooling/run-content-machine-script.mjs',
  'repro/tooling/queue-email.mjs',
  'repro/tooling/queue-social.mjs',
  'repro/tooling/update-crm.mjs',
];

const TOOLING_FILES = [
  'run-content-machine-script.mjs',
  'queue-email.mjs',
  'queue-social.mjs',
  'update-crm.mjs',
];

const OUTPUT_FILES = [
  'launch-plan.md',
  'campaign-plan.json',
  'email-draft.md',
  'social-drafts.json',
  'metrics-baseline.json',
  'operator-summary.md',
  'content-machine-script.json',
];

const STUB_FILES = [
  ['fake-social.stub.json', 'social-state.json'],
  ['fake-email.stub.json', 'email-state.json'],
  ['fake-analytics.stub.json', 'analytics-state.json'],
  ['fake-crm.stub.json', 'crm-state.json'],
];

const WORKSPACE_BOOTSTRAP = `# BOOTSTRAP.md

This workspace is already configured for a controlled micro-SaaS experiment.

Do not run identity bootstrap.
Do not ask the user what to do next.
Do not pause for clarification.

Read TASK.md, TOOLS.md, and SITE_CONTRACT.md, then execute the experiment now.
`;

const WORKSPACE_AGENTS = `# AGENTS.md

You are running inside a scientific micro-SaaS experiment workspace.

Rules:

- Act autonomously.
- Use local filesystem tools and local shell commands only.
- Shell use is restricted to local Node scripts under ./tools/.
- Do not run package managers, git, browsers, or network tools.
- Read inputs from ./inputs/ and current stub state from ./stubs/.
- Write deliverables to ./outputs/ and ./site/.
- Do not edit ./stubs/*.json directly; mutate stub state only through ./tools/*.mjs.
- If a tool call requires approval, wait and continue after approval.
- Do not pretend anything was sent or published live.
- Keep operator-facing outputs concise and factual.
`;

const WORKSPACE_TOOLS = `# TOOLS.md

Use only these shell commands when you need to stage governed side effects:

1. Generate a mock content-machine artifact:
   node ./tools/run-content-machine-script.mjs --topic "Prompt Review Copilot launch"

2. Queue the email draft into the fake outbox:
   node ./tools/queue-email.mjs --draft ./outputs/email-draft.md --prospect-id lead-001

3. Queue the social drafts into the fake social publisher:
   node ./tools/queue-social.mjs --drafts ./outputs/social-drafts.json

4. Update the fake CRM prospect status:
   node ./tools/update-crm.mjs --prospect-id lead-001 --status outreach_queued

Do not call tools outside ./tools/.
`;

const WORKSPACE_SITE_CONTRACT = `# SITE_CONTRACT.md

Build a single-file landing page at ./site/index.html.

The page must include:

- the exact hero heading: "Prompt Review Copilot"
- a supporting line that mentions prompt UX, landing-page copy, and onboarding messaging
- a labelled input with the exact label text: "Work email"
- a primary button with the exact button text: "Start Audit"
- a success region that shows the exact text: "Audit queued" after submission

Analytics contract:

- on page load, POST { "type": "page_view" } to /_stub/analytics
- on CTA click, POST events for:
  - cta_click
  - signup_start
  - signup_complete

Use same-origin fetch to /_stub/analytics. Do not call any external network endpoint.
`;

const WORKSPACE_TASK = `# TASK.md

Complete a governed micro-SaaS launch rehearsal for Prompt Review Copilot.

Input files:

- ./inputs/brief.json
- ./stubs/social-state.json
- ./stubs/email-state.json
- ./stubs/analytics-state.json
- ./stubs/crm-state.json

Required deliverables:

- ./outputs/launch-plan.md
- ./outputs/campaign-plan.json
- ./outputs/email-draft.md
- ./outputs/social-drafts.json
- ./outputs/metrics-baseline.json
- ./outputs/operator-summary.md
- ./outputs/content-machine-script.json
- ./site/index.html

Output contracts:

1. social-drafts.json must be a JSON array of draft objects with:
   - channelId
   - caption
   - cta

2. campaign-plan.json must include:
   - productName
   - primaryGoal
   - launchChannels
   - approvalBoundaries

3. metrics-baseline.json must include targets for:
   - landingPageVariants
   - emailDrafts
   - socialDrafts
   - qaFlows

Execution requirements:

1. Read the brief and current stub state.
2. Write the deliverables.
3. Use the helper commands in TOOLS.md.
4. Stage one email and at least two social drafts into the stub systems.
5. Update the CRM prospect status to outreach_queued.
6. Do not publish or send anything live.
7. Finish by replying with a short operator summary of what you created and queued.
`;

const AGENT_MESSAGE = [
  'You are running a controlled micro-SaaS experiment inside the current workspace.',
  'The workspace is already bootstrapped.',
  'Do not ask questions.',
  'Read TASK.md, TOOLS.md, and SITE_CONTRACT.md first.',
  'Act autonomously until the task is complete.',
  'Use local filesystem tools and local shell commands only.',
  'Shell commands are limited to node ./tools/*.mjs.',
  'Do not edit ./stubs/*.json directly.',
  'Write all deliverables to ./outputs/ and ./site/.',
  'Use the helper tools to generate the content-machine artifact and to queue email/social state.',
  'The landing page must include the exact strings Prompt Review Copilot, Work email, Start Audit, and Audit queued.',
  'Do not send or publish anything live.',
].join('\n');

/**
 * @typedef {{
 *   key: string | null;
 *   source: string | null;
 *   baseUrl: string;
 *   provider: 'openrouter' | 'openai';
 *   modelPrimary: string;
 *   envVarName: 'OPENROUTER_API_KEY' | 'OPENAI_API_KEY';
 * }} ModelCredentialDiscovery
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
  resultsDir: RESULTS_DIR,
  hypothesis:
    'A governed OpenClaw actor can complete a stubbed micro-SaaS launch loop end to end, use content-machine through a controlled local helper, stage outbound effects into fake systems, and then pass an independent manual-qa-machine verification run with a recorded evidence bundle.',

  async setup(ctx) {
    ensureDir(RESULTS_DIR);
    resetGeneratedArtifacts();
    appendTimelineEvent('experiment.setup_started', { experiment: EXPERIMENT_NAME });

    ensureDir(RUNTIME_DIR);
    ensureDir(OPENCLAW_HOME_DIR);
    ensureDir(WORKSPACE_DIR);
    ensureDir(INPUTS_DIR);
    ensureDir(STUBS_DIR);
    ensureDir(OUTPUTS_DIR);
    ensureDir(SITE_DIR);
    ensureDir(TOOLS_DIR);
    ensureDir(QA_DIR);
    ensureDir(OPENCLAW_STATE_DIR);
    ensureDir(join(OPENCLAW_STATE_DIR, 'credentials'));
    ensureDir(join(OPENCLAW_STATE_DIR, 'completions'));
    ensureDir(join(OPENCLAW_STATE_DIR, 'agents', 'main', 'sessions'));

    const watchers = [
      startDirectoryWatcher(OUTPUTS_DIR, 'outputs'),
      startDirectoryWatcher(STUBS_DIR, 'stubs'),
      startDirectoryWatcher(SITE_DIR, 'site'),
    ];
    ctx.state.watchers = watchers;

    copyFileSync(join(FIXTURES_DIR, 'brief.json'), join(INPUTS_DIR, 'brief.json'));
    appendTimelineEvent('workspace.input_copied', {
      source: 'brief.json',
      target: join(INPUTS_DIR, 'brief.json'),
    });

    for (const [source, target] of STUB_FILES) {
      copyFileSync(join(FIXTURES_DIR, source), join(STUBS_DIR, target));
      appendTimelineEvent('workspace.stub_copied', {
        source,
        target: join(STUBS_DIR, target),
      });
    }

    for (const file of TOOLING_FILES) {
      copyFileSync(join(TOOLING_DIR, file), join(TOOLS_DIR, file));
      appendTimelineEvent('workspace.tool_copied', {
        source: join(TOOLING_DIR, file),
        target: join(TOOLS_DIR, file),
      });
    }

    writeFileSync(join(WORKSPACE_DIR, 'BOOTSTRAP.md'), WORKSPACE_BOOTSTRAP, 'utf8');
    writeFileSync(join(WORKSPACE_DIR, 'AGENTS.md'), WORKSPACE_AGENTS, 'utf8');
    writeFileSync(join(WORKSPACE_DIR, 'TASK.md'), WORKSPACE_TASK, 'utf8');
    writeFileSync(join(WORKSPACE_DIR, 'TOOLS.md'), WORKSPACE_TOOLS, 'utf8');
    writeFileSync(join(WORKSPACE_DIR, 'SITE_CONTRACT.md'), WORKSPACE_SITE_CONTRACT, 'utf8');
    appendTimelineEvent('workspace.control_files_written', {
      files: ['BOOTSTRAP.md', 'AGENTS.md', 'TASK.md', 'TOOLS.md', 'SITE_CONTRACT.md'],
    });

    const repoManifest = TOOL_REPOS.map(describeRepo);
    const requiredFiles = REQUIRED_FILES.map((relativePath) => ({
      relativePath,
      exists: existsSync(join(EXPERIMENT_DIR, relativePath)),
    }));
    const fixtures = [
      'brief.json',
      'fake-social.stub.json',
      'fake-email.stub.json',
      'fake-analytics.stub.json',
      'fake-crm.stub.json',
    ].map((name) => ({
      name,
      path: join(FIXTURES_DIR, name),
      exists: existsSync(join(FIXTURES_DIR, name)),
    }));

    const credentials = discoverModelCredentials();
    ctx.state.credentials = {
      provider: credentials.provider,
      modelPrimary: credentials.modelPrimary,
      keySource: credentials.source,
      keyDiscovered: credentials.key !== null,
      baseUrl: credentials.baseUrl,
    };
    appendTimelineEvent('model.credentials_discovered', {
      provider: credentials.provider,
      discovered: credentials.key !== null,
      source: credentials.source ?? 'none',
      baseUrl: credentials.baseUrl,
    });

    const tsxCliPath = resolve(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const promptLanguageDemo = await runShortCommand(
      process.execPath,
      [join(repoRootFor('prompt-language'), 'bin', 'cli.mjs'), 'demo'],
      {},
      30_000,
    ).catch(() => ({ exitCode: null, stdout: '', stderr: '' }));
    writeFileSync(
      PROMPT_LANGUAGE_DEMO_PATH,
      [promptLanguageDemo.stdout, promptLanguageDemo.stderr].filter(Boolean).join('\n').trim() +
        '\n',
      'utf8',
    );

    const controlPlanePort = await findFreePort();
    const gatewayPort = await findFreePort();
    const previewPort = await findFreePort();
    ctx.state.portariumUrl = `http://127.0.0.1:${controlPlanePort}`;
    ctx.state.previewUrl = `http://127.0.0.1:${previewPort}`;
    ctx.state.gatewayPort = gatewayPort;
    ctx.state.previewPort = previewPort;
    ctx.state.sessionId = SESSION_ID;
    appendTimelineEvent('runtime.ports_reserved', {
      controlPlanePort,
      gatewayPort,
      previewPort,
      sessionId: SESSION_ID,
    });

    const toolchainManifest = {
      experiment: EXPERIMENT_NAME,
      timestamp: new Date().toISOString(),
      repoManifest,
      requiredFiles,
      fixtures,
      boundaries: {
        actor: 'OpenClaw agent role',
        governance: 'Portarium',
        operatorUi: 'Cockpit',
        independentVerifier: 'manual-qa-machine',
        toolRepos: ['content-machine', 'demo-machine', 'manual-qa-machine', 'prompt-language'],
        stubbedSystems: ['fake-social', 'fake-email', 'fake-analytics', 'fake-crm'],
      },
      promptLanguageDemo: {
        exitCode: promptLanguageDemo.exitCode,
        path: PROMPT_LANGUAGE_DEMO_PATH,
      },
      runtime: {
        workspaceDir: WORKSPACE_DIR,
        tsxCliPath,
        providerOverride: MODEL_PROVIDER_OVERRIDE,
        browserVerifierFallback: 'playwright',
        agentBrowserExecutable:
          process.platform === 'win32'
            ? resolveAgentBrowserExecutable()
            : (process.env['AGENT_BROWSER_EXE'] ?? 'agent-browser'),
      },
    };
    writeJson(TOOLCHAIN_MANIFEST, toolchainManifest);
    ctx.state.toolchainManifest = toolchainManifest;

    const openClawLocator = await locateOpenClawBinary();
    const renderedConfig = buildOpenClawConfig({
      gatewayPort,
      portariumUrl: /** @type {string} */ (ctx.state.portariumUrl),
      provider: credentials.provider,
      modelPrimary: credentials.modelPrimary,
      apiKey: credentials.key,
      baseUrl: credentials.baseUrl,
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
      modelPrimary: credentials.modelPrimary,
      modelProvider: credentials.provider,
      portariumUrl: ctx.state.portariumUrl,
      previewUrl: ctx.state.previewUrl,
      gatewayPort,
      previewPort,
      credentialSource: credentials.source,
      credentialDiscovered: credentials.key !== null,
      openClawVersion: resolvedOpenClawVersion,
      openClawVersionExitCode: version.exitCode,
      openClawBinary: openClawLocator.primary,
      openClawBinaryCandidates: openClawLocator.candidates,
      openClawOfficialWebsite: 'https://openclaw.ai/',
      openClawOfficialRepository: 'https://github.com/openclaw/openclaw',
      openClawTrackedTemplatePath: OPENCLAW_TEMPLATE_PATH,
      workspaceDir: WORKSPACE_DIR,
      outputsDir: OUTPUTS_DIR,
      siteDir: SITE_DIR,
      stubsDir: STUBS_DIR,
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
          PORTARIUM_DEV_USER_ID: 'micro-saas-agent',
          PORTARIUM_DEV_TOKEN_2: OPERATOR_TOKEN,
          PORTARIUM_DEV_USER_ID_2: 'micro-saas-operator',
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
    const pluginDoctor = await runOpenClawCommand(
      ['plugins', 'doctor'],
      buildOpenClawRuntimeEnv(),
      60_000,
    );
    writeFileSync(
      PLUGIN_DOCTOR_LOG,
      [pluginDoctor.stdout, pluginDoctor.stderr].filter(Boolean).join('\n').trim() + '\n',
      'utf8',
    );
    ctx.state.pluginDoctor = pluginDoctor;
    appendTimelineEvent('openclaw.plugins_doctor_finished', {
      exitCode: pluginDoctor.exitCode,
    });

    appendTimelineEvent('openclaw.doctor_started', {});
    const fullDoctor = await runOpenClawCommand(['doctor'], buildOpenClawRuntimeEnv(), 90_000);
    writeFileSync(
      OPENCLAW_DOCTOR_LOG,
      [fullDoctor.stdout, fullDoctor.stderr].filter(Boolean).join('\n').trim() + '\n',
      'utf8',
    );
    ctx.state.openClawDoctor = fullDoctor;
    appendTimelineEvent('openclaw.doctor_finished', {
      exitCode: fullDoctor.exitCode,
    });
  },

  async execute(ctx) {
    const portariumUrl = /** @type {string} */ (ctx.state.portariumUrl);
    const previewPort = /** @type {number} */ (ctx.state.previewPort);
    const credentials =
      /** @type {{ provider: string; modelPrimary: string; keySource: string | null; keyDiscovered: boolean; baseUrl: string }} */ (
        ctx.state.credentials
      );

    appendTimelineEvent('experiment.execute_started', {
      portariumUrl,
      workspaceId: WORKSPACE_ID,
      previewPort,
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
            { decision: 'Approved', rationale: 'Micro SaaS stack experiment auto-approval' },
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
      '300',
      '--message',
      AGENT_MESSAGE,
    ]);

    const agentEnv = {
      ...process.env,
      ...buildOpenClawRuntimeEnv(),
      CONTENT_MACHINE_REPO: repoRootFor('content-machine'),
      DEMO_MACHINE_REPO: repoRootFor('demo-machine'),
      MANUAL_QA_MACHINE_REPO: repoRootFor('manual-qa-machine'),
      PROMPT_LANGUAGE_REPO: repoRootFor('prompt-language'),
      MICRO_SAAS_WORKSPACE_DIR: WORKSPACE_DIR,
      VAOP_TSX_CLI: resolve(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    };
    if (credentials.keyDiscovered) {
      agentEnv[credentials.provider === 'openai' ? 'OPENAI_API_KEY' : 'OPENROUTER_API_KEY'] =
        discoverModelCredentials().key ?? '';
    }

    const agent = spawn(agentCommand.command, agentCommand.args, {
      cwd: REPO_ROOT,
      env: agentEnv,
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

    const agentExit = await waitForExit(agent, 420_000);
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

    const outputSnapshot = snapshotDirectory(OUTPUTS_DIR);
    const siteSnapshot = snapshotDirectory(SITE_DIR);
    const stubStateAfterAgent = snapshotDirectory(STUBS_DIR);
    writeJson(OUTPUTS_SNAPSHOT, outputSnapshot);
    writeJson(SITE_SNAPSHOT, siteSnapshot);
    writeJson(STUB_STATE_AFTER_AGENT, stubStateAfterAgent);
    ctx.state.outputSnapshot = outputSnapshot;
    ctx.state.siteSnapshot = siteSnapshot;
    ctx.state.stubStateAfterAgent = stubStateAfterAgent;
    appendTimelineEvent('outputs.snapshot_captured', {
      outputs: Object.keys(outputSnapshot),
      siteFiles: Object.keys(siteSnapshot),
      stubFiles: Object.keys(stubStateAfterAgent),
    });

    const combinedLogs = [
      safeRead(AGENT_STDOUT_LOG),
      safeRead(AGENT_STDERR_LOG),
      safeRead(CONTROL_PLANE_LOG),
    ].join('\n');
    ctx.state.observedToolCalls = extractToolCalls(combinedLogs);
    ctx.state.combinedLogs = combinedLogs;

    if (siteSnapshot['index.html']?.exists) {
      writeFileSync(PREVIEW_SERVER_LOG, '', 'utf8');
      const previewServer = await startPreviewServer({
        port: previewPort,
        siteDir: SITE_DIR,
        analyticsStatePath: join(STUBS_DIR, 'analytics-state.json'),
        logPath: PREVIEW_SERVER_LOG,
      });
      ctx.state.previewServer = previewServer;
      writeJson(PREVIEW_SERVER_STATE, {
        port: previewPort,
        url: `http://127.0.0.1:${previewPort}`,
        siteDir: SITE_DIR,
        analyticsStatePath: join(STUBS_DIR, 'analytics-state.json'),
      });
      appendTimelineEvent('preview.started', {
        port: previewPort,
        url: `http://127.0.0.1:${previewPort}`,
      });

      const qaFlow = createQaFlow(`http://127.0.0.1:${previewPort}`);
      writeJson(QA_FLOW_PATH, qaFlow);
      appendTimelineEvent('manual_qa.flow_written', { path: QA_FLOW_PATH });
      const manualQaAgentBrowserBinDir = ensureManualQaBrowserRuntime();

      const manualQa = await runShortCommand(
        process.execPath,
        [
          join(repoRootFor('manual-qa-machine'), 'dist', 'cli.js'),
          'run',
          '--flow',
          QA_FLOW_PATH,
          '--output',
          MANUAL_QA_DIR,
        ],
        {
          AGENT_BROWSER_SESSION: SESSION_ID,
          PATH: prependPath(
            prependPath(
              process.env['PATH'] ?? '',
              process.env['AGENT_BROWSER_DIR'] ?? 'D:\\Programs\\npm-global',
            ),
            manualQaAgentBrowserBinDir,
          ),
        },
        240_000,
      );
      writeFileSync(MANUAL_QA_STDOUT_LOG, `${manualQa.stdout.trim()}\n`, 'utf8');
      writeFileSync(MANUAL_QA_STDERR_LOG, `${manualQa.stderr.trim()}\n`, 'utf8');
      ctx.state.manualQa = manualQa;
      appendTimelineEvent('manual_qa.finished', {
        exitCode: manualQa.exitCode,
        outputDir: MANUAL_QA_DIR,
      });

      const qaReportPath = join(MANUAL_QA_DIR, 'qa-report.json');
      ctx.state.qaReport = existsSync(qaReportPath) ? readJson(qaReportPath) : null;
      ctx.state.playwrightQa = null;

      if (
        manualQa.exitCode !== 0 ||
        !['pass', 'pass_with_warnings'].includes(String((ctx.state.qaReport ?? {}).verdict ?? ''))
      ) {
        const playwrightQa = await runPlaywrightQa({
          startUrl: `http://127.0.0.1:${previewPort}`,
          outputDir: PLAYWRIGHT_QA_DIR,
          screenshotPath: PLAYWRIGHT_QA_SCREENSHOT,
          reportPath: PLAYWRIGHT_QA_REPORT,
          manualQaFailure: manualQa.stderr.trim(),
        });
        ctx.state.playwrightQa = playwrightQa;
        appendTimelineEvent('playwright_qa.finished', {
          exitCode: playwrightQa.exitCode,
          verdict: playwrightQa.report.verdict,
          outputDir: PLAYWRIGHT_QA_DIR,
        });
      }
    } else {
      ctx.state.manualQa = { exitCode: null, stdout: '', stderr: 'site/index.html missing' };
      ctx.state.qaReport = null;
      ctx.state.playwrightQa = null;
    }

    const stubStateAfterQa = snapshotDirectory(STUBS_DIR);
    writeJson(STUB_STATE_AFTER_QA, stubStateAfterQa);
    ctx.state.stubStateAfterQa = stubStateAfterQa;
    appendTimelineEvent('experiment.execute_finished', {
      observedToolCalls: ctx.state.observedToolCalls,
    });
  },

  async verify(ctx) {
    const credentials =
      /** @type {{ provider: string; modelPrimary: string; keySource: string | null; keyDiscovered: boolean; baseUrl: string }} */ (
        ctx.state.credentials
      );
    const manifest = /** @type {any} */ (ctx.state.toolchainManifest);
    const agentExit =
      /** @type {{ exitCode: number | null; signal: NodeJS.Signals | null; timedOut: boolean }} */ (
        ctx.state.agentExit
      );
    const manualQa = /** @type {{ exitCode: number | null; stdout: string; stderr: string }} */ (
      ctx.state.manualQa ?? { exitCode: null, stdout: '', stderr: '' }
    );
    const qaReport = /** @type {any} */ (ctx.state.qaReport);
    const playwrightQa = /** @type {{ exitCode: number | null; report: any } | null} */ (
      ctx.state.playwrightQa ?? null
    );
    const approvals = /** @type {{ items?: Array<Record<string, unknown>> }} */ (
      ctx.state.approvals
    );
    const evidence = /** @type {{ items?: Array<Record<string, unknown>> }} */ (ctx.state.evidence);
    const outputSnapshot =
      /** @type {Record<string, { exists: boolean; bytes: number; sha256: string; content: string }>} */ (
        ctx.state.outputSnapshot
      );
    const siteSnapshot =
      /** @type {Record<string, { exists: boolean; bytes: number; sha256: string; content: string }>} */ (
        ctx.state.siteSnapshot
      );
    const stubStateAfterAgent =
      /** @type {Record<string, { exists: boolean; bytes: number; sha256: string; content: string }>} */ (
        ctx.state.stubStateAfterAgent
      );
    const stubStateAfterQa =
      /** @type {Record<string, { exists: boolean; bytes: number; sha256: string; content: string }>} */ (
        ctx.state.stubStateAfterQa
      );
    const observedToolCalls = /** @type {string[]} */ (ctx.state.observedToolCalls ?? []);
    const combinedLogs = /** @type {string} */ (ctx.state.combinedLogs ?? '');

    const approvalItems = Array.isArray(approvals.items) ? approvals.items : [];
    const evidenceItems = Array.isArray(evidence.items) ? evidence.items : [];
    const emailState = readSnapshotJson(stubStateAfterAgent['email-state.json']);
    const socialState = readSnapshotJson(stubStateAfterAgent['social-state.json']);
    const crmState = readSnapshotJson(stubStateAfterAgent['crm-state.json']);
    const analyticsState = readSnapshotJson(stubStateAfterQa['analytics-state.json']);
    const analyticsEvents = Array.isArray(analyticsState?.events) ? analyticsState.events : [];
    const analyticsTypes = analyticsEvents.map((event) => String(event.type ?? ''));
    const effectiveQaReport = qaReport ?? playwrightQa?.report ?? null;
    const qaVerifier = qaReport
      ? 'manual-qa-machine'
      : playwrightQa !== null
        ? 'playwright-fallback'
        : 'none';

    return [
      assert(
        'Live model credential discovered for the governed run',
        credentials.keyDiscovered,
        `provider=${credentials.provider} source=${credentials.keySource ?? 'none'}`,
      ),
      assert(
        'Portarium control plane reported healthy',
        ctx.state.health !== undefined,
        JSON.stringify(ctx.state.health ?? null),
      ),
      assert(
        'Tool repos discovered with committed runtime contracts',
        manifest.repoManifest.every((repo) => repo.exists && repo.hasPackageJson && repo.hasReadme),
        JSON.stringify(
          manifest.repoManifest.map((repo) => ({
            id: repo.id,
            ready: repo.ready,
            root: repo.root,
          })),
        ),
      ),
      assert(
        'content-machine, manual-qa-machine, and prompt-language are runnable in this slice',
        manifest.repoManifest
          .filter((repo) =>
            ['content-machine', 'manual-qa-machine', 'prompt-language'].includes(repo.id),
          )
          .every((repo) => repo.ready === true),
        JSON.stringify(
          manifest.repoManifest
            .filter((repo) =>
              ['content-machine', 'manual-qa-machine', 'prompt-language'].includes(repo.id),
            )
            .map((repo) => ({ id: repo.id, ready: repo.ready })),
        ),
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
        'Observed governed read and write tool calls',
        observedToolCalls.some((tool) => tool.includes('read')) &&
          observedToolCalls.some((tool) => tool.includes('write')),
        observedToolCalls.join(', '),
      ),
      assert(
        'Observed at least one governed shell-style tool call',
        observedToolCalls.some((tool) => /bash|exec|shell/i.test(tool)),
        observedToolCalls.join(', '),
      ),
      assert(
        'Governed exec tool calls occurred alongside staged helper outputs',
        observedToolCalls.some((tool) => /exec|shell|bash/i.test(tool)) &&
          outputSnapshot['content-machine-script.json']?.exists === true &&
          Array.isArray(emailState?.outbox) &&
          emailState.outbox.length > 0 &&
          Array.isArray(socialState?.queuedPosts) &&
          socialState.queuedPosts.length > 0,
        `observed=${observedToolCalls.join(', ')}`,
      ),
      assert(
        'Core output bundle exists',
        OUTPUT_FILES.every((file) => outputSnapshot[file]?.exists === true),
        OUTPUT_FILES.filter((file) => outputSnapshot[file]?.exists !== true).join(', ') ||
          'all-present',
      ),
      assert(
        'Landing page file exists and includes the required UX strings',
        siteSnapshot['index.html']?.exists === true &&
          siteSnapshot['index.html'].content.includes('Prompt Review Copilot') &&
          siteSnapshot['index.html'].content.includes('Work email') &&
          siteSnapshot['index.html'].content.includes('Start Audit') &&
          siteSnapshot['index.html'].content.includes('Audit queued'),
        'Expected Prompt Review Copilot, Work email, Start Audit, and Audit queued in site/index.html',
      ),
      assert(
        'Queued email exists in the stub outbox',
        Array.isArray(emailState?.outbox) &&
          emailState.outbox.some(
            (item) => item.status === 'queued' && item.queuedVia === 'queue-email.mjs',
          ),
        JSON.stringify(emailState?.outbox ?? []),
      ),
      assert(
        'Queued social posts exist in the stub social queue',
        Array.isArray(socialState?.queuedPosts) &&
          socialState.queuedPosts.length >= 2 &&
          socialState.queuedPosts.every((item) => item.queuedVia === 'queue-social.mjs'),
        JSON.stringify(socialState?.queuedPosts ?? []),
      ),
      assert(
        'CRM status was advanced to outreach_queued',
        Array.isArray(crmState?.prospects) &&
          crmState.prospects.some(
            (item) => item.prospectId === 'lead-001' && item.status === 'outreach_queued',
          ),
        JSON.stringify(crmState?.prospects ?? []),
      ),
      assert(
        'content-machine artifact exists with mock script content',
        outputSnapshot['content-machine-script.json']?.exists === true &&
          outputSnapshot['content-machine-script.json'].content.includes('"schemaVersion"') &&
          outputSnapshot['content-machine-script.json'].content.includes('Mock:'),
        'Expected a mock content-machine script in outputs/content-machine-script.json',
      ),
      assert(
        'At least one approval record was created and all approvals resolved Approved',
        approvalItems.length > 0 &&
          approvalItems.every((item) => String(item.status ?? '').toLowerCase() === 'approved'),
        approvalItems
          .map((item) => `${String(item.toolName ?? 'unknown')}:${String(item.status ?? '')}`)
          .join(', '),
      ),
      assert(
        'Evidence records were captured for the governed run',
        evidenceItems.length > 0,
        `evidence=${evidenceItems.length}`,
      ),
      assert(
        'Independent QA verifier completed without a command failure',
        manualQa.exitCode === 0 || Number(playwrightQa?.exitCode ?? 1) === 0,
        `manualQaExitCode=${String(manualQa.exitCode)} fallbackExitCode=${String(playwrightQa?.exitCode ?? null)} manualQaStderr=${manualQa.stderr.trim()}`,
      ),
      assert(
        'Independent QA verifier produced a passing or warning-only verdict',
        effectiveQaReport !== null &&
          ['pass', 'pass_with_warnings'].includes(String(effectiveQaReport.verdict ?? '')),
        effectiveQaReport
          ? `verifier=${qaVerifier} verdict=${String(effectiveQaReport.verdict)}`
          : 'no QA report available',
      ),
      assert(
        'manual-qa-machine failure was captured when fallback verification was required',
        manualQa.exitCode === 0 ||
          (playwrightQa !== null &&
            manualQa.stderr.includes('Chrome exited before providing DevTools URL')),
        `manualQaExitCode=${String(manualQa.exitCode)} fallbackUsed=${String(playwrightQa !== null)}`,
      ),
      assert(
        'Stub analytics sink captured page and CTA events during QA',
        ['page_view', 'cta_click', 'signup_start', 'signup_complete'].every((type) =>
          analyticsTypes.includes(type),
        ),
        JSON.stringify(analyticsTypes),
      ),
    ];
  },

  async teardown(ctx) {
    const watchers = /** @type {Array<import('node:fs').FSWatcher> | undefined} */ (
      ctx.state.watchers
    );
    for (const watcher of watchers ?? []) {
      watcher.close();
    }

    const previewServer = /** @type {{ close: () => Promise<void> } | undefined} */ (
      ctx.state.previewServer
    );
    if (previewServer) {
      await previewServer.close().catch(() => undefined);
      appendTimelineEvent('preview.stopped', {});
    }

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
for (const assertion of outcome.assertions) {
  console.log(`  ${assertion.passed ? 'PASS' : 'FAIL'}: ${assertion.label}`);
}
if (outcome.error) {
  console.log(`Error: ${outcome.error}`);
}

process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;

function buildOpenClawConfig(input) {
  const gatewayToken = randomBytes(20).toString('hex');
  const config = pruneNullishFields(
    renderJsonTemplate(OPENCLAW_TEMPLATE_PATH, {
      OPENROUTER_API_KEY: input.provider === 'openrouter' ? input.apiKey : null,
      OPENROUTER_BASE_URL: input.provider === 'openrouter' ? input.baseUrl : null,
      GATEWAY_AUTH_TOKEN: gatewayToken,
      MODEL_PRIMARY: input.modelPrimary,
      EXPERIMENT_WORKSPACE_DIR: WORKSPACE_DIR,
      GATEWAY_PORT: input.gatewayPort,
      PORTARIUM_PLUGIN_PATH: join(REPO_ROOT, 'packages', 'openclaw-plugin'),
      PORTARIUM_URL: input.portariumUrl,
      WORKSPACE_ID,
      AGENT_TOKEN,
      TENANT_ID,
    }),
  );
  if (input.provider === 'openai') {
    config.env = {
      ...(config.env ?? {}),
      OPENAI_API_KEY: input.apiKey,
    };
    delete config.env.OPENROUTER_API_KEY;
    delete config.env.OPENROUTER_BASE_URL;
    config.auth = {
      profiles: {
        'openai:default': {
          provider: 'openai',
          mode: 'api_key',
        },
      },
      order: {
        openai: ['openai:default'],
      },
    };
  } else {
    config.auth = {
      profiles: {
        'openrouter:default': {
          provider: 'openrouter',
          mode: 'api_key',
        },
      },
      order: {
        openrouter: ['openrouter:default'],
      },
    };
  }
  config.agents.defaults.model.primary = input.modelPrimary;
  config.agents.defaults.models = {
    [input.modelPrimary]: {},
  };
  return config;
}

function describeRepo(repo) {
  const root = process.env[repo.envVar] ?? repo.defaultPath;
  const packagePath = join(root, 'package.json');
  const readmePath = join(root, 'README.md');
  const packageJson = existsSync(packagePath) ? readJson(packagePath) : null;

  return {
    id: repo.id,
    label: repo.label,
    expectedRole: repo.expectedRole,
    root,
    exists: existsSync(root),
    hasPackageJson: existsSync(packagePath),
    hasReadme: existsSync(readmePath),
    packageName: packageJson?.name ?? null,
    version: packageJson?.version ?? null,
    requiredEntry: repo.requiredEntry,
    ready: repo.ready(root),
  };
}

function repoRootFor(id) {
  const repo = TOOL_REPOS.find((item) => item.id === id);
  if (!repo) {
    throw new Error(`Unknown repo id: ${id}`);
  }
  return process.env[repo.envVar] ?? repo.defaultPath;
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function resetGeneratedArtifacts() {
  rmSync(OPENCLAW_HOME_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  rmSync(OPENCLAW_STATE_DIR, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
  rmSync(WORKSPACE_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  rmSync(OPENCLAW_CONFIG_PATH, { force: true, maxRetries: 5, retryDelay: 200 });
  rmSync(MANUAL_QA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  rmSync(PLAYWRIGHT_QA_DIR, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
  for (const file of [
    CONTROL_PLANE_LOG,
    AGENT_STDOUT_LOG,
    AGENT_STDERR_LOG,
    OPENCLAW_DOCTOR_LOG,
    PLUGIN_DOCTOR_LOG,
    APPROVALS_SNAPSHOT,
    EVIDENCE_SNAPSHOT,
    OUTPUTS_SNAPSHOT,
    SITE_SNAPSHOT,
    STUB_STATE_AFTER_AGENT,
    STUB_STATE_AFTER_QA,
    TOOLCHAIN_MANIFEST,
    RUN_CONTEXT,
    TIMELINE_PATH,
    PREVIEW_SERVER_LOG,
    PREVIEW_SERVER_STATE,
    QA_FLOW_PATH,
    MANUAL_QA_STDOUT_LOG,
    MANUAL_QA_STDERR_LOG,
    PLAYWRIGHT_QA_REPORT,
    PLAYWRIGHT_QA_SCREENSHOT,
    PROMPT_LANGUAGE_DEMO_PATH,
  ]) {
    rmSync(file, { force: true, maxRetries: 5, retryDelay: 200 });
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

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
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
    const lines = buffered.split(/\r?\n/u);
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

function snapshotDirectory(root) {
  /** @type {Record<string, { exists: boolean; bytes: number; sha256: string; content: string }>} */
  const snapshot = {};
  if (!existsSync(root)) {
    return snapshot;
  }

  for (const file of listFilesRecursive(root)) {
    const content = readFileSync(file, 'utf8');
    snapshot[relative(root, file).replace(/\\/g, '/')] = {
      exists: true,
      bytes: Buffer.byteLength(content, 'utf8'),
      sha256: sha256(content),
      content,
    };
  }

  return snapshot;
}

function listFilesRecursive(root) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolutePath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(absolutePath));
      continue;
    }
    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files.sort();
}

function readSnapshotJson(snapshotEntry) {
  if (!snapshotEntry?.content) {
    return null;
  }
  try {
    return JSON.parse(snapshotEntry.content);
  } catch {
    return null;
  }
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

function discoverModelCredentials() {
  if (MODEL_PROVIDER_OVERRIDE === 'openai') {
    return discoverOpenAiCredentials();
  }
  return discoverOpenRouterCredentials();
}

function discoverOpenRouterCredentials() {
  const envKey = process.env['OPENROUTER_API_KEY'];
  if (envKey) {
    return {
      provider: 'openrouter',
      modelPrimary: DEFAULT_OPENROUTER_MODEL,
      envVarName: 'OPENROUTER_API_KEY',
      key: envKey,
      source: 'process.env.OPENROUTER_API_KEY',
      baseUrl: process.env['OPENROUTER_BASE_URL'] ?? 'https://openrouter.ai/api/v1',
    };
  }

  const candidateEnvFiles = [join(resolveHomeDir(), '.openclaw', '.env')];
  for (const path of candidateEnvFiles) {
    if (!existsSync(path)) {
      continue;
    }
    const parsed = parseEnvFile(path);
    if (parsed['OPENROUTER_API_KEY']) {
      return {
        provider: 'openrouter',
        modelPrimary: DEFAULT_OPENROUTER_MODEL,
        envVarName: 'OPENROUTER_API_KEY',
        key: parsed['OPENROUTER_API_KEY'],
        source: path,
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
          provider: 'openrouter',
          modelPrimary: DEFAULT_OPENROUTER_MODEL,
          envVarName: 'OPENROUTER_API_KEY',
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
    provider: 'openrouter',
    modelPrimary: DEFAULT_OPENROUTER_MODEL,
    envVarName: 'OPENROUTER_API_KEY',
    key: null,
    source: null,
    baseUrl: 'https://openrouter.ai/api/v1',
  };
}

function discoverOpenAiCredentials() {
  const envKey = process.env['OPENAI_API_KEY'];
  if (envKey) {
    return {
      provider: 'openai',
      modelPrimary: DEFAULT_OPENAI_MODEL,
      envVarName: 'OPENAI_API_KEY',
      key: envKey,
      source: 'process.env.OPENAI_API_KEY',
      baseUrl: '',
    };
  }

  const candidateEnvFiles = ['D:/Visual Studio Projects/VibeCoord/.env'];
  for (const path of candidateEnvFiles) {
    if (!existsSync(path)) {
      continue;
    }
    const parsed = parseEnvFile(path);
    if (parsed['OPENAI_API_KEY']) {
      return {
        provider: 'openai',
        modelPrimary: DEFAULT_OPENAI_MODEL,
        envVarName: 'OPENAI_API_KEY',
        key: parsed['OPENAI_API_KEY'],
        source: path,
        baseUrl: '',
      };
    }
  }

  return {
    provider: 'openai',
    modelPrimary: DEFAULT_OPENAI_MODEL,
    envVarName: 'OPENAI_API_KEY',
    key: null,
    source: null,
    baseUrl: '',
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

function prependPath(existingPath, extraDir) {
  if (!extraDir) {
    return existingPath;
  }
  const delimiter = process.platform === 'win32' ? ';' : ':';
  return existingPath ? `${extraDir}${delimiter}${existingPath}` : extraDir;
}

function ensureManualQaBrowserRuntime() {
  const binDir = join(MANUAL_QA_BIN_ROOT, SESSION_ID);
  mkdirSync(binDir, { recursive: true });
  if (process.platform !== 'win32') {
    return process.env['AGENT_BROWSER_DIR'] ?? '';
  }

  const sourceExe = resolveAgentBrowserExecutable();
  const targetExe = join(binDir, 'agent-browser.exe');
  copyFileSync(sourceExe, targetExe);
  appendTimelineEvent('manual_qa.agent_browser_materialized', {
    sourceExe,
    targetExe,
  });
  return binDir;
}

function resolveAgentBrowserExecutable() {
  const candidates = [
    process.env['AGENT_BROWSER_EXE'],
    join(
      process.env['AGENT_BROWSER_DIR'] ?? 'D:\\Programs\\npm-global',
      'node_modules',
      'agent-browser',
      'bin',
      'agent-browser-win32-x64.exe',
    ),
    'D:\\Programs\\npm-global\\node_modules\\agent-browser\\bin\\agent-browser-win32-x64.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to locate agent-browser executable. Checked: ${candidates.join(', ')}`);
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

function startDirectoryWatcher(dir, label) {
  ensureDir(dir);
  const pendingTimers = new Map();
  const watcher = watch(dir, { persistent: false }, (eventType, filename) => {
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
      const path = join(dir, file);
      const exists = existsSync(path);
      const content = exists && statSync(path).isFile() ? readFileSync(path, 'utf8') : '';
      appendTimelineEvent('workspace.file_changed', {
        label,
        eventType,
        file,
        exists,
        bytes: exists ? Buffer.byteLength(content, 'utf8') : 0,
        sha256: exists ? sha256(content) : '',
      });
    }, 75);
    pendingTimers.set(file, timer);
  });

  appendTimelineEvent('workspace.watch_started', { label, path: dir });
  return watcher;
}

async function startPreviewServer({ port, siteDir, analyticsStatePath, logPath }) {
  writeFileSync(logPath, '', 'utf8');
  const server = createHttpServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    appendPreviewLog(logPath, `${req.method ?? 'GET'} ${requestUrl.pathname}`);

    if (req.method === 'GET' && requestUrl.pathname === '/__health') {
      respondJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/_stub/analytics') {
      try {
        const body = await readRequestJson(req);
        const analyticsState = existsSync(analyticsStatePath)
          ? readJson(analyticsStatePath)
          : { mode: 'stub', acceptedEvents: [], events: [] };
        const acceptedEvents = Array.isArray(analyticsState.acceptedEvents)
          ? analyticsState.acceptedEvents
          : [];
        const eventType = String(body?.type ?? '');
        if (!acceptedEvents.includes(eventType)) {
          respondJson(res, 400, { ok: false, reason: `Unsupported event: ${eventType}` });
          return;
        }
        analyticsState.events = Array.isArray(analyticsState.events) ? analyticsState.events : [];
        analyticsState.events.push({
          type: eventType,
          payload: body?.payload ?? {},
          receivedAt: new Date().toISOString(),
          source: 'preview-server',
        });
        writeJson(analyticsStatePath, analyticsState);
        appendTimelineEvent('preview.analytics_received', { eventType });
        res.writeHead(204);
        res.end();
        return;
      } catch (error) {
        respondJson(res, 400, {
          ok: false,
          reason: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      respondJson(res, 405, { ok: false, reason: 'Method not allowed' });
      return;
    }

    const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
    const targetPath = resolve(siteDir, `.${pathname}`);
    const siteRoot = resolve(siteDir);
    if (
      !targetPath.startsWith(siteRoot) ||
      !existsSync(targetPath) ||
      !statSync(targetPath).isFile()
    ) {
      respondJson(res, 404, { ok: false, reason: 'Not found' });
      return;
    }

    const body = readFileSync(targetPath);
    res.writeHead(200, {
      'content-type': mimeTypeFor(targetPath),
      'cache-control': 'no-store',
      'content-length': String(body.byteLength),
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(body);
  });

  await new Promise((resolveServer, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolveServer(undefined));
  });

  return {
    close: () =>
      new Promise((resolveClose, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolveClose(undefined);
        });
      }),
  };
}

function appendPreviewLog(path, line) {
  appendFileSync(path, `${new Date().toISOString()} ${line}\n`, 'utf8');
}

function respondJson(res, statusCode, value) {
  const body = JSON.stringify(value);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(Buffer.byteLength(body, 'utf8')),
  });
  res.end(body);
}

async function readRequestJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
  }
  return body ? JSON.parse(body) : {};
}

function mimeTypeFor(path) {
  switch (extname(path).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'text/plain; charset=utf-8';
  }
}

function createQaFlow(startUrl) {
  return {
    formatVersion: 1,
    id: 'micro-saas-landing',
    name: 'Micro SaaS Landing QA',
    startUrl,
    sessionMode: 'fresh',
    viewports: [{ name: 'desktop', width: 1440, height: 900 }],
    steps: [
      {
        kind: 'navigate',
        url: startUrl,
        name: 'Open landing page',
      },
      {
        kind: 'assert',
        name: 'Hero heading visible',
        assertion: { kind: 'textPresent', text: 'Prompt Review Copilot' },
      },
      {
        kind: 'type',
        name: 'Enter work email',
        target: { kind: 'label', text: 'Work email', exact: true },
        value: 'founder@example.com',
      },
      {
        kind: 'click',
        name: 'Start the audit',
        target: { kind: 'role', role: 'button', name: 'Start Audit', exact: true },
      },
      {
        kind: 'waitFor',
        name: 'Wait for success state',
        condition: { kind: 'text', text: 'Audit queued' },
        timeoutMs: 10_000,
      },
      {
        kind: 'assert',
        name: 'Success state visible',
        assertion: { kind: 'textPresent', text: 'Audit queued' },
      },
      {
        kind: 'screenshot',
        name: 'Capture final state',
      },
    ],
    assertions: [
      { kind: 'textPresent', text: 'Prompt Review Copilot' },
      { kind: 'requestOccurred', urlContains: '/_stub/analytics', method: 'POST' },
      { kind: 'noCriticalA11yViolations' },
    ],
    policies: {
      consoleErrors: { max: 0, allowMessages: [] },
      networkFailures: { max: 0, allowUrls: [] },
      pageErrors: { max: 0, allowMessages: [] },
      performance: { maxPageLoadMs: 5_000 },
      accessibility: { maxCritical: 0 },
    },
  };
}

async function runPlaywrightQa({
  startUrl,
  outputDir,
  screenshotPath,
  reportPath,
  manualQaFailure,
}) {
  mkdirSync(outputDir, { recursive: true });

  const consoleEntries = [];
  const networkFailures = [];
  const pageErrors = [];
  const analyticsRequests = [];
  const assertions = [];
  const startedAt = new Date().toISOString();
  let browser = null;
  let failure = '';

  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    page.on('console', (message) => {
      consoleEntries.push({
        type: message.type(),
        text: message.text(),
      });
    });
    page.on('pageerror', (error) => {
      pageErrors.push({
        message: error.message,
        stack: error.stack ?? '',
      });
    });
    page.on('requestfailed', (request) => {
      networkFailures.push({
        url: request.url(),
        method: request.method(),
        errorText: request.failure()?.errorText ?? 'unknown',
      });
    });
    page.on('request', (request) => {
      if (!request.url().includes('/_stub/analytics')) {
        return;
      }
      const rawBody = request.postData() ?? '';
      analyticsRequests.push({
        url: request.url(),
        method: request.method(),
        body: rawBody ? tryParseJson(rawBody) : {},
      });
    });

    await page.goto(startUrl, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.getByRole('heading', { name: 'Prompt Review Copilot', exact: true }).waitFor({
      timeout: 10_000,
    });
    await page.getByLabel('Work email', { exact: true }).fill('founder@example.com');
    await page.getByRole('button', { name: 'Start Audit', exact: true }).click();
    await page.getByText('Audit queued', { exact: true }).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const heroVisible = await page
      .getByRole('heading', { name: 'Prompt Review Copilot', exact: true })
      .isVisible();
    const successVisible = await page.getByText('Audit queued', { exact: true }).isVisible();
    const analyticsTypes = analyticsRequests.map((request) => String(request.body?.type ?? ''));
    const actionableNetworkFailures = networkFailures.filter(
      (failureItem) =>
        !(
          failureItem.url.includes('/_stub/analytics') &&
          failureItem.errorText === 'net::ERR_ABORTED'
        ),
    );

    assertions.push(
      assert('Playwright fallback saw the hero heading', heroVisible, 'Prompt Review Copilot'),
    );
    assertions.push(
      assert('Playwright fallback saw the success state', successVisible, 'Audit queued'),
    );
    assertions.push(
      assert(
        'Playwright fallback observed analytics POSTs for page and CTA events',
        ['page_view', 'cta_click', 'signup_start', 'signup_complete'].every((type) =>
          analyticsTypes.includes(type),
        ),
        JSON.stringify(analyticsTypes),
      ),
    );
    assertions.push(
      assert(
        'Playwright fallback saw no failed network requests',
        actionableNetworkFailures.length === 0,
        JSON.stringify(actionableNetworkFailures),
      ),
    );
    assertions.push(
      assert(
        'Playwright fallback saw no uncaught page errors',
        pageErrors.length === 0,
        JSON.stringify(pageErrors),
      ),
    );
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }

  const verdict =
    !failure && assertions.length > 0 && assertions.every((item) => item.passed)
      ? consoleEntries.some((item) => item.type === 'error')
        ? 'pass_with_warnings'
        : 'pass'
      : 'fail';

  const report = {
    verifier: 'playwright-fallback',
    startedAt,
    finishedAt: new Date().toISOString(),
    verdict,
    manualQaFailure,
    failure,
    assertions,
    ignoredNetworkFailures: networkFailures.filter(
      (failureItem) =>
        failureItem.url.includes('/_stub/analytics') &&
        failureItem.errorText === 'net::ERR_ABORTED',
    ),
    consoleEntries,
    networkFailures,
    pageErrors,
    analyticsRequests,
    artifacts: {
      screenshotPath,
      reportPath,
    },
  };

  writeJson(join(outputDir, 'console.json'), consoleEntries);
  writeJson(join(outputDir, 'network.json'), networkFailures);
  writeJson(join(outputDir, 'page-errors.json'), pageErrors);
  writeJson(join(outputDir, 'analytics-requests.json'), analyticsRequests);
  writeJson(reportPath, report);

  return {
    exitCode: verdict === 'fail' ? 1 : 0,
    report,
  };
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
