/**
 * Load test: Database connection pool saturation (bead-0940)
 *
 * Simulates a bounded connection pool and validates that the application
 * layer handles pool exhaustion gracefully — no hangs, no silent drops,
 * and correct back-pressure behaviour.
 *
 * Uses a synthetic pool (no real Postgres) to isolate pool-management
 * logic from network variability.
 */

import { describe, expect, it } from 'vitest';

import { parsePolicyV1 } from '../../src/domain/policy/index.js';
import { toAppContext } from '../../src/application/common/context.js';
import type {
  ApprovalStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  EvidenceLogPort,
  IdGenerator,
  PolicyStore,
  UnitOfWork,
} from '../../src/application/ports/index.js';
import { InMemoryAgentActionProposalStore } from '../../src/infrastructure/stores/in-memory-agent-action-proposal-store.js';
import { proposeAgentAction } from '../../src/application/commands/propose-agent-action.js';
import { computeStats, formatStats, runConcurrent } from './harness.js';

// ---------------------------------------------------------------------------
// Simulated connection pool
// ---------------------------------------------------------------------------

class SimulatedConnectionPool {
  readonly #maxConnections: number;
  readonly #queryLatencyMs: number;
  #active = 0;
  #waiters: (() => void)[] = [];
  #highWaterMark = 0;
  #totalAcquired = 0;
  #totalTimedOut = 0;

  constructor(maxConnections: number, queryLatencyMs: number) {
    this.#maxConnections = maxConnections;
    this.#queryLatencyMs = queryLatencyMs;
  }

  get highWaterMark(): number {
    return this.#highWaterMark;
  }
  get totalAcquired(): number {
    return this.#totalAcquired;
  }
  get totalTimedOut(): number {
    return this.#totalTimedOut;
  }
  get activeConnections(): number {
    return this.#active;
  }
  get waitingCount(): number {
    return this.#waiters.length;
  }

