import { describe, expect, it, vi } from 'vitest';

import {
  ActionId,
  CorrelationId,
  MachineId,
  RunId,
  TenantId,
} from '../../domain/primitives/index.js';
import type { ActionDispatchInput } from '../../application/ports/action-runner.js';
import type { MachineInvokerPort } from '../../application/ports/machine-invoker.js';
import { MachineInvokerActionRunner } from './machine-invoker-action-runner.js';

function makeInput(): ActionDispatchInput {
  return {
    actionId: ActionId('act-1'),
    tenantId: TenantId('t-1'),
    runId: RunId('run-1'),
    correlationId: CorrelationId('corr-1'),
    flowRef: 'delete-file',
    payload: { path: '/tmp/foo' },
  };
}

function makeInvoker(overrides?: Partial<MachineInvokerPort>): MachineInvokerPort {
  return {
    runAgent: vi.fn(async () => ({ ok: true as const, output: {} })),
    invokeTool: vi.fn(async () => ({ ok: true as const, output: { result: 'done' } })),
    ...overrides,
  };
}

describe('MachineInvokerActionRunner', () => {
  const machineId = MachineId('mach-1');

  it('delegates to invokeTool and maps success', async () => {
    const invoker = makeInvoker();
    const runner = new MachineInvokerActionRunner({ machineInvoker: invoker, machineId });

    const result = await runner.dispatchAction(makeInput());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.output).toEqual({ result: 'done' });
    expect(invoker.invokeTool).toHaveBeenCalledTimes(1);
  });

  it('passes flowRef as toolName and payload as parameters', async () => {
    const invoker = makeInvoker();
    const runner = new MachineInvokerActionRunner({ machineInvoker: invoker, machineId });

    await runner.dispatchAction(makeInput());

    expect(invoker.invokeTool).toHaveBeenCalledWith(
      expect.objectContaining({
        machineId,
        toolName: 'delete-file',
        parameters: { path: '/tmp/foo' },
        actionId: ActionId('act-1'),
        tenantId: TenantId('t-1'),
        runId: RunId('run-1'),
        correlationId: CorrelationId('corr-1'),
      }),
    );
  });

  it('passes policyTier when configured', async () => {
    const invoker = makeInvoker();
    const runner = new MachineInvokerActionRunner({
      machineInvoker: invoker,
      machineId,
      policyTier: 'HumanApprove',
    });

    await runner.dispatchAction(makeInput());

    expect(invoker.invokeTool).toHaveBeenCalledWith(
      expect.objectContaining({ policyTier: 'HumanApprove' }),
    );
  });

  it('omits policyTier when not configured', async () => {
    const invoker = makeInvoker();
    const runner = new MachineInvokerActionRunner({ machineInvoker: invoker, machineId });

    await runner.dispatchAction(makeInput());

    const callArgs = (invoker.invokeTool as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(callArgs).toBeDefined();
    expect('policyTier' in (callArgs ?? {})).toBe(false);
  });

  it('maps Timeout error kind', async () => {
    const invoker = makeInvoker({
      invokeTool: vi.fn(async () => ({
        ok: false as const,
        errorKind: 'Timeout' as const,
        message: 'Request timed out.',
      })),
    });
    const runner = new MachineInvokerActionRunner({ machineInvoker: invoker, machineId });

    const result = await runner.dispatchAction(makeInput());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.errorKind).toBe('Timeout');
    expect(result.message).toBe('Request timed out.');
  });

  it('maps Unauthorized error kind', async () => {
    const invoker = makeInvoker({
      invokeTool: vi.fn(async () => ({
        ok: false as const,
        errorKind: 'Unauthorized' as const,
        message: 'Not authorized.',
      })),
    });
    const runner = new MachineInvokerActionRunner({ machineInvoker: invoker, machineId });

    const result = await runner.dispatchAction(makeInput());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.errorKind).toBe('Unauthorized');
  });

  it('maps RateLimited error kind', async () => {
    const invoker = makeInvoker({
      invokeTool: vi.fn(async () => ({
        ok: false as const,
        errorKind: 'RateLimited' as const,
        message: 'Too many requests.',
      })),
    });
    const runner = new MachineInvokerActionRunner({ machineInvoker: invoker, machineId });

    const result = await runner.dispatchAction(makeInput());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.errorKind).toBe('RateLimited');
  });

  it('maps PolicyDenied to RemoteError', async () => {
    const invoker = makeInvoker({
      invokeTool: vi.fn(async () => ({
        ok: false as const,
        errorKind: 'PolicyDenied' as const,
        message: 'Policy blocked tool.',
      })),
    });
    const runner = new MachineInvokerActionRunner({ machineInvoker: invoker, machineId });

    const result = await runner.dispatchAction(makeInput());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.errorKind).toBe('RemoteError');
  });

  it('maps RemoteError to RemoteError', async () => {
    const invoker = makeInvoker({
      invokeTool: vi.fn(async () => ({
        ok: false as const,
        errorKind: 'RemoteError' as const,
        message: 'Gateway failed.',
      })),
    });
    const runner = new MachineInvokerActionRunner({ machineInvoker: invoker, machineId });

    const result = await runner.dispatchAction(makeInput());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.errorKind).toBe('RemoteError');
    expect(result.message).toBe('Gateway failed.');
  });

  it('does not call runAgent', async () => {
    const invoker = makeInvoker();
    const runner = new MachineInvokerActionRunner({ machineInvoker: invoker, machineId });

    await runner.dispatchAction(makeInput());

    expect(invoker.runAgent).not.toHaveBeenCalled();
  });
});
