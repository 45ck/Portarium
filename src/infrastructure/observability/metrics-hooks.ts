export type MetricAttributes = Readonly<Record<string, string | number | boolean>>;

export interface MetricsHooks {
  incrementCounter(name: string, attributes?: MetricAttributes): void;
  recordHistogram?(name: string, value: number, attributes?: MetricAttributes): void;
}

const NOOP_METRICS_HOOKS: MetricsHooks = {
  incrementCounter() {
    // no-op by default
  },
  recordHistogram() {
    // no-op by default
  },
};

let activeMetricsHooks: MetricsHooks = NOOP_METRICS_HOOKS;

export function emitCounter(name: string, attributes?: MetricAttributes): void {
  if (attributes === undefined) {
    activeMetricsHooks.incrementCounter(name);
    return;
  }
  activeMetricsHooks.incrementCounter(name, attributes);
}

export function emitHistogram(name: string, value: number, attributes?: MetricAttributes): void {
  if (activeMetricsHooks.recordHistogram === undefined) {
    return;
  }

  if (attributes === undefined) {
    activeMetricsHooks.recordHistogram(name, value);
    return;
  }

  activeMetricsHooks.recordHistogram(name, value, attributes);
}

export function setMetricsHooksForTest(hooks: MetricsHooks): void {
  activeMetricsHooks = hooks;
}

export function resetMetricsHooksForTest(): void {
  activeMetricsHooks = NOOP_METRICS_HOOKS;
}
