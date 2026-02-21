import { describe, expect, it } from 'vitest';

import { ControlPlaneClient, ControlPlaneClientError } from './http-client.js';
import { ProblemDetailsError } from './problem-details.js';

function createErrorFetch(status: number, body: string): typeof fetch {
  return (async () =>
    ({
      ok: false,
      status,
      headers: new Headers(),
      text: async () => body,
    }) as Response) as typeof fetch;
}

function createEmptyFetch(status = 204): typeof fetch {
  return (async () =>
    ({
      ok: true,
      status,
      headers: new Headers(),
      text: async () => '',
    }) as Response) as typeof fetch;
}

function createJsonFetch(body: unknown): typeof fetch {
  return (async () =>
    ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify(body),
    }) as Response) as typeof fetch;
}

function makeClient(fetchImpl: typeof fetch, extra: object = {}): ControlPlaneClient {
  return new ControlPlaneClient({
    baseUrl: 'https://api.portarium.test',
    fetchImpl,
    ...extra,
  });
}

describe('ControlPlaneClient error response handling', () => {
  it('throws ProblemDetailsError when server returns RFC 9457 Problem Details', async () => {
    const problem = {
      type: 'https://portarium.dev/problems/approval-not-found',
      title: 'Approval Not Found',
      status: 404,
      detail: 'No approval with id appr-99 found',
      instance: '/v1/workspaces/ws/approvals/appr-99',
    };
    const client = makeClient(createErrorFetch(404, JSON.stringify(problem)));

    const error = await client.getApproval('ws', 'appr-99').catch((e) => e);
    expect(error).toBeInstanceOf(ProblemDetailsError);
    expect((error as ProblemDetailsError).status).toBe(404);
    expect((error as ProblemDetailsError).problem.type).toBe(
      'https://portarium.dev/problems/approval-not-found',
    );
    expect((error as ProblemDetailsError).problem.detail).toBe('No approval with id appr-99 found');
  });

  it('throws ControlPlaneClientError for non-Problem Details 4xx responses', async () => {
    const client = makeClient(createErrorFetch(422, 'Unprocessable Entity'));
    const error = await client.listRuns('ws').catch((e) => e);
    expect(error).toBeInstanceOf(ControlPlaneClientError);
    expect((error as ControlPlaneClientError).status).toBe(422);
    expect((error as ControlPlaneClientError).body).toBe('Unprocessable Entity');
  });

  it('throws ControlPlaneClientError for 500 server errors', async () => {
    const client = makeClient(createErrorFetch(500, 'Internal Server Error'));
    const error = await client.listApprovals('ws').catch((e) => e);
    expect(error).toBeInstanceOf(ControlPlaneClientError);
    expect((error as ControlPlaneClientError).status).toBe(500);
  });

  it('throws ControlPlaneClientError for empty 4xx body', async () => {
    const client = makeClient(createErrorFetch(403, ''));
    const error = await client.listRuns('ws').catch((e) => e);
    expect(error).toBeInstanceOf(ControlPlaneClientError);
    expect((error as ControlPlaneClientError).status).toBe(403);
    expect((error as ControlPlaneClientError).body).toBe('');
  });

  it('throws ControlPlaneClientError when response body is not valid JSON', async () => {
    const badFetch = (async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => '{{bad json',
      }) as Response) as typeof fetch;
    const client = makeClient(badFetch);

    const error = await client.listRuns('ws').catch((e) => e);
    expect(error).toBeInstanceOf(ControlPlaneClientError);
    expect((error as ControlPlaneClientError).body).toBe('Invalid JSON response');
  });
});

describe('ControlPlaneClient response parsing', () => {
  it('returns undefined for 204 No Content responses', async () => {
    const client = makeClient(createEmptyFetch(204));
    const result = await client.cancelRun('ws', 'run-1');
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty 200 body', async () => {
    const client = makeClient(createEmptyFetch(200));
    const result = await client.cancelRun('ws', 'run-1');
    expect(result).toBeUndefined();
  });

  it('returns parsed JSON with default parser', async () => {
    const payload = { items: [{ id: 'wi-1' }], nextCursor: 'next:xyz' };
    const client = makeClient(createJsonFetch(payload));
    const result = await client.listWorkItems('ws');
    expect(result).toEqual(payload);
  });
});
