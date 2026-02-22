import type { AgentConfigV1, MachineRegistrationV1 } from './machine-registration-v1.js';
import {
  establishCapabilityHandshakeV1,
  type CapabilityHandshakeV1,
} from './capability-handshake-v1.js';

/**
 * Reasons why an OpenClaw agent-machine binding is invalid.
 *
 * - MachineIdMismatch: the agent's machineId does not match the machine's machineId.
 * - MachineInactive: the machine is inactive and cannot accept new agent bindings.
 * - NoCapabilityIntersection: none of the agent's declared capabilities are
 *   supported by the machine — there is nothing the agent can do on this machine.
 */
export type OpenClawAgentBindingViolationKindV1 =
  | 'MachineIdMismatch'
  | 'MachineInactive'
  | 'NoCapabilityIntersection';

export type OpenClawAgentBindingViolationV1 = Readonly<{
  kind: OpenClawAgentBindingViolationKindV1;
  detail: string;
}>;

/**
 * Result of validating whether an OpenClaw agent can be bound to a machine.
 *
 * When valid:
 * - The handshake captures the full capability intersection: which of the
 *   agent's declared capabilities the machine supports, and which it does not.
 * - At least one capability is routable (enforced by the guard).
 *
 * When invalid:
 * - One or more violations explain why the binding is not allowed.
 */
export type OpenClawAgentBindingResultV1 =
  | Readonly<{
      valid: true;
      agentId: string;
      machineId: string;
      /**
       * Full capability handshake result — includes routableCapabilities and
       * nonRoutableAgentCapabilities so callers can identify partial coverage.
       */
      handshake: CapabilityHandshakeV1;
    }>
  | Readonly<{
      valid: false;
      agentId: string;
      machineId: string;
      violations: readonly OpenClawAgentBindingViolationV1[];
    }>;

/**
 * Validates that an OpenClaw agent configuration can be bound to a machine
 * registration, checking identity, liveness, and capability coverage.
 *
 * This is a pure domain rule — it has no side effects and requires no I/O.
 *
 * Invariants enforced (in evaluation order):
 * 1. agent.machineId must equal machine.machineId.
 * 2. machine.active must be true (inactive machines reject new bindings).
 * 3. At least one of the agent's capabilities must be routable through the
 *    machine (full disjointness is rejected; partial coverage is allowed and
 *    reported via the handshake's nonRoutableAgentCapabilities field).
 *
 * All violations are collected before returning; a single call reveals all
 * problems rather than stopping at the first.
 */
export function validateOpenClawAgentBindingV1(
  agent: AgentConfigV1,
  machine: MachineRegistrationV1,
): OpenClawAgentBindingResultV1 {
  const agentId = String(agent.agentId);
  const machineId = String(machine.machineId);

  const violations: OpenClawAgentBindingViolationV1[] = [];

  if (agentId !== machineId && String(agent.machineId) !== String(machine.machineId)) {
    violations.push({
      kind: 'MachineIdMismatch',
      detail:
        `agent.machineId "${String(agent.machineId)}" does not match ` +
        `machine.machineId "${String(machine.machineId)}".`,
    });
  }

  if (!machine.active) {
    violations.push({
      kind: 'MachineInactive',
      detail: `machine "${String(machine.machineId)}" is inactive; agents may not be bound to inactive machines.`,
    });
  }

  // Perform the capability handshake regardless of earlier violations so we can
  // report capability problems independently.
  const handshake = establishCapabilityHandshakeV1({
    machineCapabilities: machine.capabilities,
    agentCapabilities: agent.capabilities,
  });

  if (handshake.routableCapabilities.length === 0) {
    violations.push({
      kind: 'NoCapabilityIntersection',
      detail:
        `agent "${agentId}" has no capabilities routable through machine "${String(machine.machineId)}". ` +
        `Agent capabilities: [${agent.capabilities.map((c) => String(c.capability)).join(', ')}]. ` +
        `Machine capabilities: [${machine.capabilities.map((c) => String(c.capability)).join(', ')}].`,
    });
  }

  if (violations.length > 0) {
    return { valid: false, agentId, machineId, violations };
  }

  return { valid: true, agentId, machineId, handshake };
}
