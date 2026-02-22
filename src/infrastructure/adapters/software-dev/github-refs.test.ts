/**
 * Unit tests for github-refs.ts pure helper functions.
 * Covers fallback branches not exercised through the adapter integration tests.
 * Bead: bead-0424
 */

import { describe, expect, it } from 'vitest';
import { prRef, deployRef, repoRef, workflowRunRef, computeDoraPayload } from './github-refs.js';

describe('prRef', () => {
  it('uses pr.number as externalId', () => {
    const ref = prRef({ number: 42, title: 'Fix bug', html_url: 'https://gh/pr/42' }, '');
    expect(ref.externalId).toBe('42');
  });

  it('falls back to pr.id when number is absent', () => {
    const ref = prRef({ id: 99, title: 'No number' }, 'https://gh');
    expect(ref.externalId).toBe('99');
  });

  it('falls back to PR # label when title is absent', () => {
    const ref = prRef({ number: 5 }, '');
    expect(ref.displayLabel).toBe('PR #5');
  });

  it('falls back to htmlUrl when html_url is absent', () => {
    const ref = prRef({ number: 5 }, 'https://fallback-url');
    expect(ref.deepLinkUrl).toBe('https://fallback-url');
  });
});

describe('deployRef', () => {
  it('falls back to unknown when environment is absent', () => {
    const ref = deployRef({ id: 10 }, 'org', 'repo');
    expect(ref.displayLabel).toContain('unknown');
  });

  it('includes environment in displayLabel', () => {
    const ref = deployRef({ id: 10, environment: 'staging' }, 'org', 'repo');
    expect(ref.displayLabel).toContain('staging');
  });
});

describe('repoRef', () => {
  it('uses full_name as displayLabel', () => {
    const ref = repoRef({ id: 1, full_name: 'org/repo', html_url: 'https://gh/org/repo' });
    expect(ref.displayLabel).toBe('org/repo');
  });

  it('falls back to name when full_name is absent', () => {
    const ref = repoRef({ id: 1, name: 'repo' });
    expect(ref.displayLabel).toBe('repo');
  });

  it('falls back to empty string when neither full_name nor name present', () => {
    const ref = repoRef({ id: 1 });
    expect(ref.displayLabel).toBe('');
  });

  it('falls back to empty deepLinkUrl when html_url absent', () => {
    const ref = repoRef({ id: 1, name: 'repo' });
    expect(ref.deepLinkUrl).toBe('');
  });
});

describe('workflowRunRef', () => {
  it('falls back to run label when name is absent', () => {
    const ref = workflowRunRef({ id: 5, run_number: 1, status: 'in_progress' });
    expect(ref.displayLabel).toContain('run');
  });

  it('uses status as conclusion fallback when conclusion absent', () => {
    const ref = workflowRunRef({ id: 5, name: 'CI', run_number: 1, status: 'in_progress' });
    expect(ref.displayLabel).toContain('in_progress');
  });

  it('falls back to unknown when both conclusion and status absent', () => {
    const ref = workflowRunRef({ id: 5, name: 'CI', run_number: 1 });
    expect(ref.displayLabel).toContain('unknown');
  });

  it('falls back to id when run_number absent', () => {
    const ref = workflowRunRef({ id: 5, name: 'CI', conclusion: 'success' });
    expect(ref.displayLabel).toContain('5');
  });

  it('falls back to empty deepLinkUrl when html_url absent', () => {
    const ref = workflowRunRef({ id: 5, name: 'CI', run_number: 1 });
    expect(ref.deepLinkUrl).toBe('');
  });
});

describe('computeDoraPayload', () => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  it('returns null avgHours when no PRs have timestamps', () => {
    const result = computeDoraPayload({ owner: 'org', repo: 'r', prs: [], deployments: [], since });
    const lt = result['leadTime'] as { avgHours: null };
    expect(lt.avgHours).toBeNull();
  });

  it('returns zero deployments when none in window', () => {
    const result = computeDoraPayload({ owner: 'org', repo: 'r', prs: [], deployments: [], since });
    const df = result['deploymentFrequency'] as { totalDeployments: number };
    expect(df.totalDeployments).toBe(0);
  });

  it('excludes PRs merged before since date', () => {
    const oldPr = { merged_at: new Date(since.getTime() - 1000).toISOString() };
    const result = computeDoraPayload({
      owner: 'org',
      repo: 'r',
      prs: [oldPr],
      deployments: [],
      since,
    });
    const lt = result['leadTime'] as { sampleSize: number };
    expect(lt.sampleSize).toBe(0);
  });
});
