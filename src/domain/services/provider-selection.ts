import type { AdapterRegistrationV1 } from '../adapters/adapter-registration-v1.js';
import { isAllowedPortCapability } from '../ports/port-family-capabilities-v1.js';
import type { PortFamily } from '../primitives/index.js';
import { adapterClaimSupportsCapability } from './capability-enforcement.js';

export type ProviderSelectionResult =
  | Readonly<{ ok: true; adapter: AdapterRegistrationV1; alternativeCount: number }>
  | Readonly<{
      ok: false;
      reason:
        | 'no_capable_adapter'
        | 'no_enabled_adapter'
        | 'no_matching_adapter'
        | 'operation_not_in_family';
    }>;

export class ProviderSelectionError extends Error {
  public override readonly name = 'ProviderSelectionError';

  public constructor(message: string) {
    super(message);
  }
}

/**
 * Select the best adapter for a given port family and operation.
 *
 * Selection order:
 * 1. Reject immediately if the operation is not a canonical capability of the port family.
 * 2. Filter adapters by port family.
 * 3. Filter by enabled.
 * 4. Filter by capability/operation match (canonical-first, legacy-operation fallback).
 * 5. Sort remaining capable adapters deterministically by adapterId (ascending).
 * 6. Return the first — ties are broken alphabetically.
 */
export function selectProvider(params: {
  adapters: readonly AdapterRegistrationV1[];
  portFamily: PortFamily;
  operation: string;
}): ProviderSelectionResult {
  const { adapters, portFamily, operation } = params;

  if (!isAllowedPortCapability(portFamily, operation)) {
    return { ok: false, reason: 'operation_not_in_family' };
  }

  const matchingFamily = adapters.filter((a) => a.portFamily === portFamily);
  if (matchingFamily.length === 0) {
    return { ok: false, reason: 'no_matching_adapter' };
  }

  const enabled = matchingFamily.filter((a) => a.enabled);
  if (enabled.length === 0) {
    return { ok: false, reason: 'no_enabled_adapter' };
  }

  const capable = enabled.filter((a) =>
    a.capabilityMatrix.some((claim) => adapterClaimSupportsCapability(claim, operation)),
  );
  if (capable.length === 0) {
    return { ok: false, reason: 'no_capable_adapter' };
  }

  const sorted = [...capable].sort((a, b) => {
    const aId = a.adapterId as string;
    const bId = b.adapterId as string;
    return aId < bId ? -1 : aId > bId ? 1 : 0;
  });

  return { ok: true, adapter: sorted[0]!, alternativeCount: sorted.length - 1 };
}
