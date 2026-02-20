/**
 * Portarium local emulator -- simulates the run lifecycle in-memory.
 *
 * Designed for local development and integration testing without
 * requiring Temporal, PostgreSQL, or any external service.
 */

import { randomUUID } from 'node:crypto';

// -- Types -------------------------------------------------------------------

export type EmulatorRunStatus =
  | 'Pending'
  | 'Approved'
  | 'Denied'
  | 'Executing'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export interface EmulatorRun {
  readonly runId: string;
  readonly workspaceId: string;
  readonly workflowId: string;
  readonly inputPayload: Record<string, unknown>;
  status: EmulatorRunStatus;
  readonly createdAtIso: string;
  updatedAtIso: string;
  result?: unknown;
  error?: string;
}

export interface StartRunInput {
  workspaceId: string;
  workflowId: string;
  inputPayload?: Record<string, unknown>;
}

export type ApprovalDecision = 'Approved' | 'Denied';

export interface EmulatorOptions {
  /** If true, runs auto-approve (skip manual approval step). */
  autoApprove?: boolean;
  /** If true, runs auto-complete after executing. */
  autoComplete?: boolean;
  /** Simulated execution delay in ms (default: 0). */
  executionDelayMs?: number;
}

// -- Emulator ----------------------------------------------------------------

export class RunEmulator {
  readonly #runs = new Map<string, EmulatorRun>();
  readonly #options: Required<EmulatorOptions>;

  public constructor(options?: EmulatorOptions) {
    this.#options = {
      autoApprove: options?.autoApprove ?? false,
      autoComplete: options?.autoComplete ?? false,
      executionDelayMs: options?.executionDelayMs ?? 0,
    };
  }

  /** Start a new run. Returns Pending (or auto-advances if configured). */
  public async startRun(input: StartRunInput): Promise<EmulatorRun> {
    const now = new Date().toISOString();
    const run: EmulatorRun = {
      runId: `run-${randomUUID()}`,
      workspaceId: input.workspaceId,
      workflowId: input.workflowId,
      inputPayload: input.inputPayload ?? {},
      status: 'Pending',
      createdAtIso: now,
      updatedAtIso: now,
    };
    this.#runs.set(run.runId, run);

    if (this.#options.autoApprove) {
      await this.submitApproval(run.runId, 'Approved');
    }

    return { ...run };
  }

  /** Submit an approval decision for a pending run. */
  public async submitApproval(
    runId: string,
    decision: ApprovalDecision,
  ): Promise<EmulatorRun> {
    const run = this.#requireRun(runId);
    if (run.status !== 'Pending') {
      throw new Error(`Run ${runId} is ${run.status}, expected Pending.`);
    }

    if (decision === 'Denied') {
      run.status = 'Denied';
      run.updatedAtIso = new Date().toISOString();
      return { ...run };
    }

    run.status = 'Approved';
    run.updatedAtIso = new Date().toISOString();

    // Transition to Executing.
    run.status = 'Executing';
    run.updatedAtIso = new Date().toISOString();

    if (this.#options.executionDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.#options.executionDelayMs));
    }

    if (this.#options.autoComplete) {
      await this.completeRun(runId, { success: true });
    }

    return { ...run };
  }

  /** Mark an executing run as completed. */
  public async completeRun(runId: string, result?: unknown): Promise<EmulatorRun> {
    const run = this.#requireRun(runId);
    if (run.status !== 'Executing') {
      throw new Error(`Run ${runId} is ${run.status}, expected Executing.`);
    }
    run.status = 'Completed';
    run.result = result;
    run.updatedAtIso = new Date().toISOString();
    return { ...run };
  }

  /** Mark an executing run as failed. */
  public async failRun(runId: string, error: string): Promise<EmulatorRun> {
    const run = this.#requireRun(runId);
    if (run.status !== 'Executing') {
      throw new Error(`Run ${runId} is ${run.status}, expected Executing.`);
    }
    run.status = 'Failed';
    run.error = error;
    run.updatedAtIso = new Date().toISOString();
    return { ...run };
  }

  /** Cancel a run that is not yet completed or failed. */
  public async cancelRun(runId: string): Promise<EmulatorRun> {
    const run = this.#requireRun(runId);
    if (run.status === 'Completed' || run.status === 'Failed' || run.status === 'Cancelled') {
      throw new Error(`Run ${runId} is ${run.status}, cannot cancel.`);
    }
    run.status = 'Cancelled';
    run.updatedAtIso = new Date().toISOString();
    return { ...run };
  }

  /** Get a run by ID. */
  public getRun(runId: string): EmulatorRun | undefined {
    const run = this.#runs.get(runId);
    return run ? { ...run } : undefined;
  }

  /** List all runs in the emulator. */
  public listRuns(): EmulatorRun[] {
    return [...this.#runs.values()].map((r) => ({ ...r }));
  }

  /** Reset all state. */
  public reset(): void {
    this.#runs.clear();
  }

  #requireRun(runId: string): EmulatorRun {
    const run = this.#runs.get(runId);
    if (!run) throw new Error(`Run ${runId} not found.`);
    return run;
  }
}
