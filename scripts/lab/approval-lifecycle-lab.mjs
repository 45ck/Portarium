/**
 * Approval Lifecycle Lab -- manual V&V script.
 *
 * Starts the Portarium policy proxy, runs a real LLM agent, and waits for
 * manual human approval (no auto-approver). The operator approves via the
 * browser UI, CLI, or curl.
 *
 * Usage:
 *   npm run lab:approval                     # auto-detect provider
 *   npm run lab:approval:claude              # force Claude
 *   npm run lab:approval:openai              # force OpenAI
 *   npm run lab:approval:gemini              # force Gemini
 *
 * Environment:
 *   PORTARIUM_LAB_PROVIDER=claude|openai|gemini  (override auto-detect)
 *   ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_VERTEX_API_KEY
 */

import { startPolicyProxy } from '../demo/portarium-tool-proxy.mjs';
import { handleApprovalRequired } from '../demo/portarium-approval-plugin.mjs';

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

/**
 * @typedef {'claude'|'openai'|'gemini'} ProviderName
 */

/** @type {{ name: ProviderName; envKey: string; sdkImport: string }[]} */
const PROVIDERS = [
  { name: 'claude', envKey: 'ANTHROPIC_API_KEY', sdkImport: '@anthropic-ai/sdk' },
  { name: 'openai', envKey: 'OPENAI_API_KEY', sdkImport: 'openai' },
  { name: 'gemini', envKey: 'GOOGLE_VERTEX_API_KEY', sdkImport: '@google/generative-ai' },
];

/**
 * @param {ProviderName} [forced]
 * @returns {Promise<ProviderName|null>}
 */
async function detectProvider(forced) {
  if (forced) {
    const p = PROVIDERS.find((pp) => pp.name === forced);
    if (!p) {
      console.error(`[lab] Unknown provider: ${forced}`);
      return null;
    }
    if (!process.env[p.envKey]) {
      console.error(`[lab] ${p.envKey} not set for provider ${forced}`);
      return null;
    }
    return forced;
  }

  for (const p of PROVIDERS) {
    if (process.env[p.envKey]) {
      try {
        await import(p.sdkImport);
        return p.name;
      } catch {
        // SDK not installed
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tool definitions (same across providers, using Claude format as canonical)
// ---------------------------------------------------------------------------

const TOOL_NAME_MAP = {
  read_file: 'read:file',
  search_documents: 'search:documents',
  write_file: 'write:file',
  run_shell_command: 'shell.exec',
};

const SYSTEM_PROMPT =
  'You are a task runner. Execute the requested steps using the available tools. ' +
  'Report exactly what you could and could not do.';

const USER_PROMPT =
  'Please do the following in order:\n' +
  '1. Read the project README (path: "README.md")\n' +
  '2. Search for "policy enforcement" in documents\n' +
  '3. Write a summary to "output.txt"\n' +
  '4. Run the shell command "git log --oneline -5"\n' +
  'Report what succeeded and what was blocked by policy.';

// ---------------------------------------------------------------------------
// Claude runner
// ---------------------------------------------------------------------------

async function runClaude(proxyUrl) {
  const mod = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default ?? mod.Anthropic;
  const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });

  const tools = [
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

  const messages = [{ role: 'user', content: USER_PROMPT }];
  const interactions = [];

  for (let round = 0; round < 8; round++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    for (const block of response.content) {
      if (block.type === 'text' && block.text?.trim()) {
        console.log(`\n[lab] Claude: ${block.text}`);
      }
    }

    if (response.stop_reason === 'end_turn') break;
    if (response.stop_reason !== 'tool_use') break;

    const toolResults = [];

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      const portariumName = TOOL_NAME_MAP[block.name] ?? block.name;
      const result = await invokeWithApproval(proxyUrl, portariumName, block.input ?? {});
      interactions.push(result);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: result.allowed
          ? JSON.stringify(result.output ?? { status: 'executed' })
          : `BLOCKED: ${result.message}`,
      });
    }

    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults });
    }
  }

  return interactions;
}

// ---------------------------------------------------------------------------
// OpenAI runner
// ---------------------------------------------------------------------------

async function runOpenAI(proxyUrl) {
  const mod = await import('openai');
  const OpenAI = mod.default;
  const client = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  const tools = [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read the contents of a file',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' } },
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
          properties: { query: { type: 'string' } },
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
          properties: { path: { type: 'string' }, content: { type: 'string' } },
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
          properties: { command: { type: 'string' } },
          required: ['command'],
        },
      },
    },
  ];

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: USER_PROMPT },
  ];
  const interactions = [];

  for (let round = 0; round < 8; round++) {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      tools,
      tool_choice: 'auto',
      messages,
    });
    const choice = response.choices[0];
    if (!choice) break;
    messages.push(choice.message);

    if (choice.message.content?.trim()) {
      console.log(`\n[lab] OpenAI: ${choice.message.content}`);
    }

    if (choice.finish_reason === 'stop') break;
    if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls) break;

    for (const tc of choice.message.tool_calls) {
      const portariumName = TOOL_NAME_MAP[tc.function.name] ?? tc.function.name;
      let params = {};
      try {
        params = JSON.parse(tc.function.arguments);
      } catch {
        /* ignore */
      }
      const result = await invokeWithApproval(proxyUrl, portariumName, params);
      interactions.push(result);
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result.allowed
          ? JSON.stringify(result.output ?? { status: 'executed' })
          : `BLOCKED: ${result.message}`,
      });
    }
  }

  return interactions;
}

