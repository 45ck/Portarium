export const APP_ACTIONS = {
  approvalSubmit: 'approval:submit',
  runRead: 'run:read',
  runStart: 'run:start',
  workspaceRegister: 'workspace:register',
  workspaceRead: 'workspace:read',
} as const;

export type AppAction = (typeof APP_ACTIONS)[keyof typeof APP_ACTIONS];
