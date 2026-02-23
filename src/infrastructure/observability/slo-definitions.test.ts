import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const sloPath = resolve(__dirname, '../../../infra/otel/slos/portarium-slos.yaml');
const burnRatePath = resolve(__dirname, '../../../infra/otel/alerts/slo-burn-rate-alerts.yaml');

interface SloDocument {
  apiVersion?: string;
  kind?: string;
  metadata?: { name?: string; namespace?: string; labels?: Record<string, string> };
  spec?: {
    service?: string;
    description?: string;
    timeWindow?: { duration?: string; isRolling?: boolean }[];
    budgetingMethod?: string;
    objectives?: {
      ratioMetrics?: {
        good?: { source?: string; query?: string };
        total?: { source?: string; query?: string };
      };
      target?: number;
    }[];
  };
}

interface AlertGroup {
  name?: string;
  rules?: {
    alert?: string;
    expr?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  }[];
}

interface BurnRateConfig {
  groups?: AlertGroup[];
}

describe('SLO definitions (portarium-slos.yaml)', () => {
  const raw = readFileSync(sloPath, 'utf8');
  const docs = raw
    .split(/^---$/m)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseYaml(s) as SloDocument | null)
    .filter((d): d is SloDocument => d !== null);

  it('has at least 5 SLO documents', () => {
    expect(docs.length).toBeGreaterThanOrEqual(5);
  });

  it('every SLO uses OpenSLO v1 format', () => {
    for (const doc of docs) {
      expect(doc.apiVersion).toBe('openslo.com/v1');
      expect(doc.kind).toBe('SLO');
    }
  });

  it('every SLO has a name and namespace', () => {
    for (const doc of docs) {
      expect(doc.metadata?.name).toBeTruthy();
      expect(doc.metadata?.namespace).toBe('portarium');
    }
  });

  it('every SLO has a rolling 30-day time window', () => {
    for (const doc of docs) {
      const window = doc.spec?.timeWindow?.[0];
      expect(window?.duration).toBe('30d');
      expect(window?.isRolling).toBe(true);
    }
  });

  it('every SLO has an objective with a target between 0 and 1', () => {
    for (const doc of docs) {
      const target = doc.spec?.objectives?.[0]?.target;
      expect(target).toBeGreaterThan(0);
      expect(target).toBeLessThanOrEqual(1);
    }
  });

  it('every SLO has good and total PromQL queries', () => {
    for (const doc of docs) {
      const metrics = doc.spec?.objectives?.[0]?.ratioMetrics;
      expect(metrics?.good?.query).toBeTruthy();
      expect(metrics?.total?.query).toBeTruthy();
    }
  });

  it('covers control-plane-api, execution-plane, and evidence-store services', () => {
    const services = new Set(docs.map((d) => d.spec?.service));
    expect(services.has('control-plane-api')).toBe(true);
    expect(services.has('execution-plane')).toBe(true);
    expect(services.has('evidence-store')).toBe(true);
  });

  it('has P0 tier labels on critical SLOs', () => {
    const p0Slos = docs.filter((d) => d.metadata?.labels?.['portarium.io/slo-tier'] === 'p0');
    expect(p0Slos.length).toBeGreaterThanOrEqual(4);
  });
});

describe('SLO burn-rate alerts (slo-burn-rate-alerts.yaml)', () => {
  const raw = readFileSync(burnRatePath, 'utf8');
  const config = parseYaml(raw) as BurnRateConfig;

  it('has alert groups for each SLO', () => {
    const groups = config.groups ?? [];
    expect(groups.length).toBeGreaterThanOrEqual(4);
  });

  it('every alert group has fast-burn and slow-burn rules', () => {
    const groups = config.groups ?? [];
    for (const group of groups) {
      if (group.name === 'portarium-slo-budget-exhaustion') continue;
      const alerts = (group.rules ?? []).map((r) => r.alert ?? '');
      const hasFast = alerts.some((a) => a.includes('FastBurn'));
      const hasSlow = alerts.some((a) => a.includes('SlowBurn'));
      expect(hasFast).toBe(true);
      expect(hasSlow).toBe(true);
    }
  });

  it('fast-burn alerts use page severity', () => {
    const groups = config.groups ?? [];
    for (const group of groups) {
      if (group.name === 'portarium-slo-budget-exhaustion') continue;
      const fastBurn = (group.rules ?? []).filter((r) => r.alert?.includes('FastBurn'));
      for (const rule of fastBurn) {
        expect(rule.labels?.['severity']).toBe('page');
      }
    }
  });

  it('slow-burn alerts use ticket or page severity', () => {
    const groups = config.groups ?? [];
    for (const group of groups) {
      if (group.name === 'portarium-slo-budget-exhaustion') continue;
      const slowBurn = (group.rules ?? []).filter((r) => r.alert?.includes('SlowBurn'));
      for (const rule of slowBurn) {
        // Evidence integrity slow burn intentionally uses 'page' severity
        // due to the 99.99% target — even slow burn warrants paging.
        expect(['ticket', 'page']).toContain(rule.labels?.['severity']);
      }
    }
  });

  it('has a budget exhaustion warning group', () => {
    const groups = config.groups ?? [];
    const budgetGroup = groups.find((g) => g.name === 'portarium-slo-budget-exhaustion');
    expect(budgetGroup).toBeDefined();
    const rules = budgetGroup?.rules ?? [];
    expect(rules.length).toBeGreaterThanOrEqual(1);
  });
});
