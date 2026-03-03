/**
 * H4: WebSocket channel — Approval wait plugin
 *
 * Connects to the approval proxy's WebSocket endpoint using raw TCP
 * (node:net) and manual HTTP upgrade + RFC 6455 frame parsing.
 * No external WebSocket library required.
 *
 * Exports:
 *   connectApprovalChannel(proxyUrl) — async iterator of approval events
 *   waitForApproval(approvalId, proxyUrl) — resolves on matching decision
 *
 * Usage:
 *   import { waitForApproval } from './plugin.mjs';
 *   const result = await waitForApproval(approvalId, 'http://localhost:9998');
 *   // result: { approved: boolean, decision: 'approved' | 'denied' }
 */

import { connect } from 'node:net';
import { createHash, randomBytes } from 'node:crypto';

const WS_MAGIC = '258EAFA5-E914-47DA-95CF-265B91017A36';

// ---------------------------------------------------------------------------
// WebSocket frame helpers
// ---------------------------------------------------------------------------

/**
 * Decode a WebSocket frame from buffer (server → client, unmasked).
 * @param {Buffer} buf
 * @returns {{ opcode: number; payload: Buffer; totalLength: number } | null}
 */
function decodeFrame(buf) {
  if (buf.length < 2) return null;

  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let payloadLen = buf[1] & 0x7f;
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
 * Encode a masked WebSocket text frame (client → server must be masked per RFC 6455).
 * @param {string} text
 * @returns {Buffer}
 */
function encodeClientFrame(text) {
  const payload = Buffer.from(text, 'utf-8');
  const len = payload.length;
  const mask = randomBytes(4);

  let header;
  if (len < 126) {
    header = Buffer.alloc(6);
    header[0] = 0x80 | 0x01; // FIN + text
    header[1] = 0x80 | len; // MASK bit + length
    mask.copy(header, 2);
  } else if (len < 65536) {
    header = Buffer.alloc(8);
    header[0] = 0x80 | 0x01;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
    mask.copy(header, 4);
  } else {
    header = Buffer.alloc(14);
    header[0] = 0x80 | 0x01;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
    mask.copy(header, 10);
  }

  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) {
    masked[i] = payload[i] ^ mask[i % 4];
  }

  return Buffer.concat([header, masked]);
}

/**
 * Build a masked close frame (client → server).
 * @returns {Buffer}
 */
function buildCloseFrame() {
  const mask = randomBytes(4);
  const header = Buffer.alloc(6);
  header[0] = 0x80 | 0x08; // FIN + close
  header[1] = 0x80 | 0; // MASK bit + 0 payload
  mask.copy(header, 2);
  return header;
}

// ---------------------------------------------------------------------------
// connectApprovalChannel — async iterator
// ---------------------------------------------------------------------------

/**
 * Connect to the WebSocket approval channel and yield events.
 *
 * @param {string} proxyUrl  Base URL of the approval proxy (e.g. http://localhost:9998)
 * @returns {AsyncGenerator<{ type: string; approvalId: string; toolName?: string; decision?: string }, void, void>}
 */
