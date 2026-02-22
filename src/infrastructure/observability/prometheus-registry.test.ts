import { describe, it, expect } from 'vitest';
import { PromCounter, PromHistogram, PromGauge } from './prometheus-registry.js';

describe('PromCounter', () => {
  it('starts at zero and increments', () => {
    const c = new PromCounter('my_counter', 'A counter');
    c.inc();
    c.inc();
    const text = c.format();
    expect(text).toContain('# TYPE my_counter counter');
    expect(text).toContain('my_counter 2');
  });

  it('tracks separate label sets', () => {
    const c = new PromCounter('req_total', 'Requests');
    c.inc({ method: 'GET', status: '200' });
    c.inc({ method: 'GET', status: '200' });
    c.inc({ method: 'POST', status: '201' });
    const text = c.format();
    expect(text).toContain('req_total{method="GET",status="200"} 2');
    expect(text).toContain('req_total{method="POST",status="201"} 1');
  });

  it('escapes special chars in label values', () => {
    const c = new PromCounter('c', 'h');
    c.inc({ route: '/v1/items\n"test"' });
    const text = c.format();
    expect(text).toContain('\\"test\\"');
    expect(text).toContain('\\n');
  });

  it('includes HELP line', () => {
    const c = new PromCounter('my_c', 'My help text');
    c.inc();
    expect(c.format()).toContain('# HELP my_c My help text');
  });
});

describe('PromHistogram', () => {
  it('records observations and generates bucket lines', () => {
    const h = new PromHistogram('latency_seconds', 'Latency', [0.1, 0.5, 1]);
    h.observe(0.05);
    h.observe(0.2);
    h.observe(0.8);
    const text = h.format();
    expect(text).toContain('# TYPE latency_seconds histogram');
    expect(text).toContain('latency_seconds_bucket{le="0.1"} 1');
    expect(text).toContain('latency_seconds_bucket{le="0.5"} 2');
    expect(text).toContain('latency_seconds_bucket{le="1"} 3');
    expect(text).toContain('latency_seconds_bucket{le="+Inf"} 3');
    expect(text).toContain('latency_seconds_count 3');
  });

  it('accumulates sum correctly', () => {
    const h = new PromHistogram('h', 'help', [1]);
    h.observe(0.5);
    h.observe(0.5);
    const text = h.format();
    expect(text).toContain('h_sum 1');
  });

  it('handles labels in bucket lines', () => {
    const h = new PromHistogram('dur', 'Duration', [0.5, 1]);
    h.observe(0.3, { route: '/api' });
    const text = h.format();
    expect(text).toContain('dur_bucket{route="/api",le="0.5"} 1');
    expect(text).toContain('dur_sum{route="/api"}');
  });
});

describe('PromGauge', () => {
  it('sets and reads values', () => {
    const g = new PromGauge('connections', 'Active conns');
    g.set(5);
    expect(g.format()).toContain('connections 5');
  });

  it('increments and decrements', () => {
    const g = new PromGauge('g', 'h');
    g.inc();
    g.inc();
    g.dec();
    expect(g.format()).toContain('g 1');
  });

  it('outputs TYPE gauge', () => {
    const g = new PromGauge('active', 'Active things');
    g.set(0);
    expect(g.format()).toContain('# TYPE active gauge');
  });
});
