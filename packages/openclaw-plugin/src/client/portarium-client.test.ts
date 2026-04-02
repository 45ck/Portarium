import { describe, it, expect } from 'vitest';
import { PortariumClient } from './portarium-client.js';
import { resolveConfig } from '../config.js';

function makeConfig(overrides?: Record<string, unknown>) {
  return resolveConfig({
    portariumUrl: 'https://portarium.test',
    workspaceId: 'ws-test',
    bearerToken: 'tok-test',
    ...overrides,
  });
}

function mockFetch(
  response: unknown,
  status = 200,
  contentType = 'application/json',
): typeof fetch {
  return (async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name === 'content-type' ? contentType : null) },
    json: async () => response,
  })) as unknown as typeof fetch;
}

describe('PortariumClient', () => {
  describe('proposeAction', () => {
    it('returns allowed when decision is Allow', async () => {
      const client = new PortariumClient(makeConfig(), mockFetch({ decision: 'Allow' }));
      const result = await client.proposeAction({
        toolName: 'read_file',
        parameters: { path: '/tmp/x' },
        sessionKey: 'sess-1',
      });
      expect(result).toEqual({ status: 'allowed' });
    });

    it('returns denied when decision is Denied', async () => {
      const client = new PortariumClient(
        makeConfig(),
        mockFetch({ decision: 'Denied', message: 'Policy forbids this' }),
      );
      const result = await client.proposeAction({
        toolName: 'bash',
        parameters: {},
        sessionKey: 'sess-1',
      });
      expect(result).toEqual({ status: 'denied', reason: 'Policy forbids this' });
    });

    it('returns awaiting_approval when decision is NeedsApproval', async () => {
      const client = new PortariumClient(
        makeConfig(),
        mockFetch({
          decision: 'NeedsApproval',
          approvalId: 'appr-1',
          proposalId: 'prop-1',
        }),
      );
      const result = await client.proposeAction({
        toolName: 'bash',
        parameters: { command: 'rm -rf /' },
        sessionKey: 'sess-1',
      });
      expect(result).toEqual({
        status: 'awaiting_approval',
        approvalId: 'appr-1',
        actionId: 'prop-1',
      });
    });

    it('returns error when NeedsApproval has no approvalId', async () => {
      const client = new PortariumClient(makeConfig(), mockFetch({ decision: 'NeedsApproval' }));
      const result = await client.proposeAction({
        toolName: 'bash',
        parameters: {},
        sessionKey: 'sess-1',
      });
      expect(result.status).toBe('error');
    });

    it('returns denied on HTTP 409', async () => {
      const client = new PortariumClient(makeConfig(), mockFetch({}, 409));
      const result = await client.proposeAction({
        toolName: 'bash',
        parameters: {},
        sessionKey: 'sess-1',
      });
      expect(result).toEqual({ status: 'denied', reason: 'Policy denied by control plane (409)' });
    });

    it('returns error on HTTP 401', async () => {
      const client = new PortariumClient(makeConfig(), mockFetch({}, 401));
      const result = await client.proposeAction({
        toolName: 'bash',
        parameters: {},
        sessionKey: 'sess-1',
      });
      expect(result).toEqual({
        status: 'error',
        reason: 'Unauthorized — check bearerToken config',
      });
    });

    it('returns error on HTTP 500', async () => {
      const client = new PortariumClient(makeConfig(), mockFetch({}, 500));
      const result = await client.proposeAction({
        toolName: 'bash',
        parameters: {},
        sessionKey: 'sess-1',
      });
      expect(result).toEqual({ status: 'error', reason: 'Control plane returned HTTP 500' });
    });

    it('returns error when response content-type is not application/json', async () => {
      const client = new PortariumClient(
        makeConfig(),
        mockFetch('<html>Login</html>', 200, 'text/html'),
      );
      const result = await client.proposeAction({
        toolName: 'bash',
        parameters: {},
        sessionKey: 'sess-1',
      });
      expect(result).toMatchObject({ status: 'error' });
      expect((result as { reason: string }).reason).toContain('text/html');
    });

    it('returns error on network failure', async () => {
      const failFetch = (() => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch;
      const client = new PortariumClient(makeConfig(), failFetch);
      const result = await client.proposeAction({
        toolName: 'bash',
        parameters: {},
        sessionKey: 'sess-1',
      });
      expect(result).toEqual({ status: 'error', reason: 'ECONNREFUSED' });
    });

    it('sends correct headers', async () => {
      let capturedHeaders: Record<string, string> = {};
      const spyFetch = (async (_url: string, init: RequestInit) => {
        capturedHeaders = init.headers as Record<string, string>;
        return { ok: true, status: 200, json: async () => ({ decision: 'Allow' }) };
      }) as unknown as typeof fetch;

      const client = new PortariumClient(makeConfig(), spyFetch);
      await client.proposeAction({
        toolName: 'read',
        parameters: {},
        sessionKey: 'sess-1',
      });

      expect(capturedHeaders['content-type']).toBe('application/json');
      expect(capturedHeaders['authorization']).toBe('Bearer tok-test');
      expect(capturedHeaders['x-portarium-tenant-id']).toBe('default');
      expect(capturedHeaders['x-portarium-workspace-id']).toBe('ws-test');
    });

    it('sends correct body with agentId defaulting to sessionKey', async () => {
      let capturedBody: Record<string, unknown> = {};
      const spyFetch = (async (_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
        return { ok: true, status: 200, json: async () => ({ decision: 'Allow' }) };
      }) as unknown as typeof fetch;

      const client = new PortariumClient(makeConfig(), spyFetch);
      await client.proposeAction({
        toolName: 'bash',
        parameters: { cmd: 'ls' },
        sessionKey: 'sess-42',
      });

      expect(capturedBody.agentId).toBe('sess-42');
      expect(capturedBody.actionKind).toBe('tool_call');
      expect(capturedBody.toolName).toBe('bash');
      expect(capturedBody.parameters).toEqual({ cmd: 'ls' });
    });

    it('sends URL with workspace in path', async () => {
      let capturedUrl = '';
      const spyFetch = (async (url: string) => {
        capturedUrl = url;
        return { ok: true, status: 200, json: async () => ({ decision: 'Allow' }) };
      }) as unknown as typeof fetch;

      const client = new PortariumClient(makeConfig(), spyFetch);
      await client.proposeAction({
        toolName: 'read',
        parameters: {},
        sessionKey: 's',
      });

      expect(capturedUrl).toBe(
        'https://portarium.test/v1/workspaces/ws-test/agent-actions:propose',
      );
    });

    it('supports fallback status-based response (auto_allowed)', async () => {
      const client = new PortariumClient(makeConfig(), mockFetch({ status: 'auto_allowed' }));
      const result = await client.proposeAction({
        toolName: 'read',
        parameters: {},
        sessionKey: 's',
      });
      expect(result).toEqual({ status: 'allowed' });
    });

    it('supports boolean allowed response', async () => {
      const client = new PortariumClient(
        makeConfig(),
        mockFetch({ allowed: false, message: 'nope' }),
      );
      const result = await client.proposeAction({
        toolName: 'bash',
        parameters: {},
        sessionKey: 's',
      });
      expect(result).toEqual({ status: 'denied', reason: 'nope' });
    });
  });

  describe('pollApproval', () => {
    it('returns approved true', async () => {
      const client = new PortariumClient(makeConfig(), mockFetch({ status: 'approved' }));
      const result = await client.pollApproval('appr-1');
      expect(result).toEqual({ approved: true });
    });

    it('returns denied with reason', async () => {
      const client = new PortariumClient(
        makeConfig(),
        mockFetch({ status: 'denied', reason: 'Too risky' }),
      );
      const result = await client.pollApproval('appr-1');
      expect(result).toEqual({ approved: false, reason: 'Too risky' });
    });

    it('returns pending status', async () => {
      const client = new PortariumClient(makeConfig(), mockFetch({ status: 'pending' }));
      const result = await client.pollApproval('appr-1');
      expect(result).toEqual({ status: 'pending' });
    });

    it('returns expired status', async () => {
      const client = new PortariumClient(makeConfig(), mockFetch({ status: 'expired' }));
      const result = await client.pollApproval('appr-1');
      expect(result).toEqual({ status: 'expired' });
    });

    it('returns error on HTTP failure', async () => {
      const client = new PortariumClient(makeConfig(), mockFetch({}, 503));
      const result = await client.pollApproval('appr-1');
      expect(result).toEqual({ status: 'error', reason: 'HTTP 503 polling approval' });
    });

    it('returns error on network failure', async () => {
      const failFetch = (() => {
        throw new Error('timeout');
      }) as unknown as typeof fetch;
      const client = new PortariumClient(makeConfig(), failFetch);
      const result = await client.pollApproval('appr-1');
      expect(result).toEqual({ status: 'error', reason: 'timeout' });
    });

    it('sends correct URL with encoded approvalId', async () => {
      let capturedUrl = '';
      const spyFetch = (async (url: string) => {
        capturedUrl = url;
        return { ok: true, status: 200, json: async () => ({ status: 'pending' }) };
      }) as unknown as typeof fetch;

      const client = new PortariumClient(makeConfig(), spyFetch);
      await client.pollApproval('appr/special');

      expect(capturedUrl).toBe(
        'https://portarium.test/v1/workspaces/ws-test/approvals/appr%2Fspecial',
      );
    });
  });

  describe('getRunStatus', () => {
    it('returns run status on success', async () => {
      const client = new PortariumClient(
        makeConfig(),
        mockFetch({ runId: 'r-1', stage: 'active', createdAt: 'c', updatedAt: 'u' }),
      );
      const result = await client.getRunStatus('r-1');
      expect(result).toEqual({ runId: 'r-1', stage: 'active', createdAt: 'c', updatedAt: 'u' });
    });

    it('returns null on HTTP error', async () => {
      const client = new PortariumClient(makeConfig(), mockFetch({}, 404));
      expect(await client.getRunStatus('r-1')).toBeNull();
    });

    it('returns null on network error', async () => {
      const failFetch = (() => {
        throw new Error('fail');
      }) as unknown as typeof fetch;
      const client = new PortariumClient(makeConfig(), failFetch);
      expect(await client.getRunStatus('r-1')).toBeNull();
    });

    it('sends correct URL with encoded runId', async () => {
      let capturedUrl = '';
      const spyFetch = (async (url: string) => {
        capturedUrl = url;
        return { ok: true, status: 200, json: async () => ({ runId: 'r/1', stage: 'done' }) };
      }) as unknown as typeof fetch;

      const client = new PortariumClient(makeConfig(), spyFetch);
      await client.getRunStatus('r/1');
      expect(capturedUrl).toBe('https://portarium.test/v1/workspaces/ws-test/runs/r%2F1');
    });
  });

  describe('listPendingApprovals', () => {
    it('returns mapped approval summaries', async () => {
      const client = new PortariumClient(
        makeConfig(),
        mockFetch({
          items: [{ id: 'a1', toolName: 'bash', status: 'pending', createdAt: '2026-01-01' }],
        }),
      );
      const result = await client.listPendingApprovals();
      expect(result).toEqual([
        { approvalId: 'a1', toolName: 'bash', status: 'pending', createdAt: '2026-01-01' },
      ]);
    });

    it('returns empty array on HTTP error', async () => {
      const client = new PortariumClient(makeConfig(), mockFetch({}, 500));
      expect(await client.listPendingApprovals()).toEqual([]);
    });

    it('returns empty array on network failure', async () => {
      const failFetch = (() => {
        throw new Error('down');
      }) as unknown as typeof fetch;
      const client = new PortariumClient(makeConfig(), failFetch);
      expect(await client.listPendingApprovals()).toEqual([]);
    });

    it('handles response without items array', async () => {
      const client = new PortariumClient(makeConfig(), mockFetch({ data: 'unexpected' }));
      expect(await client.listPendingApprovals()).toEqual([]);
    });

    it('sends correct URL with status=pending query', async () => {
      let capturedUrl = '';
      const spyFetch = (async (url: string) => {
        capturedUrl = url;
        return { ok: true, status: 200, json: async () => ({ items: [] }) };
      }) as unknown as typeof fetch;

      const client = new PortariumClient(makeConfig(), spyFetch);
      await client.listPendingApprovals();
      expect(capturedUrl).toBe(
        'https://portarium.test/v1/workspaces/ws-test/approvals?status=pending',
      );
    });
  });

  describe('lookupCapability', () => {
    it('returns capability info on success', async () => {
      const client = new PortariumClient(
        makeConfig(),
        mockFetch({ capabilityId: 'cap-1', requiredTier: 'Auto', riskClass: 'low' }),
      );
      const result = await client.lookupCapability('read_file');
      expect(result).toEqual({ capabilityId: 'cap-1', requiredTier: 'Auto', riskClass: 'low' });
    });

    it('returns null on HTTP error', async () => {
      const client = new PortariumClient(makeConfig(), mockFetch({}, 404));
      expect(await client.lookupCapability('unknown')).toBeNull();
    });

    it('returns null on network failure', async () => {
      const failFetch = (() => {
        throw new Error('timeout');
      }) as unknown as typeof fetch;
      const client = new PortariumClient(makeConfig(), failFetch);
      expect(await client.lookupCapability('x')).toBeNull();
    });

    it('sends correct URL with encoded toolName', async () => {
      let capturedUrl = '';
      const spyFetch = (async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({ capabilityId: 'x', requiredTier: 'Auto', riskClass: 'low' }),
        };
      }) as unknown as typeof fetch;

      const client = new PortariumClient(makeConfig(), spyFetch);
      await client.lookupCapability('tool/with spaces');
      expect(capturedUrl).toBe(
        'https://portarium.test/v1/workspaces/ws-test/capabilities/tool%2Fwith%20spaces',
      );
    });
  });
});
