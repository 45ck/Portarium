/**
 * GitHub ref builder helpers and DORA metric computation shared by the GitHub SoftwareDev adapter.
 * Bead: bead-0424
 */

import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';

export type GHRecord = Record<string, unknown>;

export function prRef(pr: GHRecord, htmlUrl: string): ExternalObjectRef {
  const num = String(pr['number'] ?? pr['id']);
  return {
    sorName: 'GitHub',
    portFamily: 'SoftwareDev',
    externalId: num,
    externalType: 'pull_request',
    displayLabel: (pr['title'] as string | undefined) ?? `PR #${num}`,
    deepLinkUrl: (pr['html_url'] as string | undefined) ?? htmlUrl,
  };
}

export function deployRef(d: GHRecord, owner: string, repo: string): ExternalObjectRef {
  return {
    sorName: 'GitHub',
    portFamily: 'SoftwareDev',
    externalId: String(d['id']),
    externalType: 'deployment',
    displayLabel: `Deploy #${String(d['id'])} (${(d['environment'] as string | undefined) ?? 'unknown'})`,
    deepLinkUrl: `https://github.com/${owner}/${repo}/deployments`,
  };
}

export function repoRef(repo: GHRecord): ExternalObjectRef {
  return {
    sorName: 'GitHub',
    portFamily: 'SoftwareDev',
    externalId: String(repo['id']),
    externalType: 'repository',
    displayLabel:
      (repo['full_name'] as string | undefined) ?? (repo['name'] as string | undefined) ?? '',
    deepLinkUrl: (repo['html_url'] as string | undefined) ?? '',
  };
}

export function workflowRunRef(r: GHRecord): ExternalObjectRef {
  const name = (r['name'] as string | undefined) ?? 'run';
  const conclusion =
    (r['conclusion'] as string | undefined) ?? (r['status'] as string | undefined) ?? 'unknown';
  return {
    sorName: 'GitHub',
    portFamily: 'SoftwareDev' as const,
    externalId: String(r['id']),
    externalType: 'workflow_run',
    displayLabel: `${name} #${String(r['run_number'] ?? r['id'])} (${conclusion})`,
    deepLinkUrl: (r['html_url'] as string | undefined) ?? '',
  };
}

export interface DoraInput {
  owner: string;
  repo: string;
  prs: GHRecord[];
  deployments: GHRecord[];
  since: Date;
}

export function computeDoraPayload(input: DoraInput): Record<string, unknown> {
  const { owner, repo, prs, deployments, since } = input;
  const mergedPrs = prs.filter((pr) => {
    const m = pr['merged_at'] as string | undefined;
    return m && new Date(m) >= since;
  });
  const recentDeploys = deployments.filter((d) => {
    const c = d['created_at'] as string | undefined;
    return c && new Date(c) >= since;
  });
  const leadTimesHours = mergedPrs
    .filter((pr) => pr['created_at'] && pr['merged_at'])
    .map(
      (pr) =>
        (new Date(String(pr['merged_at'])).getTime() -
          new Date(String(pr['created_at'])).getTime()) /
        (1000 * 60 * 60),
    );
  const avgLeadTimeHours =
    leadTimesHours.length > 0
      ? leadTimesHours.reduce((a, b) => a + b, 0) / leadTimesHours.length
      : null;
  const windowDays = (Date.now() - since.getTime()) / (1000 * 60 * 60 * 24);
  return {
    repo: `${owner}/${repo}`,
    windowDays: Math.round(windowDays),
    since: since.toISOString(),
    leadTime: {
      avgHours: avgLeadTimeHours !== null ? Math.round(avgLeadTimeHours * 10) / 10 : null,
      sampleSize: leadTimesHours.length,
    },
    deploymentFrequency: {
      perDay: Math.round((windowDays > 0 ? recentDeploys.length / windowDays : 0) * 100) / 100,
      totalDeployments: recentDeploys.length,
    },
    changeFailureRateNote:
      'Requires deployment status webhook data; not available via REST polling.',
    mttrNote: 'Requires incident/rollback correlation; not available via REST polling.',
  };
}
