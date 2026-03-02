/**
 * OpenClaw Agent Policy Enforcement Demo — Standalone
 *
 * Directly exercises ActionGatedToolInvoker + blast-radius policy.
 * Zero infrastructure — runs in ~1 second.
 *
 * Run: npm run demo:policy
 */

// tsx resolves .js → .ts at runtime
import { classifyOpenClawToolBlastRadiusV1 } from '../../src/domain/machines/openclaw-tool-blast-radius-v1.js';
import { ActionGatedToolInvoker } from '../../src/application/services/action-gated-tool-invoker.js';

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------
const C = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

// ---------------------------------------------------------------------------
// Mock implementations (inline — no imports from test dirs)
// ---------------------------------------------------------------------------

/** @type {import('../../src/application/ports/machine-invoker.js').MachineInvokerPort} */
const mockMachineInvoker = {
  async invokeTool(input) {
    return {
      ok: true,
      output: { result: `[mock] executed ${input.toolName}`, params: input.parameters },
    };
  },
  async runAgent() {
    return { ok: true, output: { result: '[mock] agent run completed' } };
  },
};

/** Demo workspace actor — admin role satisfies the RBAC gate. */
const demoActor = /** @type {any} */ ({
  userId: 'user-demo-001',
  workspaceId: 'ws-portarium-demo',
  roles: ['admin'],
});

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

/**
 * @type {Array<{
 *   tool: string,
 *   tier: string,
 *   expectedDecision: 'Allow' | 'Deny',
 *   reason: string
 * }>}
 */
const SCENARIOS = [
  // ── Auto tier ────────────────────────────────────────────────────────────
  {
    tool: 'read:file',
    tier: 'Auto',
    expectedDecision: 'Allow',
    reason: 'ReadOnly → allowed at Auto',
  },
  {
    tool: 'search:documents',
    tier: 'Auto',
    expectedDecision: 'Allow',
    reason: 'ReadOnly → allowed at Auto',
  },
  {
    tool: 'get:status',
    tier: 'Auto',
    expectedDecision: 'Allow',
    reason: 'ReadOnly → allowed at Auto',
  },
  {
    tool: 'write:file',
    tier: 'Auto',
    expectedDecision: 'Deny',
    reason: 'Mutation → needs HumanApprove',
  },
  {
    tool: 'create:record',
    tier: 'Auto',
    expectedDecision: 'Deny',
    reason: 'Mutation → needs HumanApprove',
  },
  {
    tool: 'shell.exec',
    tier: 'Auto',
    expectedDecision: 'Deny',
    reason: 'Dangerous → needs ManualOnly',
  },

  // ── Assisted tier ────────────────────────────────────────────────────────
  {
    tool: 'read:file',
    tier: 'Assisted',
    expectedDecision: 'Allow',
    reason: 'ReadOnly → allowed at Assisted',
  },
  {
    tool: 'write:file',
    tier: 'Assisted',
    expectedDecision: 'Deny',
    reason: 'Mutation → needs HumanApprove (Assisted is below)',
  },
  {
    tool: 'shell.exec',
    tier: 'Assisted',
    expectedDecision: 'Deny',
    reason: 'Dangerous → still needs ManualOnly',
  },

  // ── HumanApprove tier ────────────────────────────────────────────────────
  {
    tool: 'write:file',
    tier: 'HumanApprove',
    expectedDecision: 'Allow',
    reason: 'Mutation → ok at HumanApprove',
  },
  {
    tool: 'delete:record',
    tier: 'HumanApprove',
    expectedDecision: 'Allow',
    reason: 'Mutation → ok at HumanApprove',
  },
  {
    tool: 'shell.exec',
    tier: 'HumanApprove',
    expectedDecision: 'Deny',
    reason: 'Dangerous → still needs ManualOnly',
  },

  // ── ManualOnly tier ──────────────────────────────────────────────────────
  {
    tool: 'shell.exec',
    tier: 'ManualOnly',
    expectedDecision: 'Allow',
    reason: 'Dangerous → ok at ManualOnly',
  },
  {
    tool: 'terminal.run',
    tier: 'ManualOnly',
    expectedDecision: 'Allow',
    reason: 'Dangerous → ok at ManualOnly',
  },
  {
    tool: 'browser.navigate',
    tier: 'ManualOnly',
    expectedDecision: 'Allow',
    reason: 'Dangerous → ok at ManualOnly',
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const invoker = new ActionGatedToolInvoker(mockMachineInvoker);

  console.log(
    `\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════════════╗`,
  );
  console.log(`║     OpenClaw Agent Policy Enforcement Demo — Portarium          ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝${C.reset}\n`);

  let pass = 0;
  let fail = 0;
  /** @type {string[]} */
  const failures = [];

  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i];

    const result = await invoker.invoke({
      actor: demoActor,
      tenantId: /** @type {any} */ ('ws-portarium-demo'),
      runId: /** @type {any} */ ('run-demo-001'),
      actionId: /** @type {any} */ (`action-${String(i + 1).padStart(3, '0')}`),
      correlationId: /** @type {any} */ (`corr-${String(i + 1).padStart(3, '0')}`),
      machineId: /** @type {any} */ ('machine-openclaw-demo'),
      toolName: s.tool,
      parameters: { demo: true },
      policyTier: /** @type {any} */ (s.tier),
    });

    const actual = result.proposed === true ? 'Allow' : 'Deny';
    const matched = actual === s.expectedDecision;

    if (matched) {
      pass++;
    } else {
      fail++;
      failures.push(
        `  [${i + 1}] ${s.tool} @ ${s.tier} — expected ${s.expectedDecision}, got ${actual}`,
      );
    }

    const allowBlock =
      actual === 'Allow' ? `${C.green}✅ ALLOWED${C.reset}` : `${C.red}❌ BLOCKED${C.reset}`;

    const status = matched ? `${C.green}PASS${C.reset}` : `${C.red}FAIL${C.reset}`;

    const tierPad = s.tier.padEnd(12);
    const toolPad = s.tool.padEnd(22);
    const reasonTrunc = s.reason.length > 38 ? s.reason.slice(0, 35) + '...' : s.reason;

    console.log(`  ${status}  ${toolPad}  [${tierPad}]  ${allowBlock}  ${reasonTrunc}`);
  }

  console.log(
    `\n${C.bold}Results: ${C.green}${pass} passed${C.reset} / ${fail > 0 ? C.red : C.green}${fail} failed${C.reset} of ${SCENARIOS.length} scenarios\n`,
  );

  if (failures.length > 0) {
    console.log(`${C.red}${C.bold}FAILURES:${C.reset}`);
    failures.forEach((f) => console.log(f));
    console.log();
    process.exit(1);
  }

  // Classification summary
  console.log(`${C.bold}${C.cyan}Tool classification summary:${C.reset}`);
  const seen = new Set();
  for (const s of SCENARIOS) {
    if (seen.has(s.tool)) continue;
    seen.add(s.tool);
    const policy = classifyOpenClawToolBlastRadiusV1(s.tool);
    const tierColor =
      policy.minimumTier === 'ManualOnly'
        ? C.red
        : policy.minimumTier === 'HumanApprove'
          ? C.yellow
          : C.green;
    console.log(
      `  ${s.tool.padEnd(22)}  ${policy.category.padEnd(10)}  min-tier: ${tierColor}${policy.minimumTier}${C.reset}`,
    );
  }

  console.log(`\n${C.green}${C.bold}Demo complete — policy enforcement verified.${C.reset}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
