/**
 * Portarium Policy Proxy — HTTP gateway for demo agents
 *
 * Thin HTTP server that routes tool calls through ActionGatedToolInvoker.
 * Shared by OpenAI, Anthropic, and Docker agent demos.
 *
 * Control plane delegation (ADR-0117 H9):
 *   CLI flag:    --use-control-plane --cp-url URL --workspace-id ID --bearer-token TOK
 *   Env vars:    CONTROL_PLANE_URL, WORKSPACE_ID, BEARER_TOKEN
 *
 * When configured, the proxy delegates tool proposals to the real control plane
 * POST /v1/workspaces/:wsId/agent-actions:propose endpoint. Otherwise it uses
 * the local in-process ActionGatedToolInvoker + domain-layer approval commands
 * (createApproval / submitApproval via InMemoryApprovalStore — ADR-0117 H9).
 *
 * Run standalone:  npm run demo:proxy  (or: tsx scripts/demo/portarium-tool-proxy.mjs)
 * Imported API:    const { url, close } = await startPolicyProxy(9999);
 */

import { createServer, request as httpRequest } from 'http';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { parseArgs } from 'node:util';

// ---------------------------------------------------------------------------
// CLI argument parsing (--use-control-plane flag support)
// ---------------------------------------------------------------------------

const { values: cliArgs } = parseArgs({
  options: {
    'use-control-plane': { type: 'boolean', default: false },
    'cp-url': { type: 'string' },
    'workspace-id': { type: 'string' },
    'bearer-token': { type: 'string' },
  },
  strict: false,
});

// ---------------------------------------------------------------------------
// Control plane delegation (optional)
// ---------------------------------------------------------------------------

/**
 * Resolve control plane config from CLI flags (preferred) or env vars (fallback).
 * The --use-control-plane flag signals intent; --cp-url/--workspace-id/--bearer-token
 * or the corresponding env vars supply the actual values.
 */
function resolveControlPlane() {
  const cpUrl =
    /** @type {string | undefined} */ (cliArgs['cp-url']) ?? process.env['CONTROL_PLANE_URL'];
  const wsId =
    /** @type {string | undefined} */ (cliArgs['workspace-id']) ?? process.env['WORKSPACE_ID'];
  const token =
    /** @type {string | undefined} */ (cliArgs['bearer-token']) ?? process.env['BEARER_TOKEN'];

  // If --use-control-plane is passed, require the three values
  if (cliArgs['use-control-plane']) {
    if (!cpUrl || !wsId || !token) {
      console.error(
        '[portarium-proxy] --use-control-plane requires --cp-url, --workspace-id, and --bearer-token ' +
          '(or equivalent CONTROL_PLANE_URL, WORKSPACE_ID, BEARER_TOKEN env vars).',
      );
      process.exit(1);
    }
    return { url: cpUrl, workspaceId: wsId, bearerToken: token };
  }

  // Legacy env-var only path
  if (cpUrl && wsId && token) {
    return { url: cpUrl, workspaceId: wsId, bearerToken: token };
  }

  return null;
}

/** @type {{ url: string; workspaceId: string; bearerToken: string } | null} */
const controlPlane = resolveControlPlane();

/**
 * Forward tool proposal to the real control plane.
 *
 * @param {{ toolName: string; parameters: unknown; policyTier: string }} input
 * @returns {Promise<{ statusCode: number; body: any }>}
 */
