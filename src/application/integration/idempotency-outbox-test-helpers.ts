/**
 * Shared in-memory fixtures for idempotency + outbox integration tests.
 *
 * Extracted from idempotency-outbox-replay-safety.integration.test.ts to keep
 * each test file under the max-lines (350) ESLint limit.
 */
import { MAX_OUTBOX_RETRIES } from '../services/outbox-dispatcher.js';
import type {
  AuthorizationPort,
  Clock,
  IdGenerator,
  IdempotencyKey,
  IdempotencyStore,
  OutboxEntry,
  OutboxPort,
  UnitOfWork,
  WorkspaceStore,
} from '../ports/index.js';
import type { WorkspaceV1 } from '../../domain/workspaces/workspace-v1.js';
import type { PortariumCloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';

export class InMemoryWorkspaceStore implements WorkspaceStore {
  readonly #byId = new Map<string, WorkspaceV1>();

  public getWorkspaceById(_tenantId: string, workspaceId: string): Promise<WorkspaceV1 | null> {
    return Promise.resolve(this.#byId.get(workspaceId) ?? null);
  }

  public getWorkspaceByName(_tenantId: string, workspaceName: string): Promise<WorkspaceV1 | null> {
    for (const workspace of this.#byId.values()) {
      if (workspace.name === workspaceName) return Promise.resolve(workspace);
    }
    return Promise.resolve(null);
  }

  public saveWorkspace(workspace: WorkspaceV1): Promise<void> {
    this.#byId.set(String(workspace.workspaceId), workspace);
    return Promise.resolve();
  }
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  readonly #cache = new Map<string, unknown>();

  public get<T>(key: IdempotencyKey): Promise<T | null> {
    return Promise.resolve(
      (this.#cache.get(`${key.tenantId}:${key.commandName}:${key.requestKey}`) as T) ?? null,
    );
  }

  public set<T>(key: IdempotencyKey, value: T): Promise<void> {
    this.#cache.set(`${key.tenantId}:${key.commandName}:${key.requestKey}`, value);
    return Promise.resolve();
  }

  public size(): number {
    return this.#cache.size;
  }
}

export class InMemoryOutboxStore implements OutboxPort {
  readonly #entries = new Map<string, OutboxEntry>();
  #seq = 0;
  /** When provided, fetchPending uses this as "now" for nextRetryAtIso comparison. */
  #nowIso: string | undefined;

  public constructor(nowIso?: string) {
    this.#nowIso = nowIso;
  }

  public setNow(nowIso: string): void {
    this.#nowIso = nowIso;
  }

  public enqueue(event: PortariumCloudEventV1): Promise<OutboxEntry> {
    this.#seq += 1;
    const entry: OutboxEntry = {
      entryId: `entry-${String(this.#seq).padStart(4, '0')}`,
      event,
      status: 'Pending',
      retryCount: 0,
    };
    this.#entries.set(entry.entryId, entry);
    return Promise.resolve(entry);
  }

  public fetchPending(limit: number): Promise<readonly OutboxEntry[]> {
    const now = this.#nowIso ?? new Date().toISOString();
    const result = [...this.#entries.values()]
      .filter(
        (e) =>
          e.status === 'Pending' && (e.nextRetryAtIso === undefined || e.nextRetryAtIso <= now),
      )
      .sort((a, b) => a.entryId.localeCompare(b.entryId))
      .slice(0, Math.max(0, limit));
    return Promise.resolve(result);
  }

  public markPublished(entryId: string): Promise<void> {
    const current = this.#entries.get(entryId);
    if (current) this.#entries.set(entryId, { ...current, status: 'Published' });
    return Promise.resolve();
  }

  public markFailed(entryId: string, reason: string, nextRetryAtIso: string): Promise<void> {
    const current = this.#entries.get(entryId);
    if (!current) return Promise.resolve();
    const newRetryCount = current.retryCount + 1;
    const status: OutboxEntry['status'] =
      newRetryCount >= MAX_OUTBOX_RETRIES ? 'Failed' : 'Pending';
    this.#entries.set(entryId, {
      ...current,
      status,
      failedReason: reason,
      nextRetryAtIso,
      retryCount: newRetryCount,
    });
    return Promise.resolve();
  }

  public allEntries(): readonly OutboxEntry[] {
    return [...this.#entries.values()].sort((a, b) => a.entryId.localeCompare(b.entryId));
  }

  public pendingCount(): number {
    return [...this.#entries.values()].filter((e) => e.status === 'Pending').length;
  }

  public publishedCount(): number {
    return [...this.#entries.values()].filter((e) => e.status === 'Published').length;
  }

  public failedCount(): number {
    return [...this.#entries.values()].filter((e) => e.status === 'Failed').length;
  }
}

export class InlineUnitOfWork implements UnitOfWork {
  readonly #failuresBeforeSuccess: number;
  #attempts = 0;

  public constructor(failuresBeforeSuccess = 0) {
    this.#failuresBeforeSuccess = failuresBeforeSuccess;
  }

  public execute<T>(fn: () => Promise<T>): Promise<T> {
    this.#attempts += 1;
    if (this.#attempts <= this.#failuresBeforeSuccess) {
      return Promise.reject(new Error('transient write failure'));
    }
    return fn();
  }
}

export function allowAll(): AuthorizationPort {
  return { isAllowed: () => Promise.resolve(true) };
}

export function fixedClock(nowIso: string): Clock {
  return { nowIso: () => nowIso };
}

export function counter(): IdGenerator {
  let n = 0;
  return { generateId: () => `id-${++n}` };
}

export const BASE_WORKSPACE = {
  schemaVersion: 1 as const,
  workspaceId: 'ws-1',
  tenantId: 'tenant-1',
  name: 'Test Workspace',
  createdAtIso: '2026-02-22T00:00:00.000Z',
};
