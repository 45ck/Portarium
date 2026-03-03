/**
 * H4: WebSocket channel — Proxy extension
 *
 * Extends the Portarium policy proxy with a WebSocket endpoint for
 * real-time approval notifications. Implements RFC 6455 WebSocket
 * handshake and framing using only Node.js built-in modules.
 *
 * Endpoints:
 *   POST /tools/invoke          — intercepts CRITICAL tools, returns pending_approval
 *   GET  /approvals/ws          — WebSocket upgrade (RFC 6455)
 *   POST /approvals/:id/decide  — submit approval decision
 *
 * WebSocket messages (server → client):
 *   { type: "approval_required", approvalId, toolName }
 *   { type: "approval_decision", approvalId, decision }
 *
 * Run standalone:  node proxy-extension.mjs
 * Imported API:    const { url, close } = await startApprovalProxy(9998);
 */

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
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
// WebSocket constants (RFC 6455)
// ---------------------------------------------------------------------------

const WS_MAGIC = '258EAFA5-E914-47DA-95CF-265B91017A36';
const OPCODE_TEXT = 0x01;
const OPCODE_CLOSE = 0x08;
const OPCODE_PING = 0x09;
const OPCODE_PONG = 0x0a;

// ---------------------------------------------------------------------------
// Connected WebSocket clients
// ---------------------------------------------------------------------------

/** @type {Set<import('node:net').Socket>} */
const wsClients = new Set();

// ---------------------------------------------------------------------------
// WebSocket framing helpers (RFC 6455)
// ---------------------------------------------------------------------------

/**
 * Encode a text message as a WebSocket frame (server → client, no masking).
 * @param {string} text
 * @returns {Buffer}
 */
function encodeFrame(text) {
  const payload = Buffer.from(text, 'utf-8');
  const len = payload.length;

  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | OPCODE_TEXT; // FIN + text opcode
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | OPCODE_TEXT;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | OPCODE_TEXT;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payload]);
}

/**
 * Decode a single WebSocket frame from a buffer (client → server, masked).
 * Returns null if not enough data.
 * @param {Buffer} buf
 * @returns {{ opcode: number; payload: Buffer; totalLength: number } | null}
 */
function decodeFrame(buf) {
  if (buf.length < 2) return null;

  const firstByte = buf[0];
  const secondByte = buf[1];
  const opcode = firstByte & 0x0f;
  const masked = (secondByte & 0x80) !== 0;
  let payloadLen = secondByte & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buf.length < 4) return null;
    payloadLen = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return null;
    payloadLen = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }

  const maskSize = masked ? 4 : 0;
  const totalLength = offset + maskSize + payloadLen;
  if (buf.length < totalLength) return null;

  let payload;
  if (masked) {
    const mask = buf.subarray(offset, offset + 4);
    payload = Buffer.alloc(payloadLen);
    for (let i = 0; i < payloadLen; i++) {
      payload[i] = buf[offset + 4 + i] ^ mask[i % 4];
    }
  } else {
    payload = buf.subarray(offset, offset + payloadLen);
  }

  return { opcode, payload, totalLength };
}

/**
 * Broadcast a JSON message to all connected WebSocket clients.
 * @param {object} msg
 */
function broadcast(msg) {
  const frame = encodeFrame(JSON.stringify(msg));
  for (const socket of wsClients) {
    if (!socket.destroyed) {
      socket.write(frame);
    }
  }
}

/**
 * Handle incoming WebSocket data on a client socket.
 * @param {import('node:net').Socket} socket
 * @param {Buffer} data
 */
