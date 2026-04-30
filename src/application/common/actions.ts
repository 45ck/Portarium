export const APP_ACTIONS = {
  approvalCreate: 'approval:create',
  approvalRead: 'approval:read',
  approvalSubmit: 'approval:submit',
  evidenceRead: 'evidence:read',
  planRead: 'plan:read',
  runRead: 'run:read',
  workItemRead: 'work-item:read',
  runStart: 'run:start',
  runIntervene: 'run:intervene',
  mapCommandSubmit: 'map-command:submit',
  workforceAssign: 'workforce:assign',
  workforceComplete: 'workforce:complete',
  workspaceRegister: 'workspace:register',
  workspaceRead: 'workspace:read',
  /** Heartbeat sent by a registered agent or machine. */
  agentHeartbeat: 'agent:heartbeat',
  /** Register or update a machine / agent in the machine registry. */
  machineAgentRegister: 'machine-agent:register',
  /** Read machine or agent registrations. */
  machineAgentRead: 'machine-agent:read',
  /** Sync agent lifecycle state with an OpenClaw gateway (bridge operations). */
  machineAgentBridgeSync: 'machine-agent:bridge-sync',
  /** Invoke a tool through the Portarium Action API (propose/execute flow). */
  toolInvoke: 'tool:invoke',
  /** Propose an agent action for policy evaluation and approval routing. */
  agentActionPropose: 'agent-action:propose',
  /** Execute an approved agent action through the action-gated tool invoker. */
  agentActionExecute: 'agent-action:execute',
} as const;

export type AppAction = (typeof APP_ACTIONS)[keyof typeof APP_ACTIONS];
