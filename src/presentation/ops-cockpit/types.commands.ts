import type { ExternalObjectRef, WorkItemSla, WorkItemSummary } from './types.js';

export interface AssignHumanTaskRequest {
  workforceMemberId?: string;
  workforceQueueId?: string;
}

export interface CompleteHumanTaskRequest {
  completionNote?: string;
}

export interface EscalateHumanTaskRequest {
  workforceQueueId: string;
  reason?: string;
}

export type ApprovalDecision = 'Approved' | 'Denied' | 'RequestChanges';

export interface ApprovalDecisionRequest {
  decision: ApprovalDecision;
  rationale: string;
}

export interface CreateWorkItemCommand {
  title: string;
  ownerUserId?: string;
  sla?: WorkItemSla;
  externalRefs?: ExternalObjectRef[];
}

export interface UpdateWorkItemCommand {
  title?: string;
  status?: WorkItemSummary['status'];
  ownerUserId?: string;
  sla?: WorkItemSla;
  externalRefs?: ExternalObjectRef[];
}

export interface CreateApprovalRequest {
  runId: string;
  planId: string;
  workItemId?: string;
  prompt: string;
  assigneeUserId?: string;
  dueAtIso?: string;
}

export interface StartRunCommand {
  workflowId: string;
  parameters?: Record<string, unknown>;
}
