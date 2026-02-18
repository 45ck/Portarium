type JsonPrimitive = string | number | boolean | null;
// Use interface-based recursion to avoid TS2456 (circular type alias).
declare const __jsonArrayBrand: unique symbol;
interface JsonArray extends ReadonlyArray<JsonValue> {
  // Marker field: keeps the interface non-empty for eslint, and the key cannot collide with real JSON.
  readonly [__jsonArrayBrand]?: true;
}
interface JsonObject {
  readonly [key: string]: JsonValue;
}
type JsonValue = JsonPrimitive | JsonArray | JsonObject;

/**
 * Canonical JSON stringification for hashing — aligned to RFC 8785 JCS
 * (JSON Canonicalization Scheme, https://www.rfc-editor.org/rfc/rfc8785).
 *
 * Compliance notes:
 * - Object keys are sorted by Unicode code point order of their UTF-16 representation
 *   (equivalent to the `<`/`>` operator on JS strings for all BMP characters).
 *   Domain key names are ASCII identifiers, so this is identical to byte order.
 * - `undefined` fields are omitted (like JSON.stringify; not permitted in JCS input).
 * - Arrays preserve insertion order (JCS requirement).
 * - Numbers are serialized using the ECMAScript `Number::toString` algorithm, which
 *   produces the shortest round-trip representation — compatible with JCS §3.2.2.3.
 *   Non-finite values (NaN, Infinity) are rejected as they are not valid JSON.
 * - Only plain objects, arrays, and JSON primitives are accepted.
 *   Dates, Maps, class instances, BigInt, Symbol, and functions are rejected.
 *
 * Cross-language compatibility: any JCS-compliant implementation (Python, Java, Go, etc.)
 * operating on the same JSON-compatible data will produce a byte-identical output,
 * enabling deterministic hash verification of evidence chains outside TypeScript.
 */
export function canonicalizeJson(value: unknown): string {
  const normalized = normalizeJson(value);
  return JSON.stringify(normalized);
}

function normalizeJson(value: unknown): JsonValue {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return normalizeNumber(value);
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (typeof value === 'object') return normalizePlainObject(value);

  throw new Error(`Unsupported value type in canonical JSON: ${typeof value}`);
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Non-finite numbers are not supported in canonical JSON.');
  }
  return value;
}

function normalizePlainObject(value: object): JsonObject {
  const proto = Reflect.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new Error('Only plain objects are supported in canonical JSON.');
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    // Locale-independent ordering to keep hashes stable across environments.
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const out: Record<string, JsonValue> = {};
  for (const [k, v] of entries) {
    out[k] = normalizeJson(v);
  }
  return out;
}
