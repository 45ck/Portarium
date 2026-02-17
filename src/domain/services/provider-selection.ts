import type { AdapterRegistrationV1 } from '../adapters/adapter-registration-v1.js';
import type { PortFamily } from '../primitives/index.js';

export type ProviderSelectionResult =
  | Readonly<{ ok: true; adapter: AdapterRegistrationV1; alternativeCount: number }>
  | Readonly<{
      ok: false;
      reason: 'no_capable_adapter' | 'no_enabled_adapter' | 'no_matching_adapter';
    }>;

export class ProviderSelectionError extends Error {
  public override readonly name = 'ProviderSelectionError';

  public constructor(message: string) {
    super(message);
  }
}

export function selectProvider(params: {
  adapters: readonly AdapterRegistrationV1[];
  portFamily: PortFamily;
  operation: string;
}): ProviderSelectionResult {
  const { adapters, portFamily, operation } = params;

  const matchingFamily = adapters.filter((a) => a.portFamily === portFamily);
  if (matchingFamily.length === 0) {
    return { ok: false, reason: 'no_matching_adapter' };
  }

  const enabled = matchingFamily.filter((a) => a.enabled);
  if (enabled.length === 0) {
    return { ok: false, reason: 'no_enabled_adapter' };
  }

  const capable = enabled.filter((a) =>
    a.capabilityMatrix.some((cap) => cap.operation === operation),
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
