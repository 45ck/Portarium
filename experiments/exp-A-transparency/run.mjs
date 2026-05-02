/**
 * Experiment A: before-hook transparency.
 *
 * Proves that the native OpenClaw before_tool_call hook governs normal agent
 * tool calls without agent code changes.
 */

// @ts-check

import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const EXPERIMENT_NAME = 'exp-A-transparency';
const DEFAULT_WORKSPACE_ID = 'ws-exp-a';
const DEFAULT_RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results');

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
 *   workspaceId?: string;
 *   resultsDir?: string;
 *   writeResults?: boolean;
 *   log?: (line: string) => void;
 * }} RunExperimentAOptions
 */

function nowIso() {
  return new Date().toISOString();
}

function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

function ensurePluginBuild(root) {
  execFileSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '-p', 'packages/portarium/tsconfig.json'],
    {
      cwd: root,
      stdio: 'pipe',
    },
  );
}

async function loadBuiltPlugin(root) {
  ensurePluginBuild(root);
  const hookUrl = pathToFileURL(
    join(root, 'packages/portarium/dist/hooks/before-tool-call.js'),
  ).href;
  const clientUrl = pathToFileURL(
    join(root, 'packages/portarium/dist/client/portarium-client.js'),
  ).href;
  const [{ registerBeforeToolCallHook }, { PortariumClient }] = await Promise.all([
    import(`${hookUrl}?t=${Date.now()}`),
    import(`${clientUrl}?t=${Date.now()}`),
  ]);
  return { registerBeforeToolCallHook, PortariumClient };
}