export async function* connectApprovalChannel(proxyUrl) {
  const parsed = new URL(proxyUrl);
  const host = parsed.hostname;
  const port = parseInt(parsed.port || '80', 10);

  const wsKey = randomBytes(16).toString('base64');
  const expectedAccept = createHash('sha1')
    .update(wsKey + WS_MAGIC)
    .digest('base64');

  /** @type {Array<{ type: string; approvalId: string; toolName?: string; decision?: string }>} */
  const queue = [];
  /** @type {((value: void) => void) | null} */
  let notify = null;
  let closed = false;

  const socket = await new Promise((resolve, reject) => {
    const sock = connect(port, host, () => {
      // Send HTTP upgrade request
      sock.write(
        `GET /approvals/ws HTTP/1.1\r\n` +
          `Host: ${host}:${port}\r\n` +
          `Upgrade: websocket\r\n` +
          `Connection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${wsKey}\r\n` +
          `Sec-WebSocket-Version: 13\r\n` +
          `\r\n`,
      );
    });

    let handshakeDone = false;
    let dataBuf = Buffer.alloc(0);

    sock.on('data', (chunk) => {
      dataBuf = Buffer.concat([dataBuf, chunk]);

      if (!handshakeDone) {
        const headerEnd = dataBuf.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;

        const headerStr = dataBuf.subarray(0, headerEnd).toString('utf-8');
        if (!headerStr.startsWith('HTTP/1.1 101')) {
          reject(new Error(`WebSocket upgrade failed: ${headerStr.split('\r\n')[0]}`));
          sock.destroy();
          return;
        }

        // Verify Sec-WebSocket-Accept
        const acceptMatch = headerStr.match(/Sec-WebSocket-Accept:\s*(.+)/i);
        if (!acceptMatch || acceptMatch[1].trim() !== expectedAccept) {
          reject(new Error('WebSocket accept key mismatch'));
          sock.destroy();
          return;
        }

        handshakeDone = true;
        dataBuf = dataBuf.subarray(headerEnd + 4);
        resolve(sock);
      }

      // Process WebSocket frames
      while (dataBuf.length > 0) {
        const frame = decodeFrame(dataBuf);
        if (!frame) break;
        dataBuf = dataBuf.subarray(frame.totalLength);

        if (frame.opcode === 0x08) {
          // Close frame
          closed = true;
          sock.write(buildCloseFrame());
          sock.end();
          if (notify) notify();
          return;
        }

        if (frame.opcode === 0x09) {
          // Ping → pong (masked)
          const pong = encodeClientFrame(frame.payload.toString('utf-8'));
          pong[0] = 0x80 | 0x0a; // Fix opcode to pong
          sock.write(pong);
          continue;
        }

        if (frame.opcode === 0x01) {
          // Text frame
          try {
            const msg = JSON.parse(frame.payload.toString('utf-8'));
            queue.push(msg);
            if (notify) notify();
          } catch {
            // Ignore non-JSON messages
          }
        }
      }
    });

    sock.on('error', (err) => {
      if (!handshakeDone) {
        reject(err);
      }
      closed = true;
      if (notify) notify();
    });

    sock.on('close', () => {
      closed = true;
      if (notify) notify();
    });
  });

  try {
    while (!closed) {
      if (queue.length > 0) {
        yield /** @type {any} */ (queue.shift());
        continue;
      }
      await new Promise((resolve) => {
        notify = resolve;
      });
      notify = null;
    }

    // Drain remaining items
    while (queue.length > 0) {
      yield /** @type {any} */ (queue.shift());
    }
  } finally {
    if (!socket.destroyed) {
      socket.write(buildCloseFrame());
      socket.destroy();
    }
  }
}

// ---------------------------------------------------------------------------
// waitForApproval — wait for a specific approval decision
// ---------------------------------------------------------------------------

/**
 * Connect to the WebSocket channel and wait for a specific approval decision.
 *
 * @param {string} approvalId  UUID of the pending approval
 * @param {string} proxyUrl    Base URL of the approval proxy (e.g. http://localhost:9998)
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ approved: boolean; status: 'approved' | 'denied' | 'timeout' }>}
 */
export function waitForApproval(approvalId, proxyUrl, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 30_000;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;

  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      resolve({ approved: false, status: /** @type {const} */ ('timeout') });
    }, timeoutMs);
  });

  const channelPromise = (async () => {
    try {
      for await (const event of connectApprovalChannel(proxyUrl)) {
        if (event.type === 'approval_decision' && event.approvalId === approvalId) {
          clearTimeout(timer);
          return {
            approved: event.decision === 'approved',
            status: /** @type {'approved' | 'denied'} */ (event.decision),
          };
        }
      }
      // Channel closed without decision
      clearTimeout(timer);
      return { approved: false, status: /** @type {const} */ ('timeout') };
    } catch {
      clearTimeout(timer);
      return { approved: false, status: /** @type {const} */ ('timeout') };
    }
  })();

  return Promise.race([channelPromise, timeoutPromise]);
}
