export type OperationKind = 'command' | 'query';

export type ActionKey =
  | 'approvalRead'
  | 'approvalSubmit'
  | 'runRead'
  | 'workItemRead'
  | 'runStart'
  | 'mapCommandSubmit'
  | 'workforceAssign'
  | 'workforceComplete'
  | 'workspaceRegister'
  | 'workspaceRead'
  | 'agentHeartbeat'
  | 'machineAgentRegister';

export type OperationContract = Readonly<{
  kind: OperationKind;
  name: string;
  sourcePath: string;
  actionKey: ActionKey;
  types: Readonly<{
    input: string;
    output: string;
    error: string;
  }>;
}>;

export const APPLICATION_CONTRACT_SPEC_PATH =
  '.specify/specs/application-command-query-contract-v1.md';
export const APPLICATION_SCHEMA_GOLDEN_PATH =
  'src/application/contracts/application-command-query-schema.golden.json';

export const APPLICATION_OPERATION_CONTRACTS = [
  {
    kind: 'command',
    name: 'registerWorkspace',
    sourcePath: 'src/application/commands/register-workspace.ts',
    actionKey: 'workspaceRegister',
    types: {
      input: 'RegisterWorkspaceInput',
      output: 'RegisterWorkspaceOutput',
      error: 'RegisterWorkspaceError',
    },
  },
  {
    kind: 'command',
    name: 'startWorkflow',
    sourcePath: 'src/application/commands/start-workflow.ts',
    actionKey: 'runStart',
    types: {
      input: 'StartWorkflowInput',
      output: 'StartWorkflowOutput',
      error: 'StartWorkflowError',
    },
  },
  {
    kind: 'command',
    name: 'submitApproval',
    sourcePath: 'src/application/commands/submit-approval.ts',
    actionKey: 'approvalSubmit',
    types: {
      input: 'SubmitApprovalInput',
      output: 'SubmitApprovalOutput',
      error: 'SubmitApprovalError',
    },
  },
  {
    kind: 'command',
    name: 'submitMapCommandIntent',
    sourcePath: 'src/application/commands/submit-map-command-intent.ts',
    actionKey: 'mapCommandSubmit',
    types: {
      input: 'SubmitMapCommandIntentInput',
      output: 'SubmitMapCommandIntentOutput',
      error: 'SubmitMapCommandIntentError',
    },
  },
  {
    kind: 'command',
    name: 'assignWorkforceMember',
    sourcePath: 'src/application/commands/assign-workforce-member.ts',
    actionKey: 'workforceAssign',
    types: {
      input: 'AssignWorkforceMemberInput',
      output: 'AssignWorkforceMemberOutput',
      error: 'AssignWorkforceMemberError',
    },
  },
  {
    kind: 'command',
    name: 'completeHumanTask',
    sourcePath: 'src/application/commands/complete-human-task.ts',
    actionKey: 'workforceComplete',
    types: {
      input: 'CompleteHumanTaskInput',
      output: 'CompleteHumanTaskOutput',
      error: 'CompleteHumanTaskError',
    },
  },
  {
    kind: 'command',
    name: 'registerMachine',
    sourcePath: 'src/application/commands/machine-agent-registration.ts',
    actionKey: 'machineAgentRegister',
    types: {
      input: 'RegisterMachineInput',
      output: 'RegisterMachineOutput',
      error: 'MachineAgentRegistrationError',
    },
  },
  {
    kind: 'command',
    name: 'createAgent',
    sourcePath: 'src/application/commands/machine-agent-registration.ts',
    actionKey: 'machineAgentRegister',
    types: {
      input: 'CreateAgentInput',
      output: 'CreateAgentOutput',
      error: 'MachineAgentRegistrationError',
    },
  },
  {
    kind: 'command',
    name: 'updateAgentCapabilities',
    sourcePath: 'src/application/commands/machine-agent-registration.ts',
    actionKey: 'machineAgentRegister',
    types: {
      input: 'UpdateAgentCapabilitiesInput',
      output: 'UpdateAgentCapabilitiesOutput',
      error: 'MachineAgentRegistrationError',
    },
  },
  {
    kind: 'query',
    name: 'getWorkspace',
    sourcePath: 'src/application/queries/get-workspace.ts',
    actionKey: 'workspaceRead',
    types: {
      input: 'GetWorkspaceInput',
      output: 'GetWorkspaceOutput',
      error: 'GetWorkspaceError',
    },
  },
  {
    kind: 'query',
    name: 'listWorkspaces',
    sourcePath: 'src/application/queries/list-workspaces.ts',
    actionKey: 'workspaceRead',
    types: {
      input: 'ListWorkspacesInput',
      output: 'ListWorkspacesOutput',
      error: 'ListWorkspacesError',
    },
  },
  {
    kind: 'query',
    name: 'getRun',
    sourcePath: 'src/application/queries/get-run.ts',
    actionKey: 'runRead',
    types: {
      input: 'GetRunInput',
      output: 'GetRunOutput',
      error: 'GetRunError',
    },
  },
  {
    kind: 'query',
    name: 'listRuns',
    sourcePath: 'src/application/queries/list-runs.ts',
    actionKey: 'runRead',
    types: {
      input: 'ListRunsInput',
      output: 'ListRunsOutput',
      error: 'ListRunsError',
    },
  },
  {
    kind: 'query',
    name: 'getApproval',
    sourcePath: 'src/application/queries/get-approval.ts',
    actionKey: 'approvalRead',
    types: {
      input: 'GetApprovalInput',
      output: 'GetApprovalOutput',
      error: 'GetApprovalError',
    },
  },
  {
    kind: 'query',
    name: 'listApprovals',
    sourcePath: 'src/application/queries/list-approvals.ts',
    actionKey: 'approvalRead',
    types: {
      input: 'ListApprovalsInput',
      output: 'ListApprovalsOutput',
      error: 'ListApprovalsError',
    },
  },
  {
    kind: 'query',
    name: 'getWorkItem',
    sourcePath: 'src/application/queries/get-work-item.ts',
    actionKey: 'workItemRead',
    types: {
      input: 'GetWorkItemInput',
      output: 'GetWorkItemOutput',
      error: 'GetWorkItemError',
    },
  },
  {
    kind: 'query',
    name: 'listWorkItems',
    sourcePath: 'src/application/queries/list-work-items.ts',
    actionKey: 'workItemRead',
    types: {
      input: 'ListWorkItemsInput',
      output: 'ListWorkItemsOutput',
      error: 'ListWorkItemsError',
    },
  },
] as const satisfies readonly OperationContract[];
