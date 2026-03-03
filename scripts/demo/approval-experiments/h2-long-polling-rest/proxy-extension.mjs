/**
 * H2: Long-polling REST — Proxy extension
 *
 * Extends the Portarium policy proxy with a pending-approval store.
 * When a CRITICAL tool is called, the proxy creates an approval record
 * and returns immediately with a pending status + approvalId.
 *
 * Endpoints:
 *   POST /tools/invoke       — intercepts CRITICAL tools, returns pending_approval
 *   GET  /approvals/:id      — poll approval status
 *   POST /approvals/:id/decide — submit approval decision
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
const CRITICAL_TOOLS = new Set(['delete:record', 'shell.exec', 'terminal.run', 'write:file']);

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
      service: 'h2-long-polling-approval-proxy',
      port,
      pendingApprovals: [...approvals.values()].filter((a) => a.status === 'pending').length,
    });
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

      console.log(`[h2-proxy] CRITICAL tool "${toolName}" — approval required: ${approvalId}`);
      jsonResponse(res, 202, {
        status: 'pending_approval',
        approvalId,
        toolName,
        message: `Tool "${toolName}" requires human approval. Poll GET /approvals/${approvalId} for status.`,
      });
      return;
    }

    // Non-critical tools execute immediately
    jsonResponse(res, 200, {
      allowed: true,
      tool: toolName,
      output: {
        result: `[h2-proxy] executed ${toolName}`,
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
    console.log(`[h2-proxy] Approval ${id} → ${decision}`);

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
 * Start the long-polling approval proxy.
 * @param {number} [port=9998]
 * @returns {Promise<{ url: string; close: () => void }>}
 */
export function startApprovalProxy(port = 9998) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      handleRequest(req, res, port).catch((err) => {
        console.error('[h2-proxy] Unhandled error:', err);
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
      console.log(`[h2-proxy] Listening on ${url}`);
      console.log(
        `[h2-proxy] Routes: POST /tools/invoke  GET /approvals/:id  POST /approvals/:id/decide`,
      );
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
    console.error('[h2-proxy] Failed to start:', err);
    process.exit(1);
  });
}
