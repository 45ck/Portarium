import type { CapabilityDescriptorV1 } from './capability-handshake-v1.js';

export type CapabilityObservationSourceV1 = 'Heartbeat' | 'ReRegistration';

export type CapabilityDriftDeltaV1 = Readonly<{
  addedCapabilities: readonly CapabilityDescriptorV1[];
  removedCapabilities: readonly CapabilityDescriptorV1[];
}>;

export type CapabilityDriftAllowReasonV1 = 'NoDrift' | 'DriftReviewed';

export type CapabilityDriftPolicyDecisionV1 =
  | Readonly<{
      decision: 'Allow';
      reason: CapabilityDriftAllowReasonV1;
      source: CapabilityObservationSourceV1;
      sideEffects: 'Allowed';
      drift: CapabilityDriftDeltaV1;
    }>
  | Readonly<{
      decision: 'Quarantine';
      reason: 'CapabilityDriftDetected';
      source: CapabilityObservationSourceV1;
      sideEffects: 'Denied';
      runState: 'PolicyBlocked';
      drift: CapabilityDriftDeltaV1;
    }>;

export function evaluateCapabilityDriftQuarantinePolicyV1(input: {
  baselineCapabilities: readonly CapabilityDescriptorV1[];
  observedCapabilities: readonly CapabilityDescriptorV1[];
  source: CapabilityObservationSourceV1;
  reviewed: boolean;
}): CapabilityDriftPolicyDecisionV1 {
  const baseline = dedupeDescriptors(input.baselineCapabilities);
  const observed = dedupeDescriptors(input.observedCapabilities);
  const baselineSet = toCapabilitySet(baseline);
  const observedSet = toCapabilitySet(observed);

  const addedCapabilities = observed.filter(
    (descriptor) => !baselineSet.has(String(descriptor.capability)),
  );
  const removedCapabilities = baseline.filter(
    (descriptor) => !observedSet.has(String(descriptor.capability)),
  );

  const drift: CapabilityDriftDeltaV1 = {
    addedCapabilities,
    removedCapabilities,
  };

  const hasDrift = addedCapabilities.length > 0 || removedCapabilities.length > 0;
  if (!hasDrift) {
    return {
      decision: 'Allow',
      reason: 'NoDrift',
      source: input.source,
      sideEffects: 'Allowed',
      drift,
    };
  }

  if (input.reviewed) {
    return {
      decision: 'Allow',
      reason: 'DriftReviewed',
      source: input.source,
      sideEffects: 'Allowed',
      drift,
    };
  }

  return {
    decision: 'Quarantine',
    reason: 'CapabilityDriftDetected',
    source: input.source,
    sideEffects: 'Denied',
    runState: 'PolicyBlocked',
    drift,
  };
}

export function summarizeCapabilityDriftV1(drift: CapabilityDriftDeltaV1): string {
  const added = drift.addedCapabilities.map((descriptor) => String(descriptor.capability));
  const removed = drift.removedCapabilities.map((descriptor) => String(descriptor.capability));

  const parts: string[] = [];
  if (added.length > 0) {
    parts.push(`added: ${added.join(', ')}`);
  }
  if (removed.length > 0) {
    parts.push(`removed: ${removed.join(', ')}`);
  }

  return parts.length === 0 ? 'no drift' : parts.join(' | ');
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
