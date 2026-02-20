import { describe, expect, it, vi } from 'vitest';

import type { ActionId, CorrelationId, RunId, TenantId } from '../../domain/primitives/index.js';
import { ActivepiecesActionExecutor } from './activepieces-action-executor.js';

const BASE_INPUT = {
  actionId: 'action-1' as ActionId,
  tenantId: 'tenant-1' as TenantId,
  runId: 'run-1' as RunId,
  correlationId: 'corr-1' as CorrelationId,
  flowRef: 'flow-onboarding-v2',
  payload: {
    invoiceId: 'inv-10',
    dryRun: true,
  },
};

describe('ActivepiecesActionExecutor', () => {
  it('dispatches action to Activepieces flow endpoint with correlation headers', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ executionId: 'exec-1' }), { status: 200 }),
    );
    const executor = new ActivepiecesActionExecutor({
      baseUrl: 'https://activepieces.example/',
      apiToken: 'api-token-1',
      fetchImpl,
    });

    const result = await executor.dispatchAction(BASE_INPUT);

    expect(result).toEqual({ ok: true, output: { executionId: 'exec-1' } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://activepieces.example/api/v1/flows/flow-onboarding-v2/run',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer api-token-1',
          tenantId: 'tenant-1',
          correlationId: 'corr-1',
          runId: 'run-1',
        }),
      }),
    );

    const requestBody = fetchImpl.mock.calls[0]?.[1]?.body;
    if (typeof requestBody !== 'string') {
      throw new Error('Expected request body to be a JSON string.');
    }
    expect(JSON.parse(requestBody)).toEqual({
      actionId: 'action-1',
      flowRef: 'flow-onboarding-v2',
      tenantId: 'tenant-1',
      runId: 'run-1',
      correlationId: 'corr-1',
      payload: {
        invoiceId: 'inv-10',
        dryRun: true,
      },
    });
  });

  it('uses absolute flowRef URL as-is', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('', { status: 200 }));
    const executor = new ActivepiecesActionExecutor({
      baseUrl: 'https://activepieces.example',
      fetchImpl,
    });

    const result = await executor.dispatchAction({
      ...BASE_INPUT,
      flowRef: 'https://hooks.activepieces.example/trigger/abc-123',
    });

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://hooks.activepieces.example/trigger/abc-123',
      expect.any(Object),
    );
  });

  it('maps 404 to FlowNotFound', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('not found', { status: 404 }));
    const executor = new ActivepiecesActionExecutor({
      baseUrl: 'https://activepieces.example',
      fetchImpl,
    });

    const result = await executor.dispatchAction(BASE_INPUT);

    expect(result).toEqual({
      ok: false,
      errorKind: 'FlowNotFound',
      message: 'Activepieces flow was not found.',
    });
  });

  it('maps 429 to RateLimited', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response('rate limited', { status: 429 }),
    );
    const executor = new ActivepiecesActionExecutor({
      baseUrl: 'https://activepieces.example',
      fetchImpl,
    });

    const result = await executor.dispatchAction(BASE_INPUT);

    expect(result).toEqual({
      ok: false,
      errorKind: 'RateLimited',
      message: 'Activepieces request was rate limited.',
    });
  });

  it('maps request aborts to Timeout', async () => {
    const fetchImpl = vi.fn<typeof fetch>((_input, init) => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
          once: true,
        });
      });
    });
    const executor = new ActivepiecesActionExecutor({
      baseUrl: 'https://activepieces.example',
      fetchImpl,
      timeoutMs: 5,
    });

    const result = await executor.dispatchAction(BASE_INPUT);

    expect(result).toEqual({
      ok: false,
      errorKind: 'Timeout',
      message: 'Activepieces request timed out.',
    });
  });
});
