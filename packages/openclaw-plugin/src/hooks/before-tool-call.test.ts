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
    ctx: { sessionKey?: string; runId?: string },
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

function makeCtx(overrides?: { sessionKey?: string; runId?: string }) {
  return { sessionKey: overrides?.sessionKey, runId: overrides?.runId };
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
      const { handler } = buildHook(client, poller, makeConfig());
      const result = await handler(makeEvent({ toolName: 'portarium_get_run' }), makeCtx());
      expect(client.proposeAction).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
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
