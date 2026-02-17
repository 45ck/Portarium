import { describe, expect, it } from 'vitest';

import { CommandBus } from './bus.js';
import { ok } from '../common/result.js';
import { toAppContext } from '../common/context.js';

describe('CommandBus', () => {
  it('executes registered command handlers', async () => {
    const bus = new CommandBus();
    bus.register('RegisterWorkspace', async () => ok({ workspaceId: 'ws-1' }));

    const result = await bus.execute('RegisterWorkspace', toAppContext({
      tenantId: 'tenant-1',
      principalId: 'user-1',
      correlationId: 'corr-1',
      roles: ['admin'],
    }), undefined);

    expect(result.ok).toBe(true);
  });

  it('returns dependency failure for missing handlers', async () => {
    const bus = new CommandBus();
    const result = await bus.execute('MissingCommand', toAppContext({
      tenantId: 'tenant-1',
      principalId: 'user-1',
      correlationId: 'corr-1',
      roles: ['admin'],
    }), undefined);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected dependency failure response.');
    }
    expect(result.error.kind).toBe('DependencyFailure');
  });

  it('rejects duplicate command registration', () => {
    const bus = new CommandBus();
    bus.register('RegisterWorkspace', async () => ok({ workspaceId: 'ws-1' }));

    expect(() => {
      bus.register('RegisterWorkspace', async () => ok({ workspaceId: 'ws-2' }));
    }).toThrowError("Command handler 'RegisterWorkspace' is already registered.");
  });

  it('wraps thrown command-handler errors into dependency failure', async () => {
    const bus = new CommandBus();
    bus.register('ExplodingCommand', async () => {
      throw new Error('exploded');
    });

    const result = await bus.execute('ExplodingCommand', toAppContext({
      tenantId: 'tenant-1',
      principalId: 'user-1',
      correlationId: 'corr-1',
      roles: ['admin'],
    }), undefined);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected dependency failure response.');
    }
    expect(result.error.kind).toBe('DependencyFailure');
    expect(result.error.message).toBe('exploded');
  });
});