function jsonResponse(res, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    'access-control-allow-origin': '*',
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function createProjection(workspaceId) {
  /** @type {Map<string, Record<string, unknown>>} */
  const approvals = new Map();
  /** @type {Record<string, unknown>[]} */
  const proposals = [];

  return {
    workspaceId,
    approvals,
    proposals,
  };
}

async function startDeterministicControlPlane({ workspaceId }) {
  const projection = createProjection(workspaceId);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (req.method === 'GET' && url.pathname === '/health') {
      jsonResponse(res, 200, {
        status: 'ok',
        service: 'exp-a-transparency-control-plane',
        workspaceId,
      });
      return;
    }

    const workspacePrefix = `/v1/workspaces/${encodeURIComponent(workspaceId)}`;

    if (req.method === 'POST' && url.pathname === `${workspacePrefix}/agent-actions:propose`) {
      const body = /** @type {Record<string, unknown>} */ (await readJsonBody(req));
      const toolName = String(body.toolName ?? '');
      const proposalId = `prop-exp-a-${randomUUID()}`;
      const observedAtIso = nowIso();
      let responseBody;

      if (toolName === 'read:file') {
        responseBody = {
          decision: 'Allow',
          proposalId,
          toolName,
          message: 'Read-only tool allowed at Auto tier.',
        };
      } else if (toolName === 'write:file') {
        const approvalId = `appr-exp-a-${randomUUID()}`;
        const approval = {
          approvalId,
          proposalId,
          workspaceId,
          toolName,
          parameters: body.parameters ?? {},
          status: 'Pending',
          requestedAtIso: observedAtIso,
          requestedByUserId: String(body.agentId ?? 'agent-exp-a'),
        };
        projection.approvals.set(approvalId, approval);
        responseBody = {
          decision: 'NeedsApproval',
          status: 'awaiting_approval',
          proposalId,
          approvalId,
          toolName,
          message: 'Mutation tool requires operator approval.',
        };
      } else if (toolName === 'shell.exec') {
        responseBody = {
          decision: 'Denied',
          proposalId,
          toolName,
          message: 'Dangerous shell execution is ManualOnly and denied for this run.',
        };
      } else {
        responseBody = {
          decision: 'Denied',
          proposalId,
          toolName,
          message: `Unknown tool ${toolName || '(empty)'} denied by default.`,
        };
      }

      projection.proposals.push({
        observedAtIso,
        request: body,
        response: responseBody,
      });
      jsonResponse(res, 200, responseBody);
      return;
    }

    const approvalMatch = url.pathname.match(
      new RegExp(`^${workspacePrefix.replaceAll('/', '\\/')}/approvals/([^/]+)$`),
    );
    if (approvalMatch && req.method === 'GET') {
      const approval = projection.approvals.get(decodeURIComponent(approvalMatch[1]));
      if (!approval) {
        jsonResponse(res, 404, { error: 'approval_not_found' });
        return;
      }
      jsonResponse(res, 200, approval);
      return;
    }

    const decideMatch = url.pathname.match(
      new RegExp(`^${workspacePrefix.replaceAll('/', '\\/')}/approvals/([^/]+)/decide$`),
    );
    if (decideMatch && req.method === 'POST') {
      const approvalId = decodeURIComponent(decideMatch[1]);
      const approval = projection.approvals.get(approvalId);
      if (!approval) {
        jsonResponse(res, 404, { error: 'approval_not_found' });
        return;
      }

      const body = /** @type {Record<string, unknown>} */ (await readJsonBody(req));
      const decision = String(body.decision ?? 'approved').toLowerCase();
      approval.status = decision === 'denied' ? 'Denied' : 'Approved';
      approval.decidedAtIso = nowIso();
      approval.decidedByUserId = String(body.operatorId ?? 'operator-exp-a');
      approval.rationale = String(body.rationale ?? 'Experiment A deterministic decision.');
      jsonResponse(res, 200, approval);
      return;
    }

    jsonResponse(res, 404, { error: `not_found: ${req.method} ${url.pathname}` });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not bind Experiment A control plane.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    projection,
    close: () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

function workspaceUrl(baseUrl, workspaceId, path) {
  return `${baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}${path}`;
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const body = /** @type {Record<string, unknown>} */ (await response.json());
  return { response, body };
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
  /** @type {Record<string, unknown>[]} */
  const executions = [];

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
    get executions() {
      return executions;
    },
    async attemptToolCall({ toolName, params }) {
      if (!beforeToolCall) throw new Error('before_tool_call hook was not registered.');

      const hookReturn = await beforeToolCall(
        { toolName, params, runId: `run-exp-a-${toolName.replace(/[^a-z0-9]/gi, '-')}` },
        {
          sessionKey: 'agent:exp-a:main',
          agentId: 'agent-exp-a',
          runId: 'run-exp-a-main',
        },
      );

      if (hookReturn?.block) {
        const blockReason = String(hookReturn.blockReason ?? 'blocked');
        logs.push(blockReason);
        return {
          toolName,
          status: 'blocked',
          blocked: true,
          blockReason,
          hookReturn,
          toolExecuted: false,
        };
      }

      executionCount += 1;
      const execution = {
        toolName,
        params,
        executedAtIso: nowIso(),
      };
      executions.push(execution);
      return {
        toolName,
        status: 'allowed',
        blocked: false,
        hookReturn: hookReturn ?? null,
        toolExecuted: true,
      };
    },
  };
}

function makeConfig(baseUrl, workspaceId) {
  return {
    portariumUrl: baseUrl,
    workspaceId,
    bearerToken: 'exp-a-token',
    tenantId: 'default',
    failClosed: true,
    approvalTimeoutMs: 5_000,
    pollIntervalMs: 50,
    bypassToolNames: ['portarium_get_run', 'portarium_list_approvals'],
    defaultPolicyIds: ['default-governance'],
    defaultExecutionTier: 'Auto',
  };
}

function makeApprovingPoller({ client, baseUrl, workspaceId, trace }) {
  return {
    async waitForDecision(approvalId) {
      const initialPoll = await client.pollApproval(approvalId);
      const initialApproval = await fetchJson(
        workspaceUrl(baseUrl, workspaceId, `/approvals/${encodeURIComponent(approvalId)}`),
      );
      trace.initialWriteApproval = {
        status: initialApproval.response.status,
        body: initialApproval.body,
        pluginPollResult: initialPoll,
      };

      const decision = await fetchJson(
        workspaceUrl(baseUrl, workspaceId, `/approvals/${encodeURIComponent(approvalId)}/decide`),
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer exp-a-operator-token',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            decision: 'approved',
            operatorId: 'operator-exp-a',
            rationale: 'Approve deterministic Experiment A write:file probe.',
          }),
        },
      );
      const approvedPoll = await client.pollApproval(approvalId);
      trace.writeDecision = {
        status: decision.response.status,
        body: decision.body,
        pluginPollResult: approvedPoll,
      };

      return 'approved' in approvedPoll && approvedPoll.approved
        ? { approved: true }
        : { approved: false, reason: JSON.stringify(approvedPoll) };
    },
  };
}

function assert(label, passed, detail) {
  return { label, passed, ...(detail ? { detail } : {}) };
}

function findProposal(trace, toolName) {
  const proposals = /** @type {Record<string, unknown>[]} */ (trace.proposals ?? []);
  return proposals.find((proposal) => {
    const request = /** @type {Record<string, unknown>} */ (proposal.request ?? {});
    return request.toolName === toolName;
  });
}

