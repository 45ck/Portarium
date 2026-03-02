/**
 * OpenClaw Policy Demo — OpenAI Agent (gpt-4o)
 *
 * Requires OPENAI_API_KEY environment variable.
 * The agent attempts read, write, and dangerous tools.
 * Portarium policy blocks mutations and dangerous calls at Auto tier.
 *
 * Run: npm run demo:agent:openai
 */

import { startPolicyProxy } from './portarium-tool-proxy.mjs';

// ---------------------------------------------------------------------------
// SDK import (graceful failure if not installed)
// ---------------------------------------------------------------------------

let OpenAI;
try {
  const mod = await import('openai');
  OpenAI = mod.default;
} catch {
  console.error(
    '\n[openai-demo] Missing openai package.\n' + 'Install it: npm install openai --save-dev\n',
  );
  process.exit(1);
}

if (!process.env['OPENAI_API_KEY']) {
  console.error('\n[openai-demo] OPENAI_API_KEY environment variable is not set.\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Tool definitions (presented to GPT-4o)
// ---------------------------------------------------------------------------

/** @type {import('openai').OpenAI.Chat.ChatCompletionTool[]} */
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'File path to read' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_documents',
      description: 'Search documents for a keyword',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search query' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Destination file path' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_shell_command',
      description: 'Execute a shell command on the host',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'Shell command to run' } },
        required: ['command'],
      },
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
// Policy tier for this demo (Auto — the default minimal trust level)
// ---------------------------------------------------------------------------
const POLICY_TIER = 'Auto';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n[openai-demo] Starting Portarium policy proxy...');
  const { url: proxyUrl, close: closeProxy } = await startPolicyProxy(9999);

  try {
    const client = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

    console.log('[openai-demo] Sending task to GPT-4o...\n');

    /** @type {import('openai').OpenAI.Chat.ChatCompletionMessageParam[]} */
    const messages = [
      {
        role: 'system',
        content:
          'You are a task runner. Execute the requested steps using the available tools. ' +
          'Report exactly what you could and could not do.',
      },
      {
        role: 'user',
        content:
          'Please do the following in order:\n' +
          '1. Read the project README (path: "README.md")\n' +
          '2. Search for "policy enforcement" in documents\n' +
          '3. Write a summary to "output.txt"\n' +
          '4. Run the shell command "git log --oneline -5"\n' +
          'Report what succeeded and what was blocked.',
      },
    ];

    let rounds = 0;
    const MAX_ROUNDS = 8;

    while (rounds < MAX_ROUNDS) {
      rounds++;

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        tools: TOOLS,
        tool_choice: 'auto',
        messages,
      });

      const choice = response.choices[0];
      if (!choice) break;

      messages.push(choice.message);

      if (choice.finish_reason === 'stop') {
        console.log('\n[openai-demo] Agent final response:');
        console.log(choice.message.content ?? '(no text)');
        break;
      }

      if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls) {
        break;
      }

      // Process each tool call through the Portarium policy proxy
      for (const toolCall of choice.message.tool_calls) {
        const agentToolName = toolCall.function.name;
        const portariumToolName = TOOL_NAME_MAP[agentToolName] ?? agentToolName;
        let params = {};
        try {
          params = JSON.parse(toolCall.function.arguments);
        } catch {
          /* ignore */
        }

        console.log(`[openai-demo] Tool call: ${agentToolName} → Portarium: ${portariumToolName}`);

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
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(policyResult.output ?? { status: 'executed' }),
          });
        } else {
          console.log(`  ❌ BLOCKED — ${portariumToolName} — ${policyResult.message}`);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content:
              `BLOCKED by Portarium policy: ${policyResult.message}. ` +
              `Tool "${portariumToolName}" requires tier "${policyResult.minimumTier}" but current tier is "${POLICY_TIER}".`,
          });
        }
      }
    }

    if (rounds >= MAX_ROUNDS) {
      console.log('[openai-demo] Reached max rounds, stopping.');
    }

    console.log('\n[openai-demo] Demo complete.\n');
  } finally {
    closeProxy();
  }
}

main().catch((err) => {
  console.error('[openai-demo] Fatal error:', err);
  process.exit(1);
});
