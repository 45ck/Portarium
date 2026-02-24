/**
 * Pre-emption and stop-path latency benchmark for robot missions.
 *
 * Measures the time budget for two critical safety paths:
 *
 *   1. Pre-emption latency  — cancel request issued → mission reaches
 *                              a terminal state (Cancelled / Failed).
 *   2. Stop-path latency    — dispatch → execute → cancel → terminal.
 *   3. Concurrent pre-emption — N simultaneous cancel requests against
 *                               the same mission converge to one terminal state.
 *
 * Budget targets (worst-case in-process):
 *   - Single cancel   ≤ 2 ms (in-process stub, zero I/O)
 *   - Stop-path       ≤ 5 ms (dispatch + cancel + terminal poll)
 *   - Concurrent (N=20) ≤ 20 ms total
 *
 * Live gateway budgets are defined in docs/internal/adr/ADR-0095.md.
 *
 * Bead: bead-0529
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type {
  MissionCancelRequest,
  MissionDispatchRequest,
  MissionDispatchResult,
  MissionCancelResult,
  MissionStatusResult,
  MissionPort,
} from '../../../application/ports/mission-port.js';
import type { MissionActionRequestV1 } from '../../../domain/robots/mission-action-semantics-v1.js';
import type { MissionStatus } from '../../../domain/robots/mission-v1.js';
import { CorrelationId, GatewayId, MissionId, RobotId } from '../../../domain/primitives/index.js';

// ── In-process MissionPort stub ───────────────────────────────────────────────

interface MissionRecord {
  status: MissionStatus;
  gatewayRequestId: string;
  idempotencyKey: string;
  dispatchedAt: string;
  observedAt: string;
}

/**
 * Minimal MissionPort stub with controllable latency injection.
 * Each operation completes synchronously (or after `#artificialDelayMs`)
 * so benchmark timings reflect code-path overhead, not I/O.
 */
class LatencyTestMissionPort implements MissionPort {
  readonly #missions = new Map<string, MissionRecord>();
  #artificialDelayMs = 0;

  /** Inject: pause every operation by this many ms (simulate gateway RTT). */
  setArtificialDelay(ms: number) {
    this.#artificialDelayMs = ms;
  }