// ---------------------------------------------------------------------------
// Gemini runner
// ---------------------------------------------------------------------------

async function runGemini(proxyUrl) {
  const mod = await import('@google/generative-ai');
  const genAI = new mod.GoogleGenerativeAI(process.env['GOOGLE_VERTEX_API_KEY']);

  const functionDeclarations = [
    {
      name: 'read_file',
      description: 'Read the contents of a file',
      parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] },
    },
    {
      name: 'search_documents',
      description: 'Search documents for a keyword',
      parameters: {
        type: 'OBJECT',
        properties: { query: { type: 'STRING' } },
        required: ['query'],
      },
    },
    {
      name: 'write_file',
      description: 'Write content to a file',
      parameters: {
        type: 'OBJECT',
        properties: { path: { type: 'STRING' }, content: { type: 'STRING' } },
        required: ['path', 'content'],
      },
    },
    {
      name: 'run_shell_command',
      description: 'Execute a shell command on the host',
      parameters: {
        type: 'OBJECT',
        properties: { command: { type: 'STRING' } },
        required: ['command'],
      },
    },
  ];

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [{ functionDeclarations }],
  });

  const chat = model.startChat({ history: [] });
  let response = await chat.sendMessage(USER_PROMPT);
  const interactions = [];

  for (let round = 0; round < 8; round++) {
    const candidate = response.response.candidates?.[0];
    if (!candidate) break;

    const functionCalls = [];
    for (const part of candidate.content.parts) {
      if (part.functionCall) functionCalls.push(part.functionCall);
      if (part.text?.trim()) console.log(`\n[lab] Gemini: ${part.text}`);
    }

    if (functionCalls.length === 0) break;

    const functionResponses = [];
    for (const fc of functionCalls) {
      const portariumName = TOOL_NAME_MAP[fc.name] ?? fc.name;
      const result = await invokeWithApproval(proxyUrl, portariumName, fc.args ?? {});
      interactions.push(result);
      functionResponses.push({
        functionResponse: {
          name: fc.name,
          response: result.allowed
            ? (result.output ?? { status: 'executed' })
            : { error: `BLOCKED: ${result.message}` },
        },
      });
    }

    response = await chat.sendMessage(functionResponses);
  }

  return interactions;
}

// ---------------------------------------------------------------------------
// Shared invoke + approval handler
// ---------------------------------------------------------------------------

async function invokeWithApproval(proxyUrl, toolName, parameters) {
  console.log(`[lab] Tool call: ${toolName}`);

  const resp = await fetch(`${proxyUrl}/tools/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolName, parameters, policyTier: 'Auto' }),
  });

  let result = /** @type {any} */ (await resp.json());

  if (result.status === 'awaiting_approval') {
    console.log(`\n[lab] Tool "${toolName}" requires approval.`);
    console.log(`[lab] To approve: visit ${proxyUrl}/approvals/ui`);
    console.log(`[lab]         or: npm run demo:approve (in another terminal)`);
    console.log(`[lab] Waiting for human decision...\n`);

    const decision = await handleApprovalRequired(result, proxyUrl);

    if (decision.approved) {
      const retryResp = await fetch(`${proxyUrl}/tools/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName,
          parameters,
          policyTier: 'Auto',
          approvalId: decision.approvalId,
        }),
      });
      result = /** @type {any} */ (await retryResp.json());
    } else {
      result = { allowed: false, message: 'Denied by human operator' };
    }
  }

  if (result.allowed) {
    const humanFlag = result.approvedByHuman ? ' (human-approved)' : '';
    console.log(`  ALLOWED -- ${toolName}${humanFlag}`);
  } else {
    console.log(`  BLOCKED -- ${toolName} -- ${result.message ?? 'denied'}`);
  }

  return { toolName, ...result };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const forced = /** @type {ProviderName|undefined} */ (process.env['PORTARIUM_LAB_PROVIDER']);
  const provider = await detectProvider(forced);

  if (!provider) {
    console.error(
      '\n[lab] No LLM provider available.\n' +
        '[lab] Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_VERTEX_API_KEY\n' +
        '[lab] And install the corresponding SDK.\n',
    );
    process.exit(1);
  }

  console.log(`\n[lab] Provider: ${provider}`);
  console.log('[lab] Starting Portarium policy proxy on port 9999...');
  const { url: proxyUrl, close: closeProxy } = await startPolicyProxy(9999);
  console.log(`[lab] Proxy ready: ${proxyUrl}`);
  console.log(`[lab] Approval UI: ${proxyUrl}/approvals/ui\n`);

  try {
    /** @type {any[]} */
    let interactions;

    if (provider === 'claude') {
      interactions = await runClaude(proxyUrl);
    } else if (provider === 'openai') {
      interactions = await runOpenAI(proxyUrl);
    } else {
      interactions = await runGemini(proxyUrl);
    }

    console.log('\n[lab] === Summary ===');
    console.log(`[lab] Provider: ${provider}`);
    console.log(`[lab] Tool interactions: ${interactions.length}`);
    for (const i of interactions) {
      const status = i.allowed ? 'ALLOWED' : 'BLOCKED';
      const human = i.approvedByHuman ? ' (human-approved)' : '';
      console.log(`[lab]   ${i.toolName}: ${status}${human}`);
    }
    console.log('[lab] Lab complete.\n');
  } finally {
    closeProxy();
  }
}

main().catch((err) => {
  console.error('[lab] Fatal error:', err);
  process.exit(1);
});
