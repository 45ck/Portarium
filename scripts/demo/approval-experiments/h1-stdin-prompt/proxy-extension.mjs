/**
 * H1: stdin prompt approval-wait loop
 *
 * Extends the base policy proxy with readline-based operator approval.
 * When a tool call has blast-radius CRITICAL, the proxy blocks the HTTP
 * request and prompts the operator via stdin (readline). The operator
 * types 'y' or 'n' and the decision is returned to the caller.
 *
 * Usage:  node proxy-extension.mjs
 *         PORT=9998 node proxy-extension.mjs
 */

import { createServer } from 'http';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { startPolicyProxy } from '../../portarium-tool-proxy.mjs';

// ---------------------------------------------------------------------------
// Approval state
// ---------------------------------------------------------------------------

/** @type {Map<string, { resolve: (decision: 'approved' | 'denied') => void }>} */
const pendingApprovals = new Map();
let approvalCounter = 0;

// ---------------------------------------------------------------------------
// Readline interface (shared across all approvals — serialises prompts)
// ---------------------------------------------------------------------------

const rl = createInterface({ input: process.stdin, output: process.stdout });

/**
 * Block until the operator types 'y' or 'n' in the terminal.
 * @param {string} approvalId
 * @param {string} toolName
 * @param {Record<string, unknown>} parameters
 * @returns {Promise<'approved' | 'denied'>}
 */
function promptOperator(approvalId, toolName, parameters) {
  return new Promise((resolve) => {
    pendingApprovals.set(approvalId, { resolve });

    const paramStr = JSON.stringify(parameters, null, 2);
    console.log('\n========================================');
    console.log(`APPROVAL REQUIRED  [${approvalId}]`);
    console.log(`  Tool:       ${toolName}`);
    console.log(`  Parameters: ${paramStr}`);
    console.log('========================================');

    rl.question('Approve? (y/n): ', (answer) => {
      const decision = answer.trim().toLowerCase() === 'y' ? 'approved' : 'denied';
      pendingApprovals.delete(approvalId);
      resolve(decision);
    });
  });
}

// ---------------------------------------------------------------------------
// HTTP server — wraps the base proxy, adds /approvals routes + stdin gate
// ---------------------------------------------------------------------------

const BASE_PORT = parseInt(process.env['PORT'] ?? '9998', 10);
const PROXY_PORT = BASE_PORT + 1; // base proxy on the next port

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<unknown>}
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 100 * 1024) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/**
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function json(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/** Tools that require operator approval (blast-radius CRITICAL). */
const CRITICAL_TOOLS = new Set(['delete:record', 'shell.exec', 'terminal.run', 'browser.navigate']);

import http from 'http';

/**
 * @param {string} toolName
 * @param {Record<string, unknown>} parameters
 * @param {string} policyTier
 * @returns {Promise<unknown>}
 */
function callBaseProxy(toolName, parameters, policyTier) {
  const body = JSON.stringify({ toolName, parameters, policyTier });
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://localhost:${PROXY_PORT}/tools/invoke`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Start base proxy on PROXY_PORT
  const base = await startPolicyProxy(PROXY_PORT);
  console.log(`[h1-stdin] Base proxy at ${base.url}`);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${BASE_PORT}`);

    // GET /health
    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, { status: 'ok', service: 'h1-stdin-approval-proxy', port: BASE_PORT });
      return;
    }

    // GET /approvals — list pending approvals
    if (req.method === 'GET' && url.pathname === '/approvals') {
      const ids = [...pendingApprovals.keys()];
      json(res, 200, { pending: ids });
      return;
    }

    // POST /approvals/:id/decide — programmatic approval (used by plugin.mjs)
    const decideMatch = url.pathname.match(/^\/approvals\/([^/]+)\/decide$/);
    if (req.method === 'POST' && decideMatch) {
      const id = decideMatch[1];
      const pending = pendingApprovals.get(id);
      if (!pending) {
        json(res, 404, { error: `No pending approval: ${id}` });
        return;
      }
      const body = /** @type {any} */ (await readJsonBody(req));
      const decision = body.decision === 'approved' ? 'approved' : 'denied';
      pending.resolve(decision);
      pendingApprovals.delete(id);
      json(res, 200, { approvalId: id, decision });
      return;
    }

    // POST /tools/invoke — gate CRITICAL tools through stdin
    if (req.method === 'POST' && url.pathname === '/tools/invoke') {
      let body;
      try {
        body = /** @type {any} */ (await readJsonBody(req));
      } catch {
        json(res, 400, { error: 'Invalid JSON body' });
        return;
      }

      const { toolName, parameters = {}, policyTier = 'Auto' } = body;

      if (CRITICAL_TOOLS.has(toolName)) {
        const approvalId = `approval-${++approvalCounter}`;
        console.log(`[h1-stdin] Tool "${toolName}" requires approval → ${approvalId}`);

        const decision = await promptOperator(approvalId, toolName, parameters);
        console.log(`[h1-stdin] ${approvalId} → ${decision}`);

        if (decision === 'denied') {
          json(res, 200, {
            allowed: false,
            decision: 'Deny',
            reason: 'operator-denied',
            message: `Operator denied ${toolName} via stdin`,
            tool: toolName,
            approvalId,
          });
          return;
        }
      }

      // Forward to base proxy
      try {
        const result = await callBaseProxy(toolName, parameters, policyTier);
        json(res, 200, result);
      } catch (err) {
        json(res, 502, { error: 'Base proxy unreachable', details: String(err) });
      }
      return;
    }

    json(res, 404, { error: `Not found: ${req.method} ${url.pathname}` });
  });

  server.listen(BASE_PORT, '127.0.0.1', () => {
    console.log(`[h1-stdin] Approval proxy listening on http://localhost:${BASE_PORT}`);
    console.log(
      `[h1-stdin] Routes: GET /health  GET /approvals  POST /approvals/:id/decide  POST /tools/invoke`,
    );
    console.log(`[h1-stdin] CRITICAL tools will block until operator types y/n in this terminal`);
  });
}

const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url).replace(/\\/g, '/') === process.argv[1].replace(/\\/g, '/');
if (isMain) {
  main().catch((err) => {
    console.error('[h1-stdin] Fatal:', err);
    process.exit(1);
  });
}

export { promptOperator, CRITICAL_TOOLS, pendingApprovals };
