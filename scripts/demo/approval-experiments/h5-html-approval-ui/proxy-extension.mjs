/**
 * H5: HTML approval UI — Proxy extension
 *
 * Extends the Portarium policy proxy with a pending-approval store and
 * a self-contained HTML UI for reviewing and deciding on approvals.
 *
 * Endpoints:
 *   POST /tools/invoke          — intercepts CRITICAL tools, returns pending_approval
 *   GET  /approvals/ui          — HTML page listing pending approvals with Approve/Deny buttons
 *   GET  /approvals/:id         — JSON status
 *   POST /approvals/:id/decide  — JSON body { decision }
 *
 * Run standalone:  node proxy-extension.mjs
 * Imported API:    const { url, close } = await startApprovalProxy(9998);
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// In-memory approval store
// ---------------------------------------------------------------------------

/** @type {Map<string, { toolName: string; parameters: unknown; status: 'pending' | 'approved' | 'denied'; createdAt: string; decidedAt?: string }>} */
const approvals = new Map();

/** Tools classified as CRITICAL that require human approval. */
const CRITICAL_TOOLS = new Set([
  'delete:record',
  'shell.exec',
  'terminal.run',
  'write:file',
]);

// ---------------------------------------------------------------------------
// HTTP utilities
// ---------------------------------------------------------------------------

/** @param {import('node:http').ServerResponse} res */
function jsonResponse(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

function htmlResponse(res, status, html) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
  });
  res.end(html);
}

const MAX_BODY_BYTES = 100 * 1024;

/** @param {import('node:http').IncomingMessage} req */
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
// HTML UI generation
// ---------------------------------------------------------------------------

