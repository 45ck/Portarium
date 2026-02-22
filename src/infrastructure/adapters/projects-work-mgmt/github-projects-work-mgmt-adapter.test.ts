/**
 * Tests for GitHubProjectsWorkMgmtAdapter.
 * Bead: bead-0424
 */

import { describe, it, expect, vi } from 'vitest';
import {
  GitHubProjectsWorkMgmtAdapter,
  type GitHubAdapterConfig,
} from './github-projects-work-mgmt-adapter.js';
import type { ProjectsWorkMgmtExecuteInputV1 } from '../../../application/ports/projects-work-mgmt-adapter.js';
import { TenantId } from '../../../domain/primitives/index.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TENANT_ID = TenantId('tenant-github-test');
const OWNER = 'myorg';
const REPO = 'myrepo';

const DEFAULT_CONFIG: GitHubAdapterConfig = {
  baseUrl: 'https://api.github.com',
  token: 'ghp_test_token',
  defaultOwner: OWNER,
  defaultRepo: REPO,
};

function makeFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function makeAdapter(fetchFn = makeFetch([]) as unknown as typeof fetch) {
  return new GitHubProjectsWorkMgmtAdapter(DEFAULT_CONFIG, fetchFn);
}

function makeInput(
  operation: ProjectsWorkMgmtExecuteInputV1['operation'],
  payload?: Record<string, unknown>,
): ProjectsWorkMgmtExecuteInputV1 {
  return { tenantId: TENANT_ID, operation, ...(payload !== undefined ? { payload } : {}) };
}

// Fixture helpers
function makeIssue(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    number: 42,
    title: 'Fix login flow',
    state: 'open',
    assignee: { login: 'octocat' },
    html_url: `https://github.com/${OWNER}/${REPO}/issues/42`,
    ...overrides,
  };
}

function makePR(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    number: 7,
    title: 'Add OAuth support',
    state: 'closed',
    assignee: null,
    pull_request: { merged_at: '2026-01-15T12:00:00Z' },
    html_url: `https://github.com/${OWNER}/${REPO}/pull/7`,
    ...overrides,
  };
}

