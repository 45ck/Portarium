/**
 * Base experiment runner for Portarium live-validation experiments.
 *
 * Provides a structured lifecycle: setup -> execute -> verify -> teardown,
 * with automatic result capture and timing.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export interface ExperimentContext {
  /** Experiment name (kebab-case). */
  readonly name: string;
  /** Absolute path to the experiment's results/ directory. */
  readonly resultsDir: string;
  /** Mutable bag for passing state between lifecycle phases. */
  readonly state: Record<string, unknown>;
}

export interface AssertionResult {
  readonly label: string;
  readonly passed: boolean;
  readonly detail?: string;
}

export interface ExperimentOutcome {
  readonly experiment: string;
  readonly timestamp: string;
  readonly outcome: 'confirmed' | 'refuted' | 'inconclusive';
  readonly duration_ms: number;
  readonly assertions: readonly AssertionResult[];
  readonly notes?: string;
  readonly error?: string;
}

export interface ExperimentDefinition {
  readonly name: string;
  readonly hypothesis?: string;
  readonly resultsDir?: string;

  setup?(ctx: ExperimentContext): Promise<void>;
  execute(ctx: ExperimentContext): Promise<void>;
  verify(ctx: ExperimentContext): Promise<readonly AssertionResult[]>;
  teardown?(ctx: ExperimentContext): Promise<void>;
}

export async function runExperiment(definition: ExperimentDefinition): Promise<ExperimentOutcome> {
  const resultsDir =
    definition.resultsDir ??
    join(dirname(new URL(import.meta.url).pathname), '..', definition.name, 'results');

  mkdirSync(resultsDir, { recursive: true });

  const ctx: ExperimentContext = {
    name: definition.name,
    resultsDir,
    state: {},
  };

  const start = Date.now();
  let assertions: readonly AssertionResult[] = [];
  let errorMessage: string | undefined;

  try {
    if (definition.setup) {
      await definition.setup(ctx);
    }

    await definition.execute(ctx);
    assertions = await definition.verify(ctx);
  } catch (err: unknown) {
    errorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    try {
      if (definition.teardown) {
        await definition.teardown(ctx);
      }
    } catch {
      // Teardown errors are logged but do not override the primary result.
    }
  }

  const duration_ms = Date.now() - start;
  const allPassed = assertions.length > 0 && assertions.every((a) => a.passed);
  const outcome: ExperimentOutcome['outcome'] = errorMessage
    ? 'inconclusive'
    : allPassed
      ? 'confirmed'
      : 'refuted';

  const result: ExperimentOutcome = {
    experiment: definition.name,
    timestamp: new Date().toISOString(),
    outcome,
    duration_ms,
    assertions,
    ...(definition.hypothesis ? { notes: definition.hypothesis } : {}),
    ...(errorMessage ? { error: errorMessage } : {}),
  };

  writeFileSync(join(resultsDir, 'outcome.json'), JSON.stringify(result, null, 2) + '\n');

  return result;
}

/**
 * Helper to create an assertion result.
 */
export function assert(label: string, passed: boolean, detail?: string): AssertionResult {
  return { label, passed, ...(detail ? { detail } : {}) };
}