function proposeViaControlPlane(input) {
  if (!controlPlane) throw new Error('controlPlane not configured');
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      agentId: 'agent-demo-proxy',
      actionKind: 'tool:invoke',
      toolName: input.toolName,
      parameters: input.parameters,
      executionTier: input.policyTier,
      policyIds: ['default'],
      rationale: `Demo proxy invocation of ${input.toolName}`,
    });
    const url = new URL(
      `/v1/workspaces/${controlPlane.workspaceId}/agent-actions:propose`,
      controlPlane.url,
    );
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${controlPlane.bearerToken}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = httpRequest(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode ?? 500, body: JSON.parse(raw) });
        } catch (e) {
          reject(new Error(`Failed to parse control plane response: ${String(e)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Domain-layer approval store (ADR-0117 H9 bridge)
// ---------------------------------------------------------------------------

// tsx resolves .js → .ts at runtime
import { createApproval } from '../../src/application/commands/create-approval.js';
import { submitApproval } from '../../src/application/commands/submit-approval.js';
import { toAppContext } from '../../src/application/common/context.js';
import { TenantId, WorkspaceId, ApprovalId } from '../../src/domain/primitives/index.js';

/**
 * Minimal in-memory approval store for demo use.
 * The full InMemoryApprovalStore was removed in bead-0914; the production
 * bootstrap uses an equivalent inline implementation.
 */
class InMemoryApprovalStore {
  /** @type {Map<string, any>} */
  #store = new Map();

  async getApprovalById(_tenantId, _workspaceId, approvalId) {
    return this.#store.get(String(approvalId)) ?? null;
  }

  async saveApproval(_tenantId, approval) {
    this.#store.set(String(approval.approvalId), approval);
  }

  async listApprovals(_tenantId, _workspaceId, filter) {
    let items = [...this.#store.values()];
    if (filter.status) items = items.filter((a) => a.status === filter.status);
    if (filter.runId) items = items.filter((a) => String(a.runId) === String(filter.runId));
    if (filter.planId) items = items.filter((a) => String(a.planId) === String(filter.planId));
    if (filter.limit) items = items.slice(0, filter.limit);
    return { items };
  }
}

const approvalStore = new InMemoryApprovalStore();

/** Side table: maps approvalId (string) → { toolName, parameters } for HTTP API compat. */
/** @type {Map<string, { toolName: string; parameters: unknown }>} */
const toolContextByApprovalId = new Map();

const DEMO_TENANT_ID = 'ws-proxy-demo';
const DEMO_WORKSPACE_ID = 'ws-proxy-demo';
const AGENT_PRINCIPAL = 'user-proxy-agent';
const HUMAN_PRINCIPAL = 'user-proxy-human';

/** Build an AppContext for the agent (creates approvals). */
function agentContext(correlationId = randomUUID()) {
  return toAppContext({
    tenantId: DEMO_TENANT_ID,
    principalId: AGENT_PRINCIPAL,
    correlationId,
    roles: ['operator'],
  });
}

/** Build an AppContext for the human operator (decides approvals). */
function humanContext(correlationId = randomUUID()) {
  return toAppContext({
    tenantId: DEMO_TENANT_ID,
    principalId: HUMAN_PRINCIPAL,
    correlationId,
    roles: ['approver'],
  });
}

/** Lightweight deps shared by both createApproval and submitApproval. */
function makeDomainDeps() {
  return {
    authorization: { isAllowed: async () => true },
    clock: { nowIso: () => new Date().toISOString() },
    idGenerator: { generateId: () => randomUUID() },
    approvalStore,
    unitOfWork: { execute: async (fn) => fn() },
    eventPublisher: {
      publish: async (event) => {
        console.log(`[portarium-proxy] Domain event: ${event.type}`);
      },
    },
  };
}

const domainDeps = makeDomainDeps();

/** Map domain PascalCase status to the proxy's lowercase HTTP API. */
function toLowerStatus(status) {
  if (status === 'Pending') return 'pending';
  if (status === 'Approved') return 'approved';
  if (status === 'Denied') return 'denied';
  if (status === 'RequestChanges') return 'denied';
  return status.toLowerCase();
}

/** Map lowercase HTTP decision to domain PascalCase. */
function toDomainDecision(decision) {
  if (decision === 'approved') return 'Approved';
  if (decision === 'denied') return 'Denied';
  return decision;
}

import { classifyOpenClawToolBlastRadiusV1 } from '../../src/domain/machines/openclaw-tool-blast-radius-v1.js';
import { ActionGatedToolInvoker } from '../../src/application/services/action-gated-tool-invoker.js';

// ---------------------------------------------------------------------------
// Shared mock infrastructure
// ---------------------------------------------------------------------------

/** @type {import('../../src/application/ports/machine-invoker.js').MachineInvokerPort} */
const mockMachineInvoker = {
  async invokeTool(input) {
    return {
      ok: true,
      output: {
        result: `[demo-proxy] executed ${input.toolName}`,
        parameters: input.parameters,
        timestamp: new Date().toISOString(),
      },
    };
  },
  async runAgent() {
    return { ok: true, output: { result: '[demo-proxy] agent run completed' } };
  },
};

const gatedInvoker = new ActionGatedToolInvoker(mockMachineInvoker);

/** Demo actor — admin role satisfies the RBAC gate for all tool invocations. */
const DEMO_ACTOR = /** @type {any} */ ({
  userId: 'user-proxy-demo',
  workspaceId: 'ws-proxy-demo',
  roles: ['admin'],
});

/** Catalogue of available demo tools. */
const DEMO_TOOLS = [
  { name: 'read:file', description: 'Read a file from the filesystem' },
  { name: 'search:documents', description: 'Full-text search across documents' },
  { name: 'get:status', description: 'Retrieve system or service status' },
  { name: 'write:file', description: 'Write content to a file' },
  { name: 'create:record', description: 'Create a new data record' },
  { name: 'delete:record', description: 'Permanently delete a record' },
  { name: 'shell.exec', description: 'Execute an arbitrary shell command' },
  { name: 'terminal.run', description: 'Run a terminal command with output capture' },
  { name: 'browser.navigate', description: 'Navigate to a URL in an automated browser' },
];

// ---------------------------------------------------------------------------
// HTTP utilities
// ---------------------------------------------------------------------------

/**
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function jsonResponse(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<unknown>}
 */
/** Maximum request body size (100 KB) — prevents memory exhaustion from oversized payloads. */
const MAX_BODY_BYTES = 100 * 1024;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {number} port
 */
async function handleRequest(req, res, port) {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);

  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // GET /health
  if (req.method === 'GET' && url.pathname === '/health') {
    const pendingPage = await approvalStore.listApprovals(
      TenantId(DEMO_TENANT_ID),
      WorkspaceId(DEMO_WORKSPACE_ID),
      { status: 'Pending' },
    );
    jsonResponse(res, 200, {
      status: 'ok',
      service: 'portarium-policy-proxy',
      port,
      pendingApprovals: pendingPage.items.length,
    });
    return;
  }

  // GET /approvals — list approvals (optionally filtered by ?status=pending)
  if (req.method === 'GET' && url.pathname === '/approvals') {
    const statusFilter = url.searchParams.get('status');
    const domainStatus =
      statusFilter === 'pending'
        ? 'Pending'
        : statusFilter === 'approved'
          ? 'Approved'
          : statusFilter === 'denied'
            ? 'Denied'
            : undefined;
    const page = await approvalStore.listApprovals(
      TenantId(DEMO_TENANT_ID),
      WorkspaceId(DEMO_WORKSPACE_ID),
      { status: domainStatus },
    );
    const items = page.items.map((a) => {
      const toolCtx = toolContextByApprovalId.get(String(a.approvalId)) ?? {};
      return {
        approvalId: String(a.approvalId),
        toolName: toolCtx.toolName,
        parameters: toolCtx.parameters,
        status: toLowerStatus(a.status),
        createdAt: a.requestedAtIso,
        ...(a.status !== 'Pending' ? { decidedAt: a.decidedAtIso } : {}),
      };
    });
    jsonResponse(res, 200, { approvals: items, total: items.length });
    return;
  }

  // GET /approvals/ui — human-facing HTML page
  if (req.method === 'GET' && url.pathname === '/approvals/ui') {
    const pendingPage = await approvalStore.listApprovals(
      TenantId(DEMO_TENANT_ID),
      WorkspaceId(DEMO_WORKSPACE_ID),
      { status: 'Pending' },
    );
    const pending = pendingPage.items.map((a) => {
      const toolCtx = toolContextByApprovalId.get(String(a.approvalId)) ?? {};
      return {
        id: String(a.approvalId),
        toolName: toolCtx.toolName ?? '(unknown)',
        createdAt: a.requestedAtIso,
      };
    });
    const rows = pending.length
      ? pending
          .map(
            (p) =>
              `<tr><td>${p.toolName}</td><td style="font-size:0.8em;color:#666">${p.id.slice(0, 8)}…</td><td>${p.createdAt}</td>` +
              `<td><button onclick="decide('${p.id}','approved')" style="background:#22c55e;color:#fff;border:none;padding:4px 10px;cursor:pointer;border-radius:4px">Approve</button> ` +
              `<button onclick="decide('${p.id}','denied')" style="background:#ef4444;color:#fff;border:none;padding:4px 10px;cursor:pointer;border-radius:4px;margin-left:4px">Deny</button></td></tr>`,
          )
          .join('')
      : '<tr><td colspan="4" style="color:#888;text-align:center">No pending approvals</td></tr>';
    const html = `<!doctype html><html><head><title>Portarium Approvals</title>
<meta http-equiv="refresh" content="3"><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px}
table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ddd;text-align:left}th{background:#f5f5f5}</style></head>
<body><h2>⏳ Pending Approvals</h2><p style="color:#666">Auto-refreshes every 3 seconds.</p>
<table><thead><tr><th>Tool</th><th>Approval ID</th><th>Requested</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>
<script>async function decide(id,decision){await fetch('/approvals/'+id+'/decide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision})});location.reload();}</script>
</body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': Buffer.byteLength(html) });
    res.end(html);
    return;
  }

  // GET /approvals/:id — poll single approval status
  const pollMatch = url.pathname.match(/^\/approvals\/([0-9a-f-]{36})$/);
  if (req.method === 'GET' && pollMatch) {
    const id = /** @type {string} */ (pollMatch[1]);
    const approval = await approvalStore.getApprovalById(
      TenantId(DEMO_TENANT_ID),
      WorkspaceId(DEMO_WORKSPACE_ID),
      ApprovalId(id),
    );
    if (!approval) {
      jsonResponse(res, 404, { error: `Approval ${id} not found` });
      return;
    }
    const toolCtx = toolContextByApprovalId.get(id) ?? {};
    jsonResponse(res, 200, {
      approvalId: id,
      toolName: toolCtx.toolName,
      parameters: toolCtx.parameters,
      status: toLowerStatus(approval.status),
      createdAt: approval.requestedAtIso,
      ...(approval.status !== 'Pending' ? { decidedAt: approval.decidedAtIso } : {}),
    });
    return;
  }

  // POST /approvals/:id/decide — submit human decision (via domain submitApproval command)
  const decideMatch = url.pathname.match(/^\/approvals\/([0-9a-f-]{36})\/decide$/);
  if (req.method === 'POST' && decideMatch) {
    const id = /** @type {string} */ (decideMatch[1]);
    let body;
    try {
      body = /** @type {any} */ (await readJsonBody(req));
    } catch {
      jsonResponse(res, 400, { error: 'Invalid JSON body' });
      return;
    }
    const { decision } = body;
    if (decision !== 'approved' && decision !== 'denied') {
      jsonResponse(res, 400, { error: 'decision must be "approved" or "denied"' });
      return;
    }
    const ctx = humanContext();
    const result = await submitApproval(domainDeps, ctx, {
      workspaceId: DEMO_WORKSPACE_ID,
      approvalId: id,
      decision: toDomainDecision(decision),
      rationale: `Human decision via proxy: ${decision}`,
    });
    if (!result.ok) {
      const errorKind = result.error.kind;
      const statusCode = errorKind === 'NotFound' ? 404 : errorKind === 'Conflict' ? 409 : 400;
      jsonResponse(res, statusCode, { error: result.error.message });
      return;
    }
    const toolCtx = toolContextByApprovalId.get(id);
    const decidedAt = new Date().toISOString();
    console.log(
      `[portarium-proxy] Approval ${id.slice(0, 8)}… → ${decision} (${toolCtx?.toolName ?? 'unknown'})`,
    );
    jsonResponse(res, 200, { approvalId: id, status: decision, decidedAt });
    return;
  }

  // GET /tools
  if (req.method === 'GET' && url.pathname === '/tools') {
    const tools = DEMO_TOOLS.map((t) => {
      const policy = classifyOpenClawToolBlastRadiusV1(t.name);
      return {
        name: t.name,
        description: t.description,
        category: policy.category,
        minimumTier: policy.minimumTier,
        rationale: policy.rationale,
      };
    });
    jsonResponse(res, 200, { tools });
    return;
  }

  // POST /tools/invoke
  if (req.method === 'POST' && url.pathname === '/tools/invoke') {
    let body;
    try {
      body = /** @type {any} */ (await readJsonBody(req));
    } catch {
      jsonResponse(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    const { toolName, parameters = {}, policyTier = 'Auto', approvalId: preApprovalId } = body;

    if (!toolName || typeof toolName !== 'string') {
      jsonResponse(res, 400, { error: 'toolName (string) is required' });
      return;
    }

    const VALID_TIERS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'];
    if (!VALID_TIERS.includes(policyTier)) {
      jsonResponse(res, 400, {
        error: `policyTier must be one of: ${VALID_TIERS.join(', ')}`,
      });
      return;
    }

    // --- Control plane delegation path ---
    if (controlPlane) {
      try {
        const cpResult = await proposeViaControlPlane({ toolName, parameters, policyTier });
        const cpBody = cpResult.body;
        const decision = cpBody.decision;

        if (decision === 'Allow') {
          // Execute locally after control plane says Allow
          const mockResult = await mockMachineInvoker.invokeTool({
            toolName,
            parameters,
            machineId: /** @type {any} */ ('machine-demo-proxy'),
            runId: /** @type {any} */ (`run-${Date.now()}`),
          });
          jsonResponse(res, 200, {
            allowed: true,
            decision: 'Allow',
            tool: toolName,
            proposalId: cpBody.proposalId,
            output: mockResult.ok ? mockResult.output : null,
          });
          return;
        }

        if (decision === 'NeedsApproval') {
          // Mirror the approval into the local domain store so the proxy's poll endpoint works
          const cpApprovalId = cpBody.approvalId;
          const mirrorCtx = agentContext();
          await createApproval(domainDeps, mirrorCtx, {
            workspaceId: DEMO_WORKSPACE_ID,
            runId: `run-cp-${Date.now()}`,
            planId: `plan-cp-${Date.now()}`,
            prompt: `[control-plane] Tool "${toolName}" requires approval.`,
          });
          toolContextByApprovalId.set(cpApprovalId, { toolName, parameters });
          console.log(
            `[portarium-proxy] CONTROL-PLANE: "${toolName}" needs approval → ${cpApprovalId.slice(0, 8)}...`,
          );
          jsonResponse(res, 202, {
            status: 'awaiting_approval',
            approvalId: cpApprovalId,
            proposalId: cpBody.proposalId,
            toolName,
            message: cpBody.message ?? `Tool "${toolName}" requires human approval.`,
          });
          return;
        }

        // Denied
        jsonResponse(res, 403, {
          allowed: false,
          decision: 'Denied',
          tool: toolName,
          proposalId: cpBody.proposalId,
          detail: cpBody.detail ?? `Tool "${toolName}" denied by control plane.`,
        });
        return;
      } catch (err) {
        console.error('[portarium-proxy] control plane delegation error:', err);
        jsonResponse(res, 502, { error: `Control plane error: ${String(err)}` });
        return;
      }
    }

    // --- Local evaluation path (no control plane) ---
    let result;
    try {
      result = await gatedInvoker.invoke({
        actor: DEMO_ACTOR,
        tenantId: /** @type {any} */ ('ws-proxy-demo'),
        runId: /** @type {any} */ ('run-proxy-001'),
        actionId: /** @type {any} */ (`action-${Date.now()}`),
        correlationId: /** @type {any} */ (`corr-${Date.now()}`),
        machineId: /** @type {any} */ ('machine-demo-proxy'),
        toolName,
        parameters,
        policyTier: /** @type {any} */ (policyTier),
      });
    } catch (err) {
      console.error('[portarium-proxy] gatedInvoker error:', err);
      jsonResponse(res, 500, { error: 'Policy evaluation failed' });
      return;
    }

    const policy = classifyOpenClawToolBlastRadiusV1(toolName);

    // Pre-approved re-invoke: agent is re-invoking after human approved
    if (preApprovalId) {
      const existingApproval = await approvalStore.getApprovalById(
        TenantId(DEMO_TENANT_ID),
        WorkspaceId(DEMO_WORKSPACE_ID),
        ApprovalId(preApprovalId),
      );
      const toolCtx = toolContextByApprovalId.get(preApprovalId);
      if (
        existingApproval &&
        existingApproval.status === 'Approved' &&
        toolCtx?.toolName === toolName
      ) {
        const mockResult = await mockMachineInvoker.invokeTool({
          toolName,
          parameters,
          machineId: /** @type {any} */ ('machine-demo-proxy'),
          runId: /** @type {any} */ (`run-${Date.now()}`),
        });
        jsonResponse(res, 200, {
          allowed: true,
          decision: 'Allow',
          approvedByHuman: true,
          approvalId: preApprovalId,
          tool: toolName,
          category: policy.category,
          output: mockResult.ok ? mockResult.output : null,
        });
        return;
      }
    }

    if (!result.proposed) {
      // Tool is blocked — create a domain approval via createApproval command
      const ctx = agentContext();
      const createResult = await createApproval(domainDeps, ctx, {
        workspaceId: DEMO_WORKSPACE_ID,
        runId: `run-${Date.now()}`,
        planId: `plan-${Date.now()}`,
        prompt: `Tool "${toolName}" invocation requires approval (min-tier: ${policy.minimumTier}).`,
      });
      if (!createResult.ok) {
        console.error('[portarium-proxy] createApproval failed:', createResult.error);
        jsonResponse(res, 500, { error: 'Failed to create approval request' });
        return;
      }
      const approvalId = String(createResult.value.approvalId);
      toolContextByApprovalId.set(approvalId, { toolName, parameters });
      console.log(
        `[portarium-proxy] BLOCKED: "${toolName}" (min-tier: ${policy.minimumTier}) → approval ${approvalId.slice(0, 8)}...`,
      );
      jsonResponse(res, 202, {
        status: 'awaiting_approval',
        approvalId,
        toolName,
        tier: policyTier,
        category: policy.category,
        minimumTier: policy.minimumTier,
        message: `Tool "${toolName}" requires human approval (min-tier: ${policy.minimumTier}). Poll GET /approvals/${approvalId} for status, or visit /approvals/ui.`,
      });
      return;
    }

    jsonResponse(res, 200, {
      allowed: true,
      decision: 'Allow',
      tool: toolName,
      tier: policyTier,
      category: policy.category,
      output: result.ok ? result.output : null,
    });
    return;
  }

  jsonResponse(res, 404, { error: `Not found: ${req.method} ${url.pathname}` });
}

// ---------------------------------------------------------------------------
// Public API — importable start function
// ---------------------------------------------------------------------------

/**
 * Start the policy proxy server.
 * @param {number} [port=9999]
 * @returns {Promise<{ url: string; close: () => void }>}
 */
export function startPolicyProxy(port = 9999) {
  let actualPort = port;
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      handleRequest(req, res, actualPort).catch((err) => {
        console.error('[portarium-proxy] Unhandled error:', err);
        if (!res.headersSent) {
          jsonResponse(res, 500, { error: 'Internal server error' });
        }
      });
    });

    server.on('error', (err) => {
      /** @type {any} */ (err).code === 'EADDRINUSE'
        ? reject(new Error(`Port ${port} is already in use. Is another demo proxy running?`))
        : reject(err);
    });

    // Bind to loopback only — this is a local demo server, not a public endpoint.
    server.listen(port, '127.0.0.1', () => {
      actualPort = /** @type {any} */ (server.address()).port;
      const url = `http://localhost:${actualPort}`;
      console.log(`[portarium-proxy] Listening on ${url}`);
      if (controlPlane) {
        console.log(
          `[portarium-proxy] Control plane delegation: ${controlPlane.url} (workspace: ${controlPlane.workspaceId})`,
        );
      }
      console.log(
        `[portarium-proxy] Routes: GET /health  GET /tools  POST /tools/invoke  GET /approvals  GET /approvals/:id  POST /approvals/:id/decide  GET /approvals/ui`,
      );
      resolve({
        url,
        close: () => server.close(),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Standalone entrypoint
// ---------------------------------------------------------------------------

// Works correctly whether invoked directly (`node file.mjs`) or via tsx.
const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url).replace(/\\/g, '/') === process.argv[1].replace(/\\/g, '/');
if (isMain) {
  const port = parseInt(process.env['PORT'] ?? '9999', 10);
  startPolicyProxy(port).catch((err) => {
    console.error('[portarium-proxy] Failed to start:', err);
    process.exit(1);
  });
}
