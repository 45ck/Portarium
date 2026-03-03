#!/usr/bin/env node
/**
 * H1: stdin prompt — end-to-end demo
 *
 * Runs without any API key. Simulates an agent calling 3 tools through
 * the stdin-approval proxy:
 *   1. read:file     (low risk — auto-allowed)
 *   2. delete:record (CRITICAL — requires approval)
 *   3. shell.exec    (CRITICAL — requires approval)
 *
 * Auto-approve mode:  node demo.mjs --auto
 *                     DEMO_AUTO_APPROVE=1 node demo.mjs
 *
 * In auto mode, CRITICAL tools are approved after 100ms without blocking
 * on stdin (for CI / non-interactive demo).
 */

import { createServer } from 'http';
import http from 'http';
import { createInterface } from 'readline';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AUTO_APPROVE = process.argv.includes('--auto') || process.env['DEMO_AUTO_APPROVE'] === '1';

const PROXY_PORT = 19998;

// ---------------------------------------------------------------------------
// Inline mini-proxy (avoids needing tsx for the base proxy import)
// ---------------------------------------------------------------------------

/** @param {import('http').ServerResponse} res */
function json(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/** @param {import('http').IncomingMessage} req */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
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

const CRITICAL_TOOLS = new Set(['delete:record', 'shell.exec', 'terminal.run', 'browser.navigate']);

/** @type {Map<string, { resolve: (d: 'approved' | 'denied') => void }>} */
const pendingApprovals = new Map();
let counter = 0;

const rl = AUTO_APPROVE ? null : createInterface({ input: process.stdin, output: process.stdout });

/**
 * @param {string} id
 * @param {string} toolName
 * @param {Record<string, unknown>} params
 * @returns {Promise<'approved' | 'denied'>}
 */
function promptOrAutoApprove(id, toolName, params) {
  if (AUTO_APPROVE) {
    return new Promise((resolve) => {
      console.log(`  [auto-approve] ${id} for "${toolName}" -> approved after 100ms`);
      setTimeout(() => resolve('approved'), 100);
    });
  }

  return new Promise((resolve) => {
    pendingApprovals.set(id, { resolve });
    console.log('\n  ========================================');
    console.log(`  APPROVAL REQUIRED  [${id}]`);
    console.log(`    Tool:       ${toolName}`);
    console.log(`    Parameters: ${JSON.stringify(params)}`);
    console.log('  ========================================');
    rl.question('  Approve? (y/n): ', (answer) => {
      const decision = answer.trim().toLowerCase() === 'y' ? 'approved' : 'denied';
      pendingApprovals.delete(id);
      resolve(decision);
    });
  });
}

/** Start a self-contained approval proxy (no tsx / no base proxy import). */
function startDemoProxy() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${PROXY_PORT}`);

      if (req.method === 'GET' && url.pathname === '/health') {
        json(res, 200, { status: 'ok', service: 'h1-stdin-demo-proxy' });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/approvals') {
        json(res, 200, { pending: [...pendingApprovals.keys()] });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/tools/invoke') {
        let body;
        try {
          body = /** @type {any} */ (await readBody(req));
        } catch {
          json(res, 400, { error: 'Invalid JSON' });
          return;
        }

        const { toolName, parameters = {}, policyTier = 'Auto' } = body;

        if (CRITICAL_TOOLS.has(toolName)) {
          const id = `approval-${++counter}`;
          const decision = await promptOrAutoApprove(id, toolName, parameters);

          if (decision === 'denied') {
            json(res, 200, {
              allowed: false,
              decision: 'Deny',
              reason: 'operator-denied',
              message: `Operator denied "${toolName}" via stdin`,
              tool: toolName,
              approvalId: id,
            });
            return;
          }
          // Fall through to execute
        }

        // Simulate execution (no real base proxy needed for demo)
        json(res, 200, {
          allowed: true,
          decision: 'Allow',
          tool: toolName,
          tier: policyTier,
          output: {
            result: `[demo] executed ${toolName}`,
            parameters,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      json(res, 404, { error: 'Not found' });
    });

    server.listen(PROXY_PORT, '127.0.0.1', () => {
      resolve({ url: `http://localhost:${PROXY_PORT}`, close: () => server.close() });
    });
  });
}

// ---------------------------------------------------------------------------
// Agent simulation
// ---------------------------------------------------------------------------

/**
 * @param {string} proxyUrl
 * @param {string} toolName
 * @param {Record<string, unknown>} parameters
 */
function invokeToolViaProxy(proxyUrl, toolName, parameters) {
  const body = JSON.stringify({ toolName, parameters, policyTier: 'Auto' });
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${proxyUrl}/tools/invoke`,
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
  console.log('=== H1: stdin prompt approval-wait loop — Demo ===');
  console.log(`Mode: ${AUTO_APPROVE ? 'AUTO-APPROVE (non-interactive)' : 'INTERACTIVE (stdin)'}\n`);

  const proxy = await startDemoProxy();
  console.log(`Demo proxy running at ${proxy.url}\n`);

  const tools = [
    { name: 'read:file', params: { path: '/etc/hosts' } },
    { name: 'delete:record', params: { table: 'users', id: 'usr-42' } },
    { name: 'shell.exec', params: { command: 'rm -rf /tmp/cache' } },
  ];

  for (const { name, params } of tools) {
    const isCritical = CRITICAL_TOOLS.has(name);
    console.log(`\n--- Invoking: ${name} ${isCritical ? '(CRITICAL)' : '(safe)'} ---`);

    const result = await invokeToolViaProxy(proxy.url, name, params);

    if (result.allowed) {
      console.log(`  Result: ALLOWED`);
      console.log(`  Output: ${JSON.stringify(result.output?.result ?? result.output)}`);
    } else {
      console.log(`  Result: DENIED`);
      console.log(`  Reason: ${result.reason} — ${result.message}`);
    }
  }

  console.log('\n=== Demo complete ===');
  proxy.close();
  if (rl) rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
