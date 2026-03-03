/**
 * H7: Companion approval CLI
 *
 * Standalone CLI tool that connects to the approval proxy, discovers pending
 * approvals, and lets an operator approve or deny them interactively.
 *
 * Usage:
 *   node approval-cli.mjs --proxy http://localhost:9999
 *
 * The CLI polls GET /approvals?status=pending every 2s. When pending approvals
 * are found, it prints them in a table and prompts the operator for a decision.
 * Posts the decision to POST /approvals/:id/decide.
 *
 * Ctrl+C to exit.
 */

import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const { values } = parseArgs({
  options: {
    proxy: { type: 'string', default: 'http://localhost:9999' },
    interval: { type: 'string', default: '2000' },
  },
  strict: false,
});

const proxyUrl = values.proxy;
const pollIntervalMs = parseInt(/** @type {string} */ (values.interval), 10);

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(`[approval-cli] ${msg}`);
}

function printTable(approvalsList) {
  console.log('');
  console.log('  Pending Approvals:');
  console.log('  ' + '-'.repeat(90));
  console.log(
    '  ' +
      'ID'.padEnd(38) +
      'Tool'.padEnd(20) +
      'Parameters'.padEnd(30) +
      'Created',
  );
  console.log('  ' + '-'.repeat(90));
  for (const a of approvalsList) {
    const params = JSON.stringify(a.parameters ?? {}).slice(0, 28);
    const created = new Date(a.createdAt).toLocaleTimeString();
    console.log(
      '  ' +
        a.approvalId.padEnd(38) +
        a.toolName.padEnd(20) +
        params.padEnd(30) +
        created,
    );
  }
  console.log('  ' + '-'.repeat(90));
  console.log('');
}

// ---------------------------------------------------------------------------
// Prompt helper
// ---------------------------------------------------------------------------

/**
 * Ask a yes/no question via readline.
 * @param {string} question
 * @returns {Promise<boolean>}
 */
function askYesNo(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase().startsWith('y'));
    });
  });
}

// ---------------------------------------------------------------------------
// Core loop
// ---------------------------------------------------------------------------

/** Set of approval IDs we have already prompted for (avoid re-prompting). */
const prompted = new Set();

async function fetchPending() {
  try {
    const res = await fetch(`${proxyUrl}/approvals?status=pending`);
    if (!res.ok) {
      log(`Warning: proxy returned ${res.status}`);
      return [];
    }
    const data = /** @type {{ approvals: Array<any> }} */ (await res.json());
    return data.approvals ?? [];
  } catch (err) {
    log(`Warning: could not reach proxy at ${proxyUrl} — ${/** @type {Error} */ (err).message}`);
    return [];
  }
}

async function postDecision(approvalId, decision) {
  const res = await fetch(`${proxyUrl}/approvals/${approvalId}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
  return res.json();
}

async function pollAndPrompt() {
  const pending = await fetchPending();

  // Filter out already-prompted approvals
  const newPending = pending.filter((a) => !prompted.has(a.approvalId));
  if (newPending.length === 0) return;

  printTable(newPending);

  for (const approval of newPending) {
    prompted.add(approval.approvalId);

    const approved = await askYesNo(
      `  Approve "${approval.toolName}" [${approval.approvalId.slice(0, 8)}...] ? (y/n) `,
    );
    const decision = approved ? 'approved' : 'denied';

    try {
      const result = await postDecision(approval.approvalId, decision);
      log(`${approval.approvalId.slice(0, 8)}... → ${result.status}`);
    } catch (err) {
      log(`Error posting decision: ${/** @type {Error} */ (err).message}`);
    }
  }
}

async function main() {
  log(`Companion Approval CLI`);
  log(`Proxy: ${proxyUrl}`);
  log(`Poll interval: ${pollIntervalMs}ms`);
  log(`Waiting for pending approvals... (Ctrl+C to exit)`);
  log('');

  // Initial poll
  await pollAndPrompt();

  // Continuous polling
  const timer = setInterval(async () => {
    await pollAndPrompt();
  }, pollIntervalMs);

  // Graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(timer);
    log('Shutting down.');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[approval-cli] Fatal error:', err);
  process.exit(1);
});
