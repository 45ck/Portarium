/**
 * Tests for the fault-test workflow and activity functions.
 * Bead: bead-0399
 */

import { describe, it, expect, vi } from 'vitest';
import {
  recordFaultTestStart,
  heartbeatSleep,
  verifyDbConnectivity,
  recordFaultTestCompletion,
  faultTestWorkflow,
  type FaultTestInput,
  type FaultTestActivities,
} from './fault-test-workflow.js';

const makeInput = (overrides?: Partial<FaultTestInput>): FaultTestInput => ({
  workflowId: 'test-workflow-1',
  scenario: 'pod-kill',
  durationSeconds: 10,
  ...overrides,
});

// ── recordFaultTestStart ────────────────────────────────────────────────────

describe('recordFaultTestStart', () => {
  it('returns a recordedAt timestamp', async () => {
    const heartbeat = vi.fn();
    const result = await recordFaultTestStart(makeInput(), heartbeat);
    expect(result.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('calls heartbeat twice', async () => {
    const heartbeat = vi.fn();
    await recordFaultTestStart(makeInput(), heartbeat);
    expect(heartbeat).toHaveBeenCalledTimes(2);
  });
});

// ── heartbeatSleep ─────────────────────────────────────────────────────────

describe('heartbeatSleep', () => {
  it('sleeps for the specified duration in 10s steps', async () => {
    const heartbeat = vi.fn();
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await heartbeatSleep(30, heartbeat, sleep);

    expect(sleep).toHaveBeenCalledTimes(3); // 30s / 10s steps
    expect(result.sleptSeconds).toBe(30);
    expect(heartbeat).toHaveBeenCalledTimes(3);
  });

  it('rounds up fractional steps', async () => {
    const heartbeat = vi.fn();
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await heartbeatSleep(25, heartbeat, sleep);
    expect(sleep).toHaveBeenCalledTimes(3); // ceil(25/10) = 3
    expect(result.sleptSeconds).toBe(30);
  });
});

// ── verifyDbConnectivity ───────────────────────────────────────────────────

describe('verifyDbConnectivity', () => {
  it('returns dbReachable=true on successful query', async () => {
    const heartbeat = vi.fn();
    const queryFn = vi.fn().mockResolvedValue({ rowCount: 5 });

    const result = await verifyDbConnectivity(heartbeat, queryFn);
    expect(result.dbReachable).toBe(true);
    expect(result.rowCount).toBe(5);
    expect(heartbeat).toHaveBeenCalledTimes(2);
  });

  it('propagates query errors', async () => {
    const heartbeat = vi.fn();
    const queryFn = vi.fn().mockRejectedValue(new Error('connection refused'));

    await expect(verifyDbConnectivity(heartbeat, queryFn)).rejects.toThrow('connection refused');
  });
});

// ── recordFaultTestCompletion ──────────────────────────────────────────────

describe('recordFaultTestCompletion', () => {
  it('returns completedAt and a non-negative durationMs', async () => {
    const heartbeat = vi.fn();
    const startedAt = new Date(Date.now() - 5000).toISOString();

    const result = await recordFaultTestCompletion(makeInput(), startedAt, heartbeat);
    expect(result.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.durationMs).toBeGreaterThan(0);
  });
});

// ── faultTestWorkflow ──────────────────────────────────────────────────────

describe('faultTestWorkflow', () => {
  function makeActivities(overrides?: Partial<FaultTestActivities>): FaultTestActivities {
    return {
      recordFaultTestStart: vi.fn().mockResolvedValue({ recordedAt: new Date().toISOString() }),
      heartbeatSleep: vi.fn().mockResolvedValue({ sleptSeconds: 10 }),
      verifyDbConnectivity: vi.fn().mockResolvedValue({ dbReachable: true, rowCount: 1 }),
      recordFaultTestCompletion: vi.fn().mockResolvedValue({
        completedAt: new Date().toISOString(),
        durationMs: 1500,
      }),
      ...overrides,
    };
  }

  it('completes successfully when all activities succeed', async () => {
    const acts = makeActivities();
    const state = await faultTestWorkflow(makeInput(), acts);

    expect(state.status).toBe('completed');
    expect(state.stepsCompleted).toBe(4);
    expect(state.checkpoint).toBe('post-fault');
    expect(acts.recordFaultTestStart).toHaveBeenCalledOnce();
    expect(acts.heartbeatSleep).toHaveBeenCalledOnce();
    expect(acts.verifyDbConnectivity).toHaveBeenCalledOnce();
    expect(acts.recordFaultTestCompletion).toHaveBeenCalledOnce();
  });

  it('throws when DB connectivity check fails', async () => {
    const acts = makeActivities({
      verifyDbConnectivity: vi.fn().mockResolvedValue({ dbReachable: false, rowCount: 0 }),
    });

    await expect(faultTestWorkflow(makeInput(), acts)).rejects.toThrow(
      'DB connectivity check failed',
    );
  });

  it('propagates activity errors', async () => {
    const acts = makeActivities({
      heartbeatSleep: vi.fn().mockRejectedValue(new Error('worker restarted')),
    });

    await expect(faultTestWorkflow(makeInput(), acts)).rejects.toThrow('worker restarted');
  });

  it('passes scenario and workflowId through to final state', async () => {
    const acts = makeActivities();
    const state = await faultTestWorkflow(
      makeInput({ scenario: 'network-partition', workflowId: 'net-test-1' }),
      acts,
    );

    expect(state.scenario).toBe('network-partition');
    expect(state.workflowId).toBe('net-test-1');
  });
});
