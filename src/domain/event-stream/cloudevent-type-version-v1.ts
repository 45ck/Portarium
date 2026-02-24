/**
 * CloudEvents type versioning — parsing and construction helpers.
 *
 * Portarium CloudEvents type attribute format (v1 governance):
 *
 *   com.portarium.<aggregate-lowercase>.<EventName>.v<N>
 *
 * Examples:
 *   com.portarium.run.RunStarted.v1
 *   com.portarium.approval.ApprovalGranted.v2
 *
 * Rules:
 * - All new event types MUST include a version suffix (`.v<N>` where N >= 1).
 * - The version suffix is a monotonically increasing integer.
 * - Breaking schema changes (removed fields, type changes) MUST increment N.
 * - Additive changes (new optional fields) SHOULD NOT increment N.
 * - Consumers MUST handle unknown fields gracefully (forward compatibility).
 * - Consumers MUST emit a warning when they encounter an unknown version and
 *   fall back to the highest registered version ≤ the received version.
 *
 * See: docs/internal/adr/ADR-0082.md
 * Bead: bead-0383
 */

export const PORTARIUM_CE_NAMESPACE = 'com.portarium' as const;

/**
 * Parsed representation of a Portarium CloudEvents type string.
 */
export type ParsedCloudEventType = Readonly<{
  /** Full original type string. */
  raw: string;
  /** Namespace prefix, e.g. `com.portarium`. */
  namespace: string;
  /** Aggregate segment, e.g. `run`, `approval`. */
  aggregate: string;
  /** Event name without version, e.g. `RunStarted`. */
  eventName: string;
  /** Semantic version number extracted from the suffix. `undefined` for legacy unversioned types. */
  version: number | undefined;
}>;

/**
 * Parse a Portarium CloudEvents type string into its constituent parts.
 *
 * Accepts both versioned (`…EventName.v1`) and legacy unversioned types.
 * Returns `undefined` when the string is not a valid `com.portarium.*` type.
 */
export function parseCloudEventType(type: string): ParsedCloudEventType | undefined {
  if (!type.startsWith(`${PORTARIUM_CE_NAMESPACE}.`)) return undefined;

  const body = type.slice(PORTARIUM_CE_NAMESPACE.length + 1); // after "com.portarium."
  const segments = body.split('.');

  if (segments.length < 2) return undefined;

  const aggregate = segments[0]!;

  // Last segment may be a version suffix "vN"
  const lastSegment = segments[segments.length - 1]!;
  const versionMatch = /^v(\d+)$/.exec(lastSegment);

  let eventName: string;
  let version: number | undefined;

  if (versionMatch && segments.length >= 3) {
    version = parseInt(versionMatch[1]!, 10);
    eventName = segments.slice(1, -1).join('.');
  } else {
    eventName = segments.slice(1).join('.');
    version = undefined;
  }

  if (!aggregate || !eventName) return undefined;

  return { raw: type, namespace: PORTARIUM_CE_NAMESPACE, aggregate, eventName, version };
}

/**
 * Build a versioned Portarium CloudEvents type string.
 *
 * @example
 * buildCloudEventType('run', 'RunStarted', 1)
 * // → 'com.portarium.run.RunStarted.v1'
 */
export function buildCloudEventType(aggregate: string, eventName: string, version: number): string {
  if (!aggregate.trim() || !eventName.trim()) {
    throw new Error('aggregate and eventName must be non-empty strings.');
  }
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`version must be a positive integer, got: ${version}`);
  }
  return `${PORTARIUM_CE_NAMESPACE}.${aggregate.toLowerCase()}.${eventName}.v${version}`;
}

/**
 * Extract the version from a versioned type string.
 * Returns `undefined` for legacy unversioned types.
 */
export function extractCloudEventTypeVersion(type: string): number | undefined {
  return parseCloudEventType(type)?.version;
}

/**
 * Return `true` if the type string carries a version suffix.
 */
export function isVersionedCloudEventType(type: string): boolean {
  return parseCloudEventType(type)?.version !== undefined;
}
