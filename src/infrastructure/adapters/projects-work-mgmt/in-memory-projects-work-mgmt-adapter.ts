import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { CanonicalTaskV1 } from '../../../domain/canonical/task-v1.js';
import { CanonicalTaskId } from '../../../domain/primitives/index.js';
import type {
  ProjectsWorkMgmtAdapterPort,
  ProjectsWorkMgmtExecuteInputV1,
  ProjectsWorkMgmtExecuteOutputV1,
} from '../../../application/ports/projects-work-mgmt-adapter.js';
import { PROJECTS_WORK_MGMT_OPERATIONS_V1 } from '../../../application/ports/projects-work-mgmt-adapter.js';

const OPERATION_SET = new Set<string>(PROJECTS_WORK_MGMT_OPERATIONS_V1);
const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const;

type TenantExternalRef = Readonly<{
  tenantId: ProjectsWorkMgmtExecuteInputV1['tenantId'];
  externalRef: ExternalObjectRef;
}>;

type CommentEntry = Readonly<{
  tenantId: ProjectsWorkMgmtExecuteInputV1['tenantId'];
  refId: string;
  externalRef: ExternalObjectRef;
}>;

type TimeEntry = Readonly<{
  tenantId: ProjectsWorkMgmtExecuteInputV1['tenantId'];
  taskId: string;
  externalRef: ExternalObjectRef;
}>;

type InMemoryProjectsWorkMgmtAdapterSeed = Readonly<{
  projects?: readonly TenantExternalRef[];
  tasks?: readonly CanonicalTaskV1[];
  boards?: readonly TenantExternalRef[];
  sprints?: readonly TenantExternalRef[];
  milestones?: readonly TenantExternalRef[];
  comments?: readonly CommentEntry[];
  labels?: readonly TenantExternalRef[];
  timeEntries?: readonly TimeEntry[];
}>;

type InMemoryProjectsWorkMgmtAdapterParams = Readonly<{
  seed?: InMemoryProjectsWorkMgmtAdapterSeed;
  now?: () => Date;
}>;

