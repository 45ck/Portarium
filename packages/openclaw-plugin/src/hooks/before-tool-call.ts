/**
 * The core governance hook.
 *
 * Registers the before_tool_call hook at priority 1000, intercepts every tool
 * call, routes it through Portarium policy evaluation, and either allows,
 * blocks, or suspends for human approval.
 *
 * Hook return semantics (OpenClaw SDK):
 *   void / {}          → allow
 *   { block: true }    → terminal block — lower-priority hooks are skipped
 *   { blockReason }    → block with human-readable reason logged by OpenClaw
 */
import type { PortariumPluginConfig } from '../config.js';
import type { PortariumClient } from '../client/portarium-client.js';
import type { ApprovalPoller } from '../services/approval-poller.js';

/** Slice of OpenClaw plugin API used by this hook. */
interface HookApi {
  on(
    event: string,
    handler: (
      event: { toolName: string; params: Record<string, unknown>; runId?: string },
      ctx: { sessionKey?: string; agentId?: string; runId?: string },
    ) => Promise<{ block?: boolean; blockReason?: string } | void>,
    opts?: { priority?: number },
  ): void;
}

export function registerBeforeToolCallHook(
  api: HookApi,
  client: PortariumClient,
  poller: ApprovalPoller,
  config: PortariumPluginConfig,
  logger: { info(msg: string): void; warn(msg: string): void; error(msg: string): void },
): void {
  api.on(
    'before_tool_call',
    async (event, ctx) => {
      const { toolName, params } = event;

      // Bypass governance for explicit Portarium introspection tools
      if (config.bypassToolNames.includes(toolName)) {
        return;
      }

      // sessionKey is provided by OpenClaw (e.g. "agent:main:main"); fall back to workspace.
      // Sanitize: strip control characters and truncate to 128 chars to prevent header injection.
      const rawKey = ctx.sessionKey ?? `portarium:${config.workspaceId}`;
      const sessionKey = rawKey.replace(/[\r\n\0]/g, '').slice(0, 128);

      logger.info(`[portarium] Governing tool call: ${toolName}`);

      const decision = await client.proposeAction({
        toolName,
        parameters: params,
        sessionKey,
        ...(ctx.runId ? { correlationId: ctx.runId } : {}),
      });

      switch (decision.status) {
        case 'allowed':
          logger.info(`[portarium] Allowed: ${toolName}`);
          return;

        case 'denied':
          logger.warn(`[portarium] Denied: ${toolName} — ${decision.reason}`);
          return {
            block: true,
            blockReason: `Portarium policy blocked tool "${toolName}": ${decision.reason}`,
          };

        case 'awaiting_approval': {
          logger.info(
            `[portarium] Awaiting approval for: ${toolName} (approvalId=${decision.approvalId})`,
          );
          const result = await poller.waitForDecision(decision.approvalId);
          if (result.approved) {
            logger.info(`[portarium] Approved by human: ${toolName}`);
            return;
          }
          logger.warn(`[portarium] Denied by human: ${toolName} — ${result.reason}`);
          return {
            block: true,
            blockReason: `Portarium approval denied for tool "${toolName}": ${result.reason}`,
          };
        }

        case 'error':
          if (config.failClosed) {
            logger.error(
              `[portarium] Governance error (fail-closed) for ${toolName}: ${decision.reason}`,
            );
            return {
              block: true,
              blockReason: `Portarium governance unavailable — failing closed. Tool "${toolName}" blocked. Reason: ${decision.reason}`,
            };
          }
          logger.warn(
            `[portarium] Governance error (fail-open) for ${toolName}: ${decision.reason} — allowing`,
          );
          return;
      }
    },
    { priority: 1000 },
  );
}
