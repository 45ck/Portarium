import { describe, it, expect, vi } from 'vitest';
import {
  GitHubSoftwareDevAdapter,
  type GitHubAdapterConfig,
} from './github-software-dev-adapter.js';
import type { SoftwareDevExecuteInputV1 } from '../../../application/ports/software-dev-adapter.js';
import { TenantId } from '../../../domain/primitives/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TENANT_ID = TenantId('tenant-github-test');

const DEFAULT_CONFIG: GitHubAdapterConfig = {
  owner: 'my-org',
  token: 'ghp_test_token',
  apiBaseUrl: 'https://api.github.com',
};

function makeFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeAdapter(fetchFn: any = makeFetch([])) {
  return new GitHubSoftwareDevAdapter(DEFAULT_CONFIG, fetchFn as typeof fetch);
}

function makeInput(
  operation: SoftwareDevExecuteInputV1['operation'],
  payload?: Record<string, unknown>,
): SoftwareDevExecuteInputV1 {
  return { tenantId: TENANT_ID, operation, ...(payload !== undefined ? { payload } : {}) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GitHubSoftwareDevAdapter', () => {
  describe('listPullRequests', () => {
    it('returns externalRefs for PRs', async () => {
      const prs = [
        { number: 42, title: 'Fix login bug', html_url: 'https://github.com/my-org/repo/pull/42' },
        { number: 43, title: 'Add dark mode', html_url: 'https://github.com/my-org/repo/pull/43' },
      ];
      const adapter = makeAdapter(makeFetch(prs));
      const result = await adapter.execute(makeInput('listPullRequests', { repo: 'my-repo' }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('externalRefs');
      if (result.result.kind !== 'externalRefs') return;
      expect(result.result.externalRefs).toHaveLength(2);
      expect(result.result.externalRefs[0]).toMatchObject({
        sorName: 'GitHub',
        portFamily: 'SoftwareDev',
        externalId: '42',
        externalType: 'pull_request',
        displayLabel: 'Fix login bug',
      });
    });

    it('returns validation_error when repo missing', async () => {
      const adapter = makeAdapter(makeFetch([]));
      const result = await adapter.execute(makeInput('listPullRequests'));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
    });
  });

  describe('createPullRequest', () => {
    it('creates PR and returns externalRef', async () => {
      const created = {
        number: 50,
        title: 'Feature branch',
        html_url: 'https://github.com/my-org/repo/pull/50',
      };
      const adapter = makeAdapter(makeFetch(created));

      const result = await adapter.execute(
        makeInput('createPullRequest', {
          repo: 'my-repo',
          title: 'Feature branch',
          head: 'feature/x',
          base: 'main',
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('externalRef');
      if (result.result.kind !== 'externalRef') return;
      expect(result.result.externalRef.externalId).toBe('50');
    });

    it('returns validation_error when title missing', async () => {
      const adapter = makeAdapter(makeFetch({}));
      const result = await adapter.execute(
        makeInput('createPullRequest', { repo: 'r', head: 'feature/x' }),
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
    });
  });

  describe('mergePullRequest', () => {
    it('calls PUT and returns accepted', async () => {
      const fetchFn = makeFetch({ merged: true, message: 'Pull Request successfully merged' });
      const adapter = makeAdapter(fetchFn);

      const result = await adapter.execute(
        makeInput('mergePullRequest', { repo: 'my-repo', prNumber: '42' }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('accepted');

      const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('pulls/42/merge');
      expect(init.method).toBe('PUT');
    });
  });

  describe('listDeployments', () => {
    it('returns externalRefs for deployments', async () => {
      const deployments = [
        { id: 100, environment: 'production', created_at: '2024-01-10T10:00:00Z' },
        { id: 101, environment: 'staging', created_at: '2024-01-11T10:00:00Z' },
      ];
      const adapter = makeAdapter(makeFetch(deployments));
      const result = await adapter.execute(makeInput('listDeployments', { repo: 'my-repo' }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('externalRefs');
      if (result.result.kind !== 'externalRefs') return;
      expect(result.result.externalRefs).toHaveLength(2);
      expect(result.result.externalRefs[0]).toMatchObject({
        externalId: '100',
        externalType: 'deployment',
      });
    });
  });

  describe('listRepositories', () => {
    it('returns externalRefs for repos', async () => {
      const repos = [
        {
          id: 1,
          name: 'control-plane',
          full_name: 'my-org/control-plane',
          html_url: 'https://github.com/my-org/control-plane',
        },
        {
          id: 2,
          name: 'worker',
          full_name: 'my-org/worker',
          html_url: 'https://github.com/my-org/worker',
        },
      ];
      const adapter = makeAdapter(makeFetch(repos));
      const result = await adapter.execute(makeInput('listRepositories'));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('externalRefs');
      if (result.result.kind !== 'externalRefs') return;
      expect(result.result.externalRefs[0]).toMatchObject({
        externalType: 'repository',
        displayLabel: 'my-org/control-plane',
      });
    });
  });

  describe('listWorkflowRuns', () => {
    it('returns externalRefs for workflow runs', async () => {
      const payload = {
        workflow_runs: [
          {
            id: 555,
            name: 'CI',
            run_number: 123,
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/...',
          },
        ],
      };
      const adapter = makeAdapter(makeFetch(payload));
      const result = await adapter.execute(makeInput('listWorkflowRuns', { repo: 'my-repo' }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('externalRefs');
      if (result.result.kind !== 'externalRefs') return;
      expect(result.result.externalRefs[0]).toMatchObject({
        externalType: 'workflow_run',
        externalId: '555',
      });
    });
  });

  describe('getDoraMetrics', () => {
    it('computes lead time and deployment frequency', async () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const merged = {
        created_at: new Date(sevenDaysAgo.getTime() + 1 * 60 * 60 * 1000).toISOString(), // +1h
        merged_at: new Date(sevenDaysAgo.getTime() + 5 * 60 * 60 * 1000).toISOString(), // +5h
      };

      let callCount = 0;
      const fetchFn = vi.fn().mockImplementation(async () => {
        callCount++;
        const body =
          callCount === 1
            ? JSON.stringify([merged]) // PRs
            : JSON.stringify([{ id: 1, created_at: sevenDaysAgo.toISOString() }]); // deployments
        return { ok: true, status: 200, text: () => Promise.resolve(body) };
      });

      const adapter = makeAdapter(fetchFn);
      const result = await adapter.execute(
        makeInput('getDoraMetrics', {
          repo: 'my-repo',
          since: sevenDaysAgo.toISOString(),
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('opaque');
      if (result.result.kind !== 'opaque') return;

      const payload = result.result.payload;
      expect(payload['repo']).toBe('my-org/my-repo');
      const leadTime = payload['leadTime'] as { avgHours: number; sampleSize: number };
      expect(leadTime.sampleSize).toBe(1);
      expect(leadTime.avgHours).toBe(4); // 5h - 1h = 4h
      const deployFreq = payload['deploymentFrequency'] as { totalDeployments: number };
      expect(deployFreq.totalDeployments).toBe(1);
    });

    it('returns validation_error when repo missing', async () => {
      const adapter = makeAdapter(makeFetch([]));
      const result = await adapter.execute(makeInput('getDoraMetrics'));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
    });
  });

  describe('HTTP error handling', () => {
    it('wraps HTTP 404 as provider_error', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });
      const adapter = makeAdapter(fetchFn);
      const result = await adapter.execute(makeInput('listPullRequests', { repo: 'missing' }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('provider_error');
      expect(result.message).toContain('404');
    });

    it('wraps network failure as provider_error', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const adapter = makeAdapter(fetchFn);
      const result = await adapter.execute(makeInput('listPullRequests', { repo: 'my-repo' }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('provider_error');
    });
  });
});
