import { CapabilityKey, type CapabilityKey as CapabilityKeyType } from '../primitives/index.js';
import { readRecord, readString } from '../validation/parse-utils.js';

const CAPABILITY_TOKEN_PATTERN = /^[^:\s]+:[^:\s]+$/;

export type CapabilityDescriptorV1 = Readonly<{
  capability: CapabilityKeyType;
}>;

export class CapabilityDescriptorParseError extends Error {
  public override readonly name = 'CapabilityDescriptorParseError';

  public constructor(message: string) {
    super(message);
  }
}

export type CapabilityRoutingDenyReasonV1 =
  | 'CapabilityNotDeclaredByAgent'
  | 'CapabilityNotSupportedByMachine';

export type CapabilityRoutingDecisionV1 =
  | Readonly<{
      decision: 'Route';
      capability: CapabilityDescriptorV1;
    }>
  | Readonly<{
      decision: 'Deny';
      reason: CapabilityRoutingDenyReasonV1;
      capability: CapabilityDescriptorV1;
    }>;

export type CapabilityHandshakeV1 = Readonly<{
  machineCapabilities: readonly CapabilityDescriptorV1[];
  agentCapabilities: readonly CapabilityDescriptorV1[];
  routableCapabilities: readonly CapabilityDescriptorV1[];
  nonRoutableAgentCapabilities: readonly CapabilityDescriptorV1[];
}>;

export function parseCapabilityDescriptorV1(value: unknown): CapabilityDescriptorV1 {
  return parseCapabilityDescriptorEntry(
    value,
    'CapabilityDescriptor',
    CapabilityDescriptorParseError,
  );
}

export function parseCapabilityDescriptorsV1<E extends Error>(
  value: unknown,
  fieldName: string,
  createError: new (message: string) => E,
  opts?: Readonly<{ minLength?: number }>,
): readonly CapabilityDescriptorV1[] {
  if (!Array.isArray(value)) {
    throw new createError(`${fieldName} must be an array.`);
  }

  const minLength = opts?.minLength ?? 0;
  if (minLength === 1 && value.length === 0) {
    throw new createError(`${fieldName} must be a non-empty array.`);
  }
  if (minLength > 1 && value.length < minLength) {
    throw new createError(`${fieldName} must have length >= ${minLength}.`);
  }

  const parsed = value.map((entry, index) =>
    parseCapabilityDescriptorEntry(entry, `${fieldName}[${index}]`, createError),
  );

  assertNoDuplicateCapabilities(parsed, fieldName, createError);
  return parsed;
}

export function establishCapabilityHandshakeV1(input: {
  machineCapabilities: readonly CapabilityDescriptorV1[];
  agentCapabilities: readonly CapabilityDescriptorV1[];
}): CapabilityHandshakeV1 {
  const machine = dedupeDescriptors(input.machineCapabilities);
  const agent = dedupeDescriptors(input.agentCapabilities);
  const machineSet = toCapabilitySet(machine);

  const routable: CapabilityDescriptorV1[] = [];
  const nonRoutable: CapabilityDescriptorV1[] = [];
  for (const descriptor of agent) {
    if (machineSet.has(String(descriptor.capability))) {
      routable.push(descriptor);
    } else {
      nonRoutable.push(descriptor);
    }
  }

  return {
    machineCapabilities: machine,
    agentCapabilities: agent,
    routableCapabilities: routable,
    nonRoutableAgentCapabilities: nonRoutable,
  };
}

export function routeCapabilityToAgentV1(input: {
  handshake: CapabilityHandshakeV1;
  capability: CapabilityDescriptorV1;
}): CapabilityRoutingDecisionV1 {
  const requested = String(input.capability.capability);
  const agentSet = toCapabilitySet(input.handshake.agentCapabilities);
  if (!agentSet.has(requested)) {
    return {
      decision: 'Deny',
      reason: 'CapabilityNotDeclaredByAgent',
      capability: input.capability,
    };
  }

  const machineSet = toCapabilitySet(input.handshake.machineCapabilities);
  if (!machineSet.has(requested)) {
    return {
      decision: 'Deny',
      reason: 'CapabilityNotSupportedByMachine',
      capability: input.capability,
    };
  }

  return {
    decision: 'Route',
    capability: input.capability,
  };
}

function parseCapabilityDescriptorEntry<E extends Error>(
  value: unknown,
  path: string,
  createError: new (message: string) => E,
): CapabilityDescriptorV1 {
  if (typeof value === 'string') {
    return { capability: parseCapabilityToken(value, path, createError) };
  }

  const record = readRecord(value, path, createError);
  const capability = readString(record, 'capability', createError, { path });
  return { capability: parseCapabilityToken(capability, `${path}.capability`, createError) };
}

function parseCapabilityToken<E extends Error>(
  value: string,
  path: string,
  createError: new (message: string) => E,
): CapabilityKeyType {
  if (!CAPABILITY_TOKEN_PATTERN.test(value)) {
    throw new createError(`${path} must match "entity:verb" format.`);
  }
  return CapabilityKey(value);
}

function assertNoDuplicateCapabilities<E extends Error>(
  descriptors: readonly CapabilityDescriptorV1[],
  fieldName: string,
  createError: new (message: string) => E,
): void {
  const seen = new Set<string>();
  for (const descriptor of descriptors) {
    const capability = String(descriptor.capability);
    if (seen.has(capability)) {
      throw new createError(`${fieldName} must not contain duplicate capabilities.`);
    }
    seen.add(capability);
  }
}

function dedupeDescriptors(
  descriptors: readonly CapabilityDescriptorV1[],
): readonly CapabilityDescriptorV1[] {
  const seen = new Set<string>();
  const out: CapabilityDescriptorV1[] = [];
  for (const descriptor of descriptors) {
    const capability = String(descriptor.capability);
    if (seen.has(capability)) continue;
    seen.add(capability);
    out.push(descriptor);
  }
  return out;
}

function toCapabilitySet(descriptors: readonly CapabilityDescriptorV1[]): ReadonlySet<string> {
  return new Set(descriptors.map((descriptor) => String(descriptor.capability)));
}
