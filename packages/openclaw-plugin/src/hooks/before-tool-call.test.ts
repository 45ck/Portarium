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
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

interface HookSpec {
  name: string;
  priority: number;
  handler: (ctx: {
    toolName: string;
    parameters?: Record<string, unknown>;
    sessionKey?: string;
    reject(reason: string): void;
  }) => Promise<void>;
}

/**
 * Calls registerBeforeToolCallHook and returns the registered handler for direct testing.
 */
function buildHook(
  client: PortariumClient,
  poller: ApprovalPoller,
  config: PortariumPluginConfig,
) {
  let capturedSpec: HookSpec | undefined;
  const registerHook = (spec: HookSpec) => {
    capturedSpec = spec;
  };
  const logger = makeLogger();
  registerBeforeToolCallHook(registerHook, client, poller, config, logger);
  if (!capturedSpec) throw new Error('Hook was not registered');
  return { handler: capturedSpec.handler, priority: capturedSpec.priority, logger };
}

function makeCtx(overrides?: {
  toolName?: string;
  parameters?: Record<string, unknown>;
  sessionKey?: string;
}) {
  const reject = vi.fn<[string], void>();
  return {
    toolName: overrides?.toolName ?? 'bash_exec',
    parameters: overrides?.parameters ?? { cmd: 'ls' },
    sessionKey: overrides?.sessionKey,
    reject,
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
      const { handler } = buildHook(client, poller, makeConfig());
      const ctx = makeCtx({ toolName: 'portarium_get_run' });
      await handler(ctx);
      expect(client.proposeAction).not.toHaveBeenCalled();
      expect(ctx.reject).not.toHaveBeenCalled();
    });

    it('governs tools not in bypassToolNames', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      const ctx = makeCtx({ toolName: 'bash_exec' });
      await handler(ctx);
      expect(client.proposeAction).toHaveBeenCalledOnce();
    });
  });

  describe('allowed decision', () => {
    it('returns without calling reject', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      const ctx = makeCtx();
      await handler(ctx);
      expect(ctx.reject).not.toHaveBeenCalled();
    });
  });

  describe('denied decision', () => {
    it('calls ctx.reject with the denial reason', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({
          status: 'denied',
          reason: 'Tool is too dangerous',
        }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      const ctx = makeCtx();
      await handler(ctx);
      expect(ctx.reject).toHaveBeenCalledOnce();
      expect(ctx.reject.mock.calls[0]![0]).toContain('Tool is too dangerous');
      expect(ctx.reject.mock.calls[0]![0]).toContain('bash_exec');
    });
  });

  describe('awaiting_approval decision', () => {
    it('calls poller and returns cleanly when human approves', async () => {
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
      const ctx = makeCtx();
      await handler(ctx);
      expect(poller.waitForDecision).toHaveBeenCalledWith('appr-123');
      expect(ctx.reject).not.toHaveBeenCalled();
    });

    it('calls ctx.reject when human denies', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({
          status: 'awaiting_approval',
          approvalId: 'appr-999',
          actionId: 'act-999',
        }),
      } as unknown as PortariumClient;
      const poller = {
        waitForDecision: vi.fn().mockResolvedValue({
          approved: false,
          reason: 'Operator denied',
        }),
      } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      const ctx = makeCtx();
      await handler(ctx);
      expect(ctx.reject).toHaveBeenCalledOnce();
      expect(ctx.reject.mock.calls[0]![0]).toContain('Operator denied');
      expect(ctx.reject.mock.calls[0]![0]).toContain('bash_exec');
    });
  });

  describe('error decision', () => {
    it('calls ctx.reject when failClosed=true', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({
          status: 'error',
          reason: 'Portarium unreachable',
        }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig({ failClosed: true }));
      const ctx = makeCtx();
      await handler(ctx);
      expect(ctx.reject).toHaveBeenCalledOnce();
      expect(ctx.reject.mock.calls[0]![0]).toContain('failing closed');
    });

    it('allows tool when failClosed=false', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({
          status: 'error',
          reason: 'Portarium unreachable',
        }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig({ failClosed: false }));
      const ctx = makeCtx();
      await handler(ctx);
      expect(ctx.reject).not.toHaveBeenCalled();
    });
  });

  describe('sessionKey handling', () => {
    it('passes ctx.sessionKey to proposeAction when present', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      const ctx = makeCtx({ sessionKey: 'agent-session-abc' });
      await handler(ctx);
      expect(client.proposeAction).toHaveBeenCalledWith(
        expect.objectContaining({ sessionKey: 'agent-session-abc' }),
      );
    });

    it('defaults sessionKey to portarium:{workspaceId} when absent', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig({ workspaceId: 'my-ws' }));
      const ctx = makeCtx({ sessionKey: undefined });
      await handler(ctx);
      expect(client.proposeAction).toHaveBeenCalledWith(
        expect.objectContaining({ sessionKey: 'portarium:my-ws' }),
      );
    });
  });

  describe('proposeAction input', () => {
    it('passes toolName and parameters to proposeAction', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      const ctx = makeCtx({ toolName: 'write_file', parameters: { path: '/tmp/x', content: 'y' } });
      await handler(ctx);
      expect(client.proposeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'write_file',
          parameters: { path: '/tmp/x', content: 'y' },
        }),
      );
    });

    it('defaults parameters to {} when ctx.parameters is undefined', async () => {
      const client = {
        proposeAction: vi.fn().mockResolvedValue({ status: 'allowed' }),
      } as unknown as PortariumClient;
      const poller = { waitForDecision: vi.fn() } as unknown as ApprovalPoller;
      const { handler } = buildHook(client, poller, makeConfig());
      const ctx = { toolName: 'no_params_tool', parameters: undefined, reject: vi.fn() };
      await handler(ctx);
      expect(client.proposeAction).toHaveBeenCalledWith(
        expect.objectContaining({ parameters: {} }),
      );
    });
  });
});
