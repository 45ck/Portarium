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
  type HealthStatus,
  type PolicySummary,
  type PolicyListResult,
  type SavePolicyInput,
  type SavePolicyResult,
  type MachineSummary,
  type MachineListResult,
  type AgentSummary,
  type AgentListResult,
} from '../../sdk/portarium-client.js';