function renderApprovalPage(port) {
  const rows = [];
  for (const [id, record] of approvals) {
    const params = JSON.stringify(record.parameters, null, 2);
    const shortId = id.slice(0, 8);
    const statusClass =
      record.status === 'pending'
        ? 'status-pending'
        : record.status === 'approved'
          ? 'status-approved'
          : 'status-denied';

    const buttons =
      record.status === 'pending'
        ? `<button class="btn-approve" onclick="decide('${id}','approved')">Approve</button>
           <button class="btn-deny" onclick="decide('${id}','denied')">Deny</button>`
        : `<span class="decided">${record.status} at ${record.decidedAt ?? ''}</span>`;

    rows.push(`
      <tr>
        <td title="${id}">${shortId}...</td>
        <td><code>${record.toolName}</code></td>
        <td><pre>${params}</pre></td>
        <td class="${statusClass}">${record.status}</td>
        <td>${record.createdAt}</td>
        <td>${buttons}</td>
      </tr>`);
  }

  const tableBody = rows.length > 0 ? rows.join('\n') : '<tr><td colspan="6" class="empty">No approvals yet.</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Portarium Approval UI</title>
  <meta http-equiv="refresh" content="2">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
    h1 { margin-bottom: 16px; font-size: 1.5rem; }
    .subtitle { color: #666; margin-bottom: 24px; font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #2d3748; color: #fff; text-align: left; padding: 10px 12px; font-weight: 600; font-size: 0.85rem; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; font-size: 0.85rem; }
    tr:last-child td { border-bottom: none; }
    pre { font-size: 0.8rem; white-space: pre-wrap; word-break: break-all; max-width: 250px; margin: 0; }
    code { background: #edf2f7; padding: 2px 6px; border-radius: 3px; font-size: 0.85rem; }
    .status-pending { color: #d69e2e; font-weight: 600; }
    .status-approved { color: #38a169; font-weight: 600; }
    .status-denied { color: #e53e3e; font-weight: 600; }
    .empty { text-align: center; color: #999; padding: 40px 12px; }
    .decided { font-size: 0.8rem; color: #666; }
    .btn-approve, .btn-deny { border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; font-weight: 600; margin-right: 6px; }
    .btn-approve { background: #38a169; color: #fff; }
    .btn-approve:hover { background: #2f855a; }
    .btn-deny { background: #e53e3e; color: #fff; }
    .btn-deny:hover { background: #c53030; }
    .footer { margin-top: 16px; font-size: 0.8rem; color: #999; }
  </style>
</head>
<body>
  <h1>Portarium Approval Queue</h1>
  <p class="subtitle">Auto-refreshes every 2 seconds. Pending approvals require human decision.</p>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Tool</th>
        <th>Parameters</th>
        <th>Status</th>
        <th>Created</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      ${tableBody}
    </tbody>
  </table>
  <p class="footer">Proxy: http://localhost:${port} | Approvals: ${approvals.size} total, ${[...approvals.values()].filter(a => a.status === 'pending').length} pending</p>
  <script>
    async function decide(id, decision) {
      try {
        const res = await fetch('/approvals/' + id + '/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: decision })
        });
        if (!res.ok) {
          const err = await res.json();
          alert('Error: ' + (err.error || res.statusText));
          return;
        }
        location.reload();
      } catch (err) {
        alert('Network error: ' + err.message);
      }
    }
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/** @param {import('node:http').IncomingMessage} req */
/** @param {import('node:http').ServerResponse} res */
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
      service: 'h5-html-approval-proxy',
      port,
      pendingApprovals: [...approvals.values()].filter((a) => a.status === 'pending').length,
    });
    return;
  }

  // GET /approvals/ui — HTML approval page
  if (req.method === 'GET' && url.pathname === '/approvals/ui') {
    htmlResponse(res, 200, renderApprovalPage(port));
    return;
  }

  // POST /tools/invoke — intercept CRITICAL tools
  if (req.method === 'POST' && url.pathname === '/tools/invoke') {
    let body;
    try {
      body = /** @type {any} */ (await readJsonBody(req));
    } catch {
      jsonResponse(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    const { toolName, parameters = {} } = body;
    if (!toolName || typeof toolName !== 'string') {
      jsonResponse(res, 400, { error: 'toolName (string) is required' });
      return;
    }

    if (CRITICAL_TOOLS.has(toolName)) {
      const approvalId = randomUUID();
      approvals.set(approvalId, {
        toolName,
        parameters,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      console.log(`[h5-proxy] CRITICAL tool "${toolName}" — approval required: ${approvalId}`);
      jsonResponse(res, 202, {
        status: 'pending_approval',
        approvalId,
        toolName,
        message: `Tool "${toolName}" requires human approval. Visit /approvals/ui or poll GET /approvals/${approvalId}.`,
      });
      return;
    }

    // Non-critical tools execute immediately
    jsonResponse(res, 200, {
      allowed: true,
      tool: toolName,
      output: {
        result: `[h5-proxy] executed ${toolName}`,
        parameters,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // GET /approvals/:id — poll approval status
  const pollMatch = url.pathname.match(/^\/approvals\/([0-9a-f-]{36})$/);
  if (req.method === 'GET' && pollMatch) {
    const id = pollMatch[1];
    const record = approvals.get(id);
    if (!record) {
      jsonResponse(res, 404, { error: `Approval ${id} not found` });
      return;
    }
    jsonResponse(res, 200, {
      approvalId: id,
      status: record.status,
      toolName: record.toolName,
      createdAt: record.createdAt,
      decidedAt: record.decidedAt ?? null,
    });
    return;
  }

  // POST /approvals/:id/decide — submit decision
  const decideMatch = url.pathname.match(/^\/approvals\/([0-9a-f-]{36})\/decide$/);
  if (req.method === 'POST' && decideMatch) {
    const id = decideMatch[1];
    const record = approvals.get(id);
    if (!record) {
      jsonResponse(res, 404, { error: `Approval ${id} not found` });
      return;
    }
    if (record.status !== 'pending') {
      jsonResponse(res, 409, {
        error: `Approval ${id} already decided: ${record.status}`,
      });
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
      jsonResponse(res, 400, {
        error: 'decision must be "approved" or "denied"',
      });
      return;
    }

    record.status = decision;
    record.decidedAt = new Date().toISOString();
    console.log(`[h5-proxy] Approval ${id} → ${decision}`);

    jsonResponse(res, 200, {
      approvalId: id,
      status: record.status,
      toolName: record.toolName,
      decidedAt: record.decidedAt,
    });
    return;
  }

  jsonResponse(res, 404, { error: `Not found: ${req.method} ${url.pathname}` });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the HTML approval UI proxy.
 * @param {number} [port=9998]
 * @returns {Promise<{ url: string; close: () => void }>}
 */
export function startApprovalProxy(port = 9998) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      handleRequest(req, res, port).catch((err) => {
        console.error('[h5-proxy] Unhandled error:', err);
        if (!res.headersSent) {
          jsonResponse(res, 500, { error: 'Internal server error' });
        }
      });
    });

    server.on('error', (err) => {
      /** @type {any} */ (err).code === 'EADDRINUSE'
        ? reject(new Error(`Port ${port} is already in use`))
        : reject(err);
    });

    server.listen(port, '127.0.0.1', () => {
      const url = `http://localhost:${port}`;
      console.log(`[h5-proxy] Listening on ${url}`);
      console.log(`[h5-proxy] Routes: POST /tools/invoke  GET /approvals/ui  GET /approvals/:id  POST /approvals/:id/decide`);
      resolve({ url, close: () => server.close() });
    });
  });
}

// ---------------------------------------------------------------------------
// Standalone entrypoint
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url).replace(/\\/g, '/') === process.argv[1].replace(/\\/g, '/');
if (isMain) {
  const port = parseInt(process.env['PORT'] ?? '9998', 10);
  startApprovalProxy(port).catch((err) => {
    console.error('[h5-proxy] Failed to start:', err);
    process.exit(1);
  });
}
