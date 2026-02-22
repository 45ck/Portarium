/**
 * Minimal Prometheus text-format metrics registry.
 *
 * No external dependencies — generates Prometheus exposition format (0.0.4)
 * from in-process counters, histograms, and gauges.
 *
 * Serve the output of `defaultRegistry.format()` at GET /metrics
 * with Content-Type: text/plain; version=0.0.4; charset=utf-8
 */

type LabelMap = Readonly<Record<string, string>>;

function labelsToString(labels: LabelMap): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  const pairs = entries
    .map(([k, v]) => `${k}="${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`)
    .join(',');
  return `{${pairs}}`;
}

// ---------------------------------------------------------------------------
// Counter
// ---------------------------------------------------------------------------

export class PromCounter {
  readonly #name: string;
  readonly #help: string;
  readonly #values = new Map<string, number>();

  public constructor(name: string, help: string) {
    this.#name = name;
    this.#help = help;
  }

  public inc(labels: LabelMap = {}, amount = 1): void {
    const key = labelsToString(labels);
    this.#values.set(key, (this.#values.get(key) ?? 0) + amount);
  }

  public format(): string {
    const lines = [`# HELP ${this.#name} ${this.#help}`, `# TYPE ${this.#name} counter`];
    for (const [key, value] of this.#values) {
      lines.push(`${this.#name}${key} ${value}`);
    }
    return lines.join('\n');
  }
}

// ---------------------------------------------------------------------------
// Histogram
// ---------------------------------------------------------------------------

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

interface HistogramSeries { readonly buckets: number[]; sum: number; count: number }

export class PromHistogram {
  readonly #name: string;
  readonly #help: string;
  readonly #buckets: readonly number[];
  readonly #series = new Map<string, HistogramSeries>();

  public constructor(name: string, help: string, buckets: readonly number[] = DEFAULT_BUCKETS) {
    this.#name = name;
    this.#help = help;
    this.#buckets = [...buckets].sort((a, b) => a - b);
  }

  public observe(value: number, labels: LabelMap = {}): void {
    const key = labelsToString(labels);
    let series = this.#series.get(key);
    if (!series) {
      series = { buckets: new Array<number>(this.#buckets.length).fill(0), sum: 0, count: 0 };
      this.#series.set(key, series);
    }
    for (let i = 0; i < this.#buckets.length; i++) {
      if (value <= (this.#buckets[i] ?? 0)) {
        series.buckets[i] = (series.buckets[i] ?? 0) + 1;
      }
    }
    series.sum += value;
    series.count += 1;
  }

  public format(): string {
    const lines = [`# HELP ${this.#name} ${this.#help}`, `# TYPE ${this.#name} histogram`];
    for (const [key, series] of this.#series) {
      this.#formatSeries(lines, key, series);
    }
    return lines.join('\n');
  }

  #formatSeries(lines: string[], key: string, series: HistogramSeries): void {
    const infix = key.length > 0 ? key.slice(0, -1) + ',' : '{';
    for (let i = 0; i < this.#buckets.length; i++) {
      lines.push(`${this.#name}_bucket${infix}le="${this.#buckets[i]}"} ${series.buckets[i] ?? 0}`);
    }
    lines.push(`${this.#name}_bucket${infix}le="+Inf"} ${series.count}`);
    lines.push(`${this.#name}_sum${key} ${series.sum}`);
    lines.push(`${this.#name}_count${key} ${series.count}`);
  }
}

// ---------------------------------------------------------------------------
// Gauge
// ---------------------------------------------------------------------------

export class PromGauge {
  readonly #name: string;
  readonly #help: string;
  readonly #values = new Map<string, number>();

  public constructor(name: string, help: string) {
    this.#name = name;
    this.#help = help;
  }

  public set(value: number, labels: LabelMap = {}): void {
    this.#values.set(labelsToString(labels), value);
  }

  public inc(labels: LabelMap = {}, amount = 1): void {
    const key = labelsToString(labels);
    this.#values.set(key, (this.#values.get(key) ?? 0) + amount);
  }

  public dec(labels: LabelMap = {}, amount = 1): void {
    const key = labelsToString(labels);
    this.#values.set(key, (this.#values.get(key) ?? 0) - amount);
  }

  public format(): string {
    const lines = [`# HELP ${this.#name} ${this.#help}`, `# TYPE ${this.#name} gauge`];
    for (const [key, value] of this.#values) {
      lines.push(`${this.#name}${key} ${value}`);
    }
    return lines.join('\n');
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

class Registry {
  readonly #metrics: (PromCounter | PromHistogram | PromGauge)[] = [];

  public counter(name: string, help: string): PromCounter {
    const c = new PromCounter(name, help);
    this.#metrics.push(c);
    return c;
  }

  public histogram(name: string, help: string, buckets?: readonly number[]): PromHistogram {
    const h = new PromHistogram(name, help, buckets);
    this.#metrics.push(h);
    return h;
  }

  public gauge(name: string, help: string): PromGauge {
    const g = new PromGauge(name, help);
    this.#metrics.push(g);
    return g;
  }

  public format(): string {
    return this.#metrics.map((m) => m.format()).join('\n\n') + '\n';
  }
}

// ---------------------------------------------------------------------------
// Default registry — pre-registered control plane metrics
// ---------------------------------------------------------------------------

export const defaultRegistry = new Registry();

export const httpRequestsTotal = defaultRegistry.counter(
  'portarium_http_requests_total',
  'Total number of HTTP requests received by the control plane.',
);

export const httpRequestDurationSeconds = defaultRegistry.histogram(
  'portarium_http_request_duration_seconds',
  'HTTP request duration in seconds.',
);

export const httpActiveConnections = defaultRegistry.gauge(
  'portarium_http_active_connections',
  'Number of HTTP requests currently being processed.',
);

export const rateLimitHitsTotal = defaultRegistry.counter(
  'portarium_rate_limit_hits_total',
  'Total number of requests rejected by the workspace rate limiter.',
);

export const cacheHitsTotal = defaultRegistry.counter(
  'portarium_cache_hits_total',
  'Total number of cache lookups by result (hit or miss).',
);
