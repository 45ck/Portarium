/**
 * GitHub reference adapter for the ProjectsWorkMgmt port family.
 *
 * Maps GitHub repositories, issues, pull requests, milestones, labels, and
 * comments to the canonical ProjectsWorkMgmt operations.
 *
 * Mapping decisions (per domain-atlas/decisions/providers/github.md):
 *   - Repositories          → projects (ExternalObjectRef)
 *   - Issues / Pull Requests → tasks (CanonicalTaskV1)
 *   - Milestones            → milestones (ExternalObjectRef)
 *   - Labels                → labels (ExternalObjectRef)
 *   - Issue comments        → comments (ExternalObjectRef)
 *   - Boards / Sprints      → not a GitHub REST API concept; returns empty list
 *   - Time entries          → not supported by GitHub; returns empty list
 *
 * Authentication: GitHub PAT or App installation token via
 *   `Authorization: Bearer <token>`  +  `X-GitHub-Api-Version: 2022-11-28`.
 *
 * GitHub REST API reference: https://docs.github.com/en/rest
 *
 * Bead: bead-0424
 */

import type { CanonicalTaskV1 } from '../../../domain/canonical/task-v1.js';
import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import { CanonicalTaskId } from '../../../domain/primitives/index.js';
import type {
  ProjectsWorkMgmtAdapterPort,
  ProjectsWorkMgmtExecuteInputV1,
  ProjectsWorkMgmtExecuteOutputV1,
} from '../../../application/ports/projects-work-mgmt-adapter.js';

// ── Config ─────────────────────────────────────────────────────────────────────

export interface GitHubAdapterConfig {
  /** GitHub API base URL. Default: https://api.github.com */
  baseUrl?: string;
  /** Personal access token or GitHub App installation token. */
  token: string;
  /**
   * Default repository owner (org login or username).
   * Can be overridden per-request via `payload.owner`.
   */
  defaultOwner?: string;
  /**
   * Default repository name for scoped operations.
   * Can be overridden per-request via `payload.repo`.
   */
  defaultRepo?: string;
  /** Request timeout in ms. Default: 12 000. */
  timeoutMs?: number;
}

type FetchFn = typeof fetch;

// ── Mappers ────────────────────────────────────────────────────────────────────