function readString(payload: Readonly<Record<string, unknown>> | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(payload: Readonly<Record<string, unknown>> | undefined, key: string): number | null {
  const value = payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export class InMemoryProjectsWorkMgmtAdapter implements ProjectsWorkMgmtAdapterPort {
  readonly #now: () => Date;
  readonly #projects: TenantExternalRef[];
  readonly #tasks: CanonicalTaskV1[];
  readonly #boards: TenantExternalRef[];
  readonly #sprints: TenantExternalRef[];
  readonly #milestones: TenantExternalRef[];
  readonly #comments: CommentEntry[];
  readonly #labels: TenantExternalRef[];
  readonly #timeEntries: TimeEntry[];
  #projectSequence: number;
  #taskSequence: number;
  #sprintSequence: number;
  #commentSequence: number;
  #timeEntrySequence: number;

  public constructor(params?: InMemoryProjectsWorkMgmtAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#projects = [...(params?.seed?.projects ?? [])];
    this.#tasks = [...(params?.seed?.tasks ?? [])];
    this.#boards = [...(params?.seed?.boards ?? [])];
    this.#sprints = [...(params?.seed?.sprints ?? [])];
    this.#milestones = [...(params?.seed?.milestones ?? [])];
    this.#comments = [...(params?.seed?.comments ?? [])];
    this.#labels = [...(params?.seed?.labels ?? [])];
    this.#timeEntries = [...(params?.seed?.timeEntries ?? [])];
    this.#projectSequence = this.#projects.length;
    this.#taskSequence = this.#tasks.length;
    this.#sprintSequence = this.#sprints.length;
    this.#commentSequence = this.#comments.length;
    this.#timeEntrySequence = this.#timeEntries.length;
  }

  public async execute(input: ProjectsWorkMgmtExecuteInputV1): Promise<ProjectsWorkMgmtExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported ProjectsWorkMgmt operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'listProjects':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#projects, input) },
        };
      case 'getProject':
        return this.#getTenantRef(input, this.#projects, 'projectId', 'Project', 'getProject');
      case 'createProject':
        return this.#createProject(input);
      case 'listTasks':
        return { ok: true, result: { kind: 'tasks', tasks: this.#listTasks(input) } };
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
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#boards, input) },
        };
      case 'getBoard':
        return this.#getTenantRef(input, this.#boards, 'boardId', 'Board', 'getBoard');
      case 'listSprints':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#sprints, input) },
        };
      case 'getSprint':
        return this.#getTenantRef(input, this.#sprints, 'sprintId', 'Sprint', 'getSprint');
      case 'createSprint':
        return this.#createSprint(input);
      case 'listMilestones':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#milestones, input) },
        };
      case 'getMilestone':
        return this.#getTenantRef(input, this.#milestones, 'milestoneId', 'Milestone', 'getMilestone');
      case 'listComments':
        return this.#listComments(input);
      case 'addComment':
        return this.#addComment(input);
      case 'listLabels':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#labels, input) },
        };
      case 'listTimeEntries':
        return this.#listTimeEntries(input);
      case 'logTime':
        return this.#logTime(input);
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported ProjectsWorkMgmt operation: ${String(input.operation)}.`,
        };
    }
  }

  #createProject(input: ProjectsWorkMgmtExecuteInputV1): ProjectsWorkMgmtExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createProject.',
      };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'ProjectsSuite',
      portFamily: 'ProjectsWorkMgmt',
      externalId: `project-${++this.#projectSequence}`,
      externalType: 'project',
      displayLabel: name,
    };
    this.#projects.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #listTasks(input: ProjectsWorkMgmtExecuteInputV1): readonly CanonicalTaskV1[] {
    return this.#tasks.filter((task) => task.tenantId === input.tenantId);
  }

  #getTask(input: ProjectsWorkMgmtExecuteInputV1): ProjectsWorkMgmtExecuteOutputV1 {
    const taskId = readString(input.payload, 'taskId');
    if (taskId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'taskId is required for getTask.',
      };
    }

    const task = this.#tasks.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.canonicalTaskId === taskId,
    );
    if (task === undefined) {
      return { ok: false, error: 'not_found', message: `Task ${taskId} was not found.` };
    }
    return { ok: true, result: { kind: 'task', task } };
  }

  #createTask(input: ProjectsWorkMgmtExecuteInputV1): ProjectsWorkMgmtExecuteOutputV1 {
    const title = readString(input.payload, 'title');
    if (title === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'title is required for createTask.',
      };
    }

    const task: CanonicalTaskV1 = {
      canonicalTaskId: CanonicalTaskId(`task-${++this.#taskSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      title,
      status: 'todo',
      ...(typeof input.payload?.['assigneeId'] === 'string'
        ? { assigneeId: input.payload['assigneeId'] }
        : {}),
      ...(typeof input.payload?.['dueAtIso'] === 'string'
        ? { dueAtIso: input.payload['dueAtIso'] }
        : {}),
    };
    this.#tasks.push(task);
    return { ok: true, result: { kind: 'task', task } };
  }

  #updateTask(input: ProjectsWorkMgmtExecuteInputV1): ProjectsWorkMgmtExecuteOutputV1 {
    const taskId = readString(input.payload, 'taskId');
    if (taskId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'taskId is required for updateTask.',
      };
    }

    const index = this.#tasks.findIndex(
      (candidate) => candidate.tenantId === input.tenantId && candidate.canonicalTaskId === taskId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Task ${taskId} was not found.` };
    }

    const statusValue = input.payload?.['status'];
    if (
      statusValue !== undefined &&
      (typeof statusValue !== 'string' || !(TASK_STATUSES as readonly string[]).includes(statusValue))
    ) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'status must be one of: todo, in_progress, done, cancelled.',
      };
    }

    const current = this.#tasks[index]!;
    const task: CanonicalTaskV1 = {
      ...current,
      ...(typeof input.payload?.['title'] === 'string' ? { title: input.payload['title'] } : {}),
      ...(typeof statusValue === 'string' ? { status: statusValue as CanonicalTaskV1['status'] } : {}),
      ...(typeof input.payload?.['assigneeId'] === 'string'
        ? { assigneeId: input.payload['assigneeId'] }
        : {}),
      ...(typeof input.payload?.['dueAtIso'] === 'string'
        ? { dueAtIso: input.payload['dueAtIso'] }
        : {}),
    };
    this.#tasks[index] = task;
    return { ok: true, result: { kind: 'task', task } };
  }

  #deleteTask(input: ProjectsWorkMgmtExecuteInputV1): ProjectsWorkMgmtExecuteOutputV1 {
    const taskId = readString(input.payload, 'taskId');
    if (taskId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'taskId is required for deleteTask.',
      };
    }

    const index = this.#tasks.findIndex(
      (candidate) => candidate.tenantId === input.tenantId && candidate.canonicalTaskId === taskId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Task ${taskId} was not found.` };
    }
    this.#tasks.splice(index, 1);

    for (let i = this.#timeEntries.length - 1; i >= 0; i -= 1) {
      const entry = this.#timeEntries[i]!;
      if (entry.tenantId === input.tenantId && entry.taskId === taskId) {
        this.#timeEntries.splice(i, 1);
      }
    }

    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  #assignTask(input: ProjectsWorkMgmtExecuteInputV1): ProjectsWorkMgmtExecuteOutputV1 {
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

    const index = this.#tasks.findIndex(
      (candidate) => candidate.tenantId === input.tenantId && candidate.canonicalTaskId === taskId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Task ${taskId} was not found.` };
    }

    const task: CanonicalTaskV1 = { ...this.#tasks[index]!, assigneeId };
    this.#tasks[index] = task;
    return { ok: true, result: { kind: 'task', task } };
  }

  #createSprint(input: ProjectsWorkMgmtExecuteInputV1): ProjectsWorkMgmtExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createSprint.',
      };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'ProjectsSuite',
      portFamily: 'ProjectsWorkMgmt',
      externalId: `sprint-${++this.#sprintSequence}`,
      externalType: 'sprint',
      displayLabel: name,
    };
    this.#sprints.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #listComments(input: ProjectsWorkMgmtExecuteInputV1): ProjectsWorkMgmtExecuteOutputV1 {
    const refId = readString(input.payload, 'refId');
    if (refId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'refId is required for listComments.',
      };
    }

    return {
      ok: true,
      result: {
        kind: 'externalRefs',
        externalRefs: this.#comments
          .filter((entry) => entry.tenantId === input.tenantId && entry.refId === refId)
          .map((entry) => entry.externalRef),
      },
    };
  }

  #addComment(input: ProjectsWorkMgmtExecuteInputV1): ProjectsWorkMgmtExecuteOutputV1 {
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

    const externalRef: ExternalObjectRef = {
      sorName: 'ProjectsSuite',
      portFamily: 'ProjectsWorkMgmt',
      externalId: `comment-${++this.#commentSequence}`,
      externalType: 'comment',
      displayLabel: content.length > 64 ? `${content.slice(0, 61)}...` : content,
      deepLinkUrl: `https://projects.example/items/${encodeURIComponent(refId)}/comments/${
        this.#commentSequence
      }`,
    };
    this.#comments.push({ tenantId: input.tenantId, refId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #listTimeEntries(input: ProjectsWorkMgmtExecuteInputV1): ProjectsWorkMgmtExecuteOutputV1 {
    const taskIdFilter =
      typeof input.payload?.['taskId'] === 'string' ? (input.payload['taskId']) : null;
    return {
      ok: true,
      result: {
        kind: 'externalRefs',
        externalRefs: this.#timeEntries
          .filter(
            (entry) =>
              entry.tenantId === input.tenantId &&
              (taskIdFilter === null || entry.taskId === taskIdFilter),
          )
          .map((entry) => entry.externalRef),
      },
    };
  }

  #logTime(input: ProjectsWorkMgmtExecuteInputV1): ProjectsWorkMgmtExecuteOutputV1 {
    const taskId = readString(input.payload, 'taskId');
    if (taskId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'taskId is required for logTime.',
      };
    }

    const task = this.#tasks.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.canonicalTaskId === taskId,
    );
    if (task === undefined) {
      return { ok: false, error: 'not_found', message: `Task ${taskId} was not found.` };
    }
    void task;

    const minutes = readNumber(input.payload, 'minutes');
    if (minutes === null || minutes <= 0) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'minutes must be a positive number for logTime.',
      };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'ProjectsSuite',
      portFamily: 'ProjectsWorkMgmt',
      externalId: `time-entry-${++this.#timeEntrySequence}`,
      externalType: 'time_entry',
      displayLabel: `${minutes} minutes`,
      deepLinkUrl: `https://projects.example/time/${this.#timeEntrySequence}?at=${encodeURIComponent(
        this.#now().toISOString(),
      )}`,
    };
    this.#timeEntries.push({ tenantId: input.tenantId, taskId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #listTenantRefs(
    source: readonly TenantExternalRef[],
    input: ProjectsWorkMgmtExecuteInputV1,
  ): readonly ExternalObjectRef[] {
    return source
      .filter((entry) => entry.tenantId === input.tenantId)
      .map((entry) => entry.externalRef);
  }

  #getTenantRef(
    input: ProjectsWorkMgmtExecuteInputV1,
    source: readonly TenantExternalRef[],
    key: string,
    label: string,
    operationName: string,
  ): ProjectsWorkMgmtExecuteOutputV1 {
    const externalId = readString(input.payload, key);
    if (externalId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: `${key} is required for ${operationName}.`,
      };
    }
    const found = source.find(
      (entry) =>
        entry.tenantId === input.tenantId && entry.externalRef.externalId === externalId,
    );
    if (found === undefined) {
      return { ok: false, error: 'not_found', message: `${label} ${externalId} was not found.` };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef: found.externalRef } };
  }

  public static seedMinimal(
    tenantId: ProjectsWorkMgmtExecuteInputV1['tenantId'],
  ): InMemoryProjectsWorkMgmtAdapterSeed {
    return {
      projects: [
        {
          tenantId,
          externalRef: {
            sorName: 'ProjectsSuite',
            portFamily: 'ProjectsWorkMgmt',
            externalId: 'project-1000',
            externalType: 'project',
            displayLabel: 'Ops Platform Rollout',
          },
        },
      ],
      tasks: [
        {
          canonicalTaskId: CanonicalTaskId('task-1000'),
          tenantId,
          schemaVersion: 1,
          title: 'Create rollout checklist',
          status: 'todo',
        },
      ],
      boards: [
        {
          tenantId,
          externalRef: {
            sorName: 'ProjectsSuite',
            portFamily: 'ProjectsWorkMgmt',
            externalId: 'board-1000',
            externalType: 'board',
            displayLabel: 'Program Board',
          },
        },
      ],
      sprints: [
        {
          tenantId,
          externalRef: {
            sorName: 'ProjectsSuite',
            portFamily: 'ProjectsWorkMgmt',
            externalId: 'sprint-1000',
            externalType: 'sprint',
            displayLabel: 'Sprint 12',
          },
        },
      ],
      milestones: [
        {
          tenantId,
          externalRef: {
            sorName: 'ProjectsSuite',
            portFamily: 'ProjectsWorkMgmt',
            externalId: 'milestone-1000',
            externalType: 'milestone',
            displayLabel: 'Pilot Complete',
          },
        },
      ],
      comments: [
        {
          tenantId,
          refId: 'task-1000',
          externalRef: {
            sorName: 'ProjectsSuite',
            portFamily: 'ProjectsWorkMgmt',
            externalId: 'comment-1000',
            externalType: 'comment',
            displayLabel: 'Initial draft ready.',
          },
        },
      ],
      labels: [
        {
          tenantId,
          externalRef: {
            sorName: 'ProjectsSuite',
            portFamily: 'ProjectsWorkMgmt',
            externalId: 'label-1000',
            externalType: 'label',
            displayLabel: 'ops-critical',
          },
        },
      ],
      timeEntries: [
        {
          tenantId,
          taskId: 'task-1000',
          externalRef: {
            sorName: 'ProjectsSuite',
            portFamily: 'ProjectsWorkMgmt',
            externalId: 'time-entry-1000',
            externalType: 'time_entry',
            displayLabel: '45 minutes',
          },
        },
      ],
    };
  }
}
