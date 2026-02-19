export const APP_ACTIONS = {
  approvalSubmit: 'approval:submit',
  runRead: 'run:read',
  workItemRead: 'work-item:read',
  runStart: 'run:start',
  workforceAssign: 'workforce:assign',
  workspaceRegister: 'workspace:register',
  workspaceRead: 'workspace:read',
} as const;

export type AppAction = (typeof APP_ACTIONS)[keyof typeof APP_ACTIONS];
