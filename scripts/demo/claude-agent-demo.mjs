/**
 * OpenClaw Policy Demo — Anthropic Claude Agent (claude-sonnet-4-6)
 *
 * Requires ANTHROPIC_API_KEY environment variable.
 * The agent attempts read, write, and dangerous tools.
 * Portarium policy blocks mutations and dangerous calls at Auto tier.
 *
 * Run: npm run demo:agent:claude
 */

import { startPolicyProxy } from './portarium-tool-proxy.mjs';

// ---------------------------------------------------------------------------
// SDK import (graceful failure if not installed)
// ---------------------------------------------------------------------------

let Anthropic;
try {
  const mod = await import('@anthropic-ai/sdk');
  Anthropic = mod.default ?? mod.Anthropic;
} catch {
  console.error(
    '\n[claude-demo] Missing @anthropic-ai/sdk package.\n' +
      'Install it: npm install @anthropic-ai/sdk --save-dev\n',
  );
  process.exit(1);
}

if (!process.env['ANTHROPIC_API_KEY']) {
  console.error('\n[claude-demo] ANTHROPIC_API_KEY environment variable is not set.\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Tool definitions (presented to Claude)
// ---------------------------------------------------------------------------

/** @type {import('@anthropic-ai/sdk').Anthropic.Tool[]} */
const TOOLS = [
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'File path to read' } },
      required: ['path'],
    },
  },
  {
    name: 'search_documents',
    description: 'Search documents for a keyword',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query' } },
      required: ['query'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Destination file path' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'run_shell_command',
    description: 'Execute a shell command on the host',
    input_schema: {
      type: 'object',
      properties: { command: { type: 'string', description: 'Shell command to run' } },
      required: ['command'],
    },
  },
];

/** Maps agent tool names → Portarium tool names */
const TOOL_NAME_MAP = {
  read_file: 'read:file',
  search_documents: 'search:documents',
  write_file: 'write:file',
  run_shell_command: 'shell.exec',
};

// ---------------------------------------------------------------------------
// Policy tier for this demo
// ---------------------------------------------------------------------------
const POLICY_TIER = 'Auto';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n[claude-demo] Starting Portarium policy proxy...');
  const { url: proxyUrl, close: closeProxy } = await startPolicyProxy(9999);

  try {
    const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });

    console.log('[claude-demo] Sending task to claude-sonnet-4-6...\n');

    /** @type {import('@anthropic-ai/sdk').Anthropic.MessageParam[]} */
    const messages = [
      {
        role: 'user',
        content:
          'Please do the following in order:\n' +
          '1. Read the project README (path: "README.md")\n' +
          '2. Search for "policy enforcement" in documents\n' +
          '3. Write a summary to "output.txt"\n' +
          '4. Run the shell command "git log --oneline -5"\n' +
          'Report what succeeded and what was blocked by policy.',
      },
    ];

    let rounds = 0;
    const MAX_ROUNDS = 8;

    while (rounds < MAX_ROUNDS) {
      rounds++;

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system:
          'You are a task runner. Execute the requested steps using the available tools. ' +
          'Report exactly what you could and could not do.',
        tools: TOOLS,
        messages,
      });

      // Add assistant turn
      messages.push({ role: 'assistant', content: response.content });

      // Print any text blocks Claude emits (reasoning, commentary, final answer)
      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) {
          console.log('\n[claude-demo] Claude:', block.text);
        }
      }

      if (response.stop_reason === 'end_turn') {
        break;
      }

      if (response.stop_reason !== 'tool_use') {
        break;
      }

      // Collect tool results for this turn
      /** @type {import('@anthropic-ai/sdk').Anthropic.ToolResultBlockParam[]} */
      const toolResults = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        const agentToolName = block.name;
        const portariumToolName = TOOL_NAME_MAP[agentToolName] ?? agentToolName;
        const params = /** @type {Record<string, unknown>} */ (block.input ?? {});

        console.log(`[claude-demo] Tool call: ${agentToolName} → Portarium: ${portariumToolName}`);

        // Route through Portarium policy proxy
        const policyResp = await fetch(`${proxyUrl}/tools/invoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolName: portariumToolName,
            parameters: params,
            policyTier: POLICY_TIER,
          }),
        });

        const policyResult = /** @type {any} */ (await policyResp.json());

        if (policyResult.allowed) {
          console.log(`  ✅ ALLOWED — ${portariumToolName} (tier: ${POLICY_TIER})`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(policyResult.output ?? { status: 'executed' }),
          });
        } else {
          console.log(`  ❌ BLOCKED — ${portariumToolName} — ${policyResult.message}`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content:
              `BLOCKED by Portarium policy: ${policyResult.message}. ` +
              `Tool "${portariumToolName}" requires tier "${policyResult.minimumTier}" ` +
              `but current tier is "${POLICY_TIER}".`,
          });
        }
      }

      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults });
      }
    }

    if (rounds >= MAX_ROUNDS) {
      console.log('[claude-demo] Reached max rounds, stopping.');
    }

    console.log('\n[claude-demo] Demo complete.\n');
  } finally {
    closeProxy();
  }
}

main().catch((err) => {
  console.error('[claude-demo] Fatal error:', err);
  process.exit(1);
});
