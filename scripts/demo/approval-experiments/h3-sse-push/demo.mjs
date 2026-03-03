/**
 * H3: SSE push — demo
 *
 * Simulates an agent tool call that requires human approval, using
 * Server-Sent Events for instant push notification.
 *
 * Usage:
 *   node demo.mjs                     # waits for manual POST to /approvals/:id/decide
 *   DEMO_AUTO_APPROVE=1 node demo.mjs # auto-approves after 150ms
 */

import http from 'node:http';
import { startProxy, stopProxy } from './proxy-extension.mjs';
import { waitForApproval } from './plugin.mjs';

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let responseBody = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (responseBody += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(responseBody));
          } catch {
            resolve(responseBody);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const { port } = await startProxy();
  const proxyBase = `http://127.0.0.1:${port}`;

  console.log('\n--- H3: SSE push approval-wait loop ---\n');

  // 1. Agent calls a CRITICAL tool
  console.log('[agent] calling CRITICAL tool: deleteProductionDatabase');
  const { pendingApprovalId } = await postJSON(`${proxyBase}/approvals`, {
    tool: 'deleteProductionDatabase',
    args: { confirm: true },
  });
  console.log(`[agent] approval required — id=${pendingApprovalId}`);

  // 2. Agent opens SSE stream and waits
  console.log('[agent] connecting to SSE stream...');
  const t0 = Date.now();

  // 3. If auto-approve mode, schedule a decision after 150ms
  if (process.env.DEMO_AUTO_APPROVE === '1') {
    setTimeout(async () => {
      console.log('[operator] auto-approving after 150ms delay');
      await postJSON(`${proxyBase}/approvals/${pendingApprovalId}/decide`, {
        decision: 'approved',
      });
    }, 150);
  } else {
    console.log(
      `[operator] POST to approve:\n  curl -X POST ${proxyBase}/approvals/${pendingApprovalId}/decide -H 'Content-Type: application/json' -d '{"decision":"approved"}'`,
    );
  }

  const result = await waitForApproval(pendingApprovalId, proxyBase);
  const elapsed = Date.now() - t0;

  console.log(`[agent] received decision via SSE push: ${result.decision} (${elapsed}ms)`);
  console.log('[agent] proceeding with tool execution\n');

  await stopProxy();
  console.log('--- demo complete ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
