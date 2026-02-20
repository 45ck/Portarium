export const APP_ACTIONS = {
  approvalRead: 'approval:read',
  approvalSubmit: 'approval:submit',
  runRead: 'run:read',
  workItemRead: 'work-item:read',
  runStart: 'run:start',
  mapCommandSubmit: 'map-command:submit',
  workforceAssign: 'workforce:assign',
  workforceComplete: 'workforce:complete',
  workspaceRegister: 'workspace:register',
  workspaceRead: 'workspace:read',
  /** Heartbeat sent by a registered agent or machine. */
  agentHeartbeat: 'agent:heartbeat',
  /** Register or update a machine / agent in the machine registry. */
  machineAgentRegister: 'machine-agent:register',
} as const;

export type AppAction = (typeof APP_ACTIONS)[keyof typeof APP_ACTIONS];
