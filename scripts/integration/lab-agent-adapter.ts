/**
 * LLM agent adapter -- provider-agnostic wrapper for Claude, OpenAI, and Gemini.
 *
 * Extracts the shared logic from the demo scripts: POST to proxy, handle 202,
 * retry with approvalId. Used by scenario-live-approval-lifecycle.test.ts and
 * the manual lab script.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentToolResult {
  toolCallId: string;
  content: string;
}

export interface AgentTurnResult {
  stopReason: 'end_turn' | 'tool_use' | 'unknown';
  textOutputs: string[];
  toolCalls: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }[];
}

export interface LLMAdapter {
  readonly provider: 'claude' | 'openai' | 'gemini' | 'openrouter';
  readonly envKey: string;
  isAvailable(): Promise<boolean>;
  startConversation(systemPrompt: string, userPrompt: string): Promise<AgentTurnResult>;
  sendToolResults(results: AgentToolResult[]): Promise<AgentTurnResult>;
}

export interface ToolInteraction {
  toolName: string;
  proxyStatus: number;
  approved: boolean;
  approvedByHuman: boolean;
  approvalId?: string;
  output?: unknown;
}

export interface AgentLoopTrace {
  provider: string;
  rounds: number;
  toolInteractions: ToolInteraction[];
  textOutputs: string[];
}

// ---------------------------------------------------------------------------
// Tool name mapping (agent names -> Portarium names)
// ---------------------------------------------------------------------------

const TOOL_NAME_MAP: Record<string, string> = {
  read_file: 'read:file',
  search_documents: 'search:documents',
  write_file: 'write:file',
  run_shell_command: 'shell.exec',
  web_search: 'web-search',
  scrape_website: 'scrape-website',
};

// ---------------------------------------------------------------------------
// Shared agent loop
// ---------------------------------------------------------------------------

export interface RunAgentLoopOpts {
  adapter: LLMAdapter;
  proxyUrl: string;
  systemPrompt: string;
  userPrompt: string;
  policyTier?: string;
  maxRounds?: number;
  onApprovalRequired?: (approvalId: string, toolName: string) => Promise<{ approved: boolean }>;
  /**
   * Maximum milliseconds to wait for an approval decision when polling.
   * Default: Infinity — poll forever until a decision is made.
   * Set to a finite number (e.g. 60_000) for time-bounded polling.
   */
  waitTimeout?: number;
}

