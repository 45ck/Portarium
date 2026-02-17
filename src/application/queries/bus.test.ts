import { describe, expect, it } from 'vitest';

import { QueryBus } from './bus.js';
import { toAppContext } from '../common/context.js';

describe('QueryBus', () => {
  it('executes registered query handlers', async () => {
    const bus = new QueryBus();
    bus.register('GetRun', async () => ({
      ok: true,
      value: { runId: 'run-1' },
    }));

    const result = await bus.execute(
      'GetRun',
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      undefined,
    );

    expect(result.ok).toBe(true);
  });

  it('returns dependency failure for missing handlers', async () => {
    const bus = new QueryBus();
    const result = await bus.execute(
      'MissingQuery',
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      undefined,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected dependency failure response.');
    }
    expect(result.error.kind).toBe('DependencyFailure');
  });

  it('rejects duplicate query registration', () => {
    const bus = new QueryBus();
    bus.register('GetRun', async () => ({
      ok: true,
      value: { runId: 'run-1' },
    }));

    expect(() => {
      bus.register('GetRun', async () => ({
        ok: true,
        value: { runId: 'run-2' },
      }));
    }).toThrowError("Query handler 'GetRun' is already registered.");
  });

  it('wraps thrown query-handler errors into dependency failure', async () => {
    const bus = new QueryBus();
    bus.register('ExplodingQuery', async () => {
      throw new Error('query exploded');
    });

    const result = await bus.execute(
      'ExplodingQuery',
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      undefined,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected dependency failure response.');
    }
    expect(result.error.kind).toBe('DependencyFailure');
    expect(result.error.message).toBe('query exploded');
  });
});
