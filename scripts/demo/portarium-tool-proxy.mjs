/**
 * Portarium Policy Proxy — HTTP gateway for demo agents
 *
 * Thin HTTP server that routes tool calls through ActionGatedToolInvoker.
 * Shared by OpenAI, Anthropic, and Docker agent demos.
 *
 * Run standalone:  npm run demo:proxy  (or: tsx scripts/demo/portarium-tool-proxy.mjs)
 * Imported API:    const { url, close } = await startPolicyProxy(9999);
 */

import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ---------------------------------------------------------------------------
// Approval store (file-backed — survives proxy restarts)
// ---------------------------------------------------------------------------

const APPROVALS_DIR = join(tmpdir(), '.portarium-approvals');
try {
  mkdirSync(APPROVALS_DIR, { recursive: true });
} catch {
  /* already exists */
}
const APPROVALS_FILE = join(APPROVALS_DIR, 'pending.json');

/** @typedef {{ toolName: string; parameters: unknown; status: 'pending'|'approved'|'denied'; createdAt: string; decidedAt?: string }} ApprovalRecord */
/** @type {Map<string, ApprovalRecord>} */
const approvals = new Map();

function loadApprovals() {
  try {
    const raw = readFileSync(APPROVALS_FILE, 'utf8');
    const entries = /** @type {[string, ApprovalRecord][]} */ (JSON.parse(raw));
    for (const [id, record] of entries) {
      approvals.set(id, record);
    }
  } catch {
    /* file not yet written */
  }
}

function saveApprovals() {
  try {
    writeFileSync(APPROVALS_FILE, JSON.stringify([...approvals.entries()], null, 2), 'utf8');
  } catch {
    /* non-fatal */
  }
}

loadApprovals();

// tsx resolves .js → .ts at runtime
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
    jsonResponse(res, 200, {
      status: 'ok',
      service: 'portarium-policy-proxy',
      port,
      pendingApprovals: [...approvals.values()].filter((a) => a.status === 'pending').length,
    });
    return;
  }

  // GET /approvals — list approvals (optionally filtered by ?status=pending)
  if (req.method === 'GET' && url.pathname === '/approvals') {
    const statusFilter = url.searchParams.get('status');
    const items = [];
    for (const [id, record] of approvals) {
      if (statusFilter && record.status !== statusFilter) continue;
      items.push({ approvalId: id, ...record });
    }
    jsonResponse(res, 200, { approvals: items, total: items.length });
    return;
  }

  // GET /approvals/ui — human-facing HTML page
  if (req.method === 'GET' && url.pathname === '/approvals/ui') {
    const pending = [];
    for (const [id, r] of approvals) {
      if (r.status === 'pending')
        pending.push({ id, toolName: r.toolName, createdAt: r.createdAt });
    }
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
    const record = approvals.get(id);
    if (!record) {
      jsonResponse(res, 404, { error: `Approval ${id} not found` });
      return;
    }
    jsonResponse(res, 200, { approvalId: id, ...record });
    return;
  }

  // POST /approvals/:id/decide — submit human decision
  const decideMatch = url.pathname.match(/^\/approvals\/([0-9a-f-]{36})\/decide$/);
  if (req.method === 'POST' && decideMatch) {
    const id = /** @type {string} */ (decideMatch[1]);
    const record = approvals.get(id);
    if (!record) {
      jsonResponse(res, 404, { error: `Approval ${id} not found` });
      return;
    }
    if (record.status !== 'pending') {
      jsonResponse(res, 409, { error: `Approval ${id} already decided: ${record.status}` });
      return;
    }
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
    record.status = decision;
    record.decidedAt = new Date().toISOString();
    saveApprovals();
    console.log(`[portarium-proxy] Approval ${id.slice(0, 8)}… → ${decision} (${record.toolName})`);
    jsonResponse(res, 200, { approvalId: id, status: record.status, decidedAt: record.decidedAt });
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
      const approval = approvals.get(preApprovalId);
      if (approval && approval.status === 'approved' && approval.toolName === toolName) {
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
      // Tool is blocked — create an approval request instead of denying immediately
      const approvalId = randomUUID();
      approvals.set(approvalId, {
        toolName,
        parameters,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      saveApprovals();
      console.log(
        `[portarium-proxy] BLOCKED: "${toolName}" (min-tier: ${policy.minimumTier}) → approval ${approvalId.slice(0, 8)}…`,
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
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      handleRequest(req, res, port).catch((err) => {
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
      const url = `http://localhost:${port}`;
      console.log(`[portarium-proxy] Listening on ${url}`);
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