export async function runAgentLoop(opts: RunAgentLoopOpts): Promise<AgentLoopTrace> {
  const {
    adapter,
    proxyUrl,
    systemPrompt,
    userPrompt,
    policyTier = 'Auto',
    maxRounds = 8,
    waitTimeout = Infinity,
  } = opts;

  const trace: AgentLoopTrace = {
    provider: adapter.provider,
    rounds: 0,
    toolInteractions: [],
    textOutputs: [],
  };

  let turn = await adapter.startConversation(systemPrompt, userPrompt);
  trace.textOutputs.push(...turn.textOutputs);

  for (let round = 0; round < maxRounds; round++) {
    trace.rounds = round + 1;

    if (turn.stopReason === 'end_turn' || turn.toolCalls.length === 0) {
      break;
    }

    const toolResults: AgentToolResult[] = [];

    for (const toolCall of turn.toolCalls) {
      const portariumToolName = TOOL_NAME_MAP[toolCall.name] ?? toolCall.name;

      // POST to proxy
      const resp = await fetch(`${proxyUrl}/tools/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: portariumToolName,
          parameters: toolCall.arguments,
          policyTier,
        }),
      });

      let result = (await resp.json()) as Record<string, unknown>;
      const interaction: ToolInteraction = {
        toolName: portariumToolName,
        proxyStatus: resp.status,
        approved: false,
        approvedByHuman: false,
      };

      // Handle 202 awaiting_approval
      if (result['status'] === 'awaiting_approval') {
        const approvalId = result['approvalId'] as string;
        interaction.approvalId = approvalId;

        // If caller provides an approval handler, use it; otherwise poll
        if (opts.onApprovalRequired) {
          const decision = await opts.onApprovalRequired(approvalId, portariumToolName);
          if (!decision.approved) {
            interaction.approved = false;
            toolResults.push({
              toolCallId: toolCall.id,
              content: `BLOCKED by Portarium policy: Tool "${portariumToolName}" was denied.`,
            });
            trace.toolInteractions.push(interaction);
            continue;
          }
        } else {
          // Poll until decided (configurable timeout; default: Infinity)
          const deadline = waitTimeout === Infinity ? Infinity : Date.now() + waitTimeout;
          while (deadline === Infinity || Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 200));
            const pollResp = await fetch(`${proxyUrl}/approvals/${approvalId}`);
            const pollData = (await pollResp.json()) as Record<string, unknown>;
            if (pollData['status'] === 'approved' || pollData['status'] === 'denied') {
              if (pollData['status'] === 'denied') {
                interaction.approved = false;
                toolResults.push({
                  toolCallId: toolCall.id,
                  content: `BLOCKED by Portarium policy: Tool "${portariumToolName}" was denied.`,
                });
                trace.toolInteractions.push(interaction);
                continue;
              }
              break;
            }
          }
        }

        // Re-invoke with approvalId
        const retryResp = await fetch(`${proxyUrl}/tools/invoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolName: portariumToolName,
            parameters: toolCall.arguments,
            policyTier,
            approvalId,
          }),
        });
        result = (await retryResp.json()) as Record<string, unknown>;
        interaction.proxyStatus = retryResp.status;
      }

      if (result['allowed']) {
        interaction.approved = true;
        interaction.approvedByHuman = (result['approvedByHuman'] as boolean) ?? false;
        interaction.output = result['output'];
        toolResults.push({
          toolCallId: toolCall.id,
          content: JSON.stringify(result['output'] ?? { status: 'executed' }),
        });
      } else {
        interaction.approved = false;
        toolResults.push({
          toolCallId: toolCall.id,
          content: `BLOCKED by Portarium policy: ${result['message'] ?? 'denied'}`,
        });
      }

      trace.toolInteractions.push(interaction);
    }

    if (toolResults.length === 0) break;

    turn = await adapter.sendToolResults(toolResults);
    trace.textOutputs.push(...turn.textOutputs);
  }

  return trace;
}

// ---------------------------------------------------------------------------
// Claude adapter
// ---------------------------------------------------------------------------

export async function createClaudeAdapter(): Promise<LLMAdapter | null> {
  if (!process.env['ANTHROPIC_API_KEY']) return null;

  let Anthropic: any;
  try {
    // @ts-expect-error -- optional SDK, may not be installed
    const mod = await import('@anthropic-ai/sdk');
    Anthropic = mod.default ?? mod.Anthropic;
  } catch {
    return null;
  }

  const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });

  const tools = [
    {
      name: 'read_file',
      description: 'Read the contents of a file',
      input_schema: {
        type: 'object' as const,
        properties: { path: { type: 'string', description: 'File path to read' } },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Write content to a file',
      input_schema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: 'Destination file path' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'search_documents',
      description: 'Search documents for a keyword',
      input_schema: {
        type: 'object' as const,
        properties: { query: { type: 'string', description: 'Search query' } },
        required: ['query'],
      },
    },
    {
      name: 'run_shell_command',
      description: 'Execute a shell command on the host',
      input_schema: {
        type: 'object' as const,
        properties: { command: { type: 'string', description: 'Shell command to run' } },
        required: ['command'],
      },
    },
  ];

  let systemPrompt = '';
  const messages: any[] = [];

  const adapter: LLMAdapter = {
    provider: 'claude',
    envKey: 'ANTHROPIC_API_KEY',

    async isAvailable() {
      return !!process.env['ANTHROPIC_API_KEY'];
    },

    async startConversation(system: string, user: string) {
      systemPrompt = system;
      messages.length = 0;
      messages.push({ role: 'user', content: user });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });
      return parseClaudeResponse(response);
    },

    async sendToolResults(results: AgentToolResult[]) {
      const toolResults = results.map((r) => ({
        type: 'tool_result' as const,
        tool_use_id: r.toolCallId,
        content: r.content,
      }));
      messages.push({ role: 'user', content: toolResults });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });
      return parseClaudeResponse(response);
    },
  };

  return adapter;
}

