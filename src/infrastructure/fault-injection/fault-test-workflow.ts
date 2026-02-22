/**
 * Fault-test workflow and activities for durability testing.
 *
 * The `faultTestWorkflow` runs a sequence of checkpointed activities that
 * survive worker restarts, DB failovers, and network partitions.  Each step
 * uses Temporal's activity retry/heartbeat semantics to confirm durability.
 *
 * The workflow is started by the internal `/fault-test/start` endpoint
 * and polled by `/fault-test/status/:id` during CI fault-injection drills.
 *
 * Bead: bead-0399
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type FaultTestScenario = 'pod-kill' | 'db-failover' | 'network-partition';

export interface FaultTestInput {
  workflowId: string;
  scenario: FaultTestScenario;
  /** Simulated workflow duration in seconds (filled with heartbeat sleeps). */
  durationSeconds: number;
}

export interface FaultTestState {
  workflowId: string;
  scenario: FaultTestScenario;
  status: 'running' | 'completed' | 'failed';
  checkpoint: 'pending' | 'reached' | 'post-fault';
  startedAt: string;
  completedAt?: string;
  stepsCompleted: number;
  error?: string;
}

// ── Activity implementations ────────────────────────────────────────────────
// (In production these are registered with the Temporal worker via
//  `proxyActivities`; here we expose them as plain async functions for
//  testability without the Temporal SDK.)

export type HeartbeatFn = (details?: unknown) => void;

/**
 * Step 1: Record workflow start in the evidence store.
 * Validates that write-ahead logging survives faults.
 */
export function recordFaultTestStart(
  input: FaultTestInput,
  heartbeat: HeartbeatFn,
): Promise<{ recordedAt: string }> {
  heartbeat({ step: 'start', workflowId: input.workflowId });

  // Simulate evidence write (real impl calls the evidence store adapter).
  const recordedAt = new Date().toISOString();

  heartbeat({ step: 'start', recordedAt });
  return Promise.resolve({ recordedAt });
}

/**
 * Step 2: Long-running heartbeat activity.
 * Fires heartbeats every 10 seconds for `durationSeconds`.
 * A worker restart mid-activity will resume from the last heartbeat.
 */
export async function heartbeatSleep(
  durationSeconds: number,
  heartbeat: HeartbeatFn,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<{ sleptSeconds: number }> {
  const steps = Math.ceil(durationSeconds / 10);
  for (let i = 0; i < steps; i++) {
    await sleep(10_000);
    heartbeat({ step: 'sleep', elapsed: (i + 1) * 10, total: durationSeconds });
  }
  return { sleptSeconds: steps * 10 };
}

/**
 * Step 3: Verify DB connectivity post-fault.
 * Confirms that the DB is reachable after failover/restart.
 */
export async function verifyDbConnectivity(
  heartbeat: HeartbeatFn,
  queryFn: () => Promise<{ rowCount: number }>,
): Promise<{ dbReachable: boolean; rowCount: number }> {
  heartbeat({ step: 'db-check', status: 'starting' });

  const result = await queryFn();

  heartbeat({ step: 'db-check', status: 'ok', rowCount: result.rowCount });
  return { dbReachable: true, rowCount: result.rowCount };
}

/**
 * Step 4: Record workflow completion in the evidence store.
 */
export function recordFaultTestCompletion(
  input: FaultTestInput,
  startedAt: string,
  heartbeat: HeartbeatFn,
): Promise<{ completedAt: string; durationMs: number }> {
  heartbeat({ step: 'complete', workflowId: input.workflowId });

  const completedAt = new Date().toISOString();
  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

  heartbeat({ step: 'complete', durationMs });
  return Promise.resolve({ completedAt, durationMs });
}

// ── Workflow orchestration ──────────────────────────────────────────────────

export interface FaultTestActivities {
  recordFaultTestStart: (input: FaultTestInput) => Promise<{ recordedAt: string }>;
  heartbeatSleep: (durationSeconds: number) => Promise<{ sleptSeconds: number }>;
  verifyDbConnectivity: () => Promise<{ dbReachable: boolean; rowCount: number }>;
  recordFaultTestCompletion: (
    input: FaultTestInput,
    startedAt: string,
  ) => Promise<{ completedAt: string; durationMs: number }>;
}

/**
 * The fault-test workflow.
 *
 * In a real Temporal deployment this function is decorated with
 * `@workflow.defn` and the activities are proxied via `proxyActivities`.
 * Here we accept the activities as a dependency for testability.
 */
export async function faultTestWorkflow(
  input: FaultTestInput,
  activities: FaultTestActivities,
): Promise<FaultTestState> {
  const { recordedAt } = await activities.recordFaultTestStart(input);

  await activities.heartbeatSleep(input.durationSeconds);

  const { dbReachable } = await activities.verifyDbConnectivity();
  if (!dbReachable) {
    throw new Error('DB connectivity check failed after fault injection');
  }

  const { completedAt } = await activities.recordFaultTestCompletion(input, recordedAt);

  return {
    workflowId: input.workflowId,
    scenario: input.scenario,
    status: 'completed',
    checkpoint: 'post-fault',
    startedAt: recordedAt,
    completedAt,
    stepsCompleted: 4,
  };
}
