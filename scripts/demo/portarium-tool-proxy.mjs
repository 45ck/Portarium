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
    jsonResponse(res, 200, { status: 'ok', service: 'portarium-policy-proxy', port });
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

    const { toolName, parameters = {}, policyTier = 'Auto' } = body;

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

    if (!result.proposed) {
      jsonResponse(res, 200, {
        allowed: false,
        decision: 'Deny',
        reason: result.reason,
        message: result.message,
        tool: toolName,
        tier: policyTier,
        category: policy.category,
        minimumTier: policy.minimumTier,
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
      console.log(`[portarium-proxy] Routes: GET /health  GET /tools  POST /tools/invoke`);
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
