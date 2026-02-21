import { SpanStatusCode, trace } from '@opentelemetry/api';

import type { WorkflowActionV1, WorkflowV1 } from '../../domain/workflows/workflow-v1.js';
import type { MetricAttributes } from '../observability/metrics-hooks.js';

export type TemporalTelemetryAttributes = Readonly<Record<string, string | number | boolean>>;
type TemporalSpanOutcome = 'ok' | 'error';

export interface TemporalTelemetryHooks {
  onSpanStart(spanName: string, attributes: TemporalTelemetryAttributes): void;
  onSpanEnd(
    spanName: string,
    outcome: TemporalSpanOutcome,
    durationMs: number,
    attributes: TemporalTelemetryAttributes,
  ): void;
}

export type PackTelemetryContext = Readonly<{
  packId: string;
  packVersion: string;
}>;

const tracer = trace.getTracer('portarium.infrastructure.temporal.activities');
const DEFAULT_PACK_TELEMETRY_CONTEXT: PackTelemetryContext = {
  packId: 'core.unscoped',
  packVersion: '0.0.0',
};

const NOOP_TEMPORAL_TELEMETRY_HOOKS: TemporalTelemetryHooks = {
  onSpanStart() {
    // no-op by default
  },
  onSpanEnd() {
    // no-op by default
  },
};

let activeTemporalTelemetryHooks: TemporalTelemetryHooks = NOOP_TEMPORAL_TELEMETRY_HOOKS;

export async function observeTemporalSpan<T>(params: {
  spanName: string;
  attributes: TemporalTelemetryAttributes;
  run: () => Promise<T>;
}): Promise<T> {
  return tracer.startActiveSpan(
    params.spanName,
    { attributes: params.attributes },
    async (span) => {
      activeTemporalTelemetryHooks.onSpanStart(params.spanName, params.attributes);
      const startedAtMs = Date.now();

      try {
        const value = await params.run();
        const durationMs = Date.now() - startedAtMs;
        span.setStatus({ code: SpanStatusCode.OK });
        activeTemporalTelemetryHooks.onSpanEnd(params.spanName, 'ok', durationMs, params.attributes);
        return value;
      } catch (error) {
        const durationMs = Date.now() - startedAtMs;
        const message = error instanceof Error ? error.message : 'Unhandled Temporal activity error.';
        span.recordException(error instanceof Error ? error : new Error(message));
        span.setStatus({ code: SpanStatusCode.ERROR, message });
        activeTemporalTelemetryHooks.onSpanEnd(
          params.spanName,
          'error',
          durationMs,
          params.attributes,
        );
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

export function resolvePackTelemetryContext(
  _workflow: WorkflowV1,
  packId: string | undefined,
  packVersion: string | undefined,
): PackTelemetryContext {
  if (packId && packVersion) {
    return { packId, packVersion };
  }
  return DEFAULT_PACK_TELEMETRY_CONTEXT;
}

export function buildRunMetricAttributes(
  packTelemetry: PackTelemetryContext,
  executionTier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly',
): MetricAttributes {
  return {
    'pack.id': packTelemetry.packId,
    'pack.version': packTelemetry.packVersion,
    'workflow.execution_tier': executionTier,
    'telemetry.pii_safe': true,
  };
}

export function buildActionMetricAttributes(
  packTelemetry: PackTelemetryContext,
  executionTier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly',
  action: WorkflowActionV1,
): MetricAttributes {
  return {
    ...buildRunMetricAttributes(packTelemetry, executionTier),
    'action.id': String(action.actionId),
    'action.operation': action.operation,
    'action.port_family': action.portFamily,
  };
}

export function setTemporalTelemetryHooksForTest(hooks: TemporalTelemetryHooks): void {
  activeTemporalTelemetryHooks = hooks;
}

export function resetTemporalTelemetryHooksForTest(): void {
  activeTemporalTelemetryHooks = NOOP_TEMPORAL_TELEMETRY_HOOKS;
}
