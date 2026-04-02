/**
 * Load test harness — shared utilities for all load/stress scenarios.
 *
 * Provides:
 *   - percentile / stats computation
 *   - concurrent task runner with configurable concurrency + duration
 *   - report formatting
 */

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export interface LatencyStats {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]!;
}

export function computeStats(samples: number[]): LatencyStats {
  if (samples.length === 0) {
    return { count: 0, p50: 0, p95: 0, p99: 0, mean: 0, min: 0, max: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((acc, v) => acc + v, 0);
  return {
    count: samples.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    mean: sum / samples.length,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
  };
}

// ---------------------------------------------------------------------------
// Concurrent runner
// ---------------------------------------------------------------------------

export interface LoadResult {
  durations: number[];
  errors: number;
  successes: number;
  elapsedMs: number;
}

/**
 * Run `taskFn` concurrently up to `concurrency` times, for a total of
 * `totalRequests` invocations. Returns timing + error counts.
 */
export async function runConcurrent(
  taskFn: (index: number) => Promise<void>,
  totalRequests: number,
  concurrency: number,
): Promise<LoadResult> {
  const durations: number[] = [];
  let errors = 0;
  let successes = 0;
  let nextIndex = 0;

  const start = performance.now();

  async function worker(): Promise<void> {
    while (nextIndex < totalRequests) {
      const idx = nextIndex++;
      const t0 = performance.now();
      try {
        await taskFn(idx);
        successes++;
      } catch {
        errors++;
      }
      durations.push(performance.now() - t0);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, totalRequests) }, () => worker());
  await Promise.all(workers);

  return {
    durations,
    errors,
    successes,
    elapsedMs: performance.now() - start,
  };
}

/**
 * Run `taskFn` concurrently for a fixed duration (ms).
 * Returns timing + error counts + total throughput.
 *
 * Uses reservoir sampling (maxSamples=10000) to bound memory when
 * iteration counts are very high.
 */
export async function runForDuration(
  taskFn: (index: number) => Promise<void>,
  durationMs: number,
  concurrency: number,
): Promise<LoadResult & { rps: number }> {
  const MAX_SAMPLES = 10_000;
  const durations: number[] = [];
  let errors = 0;
  let successes = 0;
  let nextIndex = 0;
  let totalIterations = 0;
  let running = true;

  const start = performance.now();

  setTimeout(() => {
    running = false;
  }, durationMs);

  async function worker(): Promise<void> {
    while (running) {
      const idx = nextIndex++;
      const t0 = performance.now();
      try {
        await taskFn(idx);
        successes++;
      } catch {
        errors++;
      }
      const elapsed = performance.now() - t0;
      const n = totalIterations++;

      // Reservoir sampling: keep first MAX_SAMPLES, then replace randomly
      if (n < MAX_SAMPLES) {
        durations.push(elapsed);
      } else {
        const j = Math.floor(Math.random() * (n + 1));
        if (j < MAX_SAMPLES) {
          durations[j] = elapsed;
        }
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const elapsedMs = performance.now() - start;
  return {
    durations,
    errors,
    successes,
    elapsedMs,
    rps: ((successes + errors) / elapsedMs) * 1000,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatStats(label: string, stats: LatencyStats): string {
  return (
    `[LOAD] ${label}: n=${stats.count} ` +
    `p50=${stats.p50.toFixed(2)}ms p95=${stats.p95.toFixed(2)}ms p99=${stats.p99.toFixed(2)}ms ` +
    `mean=${stats.mean.toFixed(2)}ms min=${stats.min.toFixed(2)}ms max=${stats.max.toFixed(2)}ms`
  );
}
