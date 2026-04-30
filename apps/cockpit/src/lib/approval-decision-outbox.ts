import type { ApprovalDecisionRequest } from '@portarium/cockpit-types';
import { CockpitApiError } from '@/lib/control-plane-client';

const STORAGE_PREFIX = 'portarium:cockpit:approval-outbox:v1';
const MAX_ATTEMPTS = 5;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface QueueStorageEntry {
  idempotencyKey: string;
  workspaceId: string;
  approvalId: string;
  decision: ApprovalDecisionRequest;
  queuedAtIso: string;
  attemptCount: number;
  nextAttemptAtIso: string;
}

interface DrainOptions {
  workspaceId: string;
  sendDecision: (entry: QueueStorageEntry) => Promise<void>;
  now?: Date;
}

interface EnqueueOptions {
  now?: Date;
}

interface StorageLike {
  readonly length: number;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

interface DrainResult {
  processed: number;
  delivered: number;
  requeued: number;
  dropped: number;
}

function storage(target?: StorageLike): StorageLike | null {
  if (target) return target;
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function keyForWorkspace(workspaceId: string): string {
  return `${STORAGE_PREFIX}:${workspaceId}`;
}

function isApprovalDecisionRequest(value: unknown): value is ApprovalDecisionRequest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as ApprovalDecisionRequest;
  const validDecision =
    candidate.decision === 'Approved' ||
    candidate.decision === 'Denied' ||
    candidate.decision === 'RequestChanges';
  return validDecision && typeof candidate.rationale === 'string';
}

function isQueueEntry(value: unknown): value is QueueStorageEntry {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<QueueStorageEntry>;
  return (
    typeof item.idempotencyKey === 'string' &&
    typeof item.workspaceId === 'string' &&
    typeof item.approvalId === 'string' &&
    typeof item.queuedAtIso === 'string' &&
    typeof item.attemptCount === 'number' &&
    typeof item.nextAttemptAtIso === 'string' &&
    isApprovalDecisionRequest(item.decision)
  );
}

function readQueue(workspaceId: string): QueueStorageEntry[] {
  const target = storage();
  if (!target) return [];
  const raw = target.getItem(keyForWorkspace(workspaceId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is QueueStorageEntry => isQueueEntry(entry));
  } catch {
    return [];
  }
}

function writeQueue(workspaceId: string, queue: QueueStorageEntry[]): void {
  const target = storage();
  if (!target) return;
  target.setItem(keyForWorkspace(workspaceId), JSON.stringify(queue));
}

function normalizeRationale(rationale: string): string {
  return rationale.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function buildApprovalDecisionIdempotencyKey(params: {
  workspaceId: string;
  approvalId: string;
  decision: ApprovalDecisionRequest;
}): string {
  return [
    params.workspaceId,
    params.approvalId,
    params.decision.decision,
    normalizeRationale(params.decision.rationale),
  ].join(':');
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof CockpitApiError) {
    return (
      error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500
    );
  }
  return error instanceof TypeError;
}

function isTerminalConflict(error: unknown): boolean {
  return error instanceof CockpitApiError && error.status === 409;
}

function nextAttemptAt(now: Date, attemptCount: number): string {
  const delayMs = Math.min(1000 * 2 ** attemptCount, 30_000);
  return new Date(now.getTime() + delayMs).toISOString();
}

function isExpired(entry: QueueStorageEntry, now: Date): boolean {
  const queuedAt = new Date(entry.queuedAtIso).getTime();
  return Number.isFinite(queuedAt) && now.getTime() - queuedAt > MAX_AGE_MS;
}

export function listApprovalDecisionOutbox(workspaceId: string): QueueStorageEntry[] {
  return readQueue(workspaceId);
}

export function clearApprovalDecisionOutbox(target?: StorageLike): number {
  const store = storage(target);
  if (!store) return 0;

  const keys: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
  }

  for (const key of keys) {
    store.removeItem(key);
  }

  return keys.length;
}

export function enqueueApprovalDecisionOutbox(
  params: {
    workspaceId: string;
    approvalId: string;
    decision: ApprovalDecisionRequest;
  },
  options: EnqueueOptions = {},
): { queued: boolean; idempotencyKey: string; size: number } {
  const now = options.now ?? new Date();
  const queue = readQueue(params.workspaceId);
  const idempotencyKey = buildApprovalDecisionIdempotencyKey(params);
  const duplicate = queue.some((item) => item.idempotencyKey === idempotencyKey);

  if (duplicate) {
    return { queued: false, idempotencyKey, size: queue.length };
  }

  queue.push({
    idempotencyKey,
    workspaceId: params.workspaceId,
    approvalId: params.approvalId,
    decision: params.decision,
    queuedAtIso: now.toISOString(),
    attemptCount: 0,
    nextAttemptAtIso: now.toISOString(),
  });
  writeQueue(params.workspaceId, queue);

  return { queued: true, idempotencyKey, size: queue.length };
}

export async function drainApprovalDecisionOutbox(options: DrainOptions): Promise<DrainResult> {
  const now = options.now ?? new Date();
  const queue = readQueue(options.workspaceId);

  let processed = 0;
  let delivered = 0;
  let requeued = 0;
  let dropped = 0;
  const nextQueue: QueueStorageEntry[] = [];

  for (const entry of queue) {
    if (isExpired(entry, now) || entry.attemptCount >= MAX_ATTEMPTS) {
      dropped += 1;
      continue;
    }

    if (new Date(entry.nextAttemptAtIso).getTime() > now.getTime()) {
      nextQueue.push(entry);
      continue;
    }

    processed += 1;

    try {
      await options.sendDecision(entry);
      delivered += 1;
    } catch (error) {
      if (isTerminalConflict(error)) {
        delivered += 1;
        continue;
      }

      if (isRetryableError(error)) {
        requeued += 1;
        nextQueue.push({
          ...entry,
          attemptCount: entry.attemptCount + 1,
          nextAttemptAtIso: nextAttemptAt(now, entry.attemptCount + 1),
        });
        continue;
      }

      dropped += 1;
    }
  }

  writeQueue(options.workspaceId, nextQueue);

  return { processed, delivered, requeued, dropped };
}
