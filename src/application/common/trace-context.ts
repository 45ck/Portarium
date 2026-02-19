const TRACEPARENT_PATTERN = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

export type TraceContext = Readonly<{
  traceparent: string;
  tracestate?: string;
}>;

export function normalizeTraceparent(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (!TRACEPARENT_PATTERN.test(normalized)) return undefined;
  return normalized;
}

export function normalizeTracestate(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (normalized === '') return undefined;
  return normalized;
}
