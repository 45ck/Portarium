import {
  PolicyId,
  ProjectId,
  UserId,
  WorkspaceId,
  type ExecutionTier,
  type PolicyId as PolicyIdType,
  type ProjectId as ProjectIdType,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  readEnum,
  readInteger,
  readNonNegativeInteger,
  readOptionalString,
  readRecord,
  readString,
  readStringArray,
} from '../validation/parse-utils.js';

export const PROJECT_STATUSES = ['Active', 'Paused', 'Completed', 'Archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_GOVERNANCE_POSTURES = ['Clear', 'Attention', 'Blocked'] as const;
export type ProjectGovernancePosture = (typeof PROJECT_GOVERNANCE_POSTURES)[number];

export const PROJECT_EVIDENCE_DEPTHS = ['minimal', 'standard', 'deep', 'forensic'] as const;
export type ProjectEvidenceDepth = (typeof PROJECT_EVIDENCE_DEPTHS)[number];

export type ProjectGovernanceProfileV1 = Readonly<{
  ownerUserIds: readonly UserIdType[];
  policyIds: readonly PolicyIdType[];
  defaultExecutionTier: ExecutionTier;
  evidenceDepth: ProjectEvidenceDepth;
  allowedActionClasses: readonly string[];
  blockedActionClasses: readonly string[];
}>;

export type ProjectPortfolioMetricsV1 = Readonly<{
  workItemCount: number;
  activeRunCount: number;
  pendingApprovalCount: number;
  evidenceCount: number;
  artifactCount: number;
  policyViolationCount: number;
}>;

export type ProjectPortfolioProjectV1 = Readonly<{
  schemaVersion: 1;
  projectId: ProjectIdType;
  workspaceId: WorkspaceIdType;
  name: string;
  status: ProjectStatus;
  governancePosture: ProjectGovernancePosture;
  governance: ProjectGovernanceProfileV1;
  metrics: ProjectPortfolioMetricsV1;
  latestActivityAtIso?: string;
  summary?: string;
}>;

export type ProjectPortfolioV1 = Readonly<{
  schemaVersion: 1;
  workspaceId: WorkspaceIdType;
  projects: readonly ProjectPortfolioProjectV1[];
}>;

export class ProjectPortfolioParseError extends Error {
  public override readonly name = 'ProjectPortfolioParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function classifyProjectGovernancePosture(
  metrics: ProjectPortfolioMetricsV1,
): ProjectGovernancePosture {
  if (metrics.policyViolationCount > 0) return 'Blocked';
  if (metrics.pendingApprovalCount > 0 || metrics.activeRunCount > 0) return 'Attention';
  return 'Clear';
}

export function parseProjectPortfolioV1(value: unknown): ProjectPortfolioV1 {
  const record = readRecord(value, 'ProjectPortfolio', ProjectPortfolioParseError);
  const schemaVersion = readInteger(record, 'schemaVersion', ProjectPortfolioParseError);
  if (schemaVersion !== 1) {
    throw new ProjectPortfolioParseError('schemaVersion must be 1.');
  }

  const workspaceId = WorkspaceId(readString(record, 'workspaceId', ProjectPortfolioParseError));
  const projects = parseProjectList(record['projects'], workspaceId);

  return {
    schemaVersion: 1,
    workspaceId,
    projects,
  };
}

export function parseProjectPortfolioProjectV1(value: unknown): ProjectPortfolioProjectV1 {
  const record = readRecord(value, 'ProjectPortfolioProject', ProjectPortfolioParseError);
  const schemaVersion = readInteger(record, 'schemaVersion', ProjectPortfolioParseError);
  if (schemaVersion !== 1) {
    throw new ProjectPortfolioParseError('schemaVersion must be 1.');
  }

  const metrics = parseProjectPortfolioMetrics(record['metrics']);
  const declaredPosture = readEnum(
    record,
    'governancePosture',
    PROJECT_GOVERNANCE_POSTURES,
    ProjectPortfolioParseError,
  );
  const expectedPosture = classifyProjectGovernancePosture(metrics);
  if (declaredPosture !== expectedPosture) {
    throw new ProjectPortfolioParseError(
      `governancePosture must be ${expectedPosture} for the supplied metrics.`,
    );
  }

  const latestActivityAtIso = readOptionalString(
    record,
    'latestActivityAtIso',
    ProjectPortfolioParseError,
  );
  if (latestActivityAtIso !== undefined && Number.isNaN(new Date(latestActivityAtIso).getTime())) {
    throw new ProjectPortfolioParseError('latestActivityAtIso must be a valid ISO timestamp.');
  }

  const summary = readOptionalString(record, 'summary', ProjectPortfolioParseError);

  return {
    schemaVersion: 1,
    projectId: ProjectId(readString(record, 'projectId', ProjectPortfolioParseError)),
    workspaceId: WorkspaceId(readString(record, 'workspaceId', ProjectPortfolioParseError)),
    name: readString(record, 'name', ProjectPortfolioParseError),
    status: readEnum(record, 'status', PROJECT_STATUSES, ProjectPortfolioParseError),
    governancePosture: declaredPosture,
    governance: parseProjectGovernanceProfile(record['governance']),
    metrics,
    ...(latestActivityAtIso !== undefined ? { latestActivityAtIso } : {}),
    ...(summary !== undefined ? { summary } : {}),
  };
}

function parseProjectList(
  value: unknown,
  portfolioWorkspaceId: WorkspaceIdType,
): readonly ProjectPortfolioProjectV1[] {
  if (!Array.isArray(value)) {
    throw new ProjectPortfolioParseError('projects must be an array.');
  }

  return value.map((item, index) => {
    const project = parseProjectPortfolioProjectV1(item);
    if (project.workspaceId !== portfolioWorkspaceId) {
      throw new ProjectPortfolioParseError(
        `projects[${index}].workspaceId must match portfolio workspaceId.`,
      );
    }
    return project;
  });
}

function parseProjectGovernanceProfile(value: unknown): ProjectGovernanceProfileV1 {
  const record = readRecord(value, 'governance', ProjectPortfolioParseError);
  return {
    ownerUserIds: readStringArray(record, 'ownerUserIds', ProjectPortfolioParseError).map(UserId),
    policyIds: readStringArray(record, 'policyIds', ProjectPortfolioParseError).map(PolicyId),
    defaultExecutionTier: readEnum(
      record,
      'defaultExecutionTier',
      ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'],
      ProjectPortfolioParseError,
    ),
    evidenceDepth: readEnum(
      record,
      'evidenceDepth',
      PROJECT_EVIDENCE_DEPTHS,
      ProjectPortfolioParseError,
    ),
    allowedActionClasses: readStringArray(
      record,
      'allowedActionClasses',
      ProjectPortfolioParseError,
    ),
    blockedActionClasses: readStringArray(
      record,
      'blockedActionClasses',
      ProjectPortfolioParseError,
    ),
  };
}

function parseProjectPortfolioMetrics(value: unknown): ProjectPortfolioMetricsV1 {
  const record = readRecord(value, 'metrics', ProjectPortfolioParseError);
  return {
    workItemCount: readNonNegativeInteger(record, 'workItemCount', ProjectPortfolioParseError),
    activeRunCount: readNonNegativeInteger(record, 'activeRunCount', ProjectPortfolioParseError),
    pendingApprovalCount: readNonNegativeInteger(
      record,
      'pendingApprovalCount',
      ProjectPortfolioParseError,
    ),
    evidenceCount: readNonNegativeInteger(record, 'evidenceCount', ProjectPortfolioParseError),
    artifactCount: readNonNegativeInteger(record, 'artifactCount', ProjectPortfolioParseError),
    policyViolationCount: readNonNegativeInteger(
      record,
      'policyViolationCount',
      ProjectPortfolioParseError,
    ),
  };
}