function makeRepo(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: REPO,
    full_name: `${OWNER}/${REPO}`,
    html_url: `https://github.com/${OWNER}/${REPO}`,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GitHubProjectsWorkMgmtAdapter', () => {
  describe('listProjects', () => {
    it('maps GitHub repositories to ExternalObjectRefs', async () => {
      const repos = [makeRepo(), makeRepo({ name: 'other', full_name: `${OWNER}/other` })];
      const adapter = makeAdapter(makeFetch(repos));

      const result = await adapter.execute(makeInput('listProjects'));

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'externalRefs') return;
      expect(result.result.externalRefs).toHaveLength(2);
      expect(result.result.externalRefs[0]).toMatchObject({
        sorName: 'GitHub',
        portFamily: 'ProjectsWorkMgmt',
        externalId: `${OWNER}/${REPO}`,
        externalType: 'repository',
      });
    });

    it('returns validation_error when owner is missing and no default', async () => {
      const adapter = new GitHubProjectsWorkMgmtAdapter(
        { token: 'tok' },
        makeFetch([]) as typeof fetch,
      );
      const result = await adapter.execute(makeInput('listProjects'));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
    });
  });

  describe('getProject', () => {
    it('returns an ExternalObjectRef for the repository', async () => {
      const adapter = makeAdapter(makeFetch(makeRepo()));

      const result = await adapter.execute(makeInput('getProject', { owner: OWNER, repo: REPO }));

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'externalRef') return;
      expect(result.result.externalRef.externalType).toBe('repository');
      expect(result.result.externalRef.externalId).toBe(`${OWNER}/${REPO}`);
    });

    it('returns not_found on 404', async () => {
      const adapter = makeAdapter(makeFetch({ message: 'Not Found' }, 404));

      const result = await adapter.execute(
        makeInput('getProject', { owner: OWNER, repo: 'nonexistent' }),
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('not_found');
    });

    it('returns validation_error when repo is missing', async () => {
      const adapter = new GitHubProjectsWorkMgmtAdapter(
        { token: 'tok', defaultOwner: OWNER },
        makeFetch({}) as typeof fetch,
      );
      const result = await adapter.execute(makeInput('getProject'));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
    });
  });

  describe('listTasks', () => {
    it('maps GitHub issues to CanonicalTaskV1 array', async () => {
      const issues = [makeIssue(), makeIssue({ number: 43, title: 'Another bug', assignee: null })];
      const adapter = makeAdapter(makeFetch(issues));

      const result = await adapter.execute(makeInput('listTasks'));

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'tasks') return;
      const tasks = result.result.tasks;
      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toMatchObject({
        canonicalTaskId: `gh:${OWNER}/${REPO}/42`,
        tenantId: TENANT_ID,
        schemaVersion: 1,
        title: 'Fix login flow',
        status: 'todo',
        assigneeId: 'octocat',
      });
      expect(tasks[1]).not.toHaveProperty('assigneeId');
    });

    it('maps merged pull requests to done status', async () => {
      const adapter = makeAdapter(makeFetch([makePR()]));

      const result = await adapter.execute(makeInput('listTasks', { state: 'closed' }));

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'tasks') return;
      expect(result.result.tasks[0]?.status).toBe('done');
      expect(result.result.tasks[0]?.externalRefs?.[0]?.externalType).toBe('pull_request');
    });

    it('includes deepLinkUrl in externalRef', async () => {
      const adapter = makeAdapter(makeFetch([makeIssue()]));
      const result = await adapter.execute(makeInput('listTasks'));
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'tasks') return;
      expect(result.result.tasks[0]?.externalRefs?.[0]?.deepLinkUrl).toContain(`${OWNER}/${REPO}`);
    });
  });

  describe('getTask', () => {
    it('fetches a single issue by number', async () => {
      const adapter = makeAdapter(makeFetch(makeIssue()));

      const result = await adapter.execute(makeInput('getTask', { taskId: '42' }));

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'task') return;
      expect(result.result.task.canonicalTaskId).toBe(`gh:${OWNER}/${REPO}/42`);
    });

    it('supports gh:owner/repo/number taskId format', async () => {
      const adapter = makeAdapter(makeFetch(makeIssue()));
      const result = await adapter.execute(
        makeInput('getTask', { taskId: `gh:${OWNER}/${REPO}/42` }),
      );
      expect(result.ok).toBe(true);
    });

    it('returns validation_error for invalid taskId format', async () => {
      const adapter = makeAdapter();
      const result = await adapter.execute(makeInput('getTask', { taskId: 'not-a-number' }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
    });

    it('returns not_found on 404', async () => {
      const adapter = makeAdapter(makeFetch({ message: 'Not Found' }, 404));
      const result = await adapter.execute(makeInput('getTask', { taskId: '9999' }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('not_found');
    });
  });

  describe('createTask', () => {
    it('creates a GitHub issue and maps it to CanonicalTaskV1', async () => {
      const created = makeIssue({ number: 50, title: 'New feature', assignee: null });
      const adapter = makeAdapter(makeFetch(created));

      const result = await adapter.execute(makeInput('createTask', { title: 'New feature' }));

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'task') return;
      expect(result.result.task.title).toBe('New feature');
      expect(result.result.task.status).toBe('todo');
    });

    it('returns validation_error when title is missing', async () => {
      const adapter = makeAdapter();
      const result = await adapter.execute(makeInput('createTask', {}));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
      expect(result.message).toContain('title');
    });
  });

  describe('updateTask', () => {
    it('updates an issue and returns the updated task', async () => {
      const updated = makeIssue({ state: 'closed' });
      const adapter = makeAdapter(makeFetch(updated));

      const result = await adapter.execute(
        makeInput('updateTask', { taskId: '42', status: 'done' }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'task') return;
      expect(result.result.task.status).toBe('done');
    });

    it('sends state_reason=not_planned for cancelled status', async () => {
      const fetchFn = makeFetch(makeIssue({ state: 'closed' }));
      const adapter = makeAdapter(fetchFn);

      await adapter.execute(makeInput('updateTask', { taskId: '42', status: 'cancelled' }));

      const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body['state']).toBe('closed');
      expect(body['state_reason']).toBe('not_planned');
    });
  });

  describe('deleteTask', () => {
    it('closes the issue as not_planned and returns accepted', async () => {
      const fetchFn = makeFetch(makeIssue({ state: 'closed' }));
      const adapter = makeAdapter(fetchFn);

      const result = await adapter.execute(makeInput('deleteTask', { taskId: '42' }));

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.kind).toBe('accepted');

      const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body['state_reason']).toBe('not_planned');
    });
  });

  describe('assignTask', () => {
    it('patches the issue assignees and returns the updated task', async () => {
      const updated = makeIssue({ assignee: { login: 'newdev' } });
      const adapter = makeAdapter(makeFetch(updated));

      const result = await adapter.execute(
        makeInput('assignTask', { taskId: '42', assigneeId: 'newdev' }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'task') return;
      expect(result.result.task.assigneeId).toBe('newdev');
    });

    it('returns validation_error when assigneeId is missing', async () => {
      const adapter = makeAdapter();
      const result = await adapter.execute(makeInput('assignTask', { taskId: '42' }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
      expect(result.message).toContain('assigneeId');
    });
  });

  describe('listMilestones', () => {
    it('maps GitHub milestones to ExternalObjectRefs', async () => {
      const milestones = [
        { number: 1, title: 'v1.0', html_url: `https://github.com/${OWNER}/${REPO}/milestone/1` },
        { number: 2, title: 'v2.0', html_url: `https://github.com/${OWNER}/${REPO}/milestone/2` },
      ];
      const adapter = makeAdapter(makeFetch(milestones));

      const result = await adapter.execute(makeInput('listMilestones'));

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'externalRefs') return;
      expect(result.result.externalRefs).toHaveLength(2);
      expect(result.result.externalRefs[0]).toMatchObject({
        externalId: '1',
        externalType: 'milestone',
        displayLabel: 'v1.0',
      });
    });
  });

  describe('getMilestone', () => {
    it('returns a single milestone as ExternalObjectRef', async () => {
      const milestone = { number: 1, title: 'v1.0' };
      const adapter = makeAdapter(makeFetch(milestone));

      const result = await adapter.execute(makeInput('getMilestone', { milestoneId: '1' }));

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'externalRef') return;
      expect(result.result.externalRef.externalId).toBe('1');
      expect(result.result.externalRef.displayLabel).toBe('v1.0');
    });

    it('returns not_found on 404', async () => {
      const adapter = makeAdapter(makeFetch({ message: 'Not Found' }, 404));
      const result = await adapter.execute(makeInput('getMilestone', { milestoneId: '999' }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('not_found');
    });
  });

  describe('listComments', () => {
    it('maps GitHub comments to ExternalObjectRefs', async () => {
      const comments = [
        {
          id: 100,
          body: 'LGTM!',
          html_url: `https://github.com/${OWNER}/${REPO}/issues/42#issuecomment-100`,
        },
      ];
      const adapter = makeAdapter(makeFetch(comments));

      const result = await adapter.execute(makeInput('listComments', { refId: '42' }));

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'externalRefs') return;
      expect(result.result.externalRefs[0]).toMatchObject({
        externalId: '100',
        externalType: 'comment',
        displayLabel: 'LGTM!',
      });
    });

    it('returns validation_error when refId is missing', async () => {
      const adapter = makeAdapter();
      const result = await adapter.execute(makeInput('listComments', {}));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
    });
  });

  describe('addComment', () => {
    it('posts a comment and returns ExternalObjectRef', async () => {
      const created = {
        id: 200,
        body: 'Thanks for the fix!',
        html_url: `https://github.com/${OWNER}/${REPO}/issues/42#issuecomment-200`,
      };
      const adapter = makeAdapter(makeFetch(created));

      const result = await adapter.execute(
        makeInput('addComment', { refId: '42', content: 'Thanks for the fix!' }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'externalRef') return;
      expect(result.result.externalRef.externalId).toBe('200');
    });

    it('returns validation_error when content is missing', async () => {
      const adapter = makeAdapter();
      const result = await adapter.execute(makeInput('addComment', { refId: '42' }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
      expect(result.message).toContain('content');
    });
  });

  describe('listLabels', () => {
    it('maps GitHub labels to ExternalObjectRefs', async () => {
      const labels = [
        { name: 'bug', color: 'd73a4a' },
        { name: 'enhancement', color: 'a2eeef' },
      ];
      const adapter = makeAdapter(makeFetch(labels));

      const result = await adapter.execute(makeInput('listLabels'));

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'externalRefs') return;
      expect(result.result.externalRefs).toHaveLength(2);
      expect(result.result.externalRefs[0]).toMatchObject({
        externalId: 'bug',
        externalType: 'label',
        displayLabel: 'bug',
      });
    });
  });

  describe('unsupported operations', () => {
    it('returns empty list for listBoards', async () => {
      const adapter = makeAdapter();
      const result = await adapter.execute(makeInput('listBoards'));
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'externalRefs') return;
      expect(result.result.externalRefs).toHaveLength(0);
    });

    it('returns unsupported_operation for getBoard', async () => {
      const adapter = makeAdapter();
      const result = await adapter.execute(makeInput('getBoard'));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('unsupported_operation');
    });

    it('returns empty list for listSprints', async () => {
      const adapter = makeAdapter();
      const result = await adapter.execute(makeInput('listSprints'));
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'externalRefs') return;
      expect(result.result.externalRefs).toHaveLength(0);
    });

    it('returns empty list for listTimeEntries', async () => {
      const adapter = makeAdapter();
      const result = await adapter.execute(makeInput('listTimeEntries'));
      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'externalRefs') return;
      expect(result.result.externalRefs).toHaveLength(0);
    });

    it('returns unsupported_operation for logTime', async () => {
      const adapter = makeAdapter();
      const result = await adapter.execute(makeInput('logTime'));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('unsupported_operation');
    });
  });

  describe('HTTP request behaviour', () => {
    it('sends correct authorization header', async () => {
      const fetchFn = makeFetch([]);
      const adapter = makeAdapter(fetchFn);
      await adapter.execute(makeInput('listProjects', { owner: OWNER }));

      const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['Authorization']).toBe(
        'Bearer ghp_test_token',
      );
    });

    it('sends X-GitHub-Api-Version header', async () => {
      const fetchFn = makeFetch([]);
      const adapter = makeAdapter(fetchFn);
      await adapter.execute(makeInput('listTasks'));

      const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['X-GitHub-Api-Version']).toBe('2022-11-28');
    });

    it('returns provider_error on unexpected HTTP error', async () => {
      const adapter = makeAdapter(makeFetch({ message: 'Server Error' }, 500));
      const result = await adapter.execute(makeInput('listTasks'));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('provider_error');
    });
  });

  describe('createProject', () => {
    it('creates a GitHub org repository', async () => {
      const repo = makeRepo({ name: 'new-service', full_name: `${OWNER}/new-service` });
      const adapter = makeAdapter(makeFetch(repo));

      const result = await adapter.execute(
        makeInput('createProject', { name: 'new-service', description: 'A new microservice' }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'externalRef') return;
      expect(result.result.externalRef.externalId).toBe(`${OWNER}/new-service`);
    });

    it('includes private flag when provided', async () => {
      const repo = makeRepo({ name: 'secret', full_name: `${OWNER}/secret`, private: true });
      const fetchFn = makeFetch(repo);
      const adapter = makeAdapter(fetchFn);

      await adapter.execute(makeInput('createProject', { name: 'secret', private: true }));

      const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body['private']).toBe(true);
    });

    it('returns validation_error when name is missing', async () => {
      const adapter = makeAdapter();
      const result = await adapter.execute(makeInput('createProject', {}));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('validation_error');
      expect(result.message).toContain('name');
    });
  });

  describe('branch coverage extras', () => {
    it('mapGitHubStateToTaskStatus: closed non-merged PR maps to done', async () => {
      // PR with pull_request present but merged_at=null (closed without merge)
      const closedPR = makePR({ pull_request: { merged_at: null } });
      const adapter = makeAdapter(makeFetch([closedPR]));

      const result = await adapter.execute(makeInput('listTasks', { state: 'closed' }));

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'tasks') return;
      expect(result.result.tasks[0]?.status).toBe('done');
    });

    it('mapCommentToExternalRef: truncates long comment body', async () => {
      const longBody = 'A'.repeat(80); // > 64 chars
      const comment = {
        id: 300,
        body: longBody,
        html_url: `https://github.com/${OWNER}/${REPO}/issues/1#issuecomment-300`,
      };
      const adapter = makeAdapter(makeFetch([comment]));

      const result = await adapter.execute(makeInput('listComments', { refId: '1' }));

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'externalRefs') return;
      expect(result.result.externalRefs[0]?.displayLabel).toMatch(/\.\.\.$/);
      expect(result.result.externalRefs[0]?.displayLabel).toHaveLength(64);
    });

    it('mapRepoToExternalRef: falls back to name when full_name absent', async () => {
      // Repo without full_name — uses name as fallback
      const repoNoFullName = { name: REPO, html_url: `https://github.com/${OWNER}/${REPO}` };
      const adapter = makeAdapter(makeFetch([repoNoFullName]));

      const result = await adapter.execute(makeInput('listProjects'));

      expect(result.ok).toBe(true);
      if (!result.ok || result.result.kind !== 'externalRefs') return;
      expect(result.result.externalRefs[0]?.externalId).toBe(REPO);
    });

    it('resolveOwnerRepo: supports owner/repo shorthand via projectId', async () => {
      const adapter = makeAdapter(makeFetch([makeIssue()]));

      const result = await adapter.execute(
        makeInput('listTasks', { projectId: `${OWNER}/${REPO}` }),
      );

      expect(result.ok).toBe(true);
    });

    it('updateTask: updates title without changing status', async () => {
      const fetchFn = makeFetch(makeIssue({ title: 'Renamed' }));
      const adapter = makeAdapter(fetchFn);

      await adapter.execute(makeInput('updateTask', { taskId: '42', title: 'Renamed' }));

      const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body['title']).toBe('Renamed');
      expect(body['state']).toBeUndefined();
    });

    it('execute: returns unsupported_operation for unknown operation', async () => {
      const adapter = makeAdapter();
      // Force an unknown operation that falls into the default switch case
      const result = await adapter.execute(makeInput('getSprint', {}));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('unsupported_operation');
    });
  });
});
