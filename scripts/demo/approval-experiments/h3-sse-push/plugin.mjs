/**
 * H3: SSE push — plugin
 *
 * Exports `waitForApproval(approvalId, proxyUrl)` which connects to the
 * proxy's SSE stream and resolves on the first `data:` event carrying
 * the decision. Falls back to a single GET poll if the stream disconnects
 * before a decision arrives.
 */

import http from 'node:http';

/**
 * Connect to the SSE stream for the given approval and wait for a decision.
 *
 * @param {string} approvalId
 * @param {string} proxyBase  e.g. "http://127.0.0.1:9093"
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ decision: string }>}
 */
export function waitForApproval(approvalId, proxyBase, opts = {}) {
  const { timeoutMs = 30_000 } = opts;
  const streamUrl = `${proxyBase}/approvals/${approvalId}/stream`;

  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`approval timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    const url = new URL(streamUrl);

    const req = http.get(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: { Accept: 'text/event-stream' },
      },
      (res) => {
        if (res.statusCode !== 200) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(`SSE stream returned status ${res.statusCode}`));
          return;
        }

        let buffer = '';

        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buffer += chunk;

          // Parse SSE frames: look for "data: {...}\n\n"
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const payload = JSON.parse(line.slice(6));
                if (payload.decision && !settled) {
                  settled = true;
                  clearTimeout(timer);
                  resolve(payload);
                }
              } catch {
                // Ignore malformed data lines
              }
            }
          }
        });

        res.on('end', () => {
          // Stream closed — fall back to polling once
          if (!settled) {
            fallbackPoll(approvalId, proxyBase)
              .then((result) => {
                if (!settled) {
                  settled = true;
                  clearTimeout(timer);
                  resolve(result);
                }
              })
              .catch((err) => {
                if (!settled) {
                  settled = true;
                  clearTimeout(timer);
                  reject(err);
                }
              });
          }
        });
      },
    );

    req.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

/**
 * Fallback: single GET poll to check if a decision was already made.
 * Uses the SSE endpoint which returns immediately if decided.
 */
function fallbackPoll(approvalId, proxyBase) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${proxyBase}/approvals/${approvalId}/stream`);
    const req = http.get(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: { Accept: 'text/event-stream' },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          for (const line of body.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                const payload = JSON.parse(line.slice(6));
                if (payload.decision) return resolve(payload);
              } catch {
                // skip
              }
            }
          }
          reject(new Error('fallback poll: no decision found'));
        });
      },
    );
    req.on('error', reject);
  });
}
