import type { ApprovalPacket, ExternalObjectRef, WorkItemSla, WorkItemSummary } from './types.js';

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

export interface ApprovalDecisionRobotContext {
  hazardousZone?: boolean;
  safetyClassifiedZone?: boolean;
  remoteEstopRequest?: boolean;
  missionProposerUserId?: string;
  estopRequesterUserId?: string;
}

export interface ApprovalDecisionRequest {
  decision: ApprovalDecision;
  rationale: string;
  sodConstraints?: Record<string, unknown>[];
  previousApproverIds?: string[];
  robotContext?: ApprovalDecisionRobotContext;
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
  approvalPacket?: ApprovalPacket;
}

export interface StartRunCommand {
  workflowId: string;
  parameters?: Record<string, unknown>;
}
