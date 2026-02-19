const SENSITIVE_KEY_PATTERN = /(authorization|token|secret|password|api[-_]?key|credential)/i;

export function redactStructuredLogValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactStructuredLogValue(item));
  }

  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = '[REDACTED]';
        continue;
      }
      out[key] = redactStructuredLogValue(nested);
    }
    return out;
  }

  return value;
}

export function redactStructuredLogObject(
  value: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return redactStructuredLogValue(value) as Record<string, unknown>;
}
