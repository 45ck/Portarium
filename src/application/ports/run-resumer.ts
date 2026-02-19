import type {
  CorrelationId,
  HumanTaskId,
  RunId,
  TenantId,
  UserId,
} from '../../domain/primitives/index.js';

export type ResumeRunFromHumanTaskInput = Readonly<{
  tenantId: TenantId;
  runId: RunId;
  humanTaskId: HumanTaskId;
  completedByUserId: UserId;
  correlationId: CorrelationId;
  completionNote?: string;
}>;

export interface RunResumerPort {
  resumeRunFromHumanTask(input: ResumeRunFromHumanTaskInput): Promise<void>;
}
