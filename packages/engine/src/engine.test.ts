import { describe, expect, it, vi } from 'vitest';
import { PortariumEngine } from './engine.js';
import type { ToolCall } from './types.js';

function makeCall(toolName: string, args: Record<string, unknown> = {}): ToolCall {
  return {
    callId: crypto.randomUUID(),
    toolName,
    args: args as ToolCall['args'],
  };
}

describe('PortariumEngine', () => {
  describe('default behaviour', () => {
    it('allows calls when no rules configured (default tier: auto)', async () => {
      const engine = new PortariumEngine();
      const result = await engine.validate(makeCall('get_user'));
      expect(result).toEqual({ outcome: 'allow', tier: 'auto' });
    });

    it('respects custom defaultTier', async () => {
      const engine = new PortariumEngine({ defaultTier: 'assisted' });
      const result = await engine.validate(makeCall('get_user'));
      expect(result).toEqual({ outcome: 'allow', tier: 'assisted' });
    });
  });

  describe('policy rules', () => {
    it('matches exact tool name', async () => {
      const engine = new PortariumEngine({
        rules: [{ name: 'Block delete', matchTool: 'delete_file', tier: 'human-approve' }],
      });
      const result = await engine.validate(makeCall('delete_file'));
      expect(result.outcome).toBe('require-approval');
    });

    it('matches wildcard tool pattern', async () => {
      const engine = new PortariumEngine({
        rules: [{ name: 'Block all deletes', matchTool: 'delete*', tier: 'human-approve' }],
      });
      expect((await engine.validate(makeCall('delete_file'))).outcome).toBe('require-approval');
      expect((await engine.validate(makeCall('delete_database'))).outcome).toBe('require-approval');
      expect((await engine.validate(makeCall('get_file'))).outcome).toBe('allow');
    });

    it('matches regex pattern', async () => {
      const engine = new PortariumEngine({
        rules: [
          { name: 'Block destructive', matchTool: /^(delete|drop|truncate)/, tier: 'manual-only' },
        ],
      });
      expect((await engine.validate(makeCall('delete_file'))).outcome).toBe('require-approval');
      expect((await engine.validate(makeCall('truncate_table'))).outcome).toBe('require-approval');
      expect((await engine.validate(makeCall('get_file'))).outcome).toBe('allow');
    });

    it('uses first matching rule (first-match-wins)', async () => {
      const engine = new PortariumEngine({
        rules: [
          { name: 'Auto reads', matchTool: 'get_*', tier: 'auto' },
          { name: 'Everything else assisted', tier: 'assisted' },
        ],
      });
      const read = await engine.validate(makeCall('get_user'));
      expect(read).toEqual({ outcome: 'allow', tier: 'auto' });

      const write = await engine.validate(makeCall('create_record'));
      expect(write).toEqual({ outcome: 'allow', tier: 'assisted' });
    });

    it('matches based on args predicate', async () => {
      const engine = new PortariumEngine({
        rules: [
          {
            name: 'Block high-value deletes',
            matchTool: 'delete_record',
            matchArgs: (args) => (args['amount'] as number) > 1000,
            tier: 'human-approve',
          },
        ],
      });

      const highValue = await engine.validate(makeCall('delete_record', { amount: 5000 }));
      expect(highValue.outcome).toBe('require-approval');

      const lowValue = await engine.validate(makeCall('delete_record', { amount: 50 }));
      expect(lowValue.outcome).toBe('allow');
    });

    it('requires approval for human-approve tier', async () => {
      const engine = new PortariumEngine({
        rules: [{ name: 'Approve ops', matchTool: 'risky_op', tier: 'human-approve' }],
      });
      const result = await engine.validate(makeCall('risky_op'));
      expect(result).toMatchObject({ outcome: 'require-approval', tier: 'human-approve' });
    });

    it('requires approval for manual-only tier', async () => {
      const engine = new PortariumEngine({
        rules: [{ name: 'Manual only', matchTool: 'critical_op', tier: 'manual-only' }],
      });
      const result = await engine.validate(makeCall('critical_op'));
      expect(result).toMatchObject({ outcome: 'require-approval', tier: 'manual-only' });
    });
  });

  describe('call limits', () => {
    it('blocks after limit is exceeded', async () => {
      const engine = new PortariumEngine({
        callLimits: [{ toolName: 'send_email', maxCallsPerSession: 2 }],
      });

      expect((await engine.validate(makeCall('send_email'))).outcome).toBe('allow');
      expect((await engine.validate(makeCall('send_email'))).outcome).toBe('allow');
      const blocked = await engine.validate(makeCall('send_email'));
      expect(blocked.outcome).toBe('block');
      expect((blocked as { outcome: 'block'; reason: string }).reason).toContain('limit exceeded');
    });

    it('does not affect other tools', async () => {
      const engine = new PortariumEngine({
        callLimits: [{ toolName: 'send_email', maxCallsPerSession: 1 }],
      });

      await engine.validate(makeCall('send_email'));
      await engine.validate(makeCall('send_email')); // exceeds limit

      const other = await engine.validate(makeCall('get_user'));
      expect(other.outcome).toBe('allow');
    });

    it('resets counts after resetSession()', async () => {
      const engine = new PortariumEngine({
        callLimits: [{ toolName: 'send_email', maxCallsPerSession: 1 }],
      });

      await engine.validate(makeCall('send_email'));
      const blocked = await engine.validate(makeCall('send_email'));
      expect(blocked.outcome).toBe('block');

      engine.resetSession();

      const allowed = await engine.validate(makeCall('send_email'));
      expect(allowed.outcome).toBe('allow');
    });
  });

  describe('audit hook', () => {
    it('calls audit hook on every decision', async () => {
      const onAudit = vi.fn();
      const engine = new PortariumEngine({ onAudit });

      await engine.validate(makeCall('get_user'));
      await engine.validate(makeCall('delete_record'));

      expect(onAudit).toHaveBeenCalledTimes(2);
    });

    it('passes correct event payload to audit hook', async () => {
      const onAudit = vi.fn();
      const engine = new PortariumEngine({
        rules: [{ name: 'Block delete', matchTool: 'delete_file', tier: 'human-approve' }],
        onAudit,
      });

      const call = makeCall('delete_file', { path: '/data/file.txt' });
      await engine.validate(call);

      expect(onAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          callId: call.callId,
          toolName: 'delete_file',
          args: { path: '/data/file.txt' },
          tier: 'human-approve',
          decision: expect.objectContaining({ outcome: 'require-approval' }),
          timestamp: expect.any(String),
        }),
      );
    });

    it('awaits async audit hooks', async () => {
      const events: string[] = [];
      const engine = new PortariumEngine({
        onAudit: async (event) => {
          await new Promise((r) => setTimeout(r, 1));
          events.push(event.toolName);
        },
      });

      await engine.validate(makeCall('tool_a'));
      await engine.validate(makeCall('tool_b'));

      expect(events).toEqual(['tool_a', 'tool_b']);
    });
  });
});