/** Safely coerce an unknown API field to string, returning fallback if not a string/number. */
function strField(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function mapGitHubStateToTaskStatus(state: string, merged: boolean): CanonicalTaskV1['status'] {
  if (state === 'open') return 'todo';
  if (merged) return 'done';
  // Closed without merge — use state_reason when available
  return 'done';
}

function mapGitHubIssueToTask(
  rec: Record<string, unknown>,
  tenantId: string,
  owner: string,
  repo: string,
): CanonicalTaskV1 {
  const number = strField(rec['number']);
  const state = strField(rec['state'], 'open');
  const pullRequest = rec['pull_request'];
  const merged =
    typeof pullRequest === 'object' &&
    pullRequest !== null &&
    Boolean((pullRequest as Record<string, unknown>)['merged_at']);

  const externalRef: ExternalObjectRef = {
    sorName: 'GitHub',
    portFamily: 'ProjectsWorkMgmt',
    externalId: number,
    externalType: pullRequest !== undefined && pullRequest !== null ? 'pull_request' : 'issue',
    displayLabel: strField(rec['title']),
    deepLinkUrl: strField(rec['html_url'], `https://github.com/${owner}/${repo}/issues/${number}`),
  };

  const assignee = rec['assignee'] as Record<string, unknown> | null | undefined;

  return {
    canonicalTaskId: CanonicalTaskId(`gh:${owner}/${repo}/${number}`),
    tenantId: tenantId as CanonicalTaskV1['tenantId'],
    schemaVersion: 1,
    title: strField(rec['title']),
    status: mapGitHubStateToTaskStatus(state, merged),
    ...(assignee !== null && assignee !== undefined
      ? { assigneeId: strField(assignee['login']) }
      : {}),
    externalRefs: [externalRef],
  };
}

function mapRepoToExternalRef(rec: Record<string, unknown>): ExternalObjectRef {
  const fullName = strField(rec['full_name'], strField(rec['name']));
  return {
    sorName: 'GitHub',
    portFamily: 'ProjectsWorkMgmt',
    externalId: fullName,
    externalType: 'repository',
    displayLabel: fullName,
    deepLinkUrl: strField(rec['html_url']),
  };
}

function mapMilestoneToExternalRef(
  rec: Record<string, unknown>,
  owner: string,
  repo: string,
): ExternalObjectRef {
  const number = strField(rec['number']);
  return {
    sorName: 'GitHub',
    portFamily: 'ProjectsWorkMgmt',
    externalId: number,
    externalType: 'milestone',
    displayLabel: strField(rec['title']),
    deepLinkUrl: `https://github.com/${owner}/${repo}/milestone/${number}`,
  };
}

function mapLabelToExternalRef(
  rec: Record<string, unknown>,
  owner: string,
  repo: string,
): ExternalObjectRef {
  const name = strField(rec['name']);
  return {
    sorName: 'GitHub',
    portFamily: 'ProjectsWorkMgmt',
    externalId: name,
    externalType: 'label',
    displayLabel: name,
    deepLinkUrl: `https://github.com/${owner}/${repo}/labels/${encodeURIComponent(name)}`,
  };
}

function mapCommentToExternalRef(rec: Record<string, unknown>): ExternalObjectRef {
  const body = strField(rec['body']);
  return {
    sorName: 'GitHub',
    portFamily: 'ProjectsWorkMgmt',
    externalId: strField(rec['id']),
    externalType: 'comment',
    displayLabel: body.length > 64 ? `${body.slice(0, 61)}...` : body,
    deepLinkUrl: strField(rec['html_url']),
  };
}

// ── Adapter ────────────────────────────────────────────────────────────────────

export class GitHubProjectsWorkMgmtAdapter implements ProjectsWorkMgmtAdapterPort {
  readonly #baseUrl: string;
  readonly #token: string;
  readonly #defaultOwner: string | undefined;
  readonly #defaultRepo: string | undefined;
  readonly #timeoutMs: number;
  readonly #fetch: FetchFn;

  public constructor(config: GitHubAdapterConfig, fetchFn?: FetchFn) {
    this.#baseUrl = (config.baseUrl ?? 'https://api.github.com').replace(/\/$/, '');
    this.#token = config.token;
    this.#defaultOwner = config.defaultOwner;
    this.#defaultRepo = config.defaultRepo;
    this.#timeoutMs = config.timeoutMs ?? 12_000;
    this.#fetch = fetchFn ?? fetch;
  }

  public async execute(
    input: ProjectsWorkMgmtExecuteInputV1,
  ): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    switch (input.operation) {
      case 'listProjects':
        return this.#listProjects(input);
      case 'getProject':
        return this.#getProject(input);
      case 'createProject':
        return this.#createProject(input);
      case 'listTasks':
        return this.#listTasks(input);
      case 'getTask':
        return this.#getTask(input);
      case 'createTask':
        return this.#createTask(input);
      case 'updateTask':
        return this.#updateTask(input);
      case 'deleteTask':
        return this.#deleteTask(input);
      case 'assignTask':
        return this.#assignTask(input);
      case 'listBoards':
        return { ok: true, result: { kind: 'externalRefs', externalRefs: [] } };
      case 'getBoard':
        return {
          ok: false,
          error: 'unsupported_operation',
          message: 'GitHub does not expose a board concept via the REST API.',
        };
      case 'listSprints':
        return { ok: true, result: { kind: 'externalRefs', externalRefs: [] } };
      case 'getSprint':
        return {
          ok: false,
          error: 'unsupported_operation',
          message: 'Sprints are not a GitHub REST API concept.',
        };
      case 'createSprint':
        return {
          ok: false,
          error: 'unsupported_operation',
          message: 'Sprints are not a GitHub REST API concept.',
        };
      case 'listMilestones':
        return this.#listMilestones(input);
      case 'getMilestone':
        return this.#getMilestone(input);
      case 'listComments':
        return this.#listComments(input);
      case 'addComment':
        return this.#addComment(input);
      case 'listLabels':
        return this.#listLabels(input);
      case 'listTimeEntries':
        return { ok: true, result: { kind: 'externalRefs', externalRefs: [] } };
      case 'logTime':
        return {
          ok: false,
          error: 'unsupported_operation',
          message: 'GitHub does not support time tracking natively.',
        };
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported ProjectsWorkMgmt operation: ${String(input.operation)}.`,
        };
    }
  }

  // ── Repositories (Projects) ─────────────────────────────────────────────────

  async #listProjects(
    input: ProjectsWorkMgmtExecuteInputV1,
  ): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    const owner = this.#resolveOwner(input.payload);
    if (owner === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'owner is required for listProjects.',
      };
    }
    try {
      const data = await this.#getJson<Record<string, unknown>[]>(
        `/orgs/${encodeURIComponent(owner)}/repos?per_page=100`,
      );
      return {
        ok: true,
        result: { kind: 'externalRefs', externalRefs: data.map(mapRepoToExternalRef) },
      };
    } catch (err) {
      return { ok: false, error: 'provider_error', message: String(err) };
    }
  }

  async #getProject(
    input: ProjectsWorkMgmtExecuteInputV1,
  ): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    const { owner, repo } = this.#resolveOwnerRepo(input.payload);
    if (owner === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'owner is required for getProject.',
      };
    }
    if (repo === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'repo is required for getProject.',
      };
    }
    try {
      const data = await this.#getJson<Record<string, unknown>>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      );
      return { ok: true, result: { kind: 'externalRef', externalRef: mapRepoToExternalRef(data) } };
    } catch (err) {
      if (String(err).includes('404')) {
        return {
          ok: false,
          error: 'not_found',
          message: `Repository ${owner}/${repo} was not found.`,
        };
      }
      return { ok: false, error: 'provider_error', message: String(err) };
    }
  }

  async #createProject(
    input: ProjectsWorkMgmtExecuteInputV1,
  ): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    const owner = this.#resolveOwner(input.payload);
    if (owner === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'owner is required for createProject.',
      };
    }
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createProject.',
      };
    }
    try {
      const body: Record<string, unknown> = { name };
      if (typeof input.payload?.['description'] === 'string') {
        body['description'] = input.payload['description'];
      }
      if (typeof input.payload?.['private'] === 'boolean') {
        body['private'] = input.payload['private'];
      }
      const data = await this.#postJson<Record<string, unknown>>(
        `/orgs/${encodeURIComponent(owner)}/repos`,
        body,
      );
      return { ok: true, result: { kind: 'externalRef', externalRef: mapRepoToExternalRef(data) } };
    } catch (err) {
      return { ok: false, error: 'provider_error', message: String(err) };
    }
  }

  // ── Issues / Pull Requests (Tasks) ─────────────────────────────────────────

  async #listTasks(
    input: ProjectsWorkMgmtExecuteInputV1,
  ): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    const { owner, repo } = this.#resolveOwnerRepo(input.payload);
    if (owner === null || repo === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'owner and repo are required for listTasks.',
      };
    }
    const state = typeof input.payload?.['state'] === 'string' ? input.payload['state'] : 'open';
    try {
      const data = await this.#getJson<Record<string, unknown>[]>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=${encodeURIComponent(state)}&per_page=100`,
      );
      return {
        ok: true,
        result: {
          kind: 'tasks',
          tasks: data.map((rec) => mapGitHubIssueToTask(rec, String(input.tenantId), owner, repo)),
        },
      };
    } catch (err) {
      return { ok: false, error: 'provider_error', message: String(err) };
    }
  }

  async #getTask(input: ProjectsWorkMgmtExecuteInputV1): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    const { owner, repo } = this.#resolveOwnerRepo(input.payload);
    if (owner === null || repo === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'owner and repo are required for getTask.',
      };
    }
    const taskId = readString(input.payload, 'taskId');
    if (taskId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'taskId is required for getTask.',
      };
    }
    const number = extractIssueNumber(taskId);
    if (number === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'taskId must be a GitHub issue number or gh:owner/repo/number.',
      };
    }
    try {
      const data = await this.#getJson<Record<string, unknown>>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}`,
      );
      return {
        ok: true,
        result: {
          kind: 'task',
          task: mapGitHubIssueToTask(data, String(input.tenantId), owner, repo),
        },
      };
    } catch (err) {
      if (String(err).includes('404')) {
        return { ok: false, error: 'not_found', message: `Issue ${taskId} was not found.` };
      }
      return { ok: false, error: 'provider_error', message: String(err) };
    }
  }

  async #createTask(
    input: ProjectsWorkMgmtExecuteInputV1,
  ): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    const { owner, repo } = this.#resolveOwnerRepo(input.payload);
    if (owner === null || repo === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'owner and repo are required for createTask.',
      };
    }
    const title = readString(input.payload, 'title');
    if (title === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'title is required for createTask.',
      };
    }
    try {
      const body: Record<string, unknown> = { title };
      if (typeof input.payload?.['body'] === 'string') body['body'] = input.payload['body'];
      if (typeof input.payload?.['assigneeId'] === 'string') {
        body['assignees'] = [input.payload['assigneeId']];
      }
      const data = await this.#postJson<Record<string, unknown>>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
        body,
      );
      return {
        ok: true,
        result: {
          kind: 'task',
          task: mapGitHubIssueToTask(data, String(input.tenantId), owner, repo),
        },
      };
    } catch (err) {
      return { ok: false, error: 'provider_error', message: String(err) };
    }
  }

  async #updateTask(
    input: ProjectsWorkMgmtExecuteInputV1,
  ): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    const { owner, repo } = this.#resolveOwnerRepo(input.payload);
    if (owner === null || repo === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'owner and repo are required for updateTask.',
      };
    }
    const taskId = readString(input.payload, 'taskId');
    if (taskId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'taskId is required for updateTask.',
      };
    }
    const number = extractIssueNumber(taskId);
    if (number === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'taskId must be a GitHub issue number or gh:owner/repo/number.',
      };
    }
    try {
      const body: Record<string, unknown> = {};
      if (typeof input.payload?.['title'] === 'string') body['title'] = input.payload['title'];
      const status = input.payload?.['status'];
      if (typeof status === 'string') {
        body['state'] = status === 'done' || status === 'cancelled' ? 'closed' : 'open';
        if (status === 'cancelled') body['state_reason'] = 'not_planned';
        else if (status === 'done') body['state_reason'] = 'completed';
      }
      if (typeof input.payload?.['body'] === 'string') body['body'] = input.payload['body'];
      const data = await this.#patchJson<Record<string, unknown>>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}`,
        body,
      );
      return {
        ok: true,
        result: {
          kind: 'task',
          task: mapGitHubIssueToTask(data, String(input.tenantId), owner, repo),
        },
      };
    } catch (err) {
      if (String(err).includes('404')) {
        return { ok: false, error: 'not_found', message: `Issue ${taskId} was not found.` };
      }
      return { ok: false, error: 'provider_error', message: String(err) };
    }
  }

  async #deleteTask(
    input: ProjectsWorkMgmtExecuteInputV1,
  ): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    // GitHub REST API does not support issue deletion; close as not_planned instead.
    const { owner, repo } = this.#resolveOwnerRepo(input.payload);
    if (owner === null || repo === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'owner and repo are required for deleteTask.',
      };
    }
    const taskId = readString(input.payload, 'taskId');
    if (taskId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'taskId is required for deleteTask.',
      };
    }
    const number = extractIssueNumber(taskId);
    if (number === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'taskId must be a GitHub issue number or gh:owner/repo/number.',
      };
    }
    try {
      await this.#patchJson(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}`,
        { state: 'closed', state_reason: 'not_planned' },
      );
      return { ok: true, result: { kind: 'accepted', operation: input.operation } };
    } catch (err) {
      if (String(err).includes('404')) {
        return { ok: false, error: 'not_found', message: `Issue ${taskId} was not found.` };
      }
      return { ok: false, error: 'provider_error', message: String(err) };
    }
  }

  async #assignTask(
    input: ProjectsWorkMgmtExecuteInputV1,
  ): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    const { owner, repo } = this.#resolveOwnerRepo(input.payload);
    if (owner === null || repo === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'owner and repo are required for assignTask.',
      };
    }
    const taskId = readString(input.payload, 'taskId');
    if (taskId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'taskId is required for assignTask.',
      };
    }
    const assigneeId = readString(input.payload, 'assigneeId');
    if (assigneeId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'assigneeId is required for assignTask.',
      };
    }
    const number = extractIssueNumber(taskId);
    if (number === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'taskId must be a GitHub issue number or gh:owner/repo/number.',
      };
    }
    try {
      const data = await this.#patchJson<Record<string, unknown>>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}`,
        { assignees: [assigneeId] },
      );
      return {
        ok: true,
        result: {
          kind: 'task',
          task: mapGitHubIssueToTask(data, String(input.tenantId), owner, repo),
        },
      };
    } catch (err) {
      if (String(err).includes('404')) {
        return { ok: false, error: 'not_found', message: `Issue ${taskId} was not found.` };
      }
      return { ok: false, error: 'provider_error', message: String(err) };
    }
  }

  // ── Milestones ──────────────────────────────────────────────────────────────

  async #listMilestones(
    input: ProjectsWorkMgmtExecuteInputV1,
  ): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    const { owner, repo } = this.#resolveOwnerRepo(input.payload);
    if (owner === null || repo === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'owner and repo are required for listMilestones.',
      };
    }
    try {
      const data = await this.#getJson<Record<string, unknown>[]>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/milestones?per_page=100`,
      );
      return {
        ok: true,
        result: {
          kind: 'externalRefs',
          externalRefs: data.map((rec) => mapMilestoneToExternalRef(rec, owner, repo)),
        },
      };
    } catch (err) {
      return { ok: false, error: 'provider_error', message: String(err) };
    }
  }

  async #getMilestone(
    input: ProjectsWorkMgmtExecuteInputV1,
  ): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    const { owner, repo } = this.#resolveOwnerRepo(input.payload);
    if (owner === null || repo === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'owner and repo are required for getMilestone.',
      };
    }
    const milestoneId = readString(input.payload, 'milestoneId');
    if (milestoneId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'milestoneId is required for getMilestone.',
      };
    }
    try {
      const data = await this.#getJson<Record<string, unknown>>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/milestones/${encodeURIComponent(milestoneId)}`,
      );
      return {
        ok: true,
        result: {
          kind: 'externalRef',
          externalRef: mapMilestoneToExternalRef(data, owner, repo),
        },
      };
    } catch (err) {
      if (String(err).includes('404')) {
        return {
          ok: false,
          error: 'not_found',
          message: `Milestone ${milestoneId} was not found.`,
        };
      }
      return { ok: false, error: 'provider_error', message: String(err) };
    }
  }

  // ── Comments ────────────────────────────────────────────────────────────────

  async #listComments(
    input: ProjectsWorkMgmtExecuteInputV1,
  ): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    const { owner, repo } = this.#resolveOwnerRepo(input.payload);
    if (owner === null || repo === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'owner and repo are required for listComments.',
      };
    }
    const refId = readString(input.payload, 'refId');
    if (refId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'refId is required for listComments.',
      };
    }
    const number = extractIssueNumber(refId);
    if (number === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'refId must be an issue number.',
      };
    }
    try {
      const data = await this.#getJson<Record<string, unknown>[]>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}/comments?per_page=100`,
      );
      return {
        ok: true,
        result: { kind: 'externalRefs', externalRefs: data.map(mapCommentToExternalRef) },
      };
    } catch (err) {
      return { ok: false, error: 'provider_error', message: String(err) };
    }
  }

  async #addComment(
    input: ProjectsWorkMgmtExecuteInputV1,
  ): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    const { owner, repo } = this.#resolveOwnerRepo(input.payload);
    if (owner === null || repo === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'owner and repo are required for addComment.',
      };
    }
    const refId = readString(input.payload, 'refId');
    if (refId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'refId is required for addComment.',
      };
    }
    const content = readString(input.payload, 'content');
    if (content === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'content is required for addComment.',
      };
    }
    const number = extractIssueNumber(refId);
    if (number === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'refId must be an issue number.',
      };
    }
    try {
      const data = await this.#postJson<Record<string, unknown>>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${number}/comments`,
        { body: content },
      );
      return {
        ok: true,
        result: { kind: 'externalRef', externalRef: mapCommentToExternalRef(data) },
      };
    } catch (err) {
      return { ok: false, error: 'provider_error', message: String(err) };
    }
  }

  // ── Labels ──────────────────────────────────────────────────────────────────

  async #listLabels(
    input: ProjectsWorkMgmtExecuteInputV1,
  ): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    const { owner, repo } = this.#resolveOwnerRepo(input.payload);
    if (owner === null || repo === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'owner and repo are required for listLabels.',
      };
    }
    try {
      const data = await this.#getJson<Record<string, unknown>[]>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/labels?per_page=100`,
      );
      return {
        ok: true,
        result: {
          kind: 'externalRefs',
          externalRefs: data.map((rec) => mapLabelToExternalRef(rec, owner, repo)),
        },
      };
    } catch (err) {
      return { ok: false, error: 'provider_error', message: String(err) };
    }
  }

  // ── HTTP helpers ────────────────────────────────────────────────────────────

  async #getJson<T>(path: string): Promise<T> {
    return this.#request<T>('GET', path, undefined);
  }

  async #postJson<T>(path: string, body: unknown): Promise<T> {
    return this.#request<T>('POST', path, body);
  }

  async #patchJson<T>(path: string, body: unknown): Promise<T> {
    return this.#request<T>('PATCH', path, body);
  }

  async #request<T>(method: string, path: string, body: unknown): Promise<T> {
    const url = `${this.#baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.#token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`GitHub API ${response.status} (${path}): ${text}`);
      }
      const text = await response.text();
      if (!text) return undefined as T;
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Payload helpers ─────────────────────────────────────────────────────────

  #resolveOwner(payload: Readonly<Record<string, unknown>> | undefined): string | null {
    if (typeof payload?.['owner'] === 'string' && payload['owner'].length > 0) {
      return payload['owner'];
    }
    return this.#defaultOwner ?? null;
  }

  #resolveOwnerRepo(payload: Readonly<Record<string, unknown>> | undefined): {
    owner: string | null;
    repo: string | null;
  } {
    // Support "owner/repo" shorthand in projectId field
    const projectId = payload?.['projectId'];
    if (typeof projectId === 'string' && projectId.includes('/')) {
      const slash = projectId.indexOf('/');
      return {
        owner: projectId.slice(0, slash) || null,
        repo: projectId.slice(slash + 1) || null,
      };
    }
    const owner = this.#resolveOwner(payload);
    const repoRaw = payload?.['repo'];
    const repo =
      typeof repoRaw === 'string' && repoRaw.length > 0 ? repoRaw : (this.#defaultRepo ?? null);
    return { owner, repo };
  }
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function readString(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function extractIssueNumber(taskId: string): string | null {
  // Accepts "gh:owner/repo/42" or plain numeric string "42"
  if (taskId.startsWith('gh:')) {
    const parts = taskId.slice(3).split('/');
    return parts.length === 3 ? (parts[2] ?? null) : null;
  }
  if (/^\d+$/.test(taskId)) return taskId;
  return null;
}
