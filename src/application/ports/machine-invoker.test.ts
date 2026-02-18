import { describe, expect, it } from 'vitest';

import {
  type ActionId,
  type AgentId,
  type CorrelationId,
  type MachineId,
  type RunId,
  type TenantId,
} from '../../domain/primitives/index.js';
import type {
  MachineInvokerErrorKind,
  MachineInvokerFailure,
  MachineInvokerPort,
  MachineInvokerResult,
  MachineInvokerSuccess,
} from './machine-invoker.js';

// ---------------------------------------------------------------------------
// Type-level contract tests (compile-time)
// ---------------------------------------------------------------------------

// Verify MachineInvokerSuccess has ok:true and output
const _success: MachineInvokerSuccess = { ok: true, output: { answer: 42 } };
const _failure: MachineInvokerFailure = {
  ok: false,
  errorKind: 'RemoteError',
  message: 'upstream failed',
};

// MachineInvokerResult is a discriminated union
const _result: MachineInvokerResult = _success;
void _result;

// Verify all error kinds are valid
const _errorKinds: MachineInvokerErrorKind[] = [
  'Unauthorized',
  'RateLimited',
  'PolicyDenied',
  'Timeout',
  'RemoteError',
];
void _errorKinds;

// ---------------------------------------------------------------------------
// Structural tests
// ---------------------------------------------------------------------------

describe('MachineInvokerSuccess', () => {
  it('has ok:true', () => {
    expect(_success.ok).toBe(true);
  });

  it('carries output payload', () => {
    expect(_success.output).toEqual({ answer: 42 });
  });
});

describe('MachineInvokerFailure', () => {
  it('has ok:false', () => {
    expect(_failure.ok).toBe(false);
  });

  it('carries errorKind and message', () => {
    expect(_failure.errorKind).toBe('RemoteError');
    expect(_failure.message).toBe('upstream failed');
  });
});

describe('MachineInvokerResult discriminant', () => {
  it('narrows to success via ok:true', () => {
    const result: MachineInvokerResult = { ok: true, output: 'hi' };
    if (result.ok) {
      expect(result.output).toBe('hi');
    } else {
      throw new Error('should not reach');
    }
  });

  it('narrows to failure via ok:false', () => {
    const result: MachineInvokerResult = { ok: false, errorKind: 'Timeout', message: 'timed out' };
    if (!result.ok) {
      expect(result.errorKind).toBe('Timeout');
    } else {
      throw new Error('should not reach');
    }
  });
});

describe('MachineInvokerPort stub compliance', () => {
  it('accepts a stub implementation with correct signatures', async () => {
    const stub: MachineInvokerPort = {
      runAgent(): Promise<MachineInvokerResult> {
        return Promise.resolve({ ok: true, output: null });
      },
      invokeTool(): Promise<MachineInvokerResult> {
        return Promise.resolve({ ok: false, errorKind: 'PolicyDenied', message: 'blocked' });
      },
    };

    const agentResult = await stub.runAgent({
      machineId: 'machine-1' as MachineId,
      agentId: 'agent-1' as AgentId,
      tenantId: 'tenant-1' as TenantId,
      runId: 'run-1' as RunId,
      actionId: 'action-1' as ActionId,
      correlationId: 'corr-1' as CorrelationId,
      prompt: 'hello',
    });

    expect(agentResult.ok).toBe(true);

    const toolResult = await stub.invokeTool({
      machineId: 'machine-1' as MachineId,
      toolName: 'read-file',
      parameters: { path: '/etc/hosts' },
      tenantId: 'tenant-1' as TenantId,
      runId: 'run-1' as RunId,
      actionId: 'action-2' as ActionId,
      correlationId: 'corr-1' as CorrelationId,
    });

    expect(toolResult.ok).toBe(false);
    if (!toolResult.ok) {
      expect(toolResult.errorKind).toBe('PolicyDenied');
    }
  });
});
