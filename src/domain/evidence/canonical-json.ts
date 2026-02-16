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
 * Canonical JSON stringification for hashing.
 *
 * Rules:
 * - Objects are stringified with lexicographically sorted keys.
 * - `undefined` fields are omitted (like JSON.stringify does).
 * - Arrays keep their order.
 * - Values must be JSON-compatible (no functions, symbols, bigint, NaN, Infinity, Date, Map, etc).
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
