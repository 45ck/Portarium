/**
 * H6: Filesystem Watch — Proxy Extension
 *
 * When a CRITICAL tool is called, writes a `.pending.json` file to a
 * well-known tmpdir path, then uses `fs.watch()` to wait for an
 * `.approved` or `.denied` file to appear.
 *
 * Also exposes `POST /approvals/:id/decide` as a convenience endpoint
 * to create the approval/denial file programmatically.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createServer } from 'node:http';

const WATCH_DIR = path.join(os.tmpdir(), '.portarium-approvals');

/** Ensure the approval directory exists. */
function ensureWatchDir() {
  if (!fs.existsSync(WATCH_DIR)) {
    fs.mkdirSync(WATCH_DIR, { recursive: true });
  }
}

/**
 * Request approval for a critical tool call via the filesystem.
 *
 * Writes `{id}.pending.json` and watches for `{id}.approved` or `{id}.denied`.
 *
 * @param {{ toolName: string; parameters: Record<string, unknown>; timeoutMs?: number }} opts
 * @returns {Promise<{ approved: boolean; approvalId: string; watchDir: string; method: string }>}
 */
export function requestApproval({ toolName, parameters, timeoutMs = 30_000 }) {
  ensureWatchDir();

  const id = crypto.randomUUID();
  const pendingFile = path.join(WATCH_DIR, `${id}.pending.json`);

  const metadata = {
    approvalId: id,
    toolName,
    parameters,
    requestedAt: new Date().toISOString(),
    watchDir: WATCH_DIR,
    instructions: `Create "${id}.approved" or "${id}.denied" in ${WATCH_DIR} to decide.`,
  };

  fs.writeFileSync(pendingFile, JSON.stringify(metadata, null, 2));
  console.log(`[h6-fs] Pending approval written: ${pendingFile}`);
  console.log(`[h6-fs] Watching ${WATCH_DIR} for ${id}.approved or ${id}.denied`);

  return new Promise((resolve, reject) => {
    const approvedFile = path.join(WATCH_DIR, `${id}.approved`);
    const deniedFile = path.join(WATCH_DIR, `${id}.denied`);

    let settled = false;

    const cleanup = (watcher, timer) => {
      if (settled) return;
      settled = true;
      watcher.close();
      clearTimeout(timer);
      // Clean up pending file
      try {
        fs.unlinkSync(pendingFile);
      } catch {
        /* ignore */
      }
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      watcher.close();
      try {
        fs.unlinkSync(pendingFile);
      } catch {
        /* ignore */
      }
      reject(new Error(`Approval timed out after ${timeoutMs}ms for ${id}`));
    }, timeoutMs);

    const watcher = fs.watch(WATCH_DIR, (eventType, filename) => {
      if (settled || !filename) return;

      if (filename === `${id}.approved`) {
        cleanup(watcher, timer);
        try {
          fs.unlinkSync(approvedFile);
        } catch {
          /* ignore */
        }
        resolve({ approved: true, approvalId: id, watchDir: WATCH_DIR, method: 'fs.watch' });
      } else if (filename === `${id}.denied`) {
        cleanup(watcher, timer);
        try {
          fs.unlinkSync(deniedFile);
        } catch {
          /* ignore */
        }
        resolve({ approved: false, approvalId: id, watchDir: WATCH_DIR, method: 'fs.watch' });
      }
    });

    // Also poll once in case the file appeared before the watcher started
    setTimeout(() => {
      if (settled) return;
      if (fs.existsSync(approvedFile)) {
        cleanup(watcher, timer);
        try {
          fs.unlinkSync(approvedFile);
        } catch {
          /* ignore */
        }
        resolve({ approved: true, approvalId: id, watchDir: WATCH_DIR, method: 'fs.watch' });
      } else if (fs.existsSync(deniedFile)) {
        cleanup(watcher, timer);
        try {
          fs.unlinkSync(deniedFile);
        } catch {
          /* ignore */
        }
        resolve({ approved: false, approvalId: id, watchDir: WATCH_DIR, method: 'fs.watch' });
      }
    }, 50);
  });
}

// ---------------------------------------------------------------------------
// Convenience HTTP endpoint: POST /approvals/:id/decide
// ---------------------------------------------------------------------------

/**
 * Start a small HTTP server that lets callers create approval/denial files
 * via HTTP instead of touching the filesystem directly.
 *
 * @param {number} [port=9877]
 * @returns {Promise<{ url: string; close: () => void }>}
 */
export function startApprovalServer(port = 9877) {
  ensureWatchDir();

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      const match = url.pathname.match(/^\/approvals\/([^/]+)\/decide$/);

      if (req.method === 'POST' && match) {
        const id = match[1];
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const { decision } = JSON.parse(body || '{}');
            if (decision !== 'approved' && decision !== 'denied') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'decision must be "approved" or "denied"' }));
              return;
            }
            const filePath = path.join(WATCH_DIR, `${id}.${decision}`);
            fs.writeFileSync(filePath, JSON.stringify({ decidedAt: new Date().toISOString() }));
            console.log(`[h6-fs] Decision file created: ${filePath}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, file: filePath }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          }
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', watchDir: WATCH_DIR }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const url = `http://localhost:${port}`;
      console.log(`[h6-fs] Approval server listening on ${url}`);
      resolve({ url, close: () => server.close() });
    });
  });
}
