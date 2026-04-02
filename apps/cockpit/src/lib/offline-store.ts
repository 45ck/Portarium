/**
 * IndexedDB-backed offline store for the Portarium Cockpit PWA.
 *
 * Stores pending approval decisions and cached API responses in IndexedDB
 * for offline resilience. Falls back gracefully when IndexedDB is unavailable.
 *
 * Bead: bead-0946
 */

const DB_NAME = 'portarium-cockpit-offline';
const DB_VERSION = 1;

/** Object store names */
const PENDING_DECISIONS_STORE = 'pending-decisions';
const CACHED_RESPONSES_STORE = 'cached-responses';

export interface PendingDecision {
  idempotencyKey: string;
  workspaceId: string;
  approvalId: string;
  decision: string;
  rationale: string;
  queuedAt: string;
  attemptCount: number;
  nextAttemptAt: string;
}

export interface CachedResponse {
  cacheKey: string;
  data: unknown;
  savedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(PENDING_DECISIONS_STORE)) {
        const store = db.createObjectStore(PENDING_DECISIONS_STORE, {
          keyPath: 'idempotencyKey',
        });
        store.createIndex('workspaceId', 'workspaceId', { unique: false });
      }

      if (!db.objectStoreNames.contains(CACHED_RESPONSES_STORE)) {
        db.createObjectStore(CACHED_RESPONSES_STORE, { keyPath: 'cacheKey' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function wrapIdbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Pending decisions ────────────────────────────────────────────────────────

export async function putPendingDecision(entry: PendingDecision): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PENDING_DECISIONS_STORE, 'readwrite');
  const store = tx.objectStore(PENDING_DECISIONS_STORE);
  await wrapIdbRequest(store.put(entry));
  db.close();
}

export async function getPendingDecisions(workspaceId: string): Promise<PendingDecision[]> {
  const db = await openDb();
  const tx = db.transaction(PENDING_DECISIONS_STORE, 'readonly');
  const store = tx.objectStore(PENDING_DECISIONS_STORE);
  const index = store.index('workspaceId');
  const results = await wrapIdbRequest(index.getAll(workspaceId));
  db.close();
  return results;
}

export async function getAllPendingDecisions(): Promise<PendingDecision[]> {
  const db = await openDb();
  const tx = db.transaction(PENDING_DECISIONS_STORE, 'readonly');
  const store = tx.objectStore(PENDING_DECISIONS_STORE);
  const results = await wrapIdbRequest(store.getAll());
  db.close();
  return results;
}

export async function removePendingDecision(idempotencyKey: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(PENDING_DECISIONS_STORE, 'readwrite');
  const store = tx.objectStore(PENDING_DECISIONS_STORE);
  await wrapIdbRequest(store.delete(idempotencyKey));
  db.close();
}

export async function countPendingDecisions(): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(PENDING_DECISIONS_STORE, 'readonly');
  const store = tx.objectStore(PENDING_DECISIONS_STORE);
  const count = await wrapIdbRequest(store.count());
  db.close();
  return count;
}

// ── Cached API responses ─────────────────────────────────────────────────────

export async function putCachedResponse(entry: CachedResponse): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(CACHED_RESPONSES_STORE, 'readwrite');
  const store = tx.objectStore(CACHED_RESPONSES_STORE);
  await wrapIdbRequest(store.put(entry));
  db.close();
}

export async function getCachedResponse(cacheKey: string): Promise<CachedResponse | undefined> {
  const db = await openDb();
  const tx = db.transaction(CACHED_RESPONSES_STORE, 'readonly');
  const store = tx.objectStore(CACHED_RESPONSES_STORE);
  const result = await wrapIdbRequest(store.get(cacheKey));
  db.close();
  return result;
}

export async function clearCachedResponses(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(CACHED_RESPONSES_STORE, 'readwrite');
  const store = tx.objectStore(CACHED_RESPONSES_STORE);
  await wrapIdbRequest(store.clear());
  db.close();
}

// ── Database management ──────────────────────────────────────────────────────

export async function deleteOfflineDatabase(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
