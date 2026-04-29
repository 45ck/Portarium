/**
 * Experiment C: approval lifecycle via Cockpit-visible script.
 *
 * Deterministically exercises the native plugin-facing approval path:
 * agent-actions:propose -> approvals visibility -> operator decision ->
 * agent-actions/:approvalId/execute -> runs/evidence visibility.
 */

// @ts-check

import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const EXPERIMENT_NAME = 'exp-C-approval-lifecycle';
const DEFAULT_WORKSPACE_ID = 'ws-exp-c';
const DEFAULT_RESULTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'results');

/**
 * @typedef {{
 *   label: string;
 *   passed: boolean;
 *   detail?: string;
 * }} Assertion
 */

/**
 * @typedef {{
 *   experiment: string;
 *   timestamp: string;
 *   outcome: 'confirmed' | 'refuted' | 'inconclusive';
 *   duration_ms: number;
 *   assertions: Assertion[];
 *   trace: Record<string, unknown>;
 *   error?: string;
 * }} ExperimentOutcome
 */

/**
 * @typedef {{
 *   workspaceId?: string;
 *   resultsDir?: string;
 *   writeResults?: boolean;
 *   log?: (line: string) => void;
 * }} RunExperimentCOptions
 */

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function hashEvidence(previousHash, entry) {
  const input = JSON.stringify({
    previousHash,
    category: entry.category,
    summary: entry.summary,
    links: entry.links,
    occurredAtIso: entry.occurredAtIso,
  });
  return `sha256:${createHash('sha256').update(input).digest('hex')}`;
}

function createProjection(workspaceId) {
  /** @type {Map<string, Record<string, unknown>>} */
  const approvals = new Map();
  /** @type {Map<string, Record<string, unknown>>} */
  const runs = new Map();
  /** @type {Record<string, unknown>[]} */
  const evidence = [];

  function appendEvidence(category, summary, links) {
    const previous = evidence.at(-1);
    const occurredAtIso = nowIso();
    const entry = {
      schemaVersion: 1,
      evidenceId: `ev-exp-c-${String(evidence.length + 1).padStart(3, '0')}`,
      workspaceId,
      category,
      summary,
      actor: { kind: category === 'Approval' ? 'User' : 'System' },
      links,
      occurredAtIso,
      previousHash: previous?.hashSha256,
    };
    evidence.push({
      ...entry,
      hashSha256: hashEvidence(String(previous?.hashSha256 ?? ''), entry),
    });
    return evidence.at(-1);
  }

  return { approvals, runs, evidence, appendEvidence };
}