function handleWsData(socket, data) {
  /** @type {Buffer} */
  let buffer = /** @type {any} */ (socket).__wsBuf
    ? Buffer.concat([/** @type {any} */ (socket).__wsBuf, data])
    : data;

  while (buffer.length > 0) {
    const frame = decodeFrame(buffer);
    if (!frame) {
      /** @type {any} */ (socket).__wsBuf = buffer;
      return;
    }

    buffer = buffer.subarray(frame.totalLength);

    if (frame.opcode === OPCODE_CLOSE) {
      // Send close frame back
      const closeFrame = Buffer.alloc(2);
      closeFrame[0] = 0x80 | OPCODE_CLOSE;
      closeFrame[1] = 0;
      socket.write(closeFrame);
      socket.end();
      wsClients.delete(socket);
      console.log(`[h4-proxy] WebSocket client disconnected (close frame)`);
      return;
    }

    if (frame.opcode === OPCODE_PING) {
      // Respond with pong
      const pongHeader = Buffer.alloc(2);
      pongHeader[0] = 0x80 | OPCODE_PONG;
      pongHeader[1] = frame.payload.length;
      socket.write(Buffer.concat([pongHeader, frame.payload]));
      continue;
    }

    if (frame.opcode === OPCODE_TEXT) {
      // Log received text (client messages are informational in this experiment)
      const text = frame.payload.toString('utf-8');
      console.log(`[h4-proxy] WS received: ${text}`);
    }
  }

  /** @type {any} */ (socket).__wsBuf = buffer.length > 0 ? buffer : undefined;
}

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
      service: 'h4-websocket-approval-proxy',
      port,
      connectedClients: wsClients.size,
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

      console.log(`[h4-proxy] CRITICAL tool "${toolName}" — approval required: ${approvalId}`);

      // Broadcast to all WebSocket clients
      broadcast({
        type: 'approval_required',
        approvalId,
        toolName,
      });

      jsonResponse(res, 202, {
        status: 'pending_approval',
        approvalId,
        toolName,
        message: `Tool "${toolName}" requires human approval. Listen on WS /approvals/ws for decision.`,
      });
      return;
    }

    // Non-critical tools execute immediately
    jsonResponse(res, 200, {
      allowed: true,
      tool: toolName,
      output: {
        result: `[h4-proxy] executed ${toolName}`,
        parameters,
        timestamp: new Date().toISOString(),
      },
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
    console.log(`[h4-proxy] Approval ${id} → ${decision}`);

    // Broadcast decision to all WebSocket clients
    broadcast({
      type: 'approval_decision',
      approvalId: id,
      decision,
    });

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
 * Start the WebSocket approval proxy.
 * @param {number} [port=9998]
 * @returns {Promise<{ url: string; close: () => void }>}
 */
export function startApprovalProxy(port = 9998) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      handleRequest(req, res, port).catch((err) => {
        console.error('[h4-proxy] Unhandled error:', err);
        if (!res.headersSent) {
          jsonResponse(res, 500, { error: 'Internal server error' });
        }
      });
    });

    // Handle WebSocket upgrade on GET /approvals/ws
    server.on('upgrade', (req, socket) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      if (url.pathname !== '/approvals/ws') {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      const key = req.headers['sec-websocket-key'];
      if (!key) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }

      // RFC 6455 handshake
      const accept = createHash('sha1')
        .update(key + WS_MAGIC)
        .digest('base64');

      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          `Sec-WebSocket-Accept: ${accept}\r\n` +
          '\r\n',
      );

      wsClients.add(socket);
      console.log(`[h4-proxy] WebSocket client connected (total: ${wsClients.size})`);

      socket.on('data', (data) => handleWsData(socket, data));
      socket.on('close', () => {
        wsClients.delete(socket);
        console.log(`[h4-proxy] WebSocket client disconnected (total: ${wsClients.size})`);
      });
      socket.on('error', (err) => {
        console.error('[h4-proxy] WebSocket error:', err.message);
        wsClients.delete(socket);
      });
    });

    server.on('error', (err) => {
      /** @type {any} */ (err).code === 'EADDRINUSE'
        ? reject(new Error(`Port ${port} is already in use`))
        : reject(err);
    });

    server.listen(port, '127.0.0.1', () => {
      const url = `http://localhost:${port}`;
      console.log(`[h4-proxy] Listening on ${url}`);
      console.log(
        `[h4-proxy] Routes: POST /tools/invoke  WS /approvals/ws  POST /approvals/:id/decide`,
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
    console.error('[h4-proxy] Failed to start:', err);
    process.exit(1);
  });
}