  async acquire(timeoutMs = 5000): Promise<{ release: () => void }> {
    if (this.#active < this.#maxConnections) {
      return this.#checkout();
    }

    // Wait for a connection to become available
    return new Promise<{ release: () => void }>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.#waiters.indexOf(waiter);
        if (idx !== -1) this.#waiters.splice(idx, 1);
        this.#totalTimedOut++;
        reject(new Error('connection pool timeout'));
      }, timeoutMs);

      const waiter = () => {
        clearTimeout(timer);
        resolve(this.#checkout());
      };
      this.#waiters.push(waiter);
    });
  }

  #checkout(): { release: () => void } {
    this.#active++;
    this.#totalAcquired++;
    if (this.#active > this.#highWaterMark) {
      this.#highWaterMark = this.#active;
    }

    return {
      release: () => {
        this.#active--;
        const next = this.#waiters.shift();
        if (next) next();
      },
    };
  }

  /** Simulate a query that holds a connection for queryLatencyMs. */
  async executeQuery<T>(fn: () => T, timeoutMs?: number): Promise<T> {
    const conn = await this.acquire(timeoutMs);
    try {
      // Simulate query latency
      await new Promise((r) => setTimeout(r, this.#queryLatencyMs));
      return fn();
    } finally {
      conn.release();
    }
  }
}

// ---------------------------------------------------------------------------
// Pool-backed stores
// ---------------------------------------------------------------------------

function makePoolBackedApprovalStore(pool: SimulatedConnectionPool): ApprovalStore {
  const data = new Map<string, any>();
  return {
    async getApprovalById(_tenantId, _workspaceId, approvalId) {
      return pool.executeQuery(() => data.get(String(approvalId)) ?? null);
    },
    async saveApproval(_tenantId, approval) {
      await pool.executeQuery(() => {
        data.set(String(approval.approvalId), approval);
      });
    },
  };
}

function makePoolBackedUnitOfWork(pool: SimulatedConnectionPool): UnitOfWork {
  return {
    async execute(fn) {
      const conn = await pool.acquire();
      try {
        return await fn();
      } finally {
        conn.release();
      }
    },
  };
}

function makeDeps(pool: SimulatedConnectionPool) {
  const approvalStore = makePoolBackedApprovalStore(pool);
  const proposalStore = new InMemoryAgentActionProposalStore();
  let idSeq = 0;

  return {
    authorization: { isAllowed: async () => true } as AuthorizationPort,
    clock: { nowIso: () => new Date().toISOString() } as Clock,
    idGenerator: {
      generateId: () => `pool-id-${++idSeq}-${Math.random().toString(36).slice(2)}`,
    } as IdGenerator,
    unitOfWork: makePoolBackedUnitOfWork(pool),
    eventPublisher: { publish: async () => undefined } as EventPublisher,
    evidenceLog: {
      appendEntry: async (_t: any, entry: any) => ({ ...entry, hashSha256: 'pool-hash' }),
    } as unknown as EvidenceLogPort,
    policyStore: {
      getPolicyById: async () =>
        parsePolicyV1({
          schemaVersion: 1,
          policyId: 'pol-pool-1',
          workspaceId: 'ws-pool',
          name: 'Pool Test Policy',
          active: true,
          priority: 1,
          version: 1,
          createdAtIso: '2026-01-01T00:00:00.000Z',
          createdByUserId: 'admin-1',
        }),
      savePolicy: async () => {},
    } as PolicyStore,
    approvalStore,
    proposalStore,
  };
}

function makeCtx(idx: number) {
  return toAppContext({
    tenantId: 'ws-pool',
    principalId: `agent-pool-${idx}`,
    correlationId: `corr-pool-${idx}`,
    roles: ['operator'],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('load: database connection pool saturation', () => {
  it(
    'pool with 10 connections handles 100 concurrent proposals without timeout',
    { timeout: 30_000 },
    async () => {
      const pool = new SimulatedConnectionPool(10, 1); // 10 conns, 1ms query
      const deps = makeDeps(pool);

      const result = await runConcurrent(
        async (idx) => {
          const r = await proposeAgentAction(deps, makeCtx(idx), {
            workspaceId: 'ws-pool',
            agentId: `agent-pool-${idx}`,
            actionKind: 'comms:listEmails',
            toolName: 'email:list',
            executionTier: 'Auto',
            policyIds: ['pol-pool-1'],
            rationale: `Pool saturation test ${idx}`,
          });
          if (!r.ok) throw new Error(`propose failed: ${r.error.kind}`);
        },
        100,
        50, // 50 concurrent → 5x pool size
      );

      const stats = computeStats(result.durations);
      console.info(formatStats('pool-10-conns / 100-requests', stats));
      console.info(
        `[LOAD] pool high-water-mark=${pool.highWaterMark} acquired=${pool.totalAcquired} timeouts=${pool.totalTimedOut}`,
      );

      expect(result.errors, 'no timeouts expected at 5x oversubscription').toBe(0);
      expect(result.successes).toBe(100);
      expect(pool.highWaterMark).toBeLessThanOrEqual(10);
      expect(pool.totalTimedOut).toBe(0);
    },
  );

  it(
    'pool with 5 connections handles 200 concurrent proposals with queuing',
    { timeout: 60_000 },
    async () => {
      const pool = new SimulatedConnectionPool(5, 2); // 5 conns, 2ms query
      const deps = makeDeps(pool);

      const result = await runConcurrent(
        async (idx) => {
          const r = await proposeAgentAction(deps, makeCtx(idx), {
            workspaceId: 'ws-pool',
            agentId: `agent-pool-${idx}`,
            actionKind: 'comms:listEmails',
            toolName: 'email:list',
            executionTier: 'Auto',
            policyIds: ['pol-pool-1'],
            rationale: `Pool stress test ${idx}`,
          });
          if (!r.ok) throw new Error(`propose failed: ${r.error.kind}`);
        },
        200,
        100, // 100 concurrent → 20x pool size
      );

      const stats = computeStats(result.durations);
      console.info(formatStats('pool-5-conns / 200-requests / 100-concurrent', stats));
      console.info(
        `[LOAD] pool high-water-mark=${pool.highWaterMark} acquired=${pool.totalAcquired} timeouts=${pool.totalTimedOut}`,
      );

      expect(result.errors).toBe(0);
      expect(result.successes).toBe(200);
      // Pool should have been fully utilized
      expect(pool.highWaterMark).toBe(5);
    },
  );

  it(
    'pool exhaustion: requests timeout gracefully when pool is blocked',
    { timeout: 15_000 },
    async () => {
      // Pool of 2 connections, 500ms query latency, 200ms acquire timeout
      const pool = new SimulatedConnectionPool(2, 500);

      // Saturate: hold both connections for 500ms
      const blockers = [pool.acquire(), pool.acquire()];
      const held = await Promise.all(blockers);

      // Now try to acquire with a short timeout — should fail
      let timedOut = false;
      try {
        await pool.acquire(200);
      } catch (e: any) {
        if (e.message === 'connection pool timeout') timedOut = true;
        else throw e;
      }

      // Release held connections
      held.forEach((c) => c.release());

      expect(timedOut).toBe(true);
      expect(pool.totalTimedOut).toBe(1);
      expect(pool.activeConnections).toBe(0);
    },
  );

  it(
    'pool recovers after saturation and processes waiting requests',
    { timeout: 15_000 },
    async () => {
      const pool = new SimulatedConnectionPool(3, 1);

      // Fill the pool
      const held = await Promise.all([pool.acquire(), pool.acquire(), pool.acquire()]);
      expect(pool.activeConnections).toBe(3);

      // Queue 6 waiters that each acquire-then-release immediately
      let acquired = 0;
      const waiterPromises = Array.from({ length: 6 }, () =>
        pool.acquire(5000).then((conn) => {
          acquired++;
          conn.release(); // release immediately so next waiter can proceed
        }),
      );

      // Release all held connections — starts the chain of acquire/release
      held.forEach((c) => c.release());

      await Promise.all(waiterPromises);

      expect(pool.totalTimedOut).toBe(0);
      expect(acquired).toBe(6);
      expect(pool.totalAcquired).toBe(9); // 3 initial + 6 waiters
      expect(pool.activeConnections).toBe(0);
    },
  );
});
