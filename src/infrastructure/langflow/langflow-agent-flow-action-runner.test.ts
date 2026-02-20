import { describe, expect, it, vi } from 'vitest';

import type { ActionId, CorrelationId, RunId, TenantId } from '../../domain/primitives/index.js';
import { LangflowAgentFlowActionRunner } from './langflow-agent-flow-action-runner.js';

const BASE_INPUT = {
  actionId: 'action-1' as ActionId,
  tenantId: 'tenant-1' as TenantId,
  runId: 'run-1' as RunId,
  correlationId: 'corr-1' as CorrelationId,
  flowRef: 'invoice-remediation-flow',
  payload: {
    invoiceId: 'inv-100',
    dryRun: true,
  },
};

describe('LangflowAgentFlowActionRunner', () => {
  it('dispatches action to Langflow flow endpoint with correlation headers', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ runId: 'lf-run-1' }), { status: 200 }),
    );
    const runner = new LangflowAgentFlowActionRunner({
      baseUrl: 'https://langflow.example/',
      apiKey: 'langflow-key-1',
      fetchImpl,
    });

    const result = await runner.dispatchAction(BASE_INPUT);

    expect(result).toEqual({ ok: true, output: { runId: 'lf-run-1' } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://langflow.example/v1/run/invoice-remediation-flow',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'langflow-key-1',
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
      flowRef: 'invoice-remediation-flow',
      tenantId: 'tenant-1',
      runId: 'run-1',
      correlationId: 'corr-1',
      payload: {
        invoiceId: 'inv-100',
        dryRun: true,
      },
    });
  });

  it('uses absolute flowRef URL as-is', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('', { status: 200 }));
    const runner = new LangflowAgentFlowActionRunner({
      baseUrl: 'https://langflow.example',
      fetchImpl,
    });

    const result = await runner.dispatchAction({
      ...BASE_INPUT,
      flowRef: 'https://langflow.example/v1/run/custom-flow-id',
    });

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://langflow.example/v1/run/custom-flow-id',
      expect.any(Object),
    );
  });

  it('maps 404 to FlowNotFound', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('not found', { status: 404 }));
    const runner = new LangflowAgentFlowActionRunner({
      baseUrl: 'https://langflow.example',
      fetchImpl,
    });

    const result = await runner.dispatchAction(BASE_INPUT);

    expect(result).toEqual({
      ok: false,
      errorKind: 'FlowNotFound',
      message: 'Langflow flow was not found.',
    });
  });

  it('maps timeout aborts to Timeout', async () => {
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
    const runner = new LangflowAgentFlowActionRunner({
      baseUrl: 'https://langflow.example',
      fetchImpl,
      timeoutMs: 5,
    });

    const result = await runner.dispatchAction(BASE_INPUT);

    expect(result).toEqual({
      ok: false,
      errorKind: 'Timeout',
      message: 'Langflow request timed out.',
    });
  });
});