function parseClaudeResponse(response: any): AgentTurnResult {
  const textOutputs: string[] = [];
  const toolCalls: AgentTurnResult['toolCalls'] = [];

  for (const block of response.content) {
    if (block.type === 'text' && block.text?.trim()) {
      textOutputs.push(block.text);
    }
    if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: block.input ?? {},
      });
    }
  }

  const stopReason =
    response.stop_reason === 'end_turn'
      ? 'end_turn'
      : response.stop_reason === 'tool_use'
        ? 'tool_use'
        : 'unknown';

  return { stopReason, textOutputs, toolCalls };
}

// ---------------------------------------------------------------------------
// OpenAI adapter
// ---------------------------------------------------------------------------

export async function createOpenAIAdapter(): Promise<LLMAdapter | null> {
  if (!process.env['OPENAI_API_KEY']) return null;

  let OpenAI: any;
  try {
    const mod = await import('openai');
    OpenAI = mod.default;
  } catch {
    return null;
  }

  const client = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  const tools = [
    {
      type: 'function' as const,
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
      type: 'function' as const,
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
      type: 'function' as const,
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
      type: 'function' as const,
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

  const messages: any[] = [];

  const adapter: LLMAdapter = {
    provider: 'openai',
    envKey: 'OPENAI_API_KEY',

    async isAvailable() {
      return !!process.env['OPENAI_API_KEY'];
    },

    async startConversation(system: string, user: string) {
      messages.length = 0;
      messages.push({ role: 'system', content: system });
      messages.push({ role: 'user', content: user });

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        tools,
        tool_choice: 'auto',
        messages,
      });

      const choice = response.choices[0];
      if (choice) messages.push(choice.message);
      return parseOpenAIResponse(choice);
    },

    async sendToolResults(results: AgentToolResult[]) {
      for (const r of results) {
        messages.push({ role: 'tool', tool_call_id: r.toolCallId, content: r.content });
      }

      const response = await client.chat.completions.create({
        model: 'gpt-4o',
        tools,
        tool_choice: 'auto',
        messages,
      });

      const choice = response.choices[0];
      if (choice) messages.push(choice.message);
      return parseOpenAIResponse(choice);
    },
  };

  return adapter;
}

// ---------------------------------------------------------------------------
// OpenRouter adapter
// ---------------------------------------------------------------------------

export async function createOpenRouterAdapter(): Promise<LLMAdapter | null> {
  if (!process.env['OPENROUTER_API_KEY']) return null;

  let OpenAI: any;
  try {
    const mod = await import('openai');
    OpenAI = mod.default;
  } catch {
    return null;
  }

  const client = new OpenAI({
    apiKey: process.env['OPENROUTER_API_KEY'],
    baseURL: process.env['OPENROUTER_BASE_URL'] ?? 'https://openrouter.ai/api/v1',
  });

  const tools = [
    {
      type: 'function' as const,
      function: {
        name: 'web_search',
        description: 'Search the public web for Growth Studio prospect research.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            maxResults: { type: 'number', description: 'Maximum search results' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'scrape_website',
        description: 'Extract citation text from a public prospect website.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Public source URL' },
          },
          required: ['url'],
        },
      },
    },
  ];

  const messages: any[] = [];
  const model = process.env['OPENROUTER_MODEL'] ?? 'openai/gpt-4o';

  const adapter: LLMAdapter = {
    provider: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',

    async isAvailable() {
      return !!process.env['OPENROUTER_API_KEY'];
    },

    async startConversation(system: string, user: string) {
      messages.length = 0;
      messages.push({ role: 'system', content: system });
      messages.push({ role: 'user', content: user });

      const response = await client.chat.completions.create({
        model,
        tools,
        tool_choice: 'auto',
        messages,
      });

      const choice = response.choices[0];
      if (choice) messages.push(choice.message);
      return parseOpenAIResponse(choice);
    },

    async sendToolResults(results: AgentToolResult[]) {
      for (const r of results) {
        messages.push({ role: 'tool', tool_call_id: r.toolCallId, content: r.content });
      }

      const response = await client.chat.completions.create({
        model,
        tools,
        tool_choice: 'auto',
        messages,
      });

      const choice = response.choices[0];
      if (choice) messages.push(choice.message);
      return parseOpenAIResponse(choice);
    },
  };

  return adapter;
}

