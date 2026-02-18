import { describe, expect, it } from 'vitest';

import type { ActionId, CorrelationId, RunId, TenantId } from '../../domain/primitives/index.js';
import type {
  ActionDispatchErrorKind,
  ActionDispatchFailure,
  ActionDispatchResult,
  ActionDispatchSuccess,
  ActionRunnerPort,
} from './action-runner.js';

// ---------------------------------------------------------------------------
// Type-level contract fixtures
// ---------------------------------------------------------------------------

const _success: ActionDispatchSuccess = { ok: true, output: { status: 'SUCCEEDED' } };
const _successNoOutput: ActionDispatchSuccess = { ok: true };
const _failure: ActionDispatchFailure = {
  ok: false,
  errorKind: 'FlowNotFound',
  message: 'flow-abc not found',
};

const _result: ActionDispatchResult = _success;
void _result;

const _errorKinds: ActionDispatchErrorKind[] = [
  'Unauthorized',
  'RateLimited',
  'FlowNotFound',
  'Timeout',
  'RemoteError',
];
void _errorKinds;

// ---------------------------------------------------------------------------
// Structural tests
// ---------------------------------------------------------------------------

describe('ActionDispatchSuccess', () => {
  it('has ok:true', () => {
    expect(_success.ok).toBe(true);
  });

  it('carries optional output', () => {
    expect(_success.output).toEqual({ status: 'SUCCEEDED' });
    expect(_successNoOutput.output).toBeUndefined();
  });
});

describe('ActionDispatchFailure', () => {
  it('has ok:false', () => {
    expect(_failure.ok).toBe(false);
  });

  it('carries errorKind and message', () => {
    expect(_failure.errorKind).toBe('FlowNotFound');
    expect(_failure.message).toBe('flow-abc not found');
  });
});

describe('ActionDispatchResult discriminant', () => {
  it('narrows to success via ok:true', () => {
    const result: ActionDispatchResult = { ok: true };
    if (result.ok) {
      expect(result.ok).toBe(true);
    } else {
      throw new Error('should not reach');
    }
  });

  it('narrows to failure via ok:false', () => {
    const result: ActionDispatchResult = {
      ok: false,
      errorKind: 'RateLimited',
      message: 'retry after 5s',
    };
    if (!result.ok) {
      expect(result.errorKind).toBe('RateLimited');
    } else {
      throw new Error('should not reach');
    }
  });
});

describe('ActionRunnerPort stub compliance', () => {
  it('accepts a stub implementation and dispatches correctly', async () => {
    const stub: ActionRunnerPort = {
      dispatchAction(): Promise<ActionDispatchResult> {
        return Promise.resolve({ ok: true, output: { executionId: 'exec-1' } });
      },
    };

    const result = await stub.dispatchAction({
      actionId: 'action-1' as ActionId,
      tenantId: 'tenant-1' as TenantId,
      runId: 'run-1' as RunId,
      correlationId: 'corr-1' as CorrelationId,
      flowRef: 'flow-onboarding-v2',
      payload: { userId: 'u-100', plan: 'starter' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output).toEqual({ executionId: 'exec-1' });
    }
  });
});
