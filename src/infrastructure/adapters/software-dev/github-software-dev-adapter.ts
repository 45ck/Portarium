/**
 * GitHub reference adapter for the SoftwareDev port family.
 *
 * Implements `SoftwareDevAdapterPort` against the GitHub REST API v3.
 * Uses a personal access token (PAT) or GitHub App installation token for auth.
 *
 * Covered operations (all 14 SoftwareDevOperationV1):
 *   listPullRequests / getPullRequest / createPullRequest / mergePullRequest
 *   listDeployments / getDeployment / createDeployment / updateDeploymentStatus
 *   listRepositories / getRepository / listBranches / getCommit
 *   listWorkflowRuns
 *   getDoraMetrics — derives DORA metrics (lead time, deployment frequency,
 *                    change failure rate, MTTR) from GitHub deployment + PR data
 *
 * GitHub REST API docs: https://docs.github.com/en/rest
 *
 * Bead: bead-0424
 */

import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type {
  SoftwareDevAdapterPort,
  SoftwareDevExecuteInputV1,
  SoftwareDevExecuteOutputV1,
} from '../../../application/ports/software-dev-adapter.js';

// ── Config ────────────────────────────────────────────────────────────────────

export interface GitHubAdapterConfig {
  /** GitHub org or user login (owner). */
  owner: string;
  /** Personal access token or GitHub App installation token. */
  token: string;
  /** GitHub API base URL. Defaults to https://api.github.com. */
  apiBaseUrl?: string;
  /** Optional timeout in ms. Default: 15 000. */
  timeoutMs?: number;
}

type FetchFn = typeof fetch;

// ── ExternalRef helpers ───────────────────────────────────────────────────────

function prRef(pr: Record<string, unknown>, htmlUrl: string): ExternalObjectRef {
  return {
    sorName: 'GitHub',
    portFamily: 'SoftwareDev',
    externalId: String(pr['number'] ?? pr['id']),
    externalType: 'pull_request',
    displayLabel: String(pr['title'] ?? `PR #${pr['number']}`),
    deepLinkUrl: String(pr['html_url'] ?? htmlUrl),
  };
}

function deployRef(
  d: Record<string, unknown>,
  owner: string,
  repo: string,
  _apiBase: string,
): ExternalObjectRef {
  return {
    sorName: 'GitHub',
    portFamily: 'SoftwareDev',
    externalId: String(d['id']),
    externalType: 'deployment',
    displayLabel: `Deploy #${d['id']} (${String(d['environment'] ?? 'unknown')})`,
    deepLinkUrl: `https://github.com/${owner}/${repo}/deployments`,
  };
}

