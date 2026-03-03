/**
 * H3: SSE push — proxy extension
 *
 * Adds approval gating to tool calls using Server-Sent Events (SSE)
 * for instant push notification when a decision is made.
 *
 * Endpoints:
 *   POST /approvals          — create a pending approval, returns { pendingApprovalId }
 *   GET  /approvals/:id/stream — SSE stream; sends decision event then closes
 *   POST /approvals/:id/decide — post a decision, triggers SSE push
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

/** @type {Map<string, { decision: string | null, listeners: Set<import('node:http').ServerResponse> }>} */
const approvals = new Map();

function jsonResponse(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** @param {import('node:http').IncomingMessage} req */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function routeMatch(pathname, pattern) {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // POST /approvals — create pending approval
  if (req.method === 'POST' && pathname === '/approvals') {
    const body = await parseBody(req);
    const id = randomUUID();
    approvals.set(id, { decision: null, listeners: new Set() });
    console.log(`[proxy] approval created id=${id} tool=${body.tool ?? 'unknown'}`);
    return jsonResponse(res, 201, { pendingApprovalId: id });
  }

  // GET /approvals/:id/stream — SSE endpoint
  const streamParams = routeMatch(pathname, '/approvals/:id/stream');
  if (req.method === 'GET' && streamParams) {
    const record = approvals.get(streamParams.id);
    if (!record) return jsonResponse(res, 404, { error: 'not found' });

    // If already decided, send immediately
    if (record.decision) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ decision: record.decision })}\n\n`);
      res.end();
      return;
    }

    // Otherwise keep connection open until decision arrives
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    // Send initial comment to confirm connection
    res.write(': connected\n\n');

    record.listeners.add(res);
    console.log(
      `[proxy] SSE client connected for id=${streamParams.id} (${record.listeners.size} listener(s))`,
    );

    req.on('close', () => {
      record.listeners.delete(res);
      console.log(`[proxy] SSE client disconnected for id=${streamParams.id}`);
    });
    return;
  }

  // POST /approvals/:id/decide — post decision, push to SSE listeners
  const decideParams = routeMatch(pathname, '/approvals/:id/decide');
  if (req.method === 'POST' && decideParams) {
    const record = approvals.get(decideParams.id);
    if (!record) return jsonResponse(res, 404, { error: 'not found' });
    if (record.decision) return jsonResponse(res, 409, { error: 'already decided' });

    const body = await parseBody(req);
    const decision = body.decision ?? 'approved';
    record.decision = decision;

    // Push to all SSE listeners
    const payload = `data: ${JSON.stringify({ decision })}\n\n`;
    for (const listener of record.listeners) {
      listener.write(payload);
      listener.end();
    }
    record.listeners.clear();

    console.log(`[proxy] decision=${decision} for id=${decideParams.id}`);
    return jsonResponse(res, 200, { id: decideParams.id, decision });
  }

  jsonResponse(res, 404, { error: 'not found' });
});

const PORT = parseInt(process.env.PROXY_PORT ?? '9093', 10);

export function startProxy(port = PORT) {
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`[proxy] SSE approval proxy listening on http://127.0.0.1:${port}`);
      resolve({ server, port });
    });
  });
}

export function stopProxy() {
  // Close all open SSE connections
  for (const [, record] of approvals) {
    for (const listener of record.listeners) {
      listener.end();
    }
    record.listeners.clear();
  }
  return new Promise((resolve) => server.close(resolve));
}

// Run standalone
if (
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('proxy-extension.mjs')
) {
  startProxy();
}
