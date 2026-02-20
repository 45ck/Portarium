# Application Command/Query Contract v1

**Beads:** bead-0319, bead-0340, bead-0434

## Purpose

Define the complete application-layer command/query surface contract and keep it CI-enforced for:

- authorization operation mapping (`APP_ACTIONS`)
- `Forbidden` action mapping
- input/output/error schema drift detection
- `.specify/specs` coverage for every application operation

## Contract Registry

| Kind      | Operation                 | Action               | Source                                                   | Input Type                     | Output Type                     | Error Type                      |
| --------- | ------------------------- | -------------------- | -------------------------------------------------------- | ------------------------------ | ------------------------------- | ------------------------------- |
| `command` | `registerWorkspace`       | `workspace:register` | `src/application/commands/register-workspace.ts`         | `RegisterWorkspaceInput`       | `RegisterWorkspaceOutput`       | `RegisterWorkspaceError`        |
| `command` | `startWorkflow`           | `run:start`          | `src/application/commands/start-workflow.ts`             | `StartWorkflowInput`           | `StartWorkflowOutput`           | `StartWorkflowError`            |
| `command` | `submitApproval`          | `approval:submit`    | `src/application/commands/submit-approval.ts`            | `SubmitApprovalInput`          | `SubmitApprovalOutput`          | `SubmitApprovalError`           |
| `command` | `submitMapCommandIntent`  | `map-command:submit` | `src/application/commands/submit-map-command-intent.ts`  | `SubmitMapCommandIntentInput`  | `SubmitMapCommandIntentOutput`  | `SubmitMapCommandIntentError`   |
| `command` | `assignWorkforceMember`   | `workforce:assign`   | `src/application/commands/assign-workforce-member.ts`    | `AssignWorkforceMemberInput`   | `AssignWorkforceMemberOutput`   | `AssignWorkforceMemberError`    |
| `command` | `completeHumanTask`       | `workforce:complete` | `src/application/commands/complete-human-task.ts`        | `CompleteHumanTaskInput`       | `CompleteHumanTaskOutput`       | `CompleteHumanTaskError`        |
| `command` | `registerMachine`         | `machine-agent:register` | `src/application/commands/machine-agent-registration.ts` | `RegisterMachineInput`         | `RegisterMachineOutput`         | `MachineAgentRegistrationError` |
| `command` | `createAgent`             | `machine-agent:register` | `src/application/commands/machine-agent-registration.ts` | `CreateAgentInput`             | `CreateAgentOutput`             | `MachineAgentRegistrationError` |
| `command` | `updateAgentCapabilities` | `machine-agent:register` | `src/application/commands/machine-agent-registration.ts` | `UpdateAgentCapabilitiesInput` | `UpdateAgentCapabilitiesOutput` | `MachineAgentRegistrationError` |
| `query`   | `getWorkspace`            | `workspace:read`     | `src/application/queries/get-workspace.ts`               | `GetWorkspaceInput`            | `GetWorkspaceOutput`            | `GetWorkspaceError`             |
| `query`   | `listWorkspaces`          | `workspace:read`     | `src/application/queries/list-workspaces.ts`             | `ListWorkspacesInput`          | `ListWorkspacesOutput`          | `ListWorkspacesError`           |
| `query`   | `getRun`                  | `run:read`           | `src/application/queries/get-run.ts`                     | `GetRunInput`                  | `GetRunOutput`                  | `GetRunError`                   |
| `query`   | `listRuns`                | `run:read`           | `src/application/queries/list-runs.ts`                   | `ListRunsInput`                | `ListRunsOutput`                | `ListRunsError`                 |
| `query`   | `getApproval`             | `approval:read`      | `src/application/queries/get-approval.ts`                | `GetApprovalInput`             | `GetApprovalOutput`             | `GetApprovalError`              |
| `query`   | `listApprovals`           | `approval:read`      | `src/application/queries/list-approvals.ts`              | `ListApprovalsInput`           | `ListApprovalsOutput`           | `ListApprovalsError`            |
| `query`   | `getWorkItem`             | `work-item:read`     | `src/application/queries/get-work-item.ts`               | `GetWorkItemInput`             | `GetWorkItemOutput`             | `GetWorkItemError`              |
| `query`   | `listWorkItems`           | `work-item:read`     | `src/application/queries/list-work-items.ts`             | `ListWorkItemsInput`           | `ListWorkItemsOutput`           | `ListWorkItemsError`            |

## Implementing Bead Mapping

| Operation Set                                                                                        | Implementing Bead(s) |
| ---------------------------------------------------------------------------------------------------- | -------------------- |
| workspace/run/approval/work-item list+read query surface                                             | `bead-0319`          |
| remaining application command use-cases (`submitMapCommandIntent`, workforce assignment/completion)  | `bead-0340`          |
| machine/agent registration command set (`registerMachine`, `createAgent`, `updateAgentCapabilities`) | `bead-0434`          |

## CI Enforcement

`src/application/contracts/application-command-query-contract.test.ts` enforces:

1. command/query index exports stay aligned with the contract registry.
2. each source file contains authorization checks using the mapped `APP_ACTIONS` value.
3. each source file maps `Forbidden.action` to the same `APP_ACTIONS` value.
4. this spec registry row exists for every operation.
5. input/output/error type alias signatures match `src/application/contracts/application-command-query-schema.golden.json`.
