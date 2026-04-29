/**
 * Base experiment runner for Portarium live-validation experiments.
 *
 * Provides a structured lifecycle: setup -> execute -> verify -> teardown,
 * with automatic result capture and timing.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runLiveModelPreflight } from './live-model-preflight.js';

export async function runExperiment(definition) {
  const resultsDir =
    definition.resultsDir ??
    join(dirname(fileURLToPath(import.meta.url)), '..', definition.name, 'results');

  mkdirSync(resultsDir, { recursive: true });

  let ctx = {
    name: definition.name,
    resultsDir,
    state: {},
  };

  const start = Date.now();
  let assertions = [];
  let errorMessage;
  let skipReason;
  let liveModelPreflight;

  try {
    if (definition.liveModelPreflight) {
      liveModelPreflight = await runLiveModelPreflight(
        definition.liveModelPreflight === true ? {} : definition.liveModelPreflight,
      );
      ctx = { ...ctx, liveModelPreflight };

      if (liveModelPreflight.status === 'disabled' || liveModelPreflight.status === 'skipped') {
        skipReason =
          liveModelPreflight.reason ?? `Live model preflight ${liveModelPreflight.status}.`;
      } else if (liveModelPreflight.status === 'failed') {
        throw new Error(
          `Live model preflight failed (${liveModelPreflight.failureKind ?? 'unknown'}): ${
            liveModelPreflight.reason ?? `HTTP ${liveModelPreflight.httpStatus ?? 'n/a'}`
          }`,
        );
      }
    }

    if (!skipReason) {
      if (definition.setup) {
        await definition.setup(ctx);
      }

      await definition.execute(ctx);
      assertions = await definition.verify(ctx);
    }
  } catch (err) {
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
  const outcome = skipReason
    ? 'skipped'
    : errorMessage
      ? 'inconclusive'
      : allPassed
        ? 'confirmed'
        : 'refuted';

  const result = {
    experiment: definition.name,
    timestamp: new Date().toISOString(),
    outcome,
    duration_ms,
    assertions,
    ...(liveModelPreflight ? { liveModelPreflight } : {}),
    ...(definition.hypothesis ? { notes: definition.hypothesis } : {}),
    ...(skipReason ? { skipReason } : {}),
    ...(errorMessage ? { error: errorMessage } : {}),
  };

  writeFileSync(join(resultsDir, 'outcome.json'), JSON.stringify(result, null, 2) + '\n');

  return result;
}

/**
 * Helper to create an assertion result.
 */
export function assert(label, passed, detail) {
  return { label, passed, ...(detail ? { detail } : {}) };
}
