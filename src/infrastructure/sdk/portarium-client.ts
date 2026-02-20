/**
 * Re-export of the PortariumClient from the SDK package.
 *
 * The canonical implementation lives in src/sdk/portarium-client.ts.
 * This re-export provides the infrastructure-layer import path requested
 * by bead-0661.
 */
export {
  PortariumClient,
  PortariumApiError,
  type PortariumClientConfig,
  type AuthProvider,
  type ProblemDetails,
  type StartRunInput,
  type RunSummary,
  type ApprovalDecisionInput,
  type AgentRegistrationInput,
  type AgentHeartbeatInput,
  type MachineRegistrationInput,
  type MachineHeartbeatInput,
  type EventSubscription,
} from '../../sdk/portarium-client.js';
