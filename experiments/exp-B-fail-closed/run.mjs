/**
 * Experiment B: fail-closed OpenClaw plugin behaviour.
 *
 * Proves that an agent tool call is not passed through when Portarium
 * governance is unreachable.
 */

// @ts-check

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const EXPERIMENT_NAME = 'exp-B-fail-closed';
const DEFAULT_RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results');
const DEFAULT_PORTARIUM_URL = process.env['PORTARIUM_FAIL_CLOSED_URL'] ?? 'http://127.0.0.1:1';
const FAIL_CLOSED_MESSAGE = 'Portarium governance unavailable — failing closed';

/**
 * @typedef {{
 *   label: string;
 *   passed: boolean;
 *   detail?: string;
 * }} Assertion
 *
 * @typedef {{
 *   experiment: string;
 *   timestamp: string;
 *   outcome: 'confirmed' | 'refuted' | 'inconclusive';
 *   duration_ms: number;
 *   assertions: Assertion[];
 *   trace: Record<string, unknown>;
 *   error?: string;
 * }} ExperimentOutcome
 *
 * @typedef {{
 *   portariumUrl?: string;
 *   resultsDir?: string;
 *   writeResults?: boolean;
 *   log?: (line: string) => void;
 * }} RunExperimentBOptions
 */

function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

function ensurePluginBuild(root) {
  execFileSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '-p', 'packages/openclaw-plugin/tsconfig.json'],
    {
      cwd: root,
      stdio: 'pipe',
    },
  );
}

async function loadBuiltPlugin(root) {
  ensurePluginBuild(root);
  const hookUrl = pathToFileURL(
    join(root, 'packages/openclaw-plugin/dist/hooks/before-tool-call.js'),
  ).href;
  const clientUrl = pathToFileURL(
    join(root, 'packages/openclaw-plugin/dist/client/portarium-client.js'),
  ).href;
  const [{ registerBeforeToolCallHook }, { PortariumClient }] = await Promise.all([
    import(`${hookUrl}?t=${Date.now()}`),
    import(`${clientUrl}?t=${Date.now()}`),
  ]);
  return { registerBeforeToolCallHook, PortariumClient };
}

function makeLogger(logs, log) {
  return {
    info(message) {
      logs.push(message);
      log(message);
    },
    warn(message) {
      logs.push(message);
      log(message);
    },
    error(message) {
      logs.push(message);
      log(message);
    },
  };
}

function makeOpenClawHarness(logs) {
  let beforeToolCall;
  let beforeToolCallPriority;
  let executionCount = 0;

  return {
    api: {
      on(event, handler, opts) {
        if (event !== 'before_tool_call') return;
        beforeToolCall = handler;
        beforeToolCallPriority = opts?.priority;
      },
    },
    get priority() {
      return beforeToolCallPriority;
    },
    get executionCount() {
      return executionCount;
    },
    async attemptToolCall({ toolName, params }) {
      if (!beforeToolCall) throw new Error('before_tool_call hook was not registered.');

      const decision = await beforeToolCall(
        { toolName, params, runId: 'run-exp-b-fail-closed' },
        {
          sessionKey: 'agent:exp-b:main',
          agentId: 'agent-exp-b',
          runId: 'run-exp-b-fail-closed',
        },
      );

      if (decision?.block) {
        const blockReason = String(decision.blockReason ?? 'blocked');
        logs.push(blockReason);
        return {
          status: 'error',
          blocked: true,
          blockReason,
          toolExecuted: false,
        };
      }

      executionCount += 1;
      return {
        status: 'ok',
        blocked: false,
        toolExecuted: true,
      };
    },
  };
}

function makeConfig(portariumUrl) {
  return {
    portariumUrl,
    workspaceId: 'ws-exp-b',
    bearerToken: 'exp-b-token',
    tenantId: 'default',
    failClosed: true,
    approvalTimeoutMs: 1_000,
    pollIntervalMs: 50,
    bypassToolNames: ['portarium_get_run', 'portarium_list_approvals'],
    defaultPolicyIds: ['default-governance'],
    defaultExecutionTier: 'HumanApprove',
  };
}

function assert(label, passed, detail) {
  return { label, passed, ...(detail ? { detail } : {}) };
}