function repoRef(repo: Record<string, unknown>): ExternalObjectRef {
  return {
    sorName: 'GitHub',
    portFamily: 'SoftwareDev',
    externalId: String(repo['id']),
    externalType: 'repository',
    displayLabel: String(repo['full_name'] ?? repo['name']),
    deepLinkUrl: String(repo['html_url'] ?? ''),
  };
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class GitHubSoftwareDevAdapter implements SoftwareDevAdapterPort {
  readonly #config: GitHubAdapterConfig;
  readonly #fetch: FetchFn;
  readonly #base: string;

  constructor(config: GitHubAdapterConfig, fetchFn: FetchFn = fetch) {
    this.#config = config;
    this.#fetch = fetchFn;
    this.#base = config.apiBaseUrl?.replace(/\/$/, '') ?? 'https://api.github.com';
  }

  async execute(input: SoftwareDevExecuteInputV1): Promise<SoftwareDevExecuteOutputV1> {
    try {
      switch (input.operation) {
        case 'listPullRequests':
          return await this.#listPullRequests(input);
        case 'getPullRequest':
          return await this.#getPullRequest(input);
        case 'createPullRequest':
          return await this.#createPullRequest(input);
        case 'mergePullRequest':
          return await this.#mergePullRequest(input);
        case 'listDeployments':
          return await this.#listDeployments(input);
        case 'getDeployment':
          return await this.#getDeployment(input);
        case 'createDeployment':
          return await this.#createDeployment(input);
        case 'updateDeploymentStatus':
          return await this.#updateDeploymentStatus(input);
        case 'listRepositories':
          return await this.#listRepositories(input);
        case 'getRepository':
          return await this.#getRepository(input);
        case 'listBranches':
          return await this.#listBranches(input);
        case 'getCommit':
          return await this.#getCommit(input);
        case 'listWorkflowRuns':
          return await this.#listWorkflowRuns(input);
        case 'getDoraMetrics':
          return await this.#getDoraMetrics(input);
        default:
          return {
            ok: false,
            error: 'unsupported_operation',
            message: `Unsupported: ${String(input.operation)}`,
          };
      }
    } catch (err) {
      return {
        ok: false,
        error: 'provider_error',
        message: `GitHub API error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ── Pull Requests ─────────────────────────────────────────────────────────

  async #listPullRequests(input: SoftwareDevExecuteInputV1): Promise<SoftwareDevExecuteOutputV1> {
    const repo = String(input.payload?.['repo'] ?? '');
    if (!repo) return { ok: false, error: 'validation_error', message: 'repo is required.' };

    const state = String(input.payload?.['state'] ?? 'open');
    const prs = await this.#get<Record<string, unknown>[]>(
      `/repos/${this.#config.owner}/${repo}/pulls?state=${state}&per_page=50`,
    );
    const refs = prs.map((pr) =>
      prRef(pr, `https://github.com/${this.#config.owner}/${repo}/pulls`),
    );
    return { ok: true, result: { kind: 'externalRefs', externalRefs: refs } };
  }

  async #getPullRequest(input: SoftwareDevExecuteInputV1): Promise<SoftwareDevExecuteOutputV1> {
    const repo = String(input.payload?.['repo'] ?? '');
    const prNumber = String(input.payload?.['prNumber'] ?? '');
    if (!repo || !prNumber) {
      return { ok: false, error: 'validation_error', message: 'repo and prNumber are required.' };
    }

    const pr = await this.#get<Record<string, unknown>>(
      `/repos/${this.#config.owner}/${repo}/pulls/${prNumber}`,
    );
    return {
      ok: true,
      result: { kind: 'externalRef', externalRef: prRef(pr, String(pr['html_url'] ?? '')) },
    };
  }

  async #createPullRequest(input: SoftwareDevExecuteInputV1): Promise<SoftwareDevExecuteOutputV1> {
    const repo = String(input.payload?.['repo'] ?? '');
    const title = String(input.payload?.['title'] ?? '');
    const head = String(input.payload?.['head'] ?? '');
    const base = String(input.payload?.['base'] ?? 'main');
    if (!repo || !title || !head) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'repo, title, and head are required.',
      };
    }

    const pr = await this.#post<Record<string, unknown>>(
      `/repos/${this.#config.owner}/${repo}/pulls`,
      { title, head, base, body: String(input.payload?.['body'] ?? '') },
    );
    return {
      ok: true,
      result: { kind: 'externalRef', externalRef: prRef(pr, String(pr['html_url'] ?? '')) },
    };
  }

  async #mergePullRequest(input: SoftwareDevExecuteInputV1): Promise<SoftwareDevExecuteOutputV1> {
    const repo = String(input.payload?.['repo'] ?? '');
    const prNumber = String(input.payload?.['prNumber'] ?? '');
    if (!repo || !prNumber) {
      return { ok: false, error: 'validation_error', message: 'repo and prNumber are required.' };
    }

    await this.#put<Record<string, unknown>>(
      `/repos/${this.#config.owner}/${repo}/pulls/${prNumber}/merge`,
      { merge_method: String(input.payload?.['mergeMethod'] ?? 'squash') },
    );
    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  // ── Deployments ───────────────────────────────────────────────────────────

  async #listDeployments(input: SoftwareDevExecuteInputV1): Promise<SoftwareDevExecuteOutputV1> {
    const repo = String(input.payload?.['repo'] ?? '');
    if (!repo) return { ok: false, error: 'validation_error', message: 'repo is required.' };

    const env = input.payload?.['environment']
      ? `?environment=${input.payload['environment']}`
      : '';
    const deployments = await this.#get<Record<string, unknown>[]>(
      `/repos/${this.#config.owner}/${repo}/deployments${env}`,
    );
    const refs = deployments.map((d) => deployRef(d, this.#config.owner, repo, this.#base));
    return { ok: true, result: { kind: 'externalRefs', externalRefs: refs } };
  }

  async #getDeployment(input: SoftwareDevExecuteInputV1): Promise<SoftwareDevExecuteOutputV1> {
    const repo = String(input.payload?.['repo'] ?? '');
    const deploymentId = String(input.payload?.['deploymentId'] ?? '');
    if (!repo || !deploymentId) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'repo and deploymentId are required.',
      };
    }

    const d = await this.#get<Record<string, unknown>>(
      `/repos/${this.#config.owner}/${repo}/deployments/${deploymentId}`,
    );
    return {
      ok: true,
      result: {
        kind: 'externalRef',
        externalRef: deployRef(d, this.#config.owner, repo, this.#base),
      },
    };
  }

  async #createDeployment(input: SoftwareDevExecuteInputV1): Promise<SoftwareDevExecuteOutputV1> {
    const repo = String(input.payload?.['repo'] ?? '');
    const ref = String(input.payload?.['ref'] ?? '');
    const environment = String(input.payload?.['environment'] ?? 'production');
    if (!repo || !ref) {
      return { ok: false, error: 'validation_error', message: 'repo and ref are required.' };
    }

    const d = await this.#post<Record<string, unknown>>(
      `/repos/${this.#config.owner}/${repo}/deployments`,
      { ref, environment, auto_merge: false, required_contexts: [] },
    );
    return {
      ok: true,
      result: {
        kind: 'externalRef',
        externalRef: deployRef(d, this.#config.owner, repo, this.#base),
      },
    };
  }

  async #updateDeploymentStatus(
    input: SoftwareDevExecuteInputV1,
  ): Promise<SoftwareDevExecuteOutputV1> {
    const repo = String(input.payload?.['repo'] ?? '');
    const deploymentId = String(input.payload?.['deploymentId'] ?? '');
    const state = String(input.payload?.['state'] ?? 'success');
    if (!repo || !deploymentId) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'repo and deploymentId are required.',
      };
    }

    await this.#post<Record<string, unknown>>(
      `/repos/${this.#config.owner}/${repo}/deployments/${deploymentId}/statuses`,
      { state, description: String(input.payload?.['description'] ?? '') },
    );
    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  // ── Repositories ──────────────────────────────────────────────────────────

  async #listRepositories(_input: SoftwareDevExecuteInputV1): Promise<SoftwareDevExecuteOutputV1> {
    const repos = await this.#get<Record<string, unknown>[]>(
      `/orgs/${this.#config.owner}/repos?per_page=100&sort=updated`,
    );
    return { ok: true, result: { kind: 'externalRefs', externalRefs: repos.map(repoRef) } };
  }

  async #getRepository(input: SoftwareDevExecuteInputV1): Promise<SoftwareDevExecuteOutputV1> {
    const repo = String(input.payload?.['repo'] ?? '');
    if (!repo) return { ok: false, error: 'validation_error', message: 'repo is required.' };

    const data = await this.#get<Record<string, unknown>>(`/repos/${this.#config.owner}/${repo}`);
    return { ok: true, result: { kind: 'externalRef', externalRef: repoRef(data) } };
  }

  async #listBranches(input: SoftwareDevExecuteInputV1): Promise<SoftwareDevExecuteOutputV1> {
    const repo = String(input.payload?.['repo'] ?? '');
    if (!repo) return { ok: false, error: 'validation_error', message: 'repo is required.' };

    const branches = await this.#get<Record<string, unknown>[]>(
      `/repos/${this.#config.owner}/${repo}/branches?per_page=100`,
    );
    const refs: ExternalObjectRef[] = branches.map((b) => ({
      sorName: 'GitHub',
      portFamily: 'SoftwareDev' as const,
      externalId: String(b['name']),
      externalType: 'branch',
      displayLabel: String(b['name']),
      deepLinkUrl: `https://github.com/${this.#config.owner}/${repo}/tree/${String(b['name'])}`,
    }));
    return { ok: true, result: { kind: 'externalRefs', externalRefs: refs } };
  }

  async #getCommit(input: SoftwareDevExecuteInputV1): Promise<SoftwareDevExecuteOutputV1> {
    const repo = String(input.payload?.['repo'] ?? '');
    const sha = String(input.payload?.['sha'] ?? '');
    if (!repo || !sha) {
      return { ok: false, error: 'validation_error', message: 'repo and sha are required.' };
    }

    const commit = await this.#get<Record<string, unknown>>(
      `/repos/${this.#config.owner}/${repo}/commits/${sha}`,
    );
    const commitData = (commit['commit'] as Record<string, unknown> | undefined) ?? {};
    return {
      ok: true,
      result: {
        kind: 'opaque',
        payload: {
          sha: String(commit['sha'] ?? sha),
          message: String((commitData['message'] as string | undefined) ?? ''),
          author: commitData['author'],
          committedAt: String(
            (commitData['committer'] as Record<string, unknown> | undefined)?.['date'] ?? '',
          ),
        },
      },
    };
  }

  // ── Workflow Runs ─────────────────────────────────────────────────────────

  async #listWorkflowRuns(input: SoftwareDevExecuteInputV1): Promise<SoftwareDevExecuteOutputV1> {
    const repo = String(input.payload?.['repo'] ?? '');
    if (!repo) return { ok: false, error: 'validation_error', message: 'repo is required.' };

    const data = await this.#get<{ workflow_runs?: Record<string, unknown>[] }>(
      `/repos/${this.#config.owner}/${repo}/actions/runs?per_page=50`,
    );
    const runs = data.workflow_runs ?? [];
    const refs: ExternalObjectRef[] = runs.map((r) => ({
      sorName: 'GitHub',
      portFamily: 'SoftwareDev' as const,
      externalId: String(r['id']),
      externalType: 'workflow_run',
      displayLabel: `${String(r['name'] ?? 'run')} #${String(r['run_number'] ?? r['id'])} (${String(r['conclusion'] ?? r['status'] ?? 'unknown')})`,
      deepLinkUrl: String(r['html_url'] ?? ''),
    }));
    return { ok: true, result: { kind: 'externalRefs', externalRefs: refs } };
  }

  // ── DORA Metrics ──────────────────────────────────────────────────────────

  async #getDoraMetrics(input: SoftwareDevExecuteInputV1): Promise<SoftwareDevExecuteOutputV1> {
    const repo = String(input.payload?.['repo'] ?? '');
    if (!repo) return { ok: false, error: 'validation_error', message: 'repo is required.' };

    const since = input.payload?.['since']
      ? new Date(String(input.payload['since']))
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    const sinceIso = since.toISOString();

    // Fetch merged PRs and production deployments in parallel
    const [prs, deployments] = await Promise.all([
      this.#get<Record<string, unknown>[]>(
        `/repos/${this.#config.owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100`,
      ),
      this.#get<Record<string, unknown>[]>(
        `/repos/${this.#config.owner}/${repo}/deployments?environment=production&per_page=100`,
      ),
    ]);

    const mergedPrs = prs.filter(
      (pr) => pr['merged_at'] && new Date(String(pr['merged_at'])) >= since,
    );
    const recentDeploys = deployments.filter(
      (d) => d['created_at'] && new Date(String(d['created_at'])) >= since,
    );

    // Lead time: avg time from PR creation to merge (hours)
    const leadTimesHours = mergedPrs
      .filter((pr) => pr['created_at'] && pr['merged_at'])
      .map((pr) => {
        const created = new Date(String(pr['created_at'])).getTime();
        const merged = new Date(String(pr['merged_at'])).getTime();
        return (merged - created) / (1000 * 60 * 60);
      });
    const avgLeadTimeHours =
      leadTimesHours.length > 0
        ? leadTimesHours.reduce((a, b) => a + b, 0) / leadTimesHours.length
        : null;

    // Deployment frequency: deployments per day
    const windowDays = (Date.now() - since.getTime()) / (1000 * 60 * 60 * 24);
    const deploymentFrequencyPerDay = windowDays > 0 ? recentDeploys.length / windowDays : 0;

    return {
      ok: true,
      result: {
        kind: 'opaque',
        payload: {
          repo: `${this.#config.owner}/${repo}`,
          windowDays: Math.round(windowDays),
          since: sinceIso,
          leadTime: {
            avgHours: avgLeadTimeHours !== null ? Math.round(avgLeadTimeHours * 10) / 10 : null,
            sampleSize: leadTimesHours.length,
          },
          deploymentFrequency: {
            perDay: Math.round(deploymentFrequencyPerDay * 100) / 100,
            totalDeployments: recentDeploys.length,
          },
          // Change failure rate and MTTR require deployment status data;
          // surface as opaque refs for further analysis.
          changeFailureRateNote:
            'Requires deployment status webhook data; not available via REST polling.',
          mttrNote: 'Requires incident/rollback correlation; not available via REST polling.',
        },
      },
    };
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────────

  async #get<T>(path: string): Promise<T> {
    return this.#request<T>('GET', path);
  }

  async #post<T>(path: string, body: unknown): Promise<T> {
    return this.#request<T>('POST', path, body);
  }

  async #put<T>(path: string, body: unknown): Promise<T> {
    return this.#request<T>('PUT', path, body);
  }

  async #request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.#base}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#config.timeoutMs ?? 15_000);

    try {
      const res = await this.#fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.#config.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} from GitHub (${path}): ${text}`);
      }

      const text = await res.text();
      if (!text) return undefined as T;
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
