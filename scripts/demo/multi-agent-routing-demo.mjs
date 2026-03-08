/**
 * OpenClaw Policy Demo — Multi-Agent Routing
 *
 * Demonstrates multiple agents running through the same Portarium proxy
 * simultaneously with different policy tiers. Each agent gets a unique
 * agentId and its approval decisions are isolated.
 *
 * Falls back gracefully if only one SDK is available.
 *
 * Run: npm run demo:agent:multi
 */

import { startPolicyProxy } from './portarium-tool-proxy.mjs';

// ---------------------------------------------------------------------------
// SDK availability detection
// ---------------------------------------------------------------------------

/** @type {{ name: string; available: boolean; sdk: unknown }[]} */
const SDKS = [];

try {
  const mod = await import('@google/generative-ai');
  SDKS.push({ name: 'gemini', available: true, sdk: mod });
} catch {
  SDKS.push({ name: 'gemini', available: false, sdk: null });
}

try {
  const mod = await import('@anthropic-ai/sdk');
  SDKS.push({ name: 'claude', available: true, sdk: mod });
} catch {
  SDKS.push({ name: 'claude', available: false, sdk: null });
}

try {
  const mod = await import('openai');
  SDKS.push({ name: 'openai', available: true, sdk: mod });
} catch {
  SDKS.push({ name: 'openai', available: false, sdk: null });
}

