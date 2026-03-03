/**
 * OpenClaw Demo Agent — Containerised scripted agent
 *
 * Deterministically tests all tool tiers via the Portarium policy proxy.
 * No AI API key required. Exits 0 if at least one block AND one allow occurred.
 *
 * Environment variables:
 *   PROXY_URL   — URL of the Portarium policy proxy (default: http://host.docker.internal:9999)
 */

const PROXY_URL = process.env['PROXY_URL'] ?? 'http://host.docker.internal:9999';

/** @type {Array<{toolName: string, policyTier: string, expectAllow: boolean}>} */
const TEST_CASES = [
  // ReadOnly tools — allowed at Auto tier
  { toolName: 'read:file', policyTier: 'Auto', expectAllow: true },
  { toolName: 'search:documents', policyTier: 'Auto', expectAllow: true },
  { toolName: 'get:status', policyTier: 'Auto', expectAllow: true },

  // Mutation tools — blocked at Auto, allowed at HumanApprove
  { toolName: 'write:file', policyTier: 'Auto', expectAllow: false },
  { toolName: 'write:file', policyTier: 'HumanApprove', expectAllow: true },
  { toolName: 'create:record', policyTier: 'Auto', expectAllow: false },
  { toolName: 'delete:record', policyTier: 'HumanApprove', expectAllow: true },

  // Dangerous tools — blocked at Auto and HumanApprove, allowed at ManualOnly
  { toolName: 'shell.exec', policyTier: 'Auto', expectAllow: false },
  { toolName: 'shell.exec', policyTier: 'HumanApprove', expectAllow: false },
  { toolName: 'shell.exec', policyTier: 'ManualOnly', expectAllow: true },
  { toolName: 'terminal.run', policyTier: 'ManualOnly', expectAllow: true },
  { toolName: 'browser.navigate', policyTier: 'ManualOnly', expectAllow: true },
];

async function waitForProxy(maxRetries = 20, intervalMs = 500) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${PROXY_URL}/health`);
      if (res.ok) return;
    } catch {
      /* proxy not ready yet */
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Proxy at ${PROXY_URL} did not become ready after ${maxRetries * intervalMs}ms`);
}

async function main() {
  console.log(`\n[openclaw-agent] Connecting to Portarium policy proxy at ${PROXY_URL}`);

  await waitForProxy();
  console.log('[openclaw-agent] Proxy ready.\n');

  // Discover available tools
  const toolsRes = await fetch(`${PROXY_URL}/tools`);
  const toolsData = /** @type {any} */ (await toolsRes.json());
  console.log(`[openclaw-agent] Available tools (${toolsData.tools.length}):`);
  for (const t of toolsData.tools) {
    console.log(`  ${t.name.padEnd(22)}  ${t.category.padEnd(10)}  min-tier: ${t.minimumTier}`);
  }
  console.log();

  let allowCount = 0;
  let blockCount = 0;
  let unexpectedCount = 0;

  for (const tc of TEST_CASES) {
    const res = await fetch(`${PROXY_URL}/tools/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: tc.toolName,
        parameters: { demo: true },
        policyTier: tc.policyTier,
      }),
    });

    const result = /** @type {any} */ (await res.json());
    // awaiting_approval counts as "blocked" for this scripted test — the agent is not
    // interactive and cannot wait for a human decision. In a real agent loop, the agent
    // would call waitForApproval() here. See portarium-approval-plugin.mjs.
    const gotAllow = result.allowed === true;
    const matched = gotAllow === tc.expectAllow;

    const icon = matched ? (gotAllow ? '✅' : '❌') : '⚠️ MISMATCH';

    const actualRaw =
      result.status === 'awaiting_approval'
        ? `AWAITING_APPROVAL (${result.approvalId?.slice(0, 8) ?? '?'}…)`
        : gotAllow
          ? 'ALLOWED'
          : 'BLOCKED';
    const actual = gotAllow ? 'ALLOWED' : actualRaw;
    const expected = tc.expectAllow ? 'ALLOWED' : 'BLOCKED';

    console.log(
      `  ${icon}  ${tc.toolName.padEnd(22)}  [${tc.policyTier.padEnd(12)}]  ${actual}` +
        (matched ? '' : `  (expected ${expected})`),
    );

    if (gotAllow) allowCount++;
    else blockCount++;
    if (!matched) unexpectedCount++;
  }

  console.log(
    `\n[openclaw-agent] Results: ${allowCount} allowed, ${blockCount} blocked, ${unexpectedCount} unexpected`,
  );

  if (unexpectedCount > 0) {
    console.error(
      `[openclaw-agent] FAIL — ${unexpectedCount} policy decisions did not match expectations.`,
    );
    process.exit(1);
  }

  if (allowCount === 0 || blockCount === 0) {
    console.error(
      '[openclaw-agent] FAIL — expected at least one allow AND one block to prove policy is working.',
    );
    process.exit(1);
  }

  console.log('[openclaw-agent] PASS — policy enforcement verified.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('[openclaw-agent] Fatal error:', err);
  process.exit(1);
});
