/**
 * Structured JSON logger for Portarium control plane.
 *
 * Outputs newline-delimited JSON to stdout/stderr.
 * Automatically injects the active OTel traceId when a span is active.
 *
 * Usage:
 *   const log = createLogger('control-plane');
 *   log.info('Server started', { port: 8080 });
 *   log.child({ workspaceId: 'ws-123' }).info('Request received');
 */

import { trace } from '@opentelemetry/api';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Readonly<Record<string, unknown>>;

type LogEntry = {
  level: LogLevel;
  time: number;
  name: string;
  msg: string;
  traceId?: string;
} & LogFields;

export type PortariumLogger = Readonly<{
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  child(bindings: LogFields): PortariumLogger;
}>;

function activeTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  if (!span) return undefined;
  const ctx = span.spanContext();
  const zero = '00000000000000000000000000000000';
  return ctx.traceId !== zero ? ctx.traceId : undefined;
}

function writeEntry(level: LogLevel, entry: LogEntry): void {
  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

function emit(level: LogLevel, name: string, msg: string, bindings: LogFields, fields?: LogFields): void {
  const entry: LogEntry = {
    level,
    time: Date.now(),
    name,
    msg,
    traceId: activeTraceId(),
    ...bindings,
    ...fields,
  };
  writeEntry(level, entry);
}

export function createLogger(name: string, bindings: LogFields = {}): PortariumLogger {
  return {
    debug(msg, fields) {
      emit('debug', name, msg, bindings, fields);
    },
    info(msg, fields) {
      emit('info', name, msg, bindings, fields);
    },
    warn(msg, fields) {
      emit('warn', name, msg, bindings, fields);
    },
    error(msg, fields) {
      emit('error', name, msg, bindings, fields);
    },
    child(childBindings) {
      return createLogger(name, { ...bindings, ...childBindings });
    },
  };
}
