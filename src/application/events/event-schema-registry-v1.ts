/**
 * In-process CloudEvent schema registry with consumer resilience.
 *
 * The registry maps (aggregate, eventName) → ordered list of versioned handlers.
 * When a consumer receives an event it calls `dispatch()` which:
 *
 * 1. Parses the version from the CloudEvents `type` attribute.
 * 2. Finds the handler registered for the exact version, OR falls back to the
 *    highest registered version that is ≤ the received version (graceful
 *    consumer resilience — tolerates additive schema changes).
 * 3. Emits a structured warning when the received version is higher than any
 *    registered handler (unknown future version).
 * 4. Returns `{ handled: false }` for completely unknown event types (forward
 *    compatibility — consumers MUST NOT crash on unknown types).
 *
 * Schema governance rules enforced at registration time:
 * - Version numbers must be positive integers.
 * - Duplicate registrations for the same (aggregate, eventName, version) are
 *   rejected (prevents accidental handler replacement).
 *
 * See: docs/adr/ADR-0082.md
 * Bead: bead-0383
 */

import type { CloudEventV1 } from '../../domain/event-stream/cloudevents-v1.js';
import {
  parseCloudEventType,
  isVersionedCloudEventType,
} from '../../domain/event-stream/cloudevent-type-version-v1.js';

export type SchemaRegistryHandler<T = unknown> = (
  event: CloudEventV1,
  data: T,
) => void | Promise<void>;

export type DispatchResult =
  | Readonly<{ handled: true; version: number }>
  | Readonly<{ handled: false; reason: 'UnknownType' | 'UnversionedType' | 'NoHandlerRegistered' }>;

export type RegistryWarning = Readonly<{
  kind: 'UnknownFutureVersion' | 'FallbackToLowerVersion';
  receivedType: string;
  receivedVersion: number;
  usedVersion: number;
}>;

interface HandlerEntry {
  version: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: SchemaRegistryHandler<any>;
}

/**
 * CloudEvent schema registry.
 *
 * @example
 * const registry = new CloudEventSchemaRegistry();
 *
 * registry.register('run', 'RunStarted', 1, (event, data: RunStartedDataV1) => {
 *   // handle v1
 * });
 *
 * registry.register('run', 'RunStarted', 2, (event, data: RunStartedDataV2) => {
 *   // handle v2
 * });
 *
 * await registry.dispatch(incomingEvent);
 */
export class CloudEventSchemaRegistry {
  // key: `<aggregate>.<eventName>`, value: entries sorted by version ascending
  readonly #handlers = new Map<string, HandlerEntry[]>();
  readonly #onWarning: (warning: RegistryWarning) => void;

  public constructor(options?: { onWarning?: (warning: RegistryWarning) => void }) {
    this.#onWarning = options?.onWarning ?? (() => undefined);
  }

  /**
   * Register a handler for a specific event type and version.
   *
   * @throws Error when the same (aggregate, eventName, version) is registered twice.
   */
  public register<T>(
    aggregate: string,
    eventName: string,
    version: number,
    handler: SchemaRegistryHandler<T>,
  ): void {
    if (!Number.isInteger(version) || version < 1) {
      throw new Error(
        `Schema registry: version must be a positive integer (got ${version} for ${aggregate}.${eventName}).`,
      );
    }

    const key = this.#makeKey(aggregate, eventName);
    let entries = this.#handlers.get(key);
    if (!entries) {
      entries = [];
      this.#handlers.set(key, entries);
    }

    if (entries.some((e) => e.version === version)) {
      throw new Error(
        `Schema registry: duplicate registration for ${aggregate}.${eventName}.v${version}.`,
      );
    }

    entries.push({ version, handler });
    entries.sort((a, b) => a.version - b.version);
  }

  /**
   * Dispatch a CloudEvent to the appropriate handler.
   *
   * Returns a `DispatchResult` describing whether the event was handled and
   * which version was used. The result is always returned even when the event
   * is unknown — consumers MUST NOT crash on unknown types.
   */
  public async dispatch(event: CloudEventV1): Promise<DispatchResult> {
    const parsed = parseCloudEventType(event.type);

    if (!parsed) {
      return { handled: false, reason: 'UnknownType' };
    }

    if (!isVersionedCloudEventType(event.type)) {
      return { handled: false, reason: 'UnversionedType' };
    }

    const receivedVersion = parsed.version!;
    const key = this.#makeKey(parsed.aggregate, parsed.eventName);
    const entries = this.#handlers.get(key);

    if (!entries || entries.length === 0) {
      return { handled: false, reason: 'NoHandlerRegistered' };
    }

    // Find exact version or best lower version (graceful resilience)
    const exact = entries.find((e) => e.version === receivedVersion);
    if (exact) {
      await exact.handler(event, event.data);
      return { handled: true, version: exact.version };
    }

    // Find the highest version ≤ received version
    const lowerCandidates = entries.filter((e) => e.version <= receivedVersion);
    if (lowerCandidates.length > 0) {
      const best = lowerCandidates[lowerCandidates.length - 1]!;
      this.#onWarning({
        kind: 'UnknownFutureVersion',
        receivedType: event.type,
        receivedVersion,
        usedVersion: best.version,
      });
      await best.handler(event, event.data);
      return { handled: true, version: best.version };
    }

    // Received version is lower than all registered versions — use lowest
    const lowest = entries[0]!;
    this.#onWarning({
      kind: 'FallbackToLowerVersion',
      receivedType: event.type,
      receivedVersion,
      usedVersion: lowest.version,
    });
    await lowest.handler(event, event.data);
    return { handled: true, version: lowest.version };
  }

  /**
   * Return all registered (aggregate, eventName, version) tuples — useful for
   * introspection and compatibility matrix generation.
   */
  public listRegistrations(): ReadonlyArray<{
    aggregate: string;
    eventName: string;
    version: number;
  }> {
    const out: { aggregate: string; eventName: string; version: number }[] = [];
    for (const [key, entries] of this.#handlers) {
      const [aggregate, ...rest] = key.split('.');
      const eventName = rest.join('.');
      for (const entry of entries) {
        out.push({ aggregate: aggregate!, eventName, version: entry.version });
      }
    }
    return out;
  }

  #makeKey(aggregate: string, eventName: string): string {
    return `${aggregate.toLowerCase()}.${eventName}`;
  }
}