const availableSdks = SDKS.filter((s) => s.available);
if (availableSdks.length === 0) {
  console.error(
    '\n[multi-agent] No agent SDKs found. Install at least one of:\n' +
      '  npm install @google/generative-ai --save-dev\n' +
      '  npm install @anthropic-ai/sdk --save-dev\n' +
      '  npm install openai --save-dev\n',
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Tool-name mapping (shared)
// ---------------------------------------------------------------------------

const TOOL_NAME_MAP = {
  read_file: 'read:file',
  search_documents: 'search:documents',
  write_file: 'write:file',
  run_shell_command: 'shell.exec',
};

// ---------------------------------------------------------------------------
// Agent: Gemini
// ---------------------------------------------------------------------------

async function runGeminiAgent(proxyUrl, agentId, policyTier) {
  const mod = SDKS.find((s) => s.name === 'gemini');
  if (!mod?.available) return { agentId, skipped: true, reason: 'SDK not installed' };

  const apiKey = process.env['GOOGLE_VERTEX_API_KEY'];
  if (!apiKey) return { agentId, skipped: true, reason: 'GOOGLE_VERTEX_API_KEY not set' };

  const { GoogleGenerativeAI } = /** @type {any} */ (mod.sdk);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [
      {
        functionDeclarations: [
          {
            name: 'read_file',
            description: 'Read the contents of a file',
            parameters: {
              type: 'OBJECT',
              properties: { path: { type: 'STRING', description: 'File path to read' } },
              required: ['path'],
            },
          },
          {
            name: 'write_file',
            description: 'Write content to a file',
            parameters: {
              type: 'OBJECT',
              properties: {
                path: { type: 'STRING', description: 'Destination file path' },
                content: { type: 'STRING', description: 'Content to write' },
              },
              required: ['path', 'content'],
            },
          },
        ],
      },
    ],
  });

  const results = [];
  const chat = model.startChat({ history: [] });

  const response = await chat.sendMessage(
    `You are agent "${agentId}". Read the file "README.md" and then write a summary to "summary-${agentId}.txt".`,
  );

  const candidate = response.response.candidates?.[0];
  if (!candidate) return { agentId, results: [], note: 'No response' };

  for (const part of candidate.content.parts) {
    if (!part.functionCall) continue;
    const portariumToolName = TOOL_NAME_MAP[part.functionCall.name] ?? part.functionCall.name;

    const policyResp = await fetch(`${proxyUrl}/tools/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: portariumToolName,
        parameters: part.functionCall.args ?? {},
        policyTier,
        agentId,
      }),
    });

    const policyResult = /** @type {any} */ (await policyResp.json());
    results.push({
      tool: portariumToolName,
      allowed: policyResult.allowed ?? false,
      status: policyResult.status ?? (policyResult.allowed ? 'allowed' : 'blocked'),
      approvalId: policyResult.approvalId ?? null,
    });
  }

  return { agentId, policyTier, results };
}

// ---------------------------------------------------------------------------
// Agent: Stub (for demonstrating concurrent routing without real API calls)
// ---------------------------------------------------------------------------

async function runStubAgent(proxyUrl, agentId, policyTier, toolCalls) {
  const results = [];

  for (const call of toolCalls) {
    const portariumToolName = TOOL_NAME_MAP[call.name] ?? call.name;

    const policyResp = await fetch(`${proxyUrl}/tools/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: portariumToolName,
        parameters: call.params,
        policyTier,
        agentId,
      }),
    });

    const policyResult = /** @type {any} */ (await policyResp.json());
    results.push({
      tool: portariumToolName,
      allowed: policyResult.allowed ?? false,
      status: policyResult.status ?? (policyResult.allowed ? 'allowed' : 'blocked'),
      approvalId: policyResult.approvalId ?? null,
    });
  }

  return { agentId, policyTier, results };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n[multi-agent] Starting Portarium policy proxy...');
  const { url: proxyUrl, close: closeProxy } = await startPolicyProxy(9999);

  try {
    console.log('[multi-agent] Available SDKs:', availableSdks.map((s) => s.name).join(', '));
    console.log('[multi-agent] Spawning agents in parallel...\n');

    // Define agents with different policy tiers
    const agentTasks = [];

    // Agent A: Gemini (or stub) at Auto tier — reads allowed, writes blocked
    if (SDKS.find((s) => s.name === 'gemini')?.available && process.env['GOOGLE_VERTEX_API_KEY']) {
      agentTasks.push(runGeminiAgent(proxyUrl, 'agent-gemini-auto', 'Auto'));
    } else {
      agentTasks.push(
        runStubAgent(proxyUrl, 'agent-stub-auto', 'Auto', [
          { name: 'read_file', params: { path: 'README.md' } },
          { name: 'write_file', params: { path: 'output.txt', content: 'hello' } },
          { name: 'run_shell_command', params: { command: 'ls' } },
        ]),
      );
    }

    // Agent B: Stub at HumanApprove tier — all tools allowed
    agentTasks.push(
      runStubAgent(proxyUrl, 'agent-stub-elevated', 'HumanApprove', [
        { name: 'read_file', params: { path: 'README.md' } },
        { name: 'write_file', params: { path: 'output.txt', content: 'hello' } },
        { name: 'run_shell_command', params: { command: 'ls' } },
      ]),
    );

    // Agent C: Stub at Auto tier — demonstrates cross-agent approval isolation
    agentTasks.push(
      runStubAgent(proxyUrl, 'agent-stub-restricted', 'Auto', [
        { name: 'read_file', params: { path: 'config.json' } },
        { name: 'run_shell_command', params: { command: 'rm -rf /' } },
      ]),
    );

    // Run all agents concurrently
    const results = await Promise.all(agentTasks);

    // Report
    console.log('\n[multi-agent] Results:\n');
    for (const agent of results) {
      console.log(`  Agent: ${agent.agentId} (tier: ${agent.policyTier ?? 'n/a'})`);
      if (agent.skipped) {
        console.log(`    ⏭️  Skipped: ${agent.reason}`);
        continue;
      }
      for (const r of agent.results ?? []) {
        const icon = r.allowed ? '✅' : r.status === 'awaiting_approval' ? '⏳' : '❌';
        const suffix = r.approvalId ? ` (approval: ${r.approvalId.slice(0, 8)}…)` : '';
        console.log(`    ${icon} ${r.tool} → ${r.status}${suffix}`);
      }
    }

    // Verify cross-agent approval isolation
    const allApprovalIds = results
      .flatMap((a) => a.results ?? [])
      .filter((r) => r.approvalId)
      .map((r) => r.approvalId);
    const uniqueApprovalIds = new Set(allApprovalIds);
    console.log(`\n[multi-agent] Total approval requests: ${allApprovalIds.length}`);
    console.log(`[multi-agent] Unique approval IDs: ${uniqueApprovalIds.size}`);
    console.log(
      `[multi-agent] Approval isolation: ${uniqueApprovalIds.size === allApprovalIds.length ? '✅ PASS' : '❌ FAIL — duplicate IDs detected'}`,
    );

    console.log('\n[multi-agent] Demo complete.\n');
  } finally {
    closeProxy();
  }
}

main().catch((err) => {
  console.error('[multi-agent] Fatal error:', err);
  process.exit(1);
});
