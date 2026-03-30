import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ApprovalPoller } from './approval-poller.js';
import type { PortariumClient } from '../client/portarium-client.js';
import type { PortariumPluginConfig } from '../config.js';

function makeConfig(overrides?: Partial<PortariumPluginConfig>): PortariumPluginConfig {
  return {
    portariumUrl: 'http://portarium.test',
    workspaceId: 'ws-test',
    bearerToken: 'tok-test',
    tenantId: 'default',
    failClosed: true,
    approvalTimeoutMs: 10_000, // short timeout for tests
    pollIntervalMs: 100,
    bypassToolNames: [],
    ...overrides,
  };
}

describe('ApprovalPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('waitForDecision', () => {
    it('returns {approved: true} when poll immediately returns approved', async () => {
      const client = {
        pollApproval: vi.fn().mockResolvedValue({ approved: true }),
      } as unknown as PortariumClient;
      const poller = new ApprovalPoller(client, makeConfig());
      const result = await poller.waitForDecision('appr-001');
      expect(result).toEqual({ approved: true });
      expect(client.pollApproval).toHaveBeenCalledWith('appr-001');
    });

    it('returns {approved: false, reason} when poll returns denied', async () => {
      const client = {
        pollApproval: vi.fn().mockResolvedValue({ approved: false, reason: 'Too risky' }),
      } as unknown as PortariumClient;
      const poller = new ApprovalPoller(client, makeConfig());
      const result = await poller.waitForDecision('appr-002');
      expect(result).toEqual({ approved: false, reason: 'Too risky' });
    });

    it('returns {approved: false} with expired reason when poll returns expired', async () => {
      const client = {
        pollApproval: vi.fn().mockResolvedValue({ status: 'expired' }),
      } as unknown as PortariumClient;
      const poller = new ApprovalPoller(client, makeConfig());
      const result = await poller.waitForDecision('appr-003');
      expect(result.approved).toBe(false);
      expect((result as { approved: false; reason: string }).reason).toMatch(/expired/i);
    });

    it('polls multiple times before reaching a decision', async () => {
      const client = {
        pollApproval: vi
          .fn()
          .mockResolvedValueOnce({ status: 'pending' })
          .mockResolvedValueOnce({ status: 'pending' })
          .mockResolvedValue({ approved: true }),
      } as unknown as PortariumClient;
      const config = makeConfig({ pollIntervalMs: 50 });
      const poller = new ApprovalPoller(client, config);

      const promise = poller.waitForDecision('appr-004');
      // Advance timers to trigger the poll delays
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ approved: true });
      expect(client.pollApproval).toHaveBeenCalledTimes(3);
    });

    it('continues polling on transient errors (does not abort)', async () => {
      const client = {
        pollApproval: vi
          .fn()
          .mockResolvedValueOnce({ status: 'error', reason: 'Network blip' })
          .mockResolvedValueOnce({ status: 'error', reason: 'Still down' })
          .mockResolvedValue({ approved: true }),
      } as unknown as PortariumClient;
      const config = makeConfig({ pollIntervalMs: 50 });
      const poller = new ApprovalPoller(client, config);

      const promise = poller.waitForDecision('appr-005');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ approved: true });
      expect(client.pollApproval).toHaveBeenCalledTimes(3);
    });

    it('returns timeout result when deadline is exceeded', async () => {
      const client = {
        pollApproval: vi.fn().mockResolvedValue({ status: 'pending' }),
      } as unknown as PortariumClient;
      const config = makeConfig({ approvalTimeoutMs: 200, pollIntervalMs: 50 });
      const poller = new ApprovalPoller(client, config);

      const promise = poller.waitForDecision('appr-006');
      // Advance time past the timeout
      await vi.advanceTimersByTimeAsync(300);
      const result = await promise;

      expect(result.approved).toBe(false);
      expect((result as { approved: false; reason: string }).reason).toMatch(/timed out/i);
    });

    it('passes the correct approvalId to each poll call', async () => {
      const client = {
        pollApproval: vi
          .fn()
          .mockResolvedValueOnce({ status: 'pending' })
          .mockResolvedValue({ approved: true }),
      } as unknown as PortariumClient;
      const config = makeConfig({ pollIntervalMs: 50 });
      const poller = new ApprovalPoller(client, config);

      const promise = poller.waitForDecision('my-special-id');
      await vi.runAllTimersAsync();
      await promise;

      expect(client.pollApproval).toHaveBeenCalledWith('my-special-id');
      // Every call should have the same approvalId
      for (const call of (client.pollApproval as ReturnType<typeof vi.fn>).mock.calls) {
        expect(call[0]).toBe('my-special-id');
      }
    });
  });
});
