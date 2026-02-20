import { afterEach, describe, expect, it, vi } from 'vitest';

import { toAppContext } from './context.js';
import {
  observeCommandExecution,
  resetCommandTelemetryHooksForTest,
  setCommandTelemetryHooksForTest,
} from './command-observability.js';

describe('observeCommandExecution', () => {
  afterEach(() => {
    resetCommandTelemetryHooksForTest();
  });

  it('emits app.command span lifecycle hooks for successful results', async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    setCommandTelemetryHooksForTest({ onStart, onEnd });

    const value = await observeCommandExecution({
      commandName: 'RegisterWorkspace',
      ctx: toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['admin'],
      }),
      run: async () => 'ok',
      classifyOutcome: () => 'ok',
    });

    expect(value).toBe('ok');
    expect(onStart).toHaveBeenCalledWith(
      'app.command.RegisterWorkspace',
      expect.objectContaining({
        'app.command.name': 'RegisterWorkspace',
      }),
    );
    expect(onEnd).toHaveBeenCalledWith(
      'app.command.RegisterWorkspace',
      'ok',
      expect.any(Number),
      expect.objectContaining({
        'app.command.outcome': 'ok',
      }),
    );
  });

  it('emits exception outcome and rethrows unhandled execution errors', async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    setCommandTelemetryHooksForTest({ onStart, onEnd });

    await expect(
      observeCommandExecution({
        commandName: 'ExplodingCommand',
        ctx: toAppContext({
          tenantId: 'tenant-1',
          principalId: 'user-1',
          correlationId: 'corr-1',
          roles: ['admin'],
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        }),
        run: async () => {
          throw new Error('boom');
        },
        classifyOutcome: () => 'ok',
      }),
    ).rejects.toThrow('boom');

    expect(onStart).toHaveBeenCalledWith(
      'app.command.ExplodingCommand',
      expect.objectContaining({
        'app.command.name': 'ExplodingCommand',
        'app.command.has_traceparent': true,
      }),
    );
    expect(onEnd).toHaveBeenCalledWith(
      'app.command.ExplodingCommand',
      'exception',
      expect.any(Number),
      expect.objectContaining({
        'app.command.outcome': 'exception',
      }),
    );
  });
});
