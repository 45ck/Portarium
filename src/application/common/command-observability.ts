import { context as otContext, metrics, propagation, SpanStatusCode, trace } from '@opentelemetry/api';

import type { AppContext } from './context.js';

type AttributeValue = string | number | boolean;

type CommandOutcome = 'ok' | 'error' | 'exception';

type CommandTelemetryAttributes = Readonly<Record<string, AttributeValue>>;

interface CommandTelemetryHooks {
  onStart(spanName: string, attributes: CommandTelemetryAttributes): void;
  onEnd(
    spanName: string,
    outcome: CommandOutcome,
    durationMs: number,
    attributes: CommandTelemetryAttributes,
  ): void;
}

const NOOP_COMMAND_TELEMETRY_HOOKS: CommandTelemetryHooks = {
  onStart() {
    // no-op by default
  },
  onEnd() {
    // no-op by default
  },
};

let activeCommandTelemetryHooks: CommandTelemetryHooks = NOOP_COMMAND_TELEMETRY_HOOKS;

const tracer = trace.getTracer('portarium.application');
const meter = metrics.getMeter('portarium.application');
const commandExecutionCounter = meter.createCounter('app.command.executions', {
  description: 'Command execution count by command name and outcome.',
});
const commandDurationHistogram = meter.createHistogram('app.command.duration.ms', {
  unit: 'ms',
  description: 'Command execution duration in milliseconds.',
});

type ObserveCommandExecutionArgs<T> = Readonly<{
  commandName: string;
  ctx: AppContext;
  run: () => Promise<T>;
  classifyOutcome: (value: T) => Exclude<CommandOutcome, 'exception'>;
}>;

function nowMs(): number {
  return Date.now();
}

function buildBaseAttributes(commandName: string, ctx: AppContext): CommandTelemetryAttributes {
  return {
    'app.command.name': commandName,
    'app.command.has_traceparent': Boolean(ctx.traceparent),
    'app.command.has_tracestate': Boolean(ctx.tracestate),
    'app.command.roles_count': ctx.roles.length,
  };
}

function buildParentContext(ctx: AppContext) {
  const carrier: Record<string, string> = {};
  if (ctx.traceparent) {
    carrier['traceparent'] = ctx.traceparent;
  }
  if (ctx.tracestate) {
    carrier['tracestate'] = ctx.tracestate;
  }
  if (Object.keys(carrier).length === 0) {
    return otContext.active();
  }
  return propagation.extract(otContext.active(), carrier);
}

export async function observeCommandExecution<T>(args: ObserveCommandExecutionArgs<T>): Promise<T> {
  const spanName = `app.command.${args.commandName}`;
  const baseAttributes = buildBaseAttributes(args.commandName, args.ctx);
  const parentContext = buildParentContext(args.ctx);

  return otContext.with(parentContext, async () =>
    tracer.startActiveSpan(
      spanName,
      {
        attributes: baseAttributes,
      },
      async (span) => {
        activeCommandTelemetryHooks.onStart(spanName, baseAttributes);
        const startedAt = nowMs();

        try {
          const value = await args.run();
          const outcome = args.classifyOutcome(value);
          const durationMs = nowMs() - startedAt;
          const metricAttributes = {
            ...baseAttributes,
            'app.command.outcome': outcome,
          };

          commandExecutionCounter.add(1, metricAttributes);
          commandDurationHistogram.record(durationMs, metricAttributes);

          span.setStatus({
            code: outcome === 'ok' ? SpanStatusCode.OK : SpanStatusCode.ERROR,
            ...(outcome === 'ok' ? {} : { message: 'Command returned an error result.' }),
          });
          activeCommandTelemetryHooks.onEnd(spanName, outcome, durationMs, metricAttributes);
          return value;
        } catch (error) {
          const durationMs = nowMs() - startedAt;
          const metricAttributes = {
            ...baseAttributes,
            'app.command.outcome': 'exception',
          } as const;
          const message = error instanceof Error ? error.message : 'Unhandled command execution error.';

          commandExecutionCounter.add(1, metricAttributes);
          commandDurationHistogram.record(durationMs, metricAttributes);
          span.recordException(error instanceof Error ? error : new Error(message));
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message,
          });
          activeCommandTelemetryHooks.onEnd(spanName, 'exception', durationMs, metricAttributes);
          throw error;
        } finally {
          span.end();
        }
      },
    ),
  );
}

export function setCommandTelemetryHooksForTest(hooks: CommandTelemetryHooks): void {
  activeCommandTelemetryHooks = hooks;
}

export function resetCommandTelemetryHooksForTest(): void {
  activeCommandTelemetryHooks = NOOP_COMMAND_TELEMETRY_HOOKS;
}
