import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

// Resolve collector config relative to repo root (4 levels up from this file:
// observability/ -> infrastructure/ -> src/ -> <worktree-root>)
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const configPath = resolve(__dirname, '../../../infra/otel/collector-config.yaml');

interface Pipeline {
  receivers?: string[];
  processors?: string[];
  exporters?: string[];
}

interface CollectorConfig {
  receivers?: Record<string, unknown>;
  processors?: Record<string, unknown>;
  exporters?: Record<string, unknown>;
  connectors?: Record<string, unknown>;
  service?: {
    pipelines?: Record<string, Pipeline>;
  };
}

describe('OTel collector-config.yaml — production pipeline structure', () => {
  let config: CollectorConfig;

  it('parses the YAML without error', () => {
    const raw = readFileSync(configPath, 'utf8');
    config = parseYaml(raw) as CollectorConfig;
    expect(config).toBeTruthy();
    // Cache for subsequent tests
    Object.assign(globalThis, { __otelConfig: config });
  });

  describe('pipelines', () => {
    function getConfig(): CollectorConfig {
      const raw = readFileSync(configPath, 'utf8');
      return parseYaml(raw) as CollectorConfig;
    }

    it('has a traces pipeline', () => {
      const cfg = getConfig();
      expect(cfg.service?.pipelines?.['traces']).toBeDefined();
    });

    it('has a metrics pipeline', () => {
      const cfg = getConfig();
      expect(cfg.service?.pipelines?.['metrics']).toBeDefined();
    });

    it('has a logs pipeline', () => {
      const cfg = getConfig();
      expect(cfg.service?.pipelines?.['logs']).toBeDefined();
    });
  });

  describe('spanmetrics connector', () => {
    it('is declared in connectors section', () => {
      const raw = readFileSync(configPath, 'utf8');
      const cfg = parseYaml(raw) as CollectorConfig;
      expect(cfg.connectors?.['spanmetrics']).toBeDefined();
    });

    it('is an exporter in the traces pipeline', () => {
      const raw = readFileSync(configPath, 'utf8');
      const cfg = parseYaml(raw) as CollectorConfig;
      const tracesExporters = cfg.service?.pipelines?.['traces']?.exporters ?? [];
      expect(tracesExporters).toContain('spanmetrics');
    });

    it('is a receiver in the metrics pipeline', () => {
      const raw = readFileSync(configPath, 'utf8');
      const cfg = parseYaml(raw) as CollectorConfig;
      const metricsReceivers = cfg.service?.pipelines?.['metrics']?.receivers ?? [];
      expect(metricsReceivers).toContain('spanmetrics');
    });
  });

  describe('prometheusremotewrite exporter', () => {
    it('is declared in exporters section', () => {
      const raw = readFileSync(configPath, 'utf8');
      const cfg = parseYaml(raw) as CollectorConfig;
      expect(cfg.exporters?.['prometheusremotewrite']).toBeDefined();
    });

    it('is used in the metrics pipeline', () => {
      const raw = readFileSync(configPath, 'utf8');
      const cfg = parseYaml(raw) as CollectorConfig;
      const metricsExporters = cfg.service?.pipelines?.['metrics']?.exporters ?? [];
      expect(metricsExporters).toContain('prometheusremotewrite');
    });
  });

  describe('loki exporter', () => {
    it('is declared in exporters section', () => {
      const raw = readFileSync(configPath, 'utf8');
      const cfg = parseYaml(raw) as CollectorConfig;
      expect(cfg.exporters?.['loki']).toBeDefined();
    });

    it('is used in the logs pipeline', () => {
      const raw = readFileSync(configPath, 'utf8');
      const cfg = parseYaml(raw) as CollectorConfig;
      const logsExporters = cfg.service?.pipelines?.['logs']?.exporters ?? [];
      expect(logsExporters).toContain('loki');
    });
  });

  describe('transform/add_trace_id_to_logs processor', () => {
    it('is declared in processors section', () => {
      const raw = readFileSync(configPath, 'utf8');
      const cfg = parseYaml(raw) as CollectorConfig;
      expect(cfg.processors?.['transform/add_trace_id_to_logs']).toBeDefined();
    });

    it('is used in the logs pipeline', () => {
      const raw = readFileSync(configPath, 'utf8');
      const cfg = parseYaml(raw) as CollectorConfig;
      const logsProcessors = cfg.service?.pipelines?.['logs']?.processors ?? [];
      expect(logsProcessors).toContain('transform/add_trace_id_to_logs');
    });
  });

  describe('attributes/redact processor', () => {
    it('is declared in processors section', () => {
      const raw = readFileSync(configPath, 'utf8');
      const cfg = parseYaml(raw) as CollectorConfig;
      expect(cfg.processors?.['attributes/redact']).toBeDefined();
    });

    it('is used in the traces pipeline', () => {
      const raw = readFileSync(configPath, 'utf8');
      const cfg = parseYaml(raw) as CollectorConfig;
      const tracesProcessors = cfg.service?.pipelines?.['traces']?.processors ?? [];
      expect(tracesProcessors).toContain('attributes/redact');
    });

    it('is used in the logs pipeline', () => {
      const raw = readFileSync(configPath, 'utf8');
      const cfg = parseYaml(raw) as CollectorConfig;
      const logsProcessors = cfg.service?.pipelines?.['logs']?.processors ?? [];
      expect(logsProcessors).toContain('attributes/redact');
    });
  });
});
