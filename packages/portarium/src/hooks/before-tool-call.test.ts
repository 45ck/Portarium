import { describe, expect, it, vi } from 'vitest';
import { registerBeforeToolCallHook } from './before-tool-call.js';
import type { PortariumClient } from '../client/portarium-client.js';
import type { ApprovalPoller } from '../services/approval-poller.js';
import type { PortariumPluginConfig } from '../config.js';

function makeConfig(overrides?: Partial<PortariumPluginConfig>): PortariumPluginConfig {
  return {
    portariumUrl: 'http://portarium.test',
    workspaceId: 'ws-test',
    bearerToken: 'tok-test',
    tenantId: 'default',
    failClosed: true,
    approvalTimeoutMs: 86_400_000,
    pollIntervalMs: 3_000,
    bypassToolNames: ['portarium_get_run', 'portarium_list_approvals'],
    defaultPolicyIds: ['default-governance'],
    defaultExecutionTier: 'HumanApprove',
    ...overrides,
  };
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/**
 * Registers the hook and returns the captured async handler + priority.
 */
function buildHook(client: PortariumClient, poller: ApprovalPoller, config: PortariumPluginConfig) {
  type HookHandler = (
    event: { toolName: string; params: Record<string, unknown>; runId?: string },
    ctx: { sessionKey?: string; agentId?: string; runId?: string },
  ) => Promise<{ block?: boolean; blockReason?: string } | void>;

  let capturedHandler: HookHandler | undefined;
  let capturedPriority: number | undefined;

  const api = {
    on(_event: string, handler: HookHandler, opts?: { priority?: number }) {
      capturedHandler = handler;
      capturedPriority = opts?.priority;
    },
  };

  const logger = makeLogger();
  registerBeforeToolCallHook(api as never, client, poller, config, logger);
  if (!capturedHandler) throw new Error('Hook was not registered');
  return { handler: capturedHandler, priority: capturedPriority, logger };
}

function makeEvent(
  overrides?: Partial<{ toolName: string; params: Record<string, unknown>; runId: string }>,
) {
  return {
    toolName: overrides?.toolName ?? 'bash_exec',
    params: overrides?.params ?? { cmd: 'ls' },
    ...(overrides?.runId ? { runId: overrides.runId } : {}),
  };
}

function makeCtx(overrides?: { sessionKey?: string; agentId?: string; runId?: string }) {
  return {
    sessionKey: overrides?.sessionKey,
    agentId: overrides?.agentId,
    runId: overrides?.runId,
  };
}

describe('registerBeforeToolCallHook', () => {
  it('registers the hook at priority 1000', () => {
    const client = { proposeAction: vi.fn() } as unknown as PortariumClient;
    const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
    const { priority } = buildHook(client, poller, makeConfig());
    expect(priority).toBe(1000);
  });

  describe('bypass tool names', () => {
    it('skips governance entirely for tools in bypassToolNames', async () => {
      const client = { proposeAction: vi.fn() } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler, logger } = buildHook(client, poller, makeConfig());
      const result = await handler(
        makeEvent({ toolName: 'portarium_get_run' }),
        makeCtx({ sessionKey: 'agent:main:main', runId: 'run-123', agentId: 'agent-1' }),
      );
      expect(client.proposeAction).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[portarium][audit] Governance bypassed'),
      );
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('portarium_get_run'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('runId=run-123'));
    });

    it('logs bypasses with event run fallback and unknown agent when ctx omits them', async () => {
      const client = { proposeAction: vi.fn() } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler, logger } = buildHook(client, poller, makeConfig());

      await handler(
        makeEvent({ toolName: 'portarium_get_run', runId: 'event-run-123' }),
        makeCtx(),
      );

      expect(client.proposeAction).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('runId=event-run-123'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('agentId=unknown'));
    });

    it('sanitizes bypass audit identity fields before logging', async () => {
      const client = { proposeAction: vi.fn() } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler, logger } = buildHook(client, poller, makeConfig());

      await handler(
        makeEvent({ toolName: 'portarium_get_run', runId: 'event-run\r\nx-evil: 1' }),
        makeCtx({
          sessionKey: 'agent:main:main',
          runId: 'ctx-run\r\nx-evil: 1',
          agentId: 'agent-1\r\nx-evil: 1',
        }),
      );

      const auditLog = vi
        .mocked(logger.info)
        .mock.calls.map(([message]) => message)
        .find((message) => message.includes('Governance bypassed'));
      expect(auditLog).toContain('runId=ctx-runx-evil: 1');
      expect(auditLog).toContain('agentId=agent-1x-evil: 1');
      expect(auditLog).not.toContain('\r');
      expect(auditLog).not.toContain('\n');
    });

    it('governs tools not in bypassToolNames', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      await handler(makeEvent({ toolName: 'bash_exec' }), makeCtx());
      expect(client.proposeAction).toHaveBeenCalledOnce();
    });

    it('does not bypass normal tools even when config is poisoned with their names', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler, logger } = buildHook(
        client,
        poller,
        makeConfig({ bypassToolNames: ['bash_exec', 'portarium_get_run'] }),
      );

      await handler(makeEvent({ toolName: 'bash_exec' }), makeCtx());

      expect(client.proposeAction).toHaveBeenCalledOnce();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Ignoring configured bypassToolNames outside the hardcoded'),
      );
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('bash_exec'));
    });

    it('sanitizes poisoned bypass tool names before audit logging', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { logger } = buildHook(
        client,
        poller,
        makeConfig({ bypassToolNames: ['bash_exec\r\nx-evil: 1', 'portarium_get_run'] }),
      );

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('bash_execx-evil: 1'));
      expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('\r\n'));
    });
  });

  describe('allowed decision', () => {
    it('returns undefined (allow) when proposeAction returns allowed', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      const result = await handler(makeEvent(), makeCtx());
      expect(result).toBeUndefined();
    });
  });

  describe('denied decision', () => {
    it('returns { block: true, blockReason } with the denial reason', async () => {
      const client = {
        proposeAction: vi
          .fn()
          .mockResolvedValue({ status: 'denied', reason: 'Tool is too dangerous' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      const result = (await handler(makeEvent(), makeCtx())) as {
        block: boolean;
        blockReason: string;
      };
      expect(result.block).toBe(true);
      expect(result.blockReason).toContain('Tool is too dangerous');
      expect(result.blockReason).toContain('bash_exec');
    });
  });

  describe('awaiting_approval decision', () => {
    it('returns undefined (allow) when human approves', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({
          status: 'awaiting_approval',
          approvalId: 'appr-123',
          actionId: 'act-456',
        }),
      } as unknown as PortariumClient;
      const poller = {
        waitForDecision: vi.fn().mockResolvedValue({ approved: true }),
      } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      const result = await handler(makeEvent(), makeCtx());
      expect(poller.waitForDecision).toHaveBeenCalledWith('appr-123');
      expect(result).toBeUndefined();
    });

    it('returns { block: true, blockReason } when human denies', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({
          status: 'awaiting_approval',
          approvalId: 'appr-999',
          actionId: 'act-999',
        }),
      } as unknown as PortariumClient;
      const poller = {
        waitForDecision: vi.fn().mockResolvedValue({ approved: false, reason: 'Operator denied' }),
      } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      const result = (await handler(makeEvent(), makeCtx())) as {
        block: boolean;
        blockReason: string;
      };
      expect(result.block).toBe(true);
      expect(result.blockReason).toContain('Operator denied');
    });
  });

  describe('error decision', () => {
    it('returns { block: true } when failClosed=true', async () => {
      const client = {
        proposeAction: vi
          .fn()
          .mockResolvedValue({ status: 'error', reason: 'Portarium unreachable' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig({ failClosed: true }));
      const result = (await handler(makeEvent(), makeCtx())) as {
        block: boolean;
        blockReason: string;
      };
      expect(result.block).toBe(true);
      expect(result.blockReason).toContain('failing closed');
    });

    it('returns undefined (allow) when failClosed=false', async () => {
      const client = {
        proposeAction: vi
          .fn()
          .mockResolvedValue({ status: 'error', reason: 'Portarium unreachable' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig({ failClosed: false }));
      const result = await handler(makeEvent(), makeCtx());
      expect(result).toBeUndefined();
    });

    it('blocks when proposeAction throws, even when failClosed=false', async () => {
      const client = {
        proposeAction: vi.fn().mockRejectedValue(new Error('client crashed')),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler, logger } = buildHook(client, poller, makeConfig({ failClosed: false }));

      const result = (await handler(makeEvent(), makeCtx())) as {
        block: boolean;
        blockReason: string;
      };

      expect(result.block).toBe(true);
      expect(result.blockReason).toContain('hook failed');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Hook failure'));
    });

    it('blocks when approval polling throws after an awaiting_approval decision', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({
          status: 'awaiting_approval',
          approvalId: 'appr-crash',
          actionId: 'act-crash',
        }),
      } as unknown as PortariumClient;
      const poller = {
        waitForDecision: vi.fn().mockRejectedValue(new Error('poller crashed')),
      } as unknown as ApprovalPoller;
      const { handler, logger } = buildHook(client, poller, makeConfig());

      const result = (await handler(makeEvent(), makeCtx())) as {
        block: boolean;
        blockReason: string;
      };

      expect(result.block).toBe(true);
      expect(result.blockReason).toContain('failing closed');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('poller crashed'));
    });
  });

  describe('sessionKey handling', () => {
    it('passes ctx.sessionKey to proposeAction when present', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      await handler(makeEvent(), makeCtx({ sessionKey: 'agent:main:main' }));
      expect(client.proposeAction).toHaveBeenCalledWith(
        expect.objectContaining({ sessionKey: 'agent:main:main' }),
      );
    });

    it('defaults sessionKey to portarium:{workspaceId} when ctx.sessionKey is absent', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig({ workspaceId: 'my-ws' }));
      await handler(makeEvent(), makeCtx());
      expect(client.proposeAction).toHaveBeenCalledWith(
        expect.objectContaining({ sessionKey: 'portarium:my-ws' }),
      );
    });

    it('blocks ctx.sessionKey containing control characters before proposing', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler, logger } = buildHook(client, poller, makeConfig());

      const result = (await handler(makeEvent(), makeCtx({ sessionKey: 'agent:\r\nmain' }))) as {
        block: boolean;
        blockReason: string;
      };

      expect(result.block).toBe(true);
      expect(result.blockReason).toContain('hook failed');
      expect(client.proposeAction).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid sessionKey'));
    });

    it('blocks ctx.sessionKey with unsupported characters before proposing', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());

      const result = (await handler(makeEvent(), makeCtx({ sessionKey: 'agent:<script>' }))) as {
        block: boolean;
      };

      expect(result.block).toBe(true);
      expect(client.proposeAction).not.toHaveBeenCalled();
    });

    it('blocks overlong ctx.sessionKey before proposing', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      const longSessionKey = `agent:${'x'.repeat(200)}`;

      const result = (await handler(makeEvent(), makeCtx({ sessionKey: longSessionKey }))) as {
        block: boolean;
      };

      expect(result.block).toBe(true);
      expect(client.proposeAction).not.toHaveBeenCalled();
    });
  });

  describe('proposeAction input', () => {
    it('forwards toolName and params to proposeAction', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      await handler(makeEvent({ toolName: 'write_file', params: { path: '/tmp/x' } }), makeCtx());
      expect(client.proposeAction).toHaveBeenCalledWith(
        expect.objectContaining({ toolName: 'write_file', parameters: { path: '/tmp/x' } }),
      );
    });

    it('forwards ctx.runId as correlationId when present', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      await handler(makeEvent(), makeCtx({ runId: 'run-xyz' }));
      expect(client.proposeAction).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: 'run-xyz' }),
      );
    });
  });
});