  /** Seed: directly set a mission into a given state. */
  seed(missionId: string, status: MissionStatus) {
    this.#missions.set(missionId, {
      status,
      gatewayRequestId: `gw-${missionId}`,
      idempotencyKey: `ik-${missionId}`,
      dispatchedAt: new Date().toISOString(),
      observedAt: new Date().toISOString(),
    });
  }

  #delay(): Promise<void> {
    if (this.#artificialDelayMs <= 0) return Promise.resolve();
    return new Promise((r) => setTimeout(r, this.#artificialDelayMs));
  }

  async dispatchMission(req: MissionDispatchRequest): Promise<MissionDispatchResult> {
    await this.#delay();
    const id = String(req.missionId);
    const existing = this.#missions.get(id);
    if (existing?.idempotencyKey === req.planEffectIdempotencyKey) {
      return {
        kind: 'Dispatched',
        missionId: req.missionId,
        correlationId: req.correlationId,
        planEffectIdempotencyKey: req.planEffectIdempotencyKey,
        gatewayRequestId: existing.gatewayRequestId,
        dispatchedAt: existing.dispatchedAt,
      };
    }
    const record: MissionRecord = {
      status: 'Executing',
      gatewayRequestId: `gw-${id}-${Date.now()}`,
      idempotencyKey: req.planEffectIdempotencyKey,
      dispatchedAt: new Date().toISOString(),
      observedAt: new Date().toISOString(),
    };
    this.#missions.set(id, record);
    return {
      kind: 'Dispatched',
      missionId: req.missionId,
      correlationId: req.correlationId,
      planEffectIdempotencyKey: req.planEffectIdempotencyKey,
      gatewayRequestId: record.gatewayRequestId,
      dispatchedAt: record.dispatchedAt,
    };
  }

  async cancelMission(req: MissionCancelRequest): Promise<MissionCancelResult> {
    await this.#delay();
    const id = String(req.missionId);
    const rec = this.#missions.get(id);
    if (!rec) return { accepted: false, message: 'unknown mission' };
    // Pre-empt: immediately move to Cancelled (simulates gateway stop-path)
    this.#missions.set(id, { ...rec, status: 'Cancelled', observedAt: new Date().toISOString() });
    return { accepted: true, cancelledAt: new Date().toISOString() };
  }

  async getMissionStatus(
    missionId: MissionId,
    _correlationId: CorrelationId,
  ): Promise<MissionStatusResult> {
    await this.#delay();
    const id = String(missionId);
    const rec = this.#missions.get(id);
    if (!rec) {
      return {
        missionId,
        status: 'Pending',
        observedAt: new Date().toISOString(),
      };
    }
    return {
      missionId,
      status: rec.status,
      observedAt: rec.observedAt,
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GATEWAY_ID = GatewayId('gw-test');
const ROBOT_ID = RobotId('robot-test');

function makeDispatchRequest(id: string): MissionDispatchRequest {
  const missionId = MissionId(id);
  const action: MissionActionRequestV1 = {
    schemaVersion: 1,
    missionId,
    robotId: ROBOT_ID,
    gatewayId: GATEWAY_ID,
    actionType: 'robot:execute_action',
    actionName: 'navigate',
    parameters: { x: 0, y: 0, theta: 0 },
    supportsPreemption: true,
    bypassTierEvaluation: false,
    completionMode: 'Auto',
    requiresOperatorConfirmation: false,
    requestedAt: new Date().toISOString(),
  };
  return {
    missionId,
    correlationId: CorrelationId(`corr-${id}`),
    planEffectIdempotencyKey: `ik-${id}`,
    action,
  };
}

function makeCancelRequest(id: string): MissionCancelRequest {
  return {
    missionId: MissionId(id),
    correlationId: CorrelationId(`corr-cancel-${id}`),
    planEffectIdempotencyKey: `ik-cancel-${id}`,
  };
}

/** Time an async operation; returns elapsed ms. */
async function timeMs(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

// ── Budget constants ──────────────────────────────────────────────────────────

/** In-process cancel must complete within this budget (no I/O). */
const CANCEL_BUDGET_MS = 2;

/** Full stop-path (dispatch → cancel → terminal confirm) budget. */
const STOP_PATH_BUDGET_MS = 5;

/** P99 concurrent cancel budget for 20 simultaneous requests. */
const CONCURRENT_CANCEL_BUDGET_MS = 20;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Pre-emption latency — single mission', () => {
  let port: LatencyTestMissionPort;
  const corrId = CorrelationId('corr-query');

  beforeEach(() => {
    port = new LatencyTestMissionPort();
  });

  it('cancel of a dispatched mission completes within budget', async () => {
    port.seed('m-1', 'Executing');
    const elapsed = await timeMs(async () => {
      await port.cancelMission(makeCancelRequest('m-1'));
    });
    expect(elapsed).toBeLessThan(CANCEL_BUDGET_MS);
  });

  it('mission status is terminal (Cancelled) immediately after cancel', async () => {
    port.seed('m-2', 'Executing');
    await port.cancelMission(makeCancelRequest('m-2'));
    const status = await port.getMissionStatus(MissionId('m-2'), corrId);
    expect(status.status).toBe('Cancelled');
  });

  it('cancel of an already-terminal mission is idempotent (no re-execution)', async () => {
    port.seed('m-3', 'Cancelled');
    await port.cancelMission(makeCancelRequest('m-3'));
    // Key invariant: terminal status does not regress
    const status = await port.getMissionStatus(MissionId('m-3'), corrId);
    expect(['Cancelled', 'Failed', 'Succeeded']).toContain(status.status);
  });

  it('cancel of unknown mission returns accepted:false', async () => {
    const result = await port.cancelMission(makeCancelRequest('unknown'));
    expect(result.accepted).toBe(false);
  });
});

describe('Stop-path latency — dispatch → cancel → terminal', () => {
  let port: LatencyTestMissionPort;
  const corrId = CorrelationId('corr-query');

  beforeEach(() => {
    port = new LatencyTestMissionPort();
  });

  it('full stop-path completes within budget', async () => {
    const id = 'sp-1';
    const elapsed = await timeMs(async () => {
      // 1. Dispatch
      const dispatch = await port.dispatchMission(makeDispatchRequest(id));
      expect(dispatch.kind).toBe('Dispatched');
      // 2. Cancel (pre-empt)
      const cancel = await port.cancelMission(makeCancelRequest(id));
      expect(cancel.accepted).toBe(true);
      // 3. Confirm terminal state
      const status = await port.getMissionStatus(MissionId(id), corrId);
      expect(['Cancelled', 'Failed']).toContain(status.status);
    });
    expect(elapsed).toBeLessThan(STOP_PATH_BUDGET_MS);
  });

  it('dispatch is idempotent — second dispatch with same key does not re-execute', async () => {
    const id = 'sp-idempotent';
    const req = makeDispatchRequest(id);

    const first = await port.dispatchMission(req);
    expect(first.kind).toBe('Dispatched');
    if (first.kind !== 'Dispatched') return;
    const firstGwId = first.gatewayRequestId;

    // Simulate retry with same idempotency key
    const second = await port.dispatchMission(req);
    expect(second.kind).toBe('Dispatched');
    if (second.kind !== 'Dispatched') return;
    // Must return the same gatewayRequestId — not a new dispatch
    expect(second.gatewayRequestId).toBe(firstGwId);
  });

  it('stop-path is repeatable: 10 sequential missions all reach terminal state', async () => {
    const corrId2 = CorrelationId('corr-q');
    for (let i = 0; i < 10; i++) {
      const id = `seq-${i}`;
      await port.dispatchMission(makeDispatchRequest(id));
      await port.cancelMission(makeCancelRequest(id));
      const status = await port.getMissionStatus(MissionId(id), corrId2);
      expect(status.status).toBe('Cancelled');
    }
  });
});

describe('Concurrent pre-emption — N simultaneous cancels', () => {
  let port: LatencyTestMissionPort;
  const corrId = CorrelationId('corr-query');

  beforeEach(() => {
    port = new LatencyTestMissionPort();
  });

  it('20 concurrent cancels all complete within budget', async () => {
    const N = 20;
    for (let i = 0; i < N; i++) port.seed(`cm-${i}`, 'Executing');

    const elapsed = await timeMs(async () => {
      await Promise.all(
        Array.from({ length: N }, (_, i) => port.cancelMission(makeCancelRequest(`cm-${i}`))),
      );
    });
    expect(elapsed).toBeLessThan(CONCURRENT_CANCEL_BUDGET_MS);
  });

  it('concurrent cancels converge: all missions reach terminal state', async () => {
    const N = 20;
    for (let i = 0; i < N; i++) port.seed(`conv-${i}`, 'Executing');

    await Promise.all(
      Array.from({ length: N }, (_, i) => port.cancelMission(makeCancelRequest(`conv-${i}`))),
    );

    const statuses = await Promise.all(
      Array.from({ length: N }, (_, i) => port.getMissionStatus(MissionId(`conv-${i}`), corrId)),
    );

    for (const s of statuses) {
      const TERMINAL: MissionStatus[] = ['Cancelled', 'Failed', 'Succeeded'];
      expect(TERMINAL).toContain(s.status);
    }
  });

  it('duplicate concurrent cancels on the same mission stay terminal', async () => {
    port.seed('dup-cancel', 'Executing');

    // 5 simultaneous cancels for the same mission
    const results = await Promise.all(
      Array.from({ length: 5 }, () => port.cancelMission(makeCancelRequest('dup-cancel'))),
    );

    // At least one must be accepted
    const accepted = results.filter((r) => r.accepted);
    expect(accepted.length).toBeGreaterThanOrEqual(1);

    // Final status must be terminal
    const status = await port.getMissionStatus(MissionId('dup-cancel'), corrId);
    expect(['Cancelled', 'Failed', 'Succeeded']).toContain(status.status);
  });
});

describe('Pre-emption with artificial gateway delay', () => {
  let port: LatencyTestMissionPort;
  const corrId = CorrelationId('corr-query');

  beforeEach(() => {
    port = new LatencyTestMissionPort();
  });

  it('cancel completes and mission is terminal even with 1ms gateway delay', async () => {
    port.setArtificialDelay(1);
    port.seed('delay-1', 'Executing');

    const cancel = await port.cancelMission(makeCancelRequest('delay-1'));
    expect(cancel.accepted).toBe(true);

    const status = await port.getMissionStatus(MissionId('delay-1'), corrId);
    expect(status.status).toBe('Cancelled');
  });

  it('stop-path with 1ms artificial delay reaches terminal state', async () => {
    port.setArtificialDelay(1);
    const id = 'delay-stop';

    const dispatch = await port.dispatchMission(makeDispatchRequest(id));
    expect(dispatch.kind).toBe('Dispatched');

    const cancel = await port.cancelMission(makeCancelRequest(id));
    expect(cancel.accepted).toBe(true);

    const status = await port.getMissionStatus(MissionId(id), corrId);
    expect(status.status).toBe('Cancelled');
  });
});

// ── ADR reference comment ─────────────────────────────────────────────────────
// Live gateway latency budgets (ROS 2, OPC UA, MQTT) are specified in
// docs/internal/adr/ADR-0095.md. The benchmarks above test the in-process code path.
// Integration tests against real gateways are tracked under bead-0519.