function parseOpenAIResponse(choice: any): AgentTurnResult {
  if (!choice) return { stopReason: 'end_turn', textOutputs: [], toolCalls: [] };

  const textOutputs: string[] = [];
  const toolCalls: AgentTurnResult['toolCalls'] = [];

  if (choice.message?.content?.trim()) {
    textOutputs.push(choice.message.content);
  }

  if (choice.message?.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      let args = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        /* ignore */
      }
      toolCalls.push({ id: tc.id, name: tc.function.name, arguments: args });
    }
  }

  const stopReason =
    choice.finish_reason === 'stop'
      ? 'end_turn'
      : choice.finish_reason === 'tool_calls'
        ? 'tool_use'
        : 'unknown';

  return { stopReason, textOutputs, toolCalls };
}

// ---------------------------------------------------------------------------
// Gemini adapter
// ---------------------------------------------------------------------------

export async function createGeminiAdapter(): Promise<LLMAdapter | null> {
  if (!process.env['GOOGLE_VERTEX_API_KEY']) return null;

  let GoogleGenerativeAI: any;
  try {
    const mod = await import('@google/generative-ai');
    GoogleGenerativeAI = mod.GoogleGenerativeAI;
  } catch {
    return null;
  }

  const genAI = new GoogleGenerativeAI(process.env['GOOGLE_VERTEX_API_KEY']);

  const functionDeclarations = [
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
      name: 'run_shell_command',
      description: 'Execute a shell command on the host',
      parameters: {
        type: 'OBJECT',
        properties: { command: { type: 'STRING', description: 'Shell command to run' } },
        required: ['command'],
      },
    },
  ];

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [{ functionDeclarations }],
  });

  let chat: any = null;

  const adapter: LLMAdapter = {
    provider: 'gemini',
    envKey: 'GOOGLE_VERTEX_API_KEY',

    async isAvailable() {
      return !!process.env['GOOGLE_VERTEX_API_KEY'];
    },

    async startConversation(_system: string, user: string) {
      chat = model.startChat({ history: [] });
      const response = await chat.sendMessage(user);
      return parseGeminiResponse(response);
    },

    async sendToolResults(results: AgentToolResult[]) {
      const functionResponses = results.map((r) => {
        let responseData: unknown;
        try {
          responseData = JSON.parse(r.content);
        } catch {
          responseData = { text: r.content };
        }
        return {
          functionResponse: {
            name: r.toolCallId, // For Gemini, toolCallId carries the function name
            response: responseData,
          },
        };
      });
      const response = await chat.sendMessage(functionResponses);
      return parseGeminiResponse(response);
    },
  };

  return adapter;
}

function parseGeminiResponse(response: any): AgentTurnResult {
  const textOutputs: string[] = [];
  const toolCalls: AgentTurnResult['toolCalls'] = [];

  const candidate = response.response?.candidates?.[0];
  if (!candidate) return { stopReason: 'end_turn', textOutputs, toolCalls };

  for (const part of candidate.content.parts) {
    if (part.text?.trim()) {
      textOutputs.push(part.text);
    }
    if (part.functionCall) {
      toolCalls.push({
        id: part.functionCall.name, // Gemini uses function name as ID
        name: part.functionCall.name,
        arguments: part.functionCall.args ?? {},
      });
    }
  }

  const stopReason = toolCalls.length > 0 ? 'tool_use' : 'end_turn';
  return { stopReason, textOutputs, toolCalls };
}