async function startDeterministicCockpitServer({ workspaceId }) {
  const projection = createProjection(workspaceId);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'authorization,content-type,x-portarium-workspace-id',
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      jsonResponse(res, 200, {
        status: 'ok',
        service: 'exp-c-deterministic-cockpit',
        workspaceId,
      });
      return;
    }

    const workspacePrefix = `/v1/workspaces/${encodeURIComponent(workspaceId)}`;

    if (req.method === 'POST' && url.pathname === `${workspacePrefix}/agent-actions:propose`) {
      const body = /** @type {Record<string, unknown>} */ (await readJsonBody(req));
      const toolName = String(body.toolName ?? '');
      const parameters = /** @type {Record<string, unknown>} */ (body.parameters ?? {});
      const runId = `run-exp-c-${randomUUID()}`;
      const approvalId = randomUUID();
      const planId = `plan-exp-c-${randomUUID()}`;
      const correlationId = String(body.correlationId ?? `corr-exp-c-${randomUUID()}`);
      const requestedAtIso = nowIso();

      if (toolName !== 'write:file') {
        jsonResponse(res, 403, {
          decision: 'Denied',
          message: `Experiment C only governs write:file, got ${toolName || '(empty)'}.`,
        });
        return;
      }

      const run = {
        runId,
        workspaceId,
        workflowId: 'experiment-c-approval-lifecycle',
        status: 'WaitingForApproval',
        agentId: String(body.agentId ?? 'agent-exp-c'),
        toolName,
        parameters,
        approvalIds: [approvalId],
        evidenceIds: [],
        correlationId,
        createdAtIso: requestedAtIso,
        updatedAtIso: requestedAtIso,
      };
      const approval = {
        approvalId,
        workspaceId,
        runId,
        planId,
        toolName,
        parameters,
        status: 'pending',
        requestedAtIso,
        requestedByUserId: String(body.agentId ?? 'agent-exp-c'),
        prompt: `Approve governed ${toolName} action for ${String(parameters.path ?? '(unknown path)')}.`,
      };

      projection.runs.set(runId, run);
      projection.approvals.set(approvalId, approval);
      const planEvidence = projection.appendEvidence('Plan', `Plan created for ${toolName}`, {
        runId,
        approvalId,
        planId,
      });
      run.evidenceIds = [planEvidence.evidenceId];

      jsonResponse(res, 202, {
        decision: 'NeedsApproval',
        status: 'awaiting_approval',
        approvalId,
        runId,
        planId,
        toolName,
        message: 'Governed write:file action is pending operator approval.',
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === `${workspacePrefix}/approvals`) {
      const status = url.searchParams.get('status');
      const approvals = [...projection.approvals.values()].filter((approval) =>
        status ? approval.status === status : true,
      );
      jsonResponse(res, 200, { approvals, total: approvals.length });
      return;
    }

    const approvalMatch = url.pathname.match(
      new RegExp(`^${workspacePrefix.replaceAll('/', '\\/')}/approvals/([^/]+)$`),
    );
    if (req.method === 'GET' && approvalMatch) {
      const approval = projection.approvals.get(decodeURIComponent(approvalMatch[1]));
      if (!approval) {
        jsonResponse(res, 404, { error: 'approval_not_found' });
        return;
      }
      jsonResponse(res, 200, approval);
      return;
    }

    const decisionMatch = url.pathname.match(
      new RegExp(`^${workspacePrefix.replaceAll('/', '\\/')}/approvals/([^/]+)/decide$`),
    );
    if (req.method === 'POST' && decisionMatch) {
      const approvalId = decodeURIComponent(decisionMatch[1]);
      const approval = projection.approvals.get(approvalId);
      if (!approval) {
        jsonResponse(res, 404, { error: 'approval_not_found' });
        return;
      }
      const body = /** @type {Record<string, unknown>} */ (await readJsonBody(req));
      const rawDecision = String(body.decision ?? '').toLowerCase();
      const status =
        rawDecision === 'approved' || rawDecision === 'approve' ? 'approved' : rawDecision;
      if (status !== 'approved' && status !== 'denied') {
        jsonResponse(res, 400, { error: 'decision must be approved or denied' });
        return;
      }
      const decidedAtIso = nowIso();
      approval.status = status;
      approval.decidedAtIso = decidedAtIso;
      approval.decidedByUserId = String(body.operatorId ?? 'operator-exp-c');
      approval.rationale = String(body.rationale ?? 'Experiment C operator decision.');

      const run = projection.runs.get(String(approval.runId));
      if (run) {
        run.status = status === 'approved' ? 'ApprovalGranted' : 'ApprovalDenied';
        run.updatedAtIso = decidedAtIso;
      }
      const approvalEvidence = projection.appendEvidence(
        'Approval',
        `Operator ${status} ${approval.toolName}`,
        { runId: approval.runId, approvalId },
      );
      if (run)
        run.evidenceIds = [...new Set([...(run.evidenceIds ?? []), approvalEvidence.evidenceId])];

      jsonResponse(res, 200, approval);
      return;
    }

    const executeMatch = url.pathname.match(
      new RegExp(`^${workspacePrefix.replaceAll('/', '\\/')}/agent-actions/([^/]+)/execute$`),
    );
    if (req.method === 'POST' && executeMatch) {
      const approvalId = decodeURIComponent(executeMatch[1]);
      const approval = projection.approvals.get(approvalId);
      if (!approval) {
        jsonResponse(res, 404, { error: 'approval_not_found' });
        return;
      }
      if (approval.status !== 'approved') {
        jsonResponse(res, 409, { error: `approval status is ${approval.status}` });
        return;
      }
      const run = projection.runs.get(String(approval.runId));
      if (!run) {
        jsonResponse(res, 404, { error: 'run_not_found' });
        return;
      }
      const executedAtIso = nowIso();
      const output = {
        ok: true,
        toolName: approval.toolName,
        path: approval.parameters.path,
        bytesWritten: String(approval.parameters.content ?? '').length,
      };

      const actionEvidence = projection.appendEvidence('Action', `Executed ${approval.toolName}`, {
        runId: run.runId,
        approvalId,
      });
      run.status = 'Succeeded';
      run.output = output;
      run.endedAtIso = executedAtIso;
      run.updatedAtIso = executedAtIso;
      const systemEvidence = projection.appendEvidence('System', `Run ${run.runId} succeeded`, {
        runId: run.runId,
      });
      run.evidenceIds = [
        ...new Set([
          ...(run.evidenceIds ?? []),
          actionEvidence.evidenceId,
          systemEvidence.evidenceId,
        ]),
      ];

      jsonResponse(res, 200, {
        approvalId,
        runId: run.runId,
        status: 'executed',
        approvedByHuman: true,
        output,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === `${workspacePrefix}/runs`) {
      const runId = url.searchParams.get('runId');
      const runs = [...projection.runs.values()].filter((run) =>
        runId ? run.runId === runId : true,
      );
      jsonResponse(res, 200, { runs, total: runs.length });
      return;
    }

    const runMatch = url.pathname.match(
      new RegExp(`^${workspacePrefix.replaceAll('/', '\\/')}/runs/([^/]+)$`),
    );
    if (req.method === 'GET' && runMatch) {
      const run = projection.runs.get(decodeURIComponent(runMatch[1]));
      if (!run) {
        jsonResponse(res, 404, { error: 'run_not_found' });
        return;
      }
      jsonResponse(res, 200, run);
      return;
    }

    if (req.method === 'GET' && url.pathname === `${workspacePrefix}/evidence`) {
      const runId = url.searchParams.get('runId');
      const evidence = projection.evidence.filter((entry) => {
        const links = /** @type {Record<string, unknown> | undefined} */ (entry.links);
        return runId ? links?.runId === runId : true;
      });
      jsonResponse(res, 200, { evidence, total: evidence.length });
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
    throw new Error('Could not bind Experiment C server.');
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

async function pollApproval(baseUrl, workspaceId, approvalId, { timeoutMs = 5_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { response, body } = await fetchJson(
      workspaceUrl(baseUrl, workspaceId, `/approvals/${encodeURIComponent(approvalId)}`),
    );
    if (response.ok && (body.status === 'approved' || body.status === 'denied')) {
      return body;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for approval ${approvalId}`);
}

async function runNativePluginApprovalPath({ baseUrl, workspaceId, log }) {
  const toolParameters = {
    path: 'experiments/exp-C-approval-lifecycle/results/agent-output.txt',
    content: 'Experiment C governed write output.',
  };

  log('[exp-c] agent: proposing governed write:file via native plugin endpoint');
  const proposal = await fetchJson(workspaceUrl(baseUrl, workspaceId, '/agent-actions:propose'), {
    method: 'POST',
    headers: {
      authorization: 'Bearer exp-c-agent-token',
      'content-type': 'application/json',
      'x-portarium-workspace-id': workspaceId,
    },
    body: JSON.stringify({
      agentId: 'agent-exp-c',
      actionKind: 'tool:invoke',
      toolName: 'write:file',
      parameters: toolParameters,
      executionTier: 'Auto',
      policyIds: ['exp-c-governed-write'],
      rationale: 'Validate approval lifecycle visibility for a governed file write.',
      correlationId: `corr-exp-c-${randomUUID()}`,
    }),
  });

  const approvalId = String(proposal.body.approvalId ?? '');
  const runId = String(proposal.body.runId ?? '');

  log(`[exp-c] cockpit: checking pending approval visibility (${approvalId})`);
  const approvalList = await fetchJson(
    workspaceUrl(baseUrl, workspaceId, '/approvals?status=pending'),
  );
  const pendingApproval = /** @type {{ approvalId?: string }[]} */ (
    approvalList.body.approvals ?? []
  ).find((approval) => approval.approvalId === approvalId);

  const initialApproval = await fetchJson(
    workspaceUrl(baseUrl, workspaceId, `/approvals/${encodeURIComponent(approvalId)}`),
  );

  log('[exp-c] operator: approving the pending request');
  const decision = await fetchJson(
    workspaceUrl(baseUrl, workspaceId, `/approvals/${encodeURIComponent(approvalId)}/decide`),
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer exp-c-operator-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        decision: 'approved',
        operatorId: 'operator-exp-c',
        rationale: 'Approved for deterministic Experiment C validation.',
      }),
    },
  );

  log('[exp-c] agent: polling until approval is granted');
  const approvedApproval = await pollApproval(baseUrl, workspaceId, approvalId);

  log('[exp-c] agent: executing after approval unblocks the write');
  const execution = await fetchJson(
    workspaceUrl(baseUrl, workspaceId, `/agent-actions/${encodeURIComponent(approvalId)}/execute`),
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer exp-c-agent-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ flowRef: 'exp-c/native-plugin/write-file', payload: toolParameters }),
    },
  );

  const run = await fetchJson(
    workspaceUrl(baseUrl, workspaceId, `/runs/${encodeURIComponent(runId)}`),
  );
  const runList = await fetchJson(
    workspaceUrl(baseUrl, workspaceId, `/runs?runId=${encodeURIComponent(runId)}`),
  );
  const evidence = await fetchJson(
    workspaceUrl(baseUrl, workspaceId, `/evidence?runId=${encodeURIComponent(runId)}`),
  );

  return {
    proposal: { status: proposal.response.status, body: proposal.body },
    approvalList: {
      status: approvalList.response.status,
      body: approvalList.body,
      pendingApproval,
    },
    initialApproval: { status: initialApproval.response.status, body: initialApproval.body },
    decision: { status: decision.response.status, body: decision.body },
    approvedApproval,
    execution: { status: execution.response.status, body: execution.body },
    run: { status: run.response.status, body: run.body },
    runList: { status: runList.response.status, body: runList.body },
    evidence: { status: evidence.response.status, body: evidence.body },
  };
}

function assert(label, passed, detail) {
  return { label, passed, ...(detail ? { detail } : {}) };
}

function evidenceHashChainIsLinked(entries) {
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index].previousHash !== entries[index - 1].hashSha256) return false;
  }
  return true;
}

function verifyTrace(trace) {
  const evidenceEntries = /** @type {Record<string, unknown>[]} */ (
    trace.evidence.body.evidence ?? []
  );
  const categories = new Set(evidenceEntries.map((entry) => entry.category));

  return [
    assert(
      'agent proposal returns awaiting approval',
      trace.proposal.status === 202 && trace.proposal.body.decision === 'NeedsApproval',
      `status=${trace.proposal.status}, decision=${String(trace.proposal.body.decision)}`,
    ),
    assert(
      'approval is visible in operator pending queue',
      trace.approvalList.status === 200 && Boolean(trace.approvalList.pendingApproval),
      `pendingTotal=${String(trace.approvalList.body.total ?? 0)}`,
    ),
    assert(
      'approval poll shows pending before operator decision',
      trace.initialApproval.status === 200 && trace.initialApproval.body.status === 'pending',
      `status=${String(trace.initialApproval.body.status)}`,
    ),
    assert(
      'operator approval succeeds',
      trace.decision.status === 200 && trace.decision.body.status === 'approved',
      `status=${trace.decision.status}`,
    ),
    assert(
      'agent poll observes approved decision',
      trace.approvedApproval.status === 'approved',
      `status=${String(trace.approvedApproval.status)}`,
    ),
    assert(
      'agent executes only after human approval',
      trace.execution.status === 200 &&
        trace.execution.body.status === 'executed' &&
        trace.execution.body.approvedByHuman === true,
      `status=${trace.execution.status}`,
    ),
    assert(
      'run is visible as succeeded',
      trace.run.status === 200 && trace.run.body.status === 'Succeeded',
      `runStatus=${String(trace.run.body.status)}`,
    ),
    assert(
      'run appears in Cockpit-style run list',
      trace.runList.status === 200 && trace.runList.body.total === 1,
      `runTotal=${String(trace.runList.body.total ?? 0)}`,
    ),
    assert(
      'evidence includes Plan, Approval, Action, and System entries',
      ['Plan', 'Approval', 'Action', 'System'].every((category) => categories.has(category)),
      `categories=${[...categories].join(',')}`,
    ),
    assert(
      'evidence hash chain is linked',
      evidenceEntries.length >= 4 && evidenceHashChainIsLinked(evidenceEntries),
      `entries=${evidenceEntries.length}`,
    ),
  ];
}

/**
 * Run Experiment C and return its structured outcome.
 *
 * @param {RunExperimentCOptions} [options]
 * @returns {Promise<ExperimentOutcome>}
 */
export async function runExperimentC(options = {}) {
  const startedAt = Date.now();
  const workspaceId = options.workspaceId ?? DEFAULT_WORKSPACE_ID;
  const resultsDir = options.resultsDir ?? DEFAULT_RESULTS_DIR;
  const log = options.log ?? console.log;
  const writeResults = options.writeResults ?? true;
  let server;
  let trace = {};
  let assertions = [];
  let error;

  try {
    server = await startDeterministicCockpitServer({ workspaceId });
    log(`[exp-c] deterministic Cockpit/control-plane surface: ${server.baseUrl}`);
    trace = await runNativePluginApprovalPath({ baseUrl: server.baseUrl, workspaceId, log });
    assertions = verifyTrace(trace);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  } finally {
    if (server) await server.close();
  }

  const duration_ms = Date.now() - startedAt;
  const outcome =
    error != null
      ? 'inconclusive'
      : assertions.length > 0 && assertions.every((item) => item.passed)
        ? 'confirmed'
        : 'refuted';

  const result = {
    experiment: EXPERIMENT_NAME,
    timestamp: nowIso(),
    outcome,
    duration_ms,
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
      'live-cockpit': { type: 'boolean', default: false },
    },
  });

  if (values['live-cockpit']) {
    console.log(
      '[exp-c] --live-cockpit is intentionally opt-in documentation mode. Start Cockpit with ' +
        '`npm run cockpit:dev` and use the deterministic outcome IDs printed by this script ' +
        'to inspect equivalent Approvals, Runs, and Evidence views in a seeded/live stack.',
    );
  }

  const resultsDir = values['results-dir'] ?? DEFAULT_RESULTS_DIR;
  const outcome = await runExperimentC({
    workspaceId: values['workspace-id'],
    resultsDir,
  });
  printSummary(outcome, resultsDir);
  process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
}