function verifyTrace(trace) {
  const attempt = /** @type {Record<string, unknown>} */ (trace['attempt'] ?? {});
  const logs = /** @type {string[]} */ (trace['logs'] ?? []);

  return [
    assert(
      'OpenClaw hook registered at priority 1000',
      trace['hookPriority'] === 1000,
      `priority=${String(trace['hookPriority'])}`,
    ),
    assert(
      'tool call returns status=error',
      attempt['status'] === 'error',
      `status=${String(attempt['status'])}`,
    ),
    assert(
      'tool call is terminally blocked',
      attempt['blocked'] === true,
      `blocked=${String(attempt['blocked'])}`,
    ),
    assert(
      'tool body was not passed through',
      attempt['toolExecuted'] === false && trace['executionCount'] === 0,
      `toolExecuted=${String(attempt['toolExecuted'])}, executionCount=${String(trace['executionCount'])}`,
    ),
    assert(
      'block reason contains fail-closed message',
      String(attempt['blockReason'] ?? '').includes(FAIL_CLOSED_MESSAGE),
      String(attempt['blockReason'] ?? ''),
    ),
    assert(
      'log contains fail-closed message',
      logs.some((line) => line.includes(FAIL_CLOSED_MESSAGE)),
      logs.join(' | '),
    ),
  ];
}

/**
 * @param {RunExperimentBOptions} [options]
 * @returns {Promise<ExperimentOutcome>}
 */
export async function runExperimentB(options = {}) {
  const startedAt = Date.now();
  const root = repoRoot();
  const resultsDir = options.resultsDir ?? DEFAULT_RESULTS_DIR;
  const log = options.log ?? console.log;
  const writeResults = options.writeResults ?? true;
  const portariumUrl = options.portariumUrl ?? DEFAULT_PORTARIUM_URL;
  const logs = [];
  let trace = {};
  let assertions = [];
  let error;

  try {
    const { registerBeforeToolCallHook, PortariumClient } = await loadBuiltPlugin(root);
    const config = makeConfig(portariumUrl);
    const logger = makeLogger(logs, log);
    const client = new PortariumClient(config);
    const poller = { waitForDecision: async () => ({ approved: false, reason: 'unused' }) };
    const harness = makeOpenClawHarness(logs);

    registerBeforeToolCallHook(harness.api, client, poller, config, logger);

    const attempt = await harness.attemptToolCall({
      toolName: 'write:file',
      params: {
        path: 'experiments/exp-B-fail-closed/results/should-not-exist.txt',
        content: 'This must not be written when Portarium is unreachable.',
      },
    });

    trace = {
      portariumUrl,
      hookPriority: harness.priority,
      attempt,
      executionCount: harness.executionCount,
      logs,
    };
    assertions = verifyTrace(trace);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const result = {
    experiment: EXPERIMENT_NAME,
    timestamp: new Date().toISOString(),
    outcome:
      error != null
        ? 'inconclusive'
        : assertions.length > 0 && assertions.every((item) => item.passed)
          ? 'confirmed'
          : 'refuted',
    duration_ms: Date.now() - startedAt,
    assertions,
    trace,
    ...(error ? { error } : {}),
  };

  if (writeResults) {
    mkdirSync(resultsDir, { recursive: true });
    writeFileSync(join(resultsDir, 'outcome.json'), `${JSON.stringify(result, null, 2)}\n`);
  }

  return /** @type {ExperimentOutcome} */ (result);
}

function printSummary(outcome, resultsDir = DEFAULT_RESULTS_DIR) {
  console.log(`\nResult: ${outcome.outcome.toUpperCase()} (${outcome.duration_ms}ms)`);
  for (const item of outcome.assertions) {
    const mark = item.passed ? 'PASS' : 'FAIL';
    const detail = item.detail ? ` - ${item.detail}` : '';
    console.log(`  ${mark}: ${item.label}${detail}`);
  }
  if (outcome.error) console.log(`\nError: ${outcome.error}`);
  console.log(`\nFull results written to: ${join(resultsDir, 'outcome.json')}`);
}

const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url).replace(/\\/g, '/') === process.argv[1].replace(/\\/g, '/');

if (isMain) {
  const { values } = parseArgs({
    options: {
      'results-dir': { type: 'string' },
      'portarium-url': { type: 'string' },
    },
  });

  const resultsDir = values['results-dir'] ?? DEFAULT_RESULTS_DIR;
  const outcome = await runExperimentB({
    resultsDir,
    portariumUrl: values['portarium-url'],
  });
  printSummary(outcome, resultsDir);
  process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
}
