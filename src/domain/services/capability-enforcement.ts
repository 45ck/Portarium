/**
 * Canonical capability enforcement service.
 *
 * Provides cross-entity compatibility checks between workflow actions,
 * adapter capability claims, and port supported operations.
 *
 * Compatibility strategy (migration path from legacy operations to canonical capabilities):
 * - When an entity declares a `capability` field, it MUST be checked first (canonical path).
 * - When only `operation` is present (legacy path), string equality is used as a fallback.
 * - Canonical capabilities always take precedence over operation string matching.
 */

import type { CapabilityClaimV1 } from '../adapters/adapter-registration-v1.js';
import type { PortCapability } from '../ports/port-family-capabilities-v1.js';
import type { PortV1 } from '../ports/port-v1.js';
import type { WorkflowActionV1 } from '../workflows/workflow-v1.js';

/**
 * Check whether an adapter capability claim satisfies a required canonical capability.
 *
 * Canonical path: claim.capability === required.
 * Compatibility fallback: claim.operation === required (for legacy claims without capability).
 */
export function adapterClaimSupportsCapability(
  claim: CapabilityClaimV1,
  required: PortCapability,
): boolean {
  if (claim.capability !== undefined) {
    return claim.capability === required;
  }
  return claim.operation === required;
}

/**
 * Check whether a port's supportedOperations includes a required canonical capability.
 */
export function portSupportsCapability(port: PortV1, required: PortCapability): boolean {
  return port.supportedOperations.includes(required);
}

/**
 * Derive the effective canonical capability for a workflow action.
 *
 * If the action carries an explicit `capability`, that is canonical.
 * Otherwise the `operation` string is treated as the effective capability
 * (compatibility path — operation must already be in `entity:verb` format).
 */
export function resolveActionCapability(action: WorkflowActionV1): string {
  return action.capability ?? action.operation;
}

/**
 * Check whether a port satisfies the capability required by a workflow action.
 */
export function portFulfillsAction(port: PortV1, action: WorkflowActionV1): boolean {
  const required = resolveActionCapability(action);
  return port.supportedOperations.includes(required as PortCapability);
}

/**
 * Check whether an adapter has at least one claim that satisfies a workflow action.
 *
 * When the action specifies a canonical capability, only canonical-capable claims match.
 * When the action uses a legacy operation string, both canonical and legacy claims match.
 */
export function adapterFulfillsAction(
  claims: readonly CapabilityClaimV1[],
  action: WorkflowActionV1,
): boolean {
  const required = resolveActionCapability(action);
  return claims.some((claim) => adapterClaimSupportsCapability(claim, required as PortCapability));
}
