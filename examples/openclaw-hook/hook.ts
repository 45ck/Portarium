/**
 * OpenClaw pre-execution hook: block non-Portarium tool calls.
 *
 * This hook intercepts every tool invocation in an OpenClaw workspace and
 * checks whether the call is routed through the Portarium control plane.
 * If not, it rejects the call and returns an error instructing the agent
 * to use `client.runs.start()` instead.
 *
 * Install this hook in your OpenClaw workspace configuration:
 *
 *   hooks:
 *     pre_tool_call:
 *       - type: script
 *         path: ./hook.ts
 *
 * Environment:
 *   PORTARIUM_BASE_URL   -- Control plane URL (default: http://localhost:3100)
 *   PORTARIUM_ENFORCE    -- Set to "true" to enforce (default: "true")
 *   PORTARIUM_ALLOWLIST  -- Comma-separated tool names always allowed without routing
 */

// -- Configuration -----------------------------------------------------------

const PORTARIUM_BASE_URL = process.env['PORTARIUM_BASE_URL'] ?? 'http://localhost:3100';
const ENFORCE = (process.env['PORTARIUM_ENFORCE'] ?? 'true') === 'true';

/** Tools exempt from the routing requirement (e.g. read-only utilities). */
const ALLOWLIST: ReadonlySet<string> = new Set(
  (process.env['PORTARIUM_ALLOWLIST'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

// -- Hook types (matches OpenClaw hook contract) -----------------------------

interface ToolCallContext {
  toolName: string;
  toolArgs: Record<string, unknown>;
  workspaceId: string;
  agentId?: string;
  /** If present, the call was already routed through Portarium. */
  portariumRunId?: string;
}

interface HookResult {
  allow: boolean;
  reason?: string;
  replacement?: {
    toolName: string;
    toolArgs: Record<string, unknown>;
  };
}

// -- Hook implementation -----------------------------------------------------

export function preToolCallHook(ctx: ToolCallContext): HookResult {
  // Always allow tools on the explicit allowlist.
  if (ALLOWLIST.has(ctx.toolName)) {
    return { allow: true };
  }

  // If the call already carries a Portarium run ID, it has been routed.
  if (ctx.portariumRunId) {
    return { allow: true };
  }

  // In audit-only mode, allow but log a warning.
  if (!ENFORCE) {
    console.warn(
      `[portarium-hook] WARN: unrouted tool call "${ctx.toolName}" in workspace ${ctx.workspaceId}. ` +
        `Set PORTARIUM_ENFORCE=true to block.`,
    );
    return { allow: true, reason: 'audit-only: unrouted call permitted' };
  }

  // Block and instruct the agent to route through Portarium.
  return {
    allow: false,
    reason:
      `Tool "${ctx.toolName}" must be invoked through the Portarium control plane. ` +
      `Use client.runs.start({ workflowId, inputPayload }) instead of calling the tool directly. ` +
      `Control plane: ${PORTARIUM_BASE_URL}`,
  };
}

// -- Entrypoint (stdin/stdout protocol for OpenClaw hooks) -------------------

async function main(): Promise<void> {
  // When invoked by OpenClaw, context arrives on stdin as JSON.
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const input = Buffer.concat(chunks).toString('utf-8').trim();
  if (!input) {
    console.log(JSON.stringify({ allow: true, reason: 'no input' }));
    return;
  }
  const ctx = JSON.parse(input) as ToolCallContext;
  const result = preToolCallHook(ctx);
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error('[portarium-hook] fatal:', error);
  // Fail-open: if the hook itself crashes, allow the call.
  console.log(JSON.stringify({ allow: true, reason: 'hook-error: fail-open' }));
});
