/**
 * The core governance hook.
 *
 * Intercepts every tool call before execution, routes it through Portarium
 * policy evaluation, and either allows, blocks, or suspends for human approval.
 */
import type { PortariumPluginConfig } from '../config.js';
import type { PortariumClient } from '../client/portarium-client.js';
import type { ApprovalPoller } from '../services/approval-poller.js';

type HookContext = {
  readonly toolName: string;
  readonly parameters?: Record<string, unknown>;
  readonly sessionKey?: string;
  reject(reason: string): void;
};

type RegisterHookFn = (spec: {
  name: string;
  priority: number;
  handler: (ctx: HookContext) => Promise<void>;
}) => void;

export function registerBeforeToolCallHook(
  registerHook: RegisterHookFn,
  client: PortariumClient,
  poller: ApprovalPoller,
  config: PortariumPluginConfig,
  logger: { info(msg: string): void; warn(msg: string): void; error(msg: string): void },
): void {
  registerHook({
    name: 'before_tool_call',
    priority: 1000, // Highest priority — runs before anything else
    handler: async (ctx: HookContext) => {
      const toolName = ctx.toolName;

      // Bypass governance for explicit Portarium introspection tools
      if (config.bypassToolNames.includes(toolName)) {
        return;
      }

      const sessionKey = ctx.sessionKey ?? `portarium:${config.workspaceId}`;

      logger.info(`[portarium] Governing tool call: ${toolName}`);

      const decision = await client.proposeAction({
        toolName,
        parameters: ctx.parameters ?? {},
        sessionKey,
      });

      switch (decision.status) {
        case 'allowed':
          logger.info(`[portarium] Allowed: ${toolName}`);
          return;

        case 'denied':
          logger.warn(`[portarium] Denied: ${toolName} — ${decision.reason}`);
          ctx.reject(`Portarium policy blocked tool "${toolName}": ${decision.reason}`);
          return;

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
          ctx.reject(`Portarium approval denied for tool "${toolName}": ${result.reason}`);
          return;
        }

        case 'error':
          if (config.failClosed) {
            logger.error(
              `[portarium] Governance error (fail-closed) for ${toolName}: ${decision.reason}`,
            );
            ctx.reject(
              `Portarium governance unavailable — failing closed. Tool "${toolName}" blocked. Reason: ${decision.reason}`,
            );
          } else {
            logger.warn(
              `[portarium] Governance error (fail-open) for ${toolName}: ${decision.reason} — allowing`,
            );
          }
          return;
      }
    },
  });
}