function verifyTrace(trace) {
  const readProposal = findProposal(trace, 'read:file');
  const writeProposal = findProposal(trace, 'write:file');
  const shellProposal = findProposal(trace, 'shell.exec');
  const attempts = /** @type {Record<string, Record<string, unknown>>} */ (trace.attempts ?? {});
  const writeInitial = /** @type {Record<string, unknown>} */ (trace.initialWriteApproval ?? {});
  const writeInitialBody = /** @type {Record<string, unknown>} */ (writeInitial.body ?? {});
  const writeDecision = /** @type {Record<string, unknown>} */ (trace.writeDecision ?? {});
  const writeDecisionBody = /** @type {Record<string, unknown>} */ (writeDecision.body ?? {});

  return [
    assert(
      'OpenClaw hook registered at priority 1000',
      trace.hookPriority === 1000,
      `priority=${String(trace.hookPriority)}`,
    ),
    assert(
      'read:file proposal is allowed',
      readProposal?.response?.decision === 'Allow' &&
        attempts.read?.status === 'allowed' &&
        attempts.read?.toolExecuted === true,
      `decision=${String(readProposal?.response?.decision)}, attempt=${String(attempts.read?.status)}`,
    ),
    assert(
      'write:file proposal creates an approval gate',
      writeProposal?.response?.decision === 'NeedsApproval' &&
        typeof writeProposal?.response?.approvalId === 'string' &&
        attempts.write?.status === 'allowed',
      `decision=${String(writeProposal?.response?.decision)}, attempt=${String(attempts.write?.status)}`,
    ),
    assert(
      'write:file approval is pending before the operator decision',
      writeInitial.status === 200 && String(writeInitialBody.status).toLowerCase() === 'pending',
      `status=${String(writeInitialBody.status)}`,
    ),
    assert(
      'write:file unblocks only after deterministic operator approval',
      writeDecision.status === 200 &&
        String(writeDecisionBody.status).toLowerCase() === 'approved' &&
        attempts.write?.toolExecuted === true,
      `decisionStatus=${String(writeDecisionBody.status)}, toolExecuted=${String(attempts.write?.toolExecuted)}`,
    ),
    assert(
      'shell.exec proposal is denied',
      shellProposal?.response?.decision === 'Denied' &&
        attempts.shell?.status === 'blocked' &&
        attempts.shell?.toolExecuted === false,
      `decision=${String(shellProposal?.response?.decision)}, attempt=${String(attempts.shell?.status)}`,
    ),
    assert(
      'denied shell.exec never reaches the tool executor',
      trace.executionCount === 2 &&
        Array.isArray(trace.executions) &&
        !trace.executions.some((execution) => execution.toolName === 'shell.exec'),
      `executionCount=${String(trace.executionCount)}`,
    ),
  ];
}

/**
 * @param {RunExperimentAOptions} [options]
 * @returns {Promise<ExperimentOutcome>}
 */
export async function runExperimentA(options = {}) {
  const startedAt = Date.now();
  const root = repoRoot();
  const workspaceId = options.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const resultsDir = options.resultsDir ?? DEFAULT_RESULTS_DIR;
  const log = options.log ?? console.log;
  const writeResults = options.writeResults ?? true;
  const logs = [];
  /** @type {Record<string, unknown>} */
  let trace = {};
  let assertions = [];
  let error;
  let server;

  try {
    const { registerBeforeToolCallHook, PortariumClient } = await loadBuiltPlugin(root);
    server = await startDeterministicControlPlane({ workspaceId });
    log(`[exp-a] deterministic Portarium surface: ${server.baseUrl}`);

    const config = makeConfig(server.baseUrl, workspaceId);
    const logger = makeLogger(logs, log);
    const client = new PortariumClient(config);
    const harness = makeOpenClawHarness(logs);
    trace = { portariumUrl: server.baseUrl };
    const poller = makeApprovingPoller({
      client,
      baseUrl: server.baseUrl,
      workspaceId,
      trace,
    });

    registerBeforeToolCallHook(harness.api, client, poller, config, logger);

    const readAttempt = await harness.attemptToolCall({
      toolName: 'read:file',
      params: { path: 'README.md' },
    });
    const writeAttempt = await harness.attemptToolCall({
      toolName: 'write:file',
      params: {
        path: 'experiments/exp-A-transparency/results/agent-output.txt',
        content: 'Experiment A governed write output.',
      },
    });
    const shellAttempt = await harness.attemptToolCall({
      toolName: 'shell.exec',
      params: { command: 'rm -rf /tmp/portarium-exp-a' },
    });

    trace = {
      ...trace,
      hookPriority: harness.priority,
      attempts: {
        read: readAttempt,
        write: writeAttempt,
        shell: shellAttempt,
      },
      proposals: server.projection.proposals,
      approvals: [...server.projection.approvals.values()],
      executionCount: harness.executionCount,
      executions: harness.executions,
      logs,
    };
    assertions = verifyTrace(trace);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  } finally {
    if (server) await server.close();
  }

  const result = {
    experiment: EXPERIMENT_NAME,
    timestamp: nowIso(),
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
      'workspace-id': { type: 'string' },
    },
  });

  const resultsDir = values['results-dir'] ?? DEFAULT_RESULTS_DIR;
  const outcome = await runExperimentA({
    workspaceId: values['workspace-id'],
    resultsDir,
  });
  printSummary(outcome, resultsDir);
  process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
}
