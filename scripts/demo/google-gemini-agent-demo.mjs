/**
 * OpenClaw Policy Demo — Google Gemini Agent (gemini-2.0-flash)
 *
 * Requires GOOGLE_VERTEX_API_KEY environment variable.
 * The agent attempts read, write, and dangerous tools.
 * Portarium policy blocks mutations and dangerous calls at Auto tier.
 *
 * Run: npm run demo:agent:gemini
 */

import { startPolicyProxy } from './portarium-tool-proxy.mjs';
import { handleApprovalRequired } from './portarium-approval-plugin.mjs';

// ---------------------------------------------------------------------------
// SDK import (graceful failure if not installed)
// ---------------------------------------------------------------------------

let GoogleGenerativeAI;
try {
  const mod = await import('@google/generative-ai');
  GoogleGenerativeAI = mod.GoogleGenerativeAI;
} catch {
  console.error(
    '\n[gemini-demo] Missing @google/generative-ai package.\n' +
      'Install it: npm install @google/generative-ai --save-dev\n',
  );
  process.exit(1);
}

if (!process.env['GOOGLE_VERTEX_API_KEY']) {
  console.error('\n[gemini-demo] GOOGLE_VERTEX_API_KEY environment variable is not set.\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Tool definitions (presented to Gemini as functionDeclarations)
// ---------------------------------------------------------------------------

/** @type {import('@google/generative-ai').FunctionDeclaration[]} */
const FUNCTION_DECLARATIONS = [
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
    name: 'search_documents',
    description: 'Search documents for a keyword',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'Search query' } },
      required: ['query'],
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
  {
    name: 'run_shell_command',
    description: 'Execute a shell command on the host',
    parameters: {
      type: 'OBJECT',
      properties: { command: { type: 'STRING', description: 'Shell command to run' } },
      required: ['command'],
    },
  },
];

/** Maps agent tool names to Portarium tool names */
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
  console.log('\n[gemini-demo] Starting Portarium policy proxy...');
  const { url: proxyUrl, close: closeProxy } = await startPolicyProxy(9999);

  try {
    const genAI = new GoogleGenerativeAI(process.env['GOOGLE_VERTEX_API_KEY']);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
    });

    console.log('[gemini-demo] Sending task to gemini-2.0-flash...\n');

    const chat = model.startChat({
      history: [],
    });

    const taskPrompt =
      'Please do the following in order:\n' +
      '1. Read the project README (path: "README.md")\n' +
      '2. Search for "policy enforcement" in documents\n' +
      '3. Write a summary to "output.txt"\n' +
      '4. Run the shell command "git log --oneline -5"\n' +
      'Report what succeeded and what was blocked by policy.';

    let response = await chat.sendMessage(taskPrompt);
    let rounds = 0;
    const MAX_ROUNDS = 8;

    while (rounds < MAX_ROUNDS) {
      rounds++;

      const candidate = response.response.candidates?.[0];
      if (!candidate) break;

      // Collect function calls from this response
      const functionCalls = [];
      for (const part of candidate.content.parts) {
        if (part.functionCall) {
          functionCalls.push(part.functionCall);
        }
        if (part.text?.trim()) {
          console.log('\n[gemini-demo] Gemini:', part.text);
        }
      }

      // No more function calls — model is done
      if (functionCalls.length === 0) {
        break;
      }

      // Process each function call through the Portarium policy proxy
      /** @type {import('@google/generative-ai').FunctionResponsePart[]} */
      const functionResponses = [];

      for (const fc of functionCalls) {
        const agentToolName = fc.name;
        const portariumToolName = TOOL_NAME_MAP[agentToolName] ?? agentToolName;
        const params = /** @type {Record<string, unknown>} */ (fc.args ?? {});

        console.log(`[gemini-demo] Tool call: ${agentToolName} → Portarium: ${portariumToolName}`);

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

        let policyResult = /** @type {any} */ (await policyResp.json());

        // Approval-wait loop: agent pauses until human approves or denies
        if (policyResult.status === 'awaiting_approval') {
          const decision = await handleApprovalRequired(policyResult, proxyUrl);
          if (decision.approved) {
            const retryResp = await fetch(`${proxyUrl}/tools/invoke`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                toolName: portariumToolName,
                parameters: params,
                policyTier: POLICY_TIER,
                approvalId: decision.approvalId,
              }),
            });
            policyResult = /** @type {any} */ (await retryResp.json());
          } else {
            policyResult = {
              allowed: false,
              message: 'Denied by human operator',
              minimumTier: policyResult.minimumTier,
            };
          }
        }

        if (policyResult.allowed) {
          const humanFlag = policyResult.approvedByHuman ? ' (human-approved)' : '';
          console.log(`  ✅ ALLOWED — ${portariumToolName} (tier: ${POLICY_TIER})${humanFlag}`);
          functionResponses.push({
            functionResponse: {
              name: agentToolName,
              response: policyResult.output ?? { status: 'executed' },
            },
          });
        } else {
          console.log(`  ❌ BLOCKED — ${portariumToolName} — ${policyResult.message}`);
          functionResponses.push({
            functionResponse: {
              name: agentToolName,
              response: {
                error:
                  `BLOCKED by Portarium policy: ${policyResult.message}. ` +
                  `Tool "${portariumToolName}" requires tier "${policyResult.minimumTier ?? 'higher'}" ` +
                  `but current tier is "${POLICY_TIER}".`,
              },
            },
          });
        }
      }

      // Send function responses back to Gemini
      response = await chat.sendMessage(functionResponses);
    }

    if (rounds >= MAX_ROUNDS) {
      console.log('[gemini-demo] Reached max rounds, stopping.');
    }

    console.log('\n[gemini-demo] Demo complete.\n');
  } finally {
    closeProxy();
  }
}

main().catch((err) => {
  console.error('[gemini-demo] Fatal error:', err);
  process.exit(1);
});
