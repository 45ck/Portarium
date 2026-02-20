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
} as const;

export type AppAction = (typeof APP_ACTIONS)[keyof typeof APP_ACTIONS];
