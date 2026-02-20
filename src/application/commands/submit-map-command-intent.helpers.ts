import {
  PolicyId,
  RobotId,
  SiteId,
  UserId,
  WorkspaceId,
  type EvidenceId as EvidenceIdType,
  type ExecutionTier,
  type PolicyId as PolicyIdType,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import type { PolicyV1 } from '../../domain/policy/index.js';
import { evaluatePolicies, type PolicyEvaluationResultV1 } from '../../domain/services/index.js';
import {
  APP_ACTIONS,
  err,
  ok,
  type Conflict,
  type Forbidden,
  type Result,
  type ValidationFailed,
} from '../common/index.js';

export type MapCommandKind = 'RemoteStop' | 'RestrictedZoneMove';

export type MapCommandContextInput = Readonly<{
  siteId: string;
  floorId?: string;
  mapLayerId?: string;
  zoneId?: string;
  hazardousZone?: boolean;
  safetyClassifiedZone?: boolean;
}>;

export type SubmitMapCommandIntentInput = Readonly<{
  workspaceId: string;
  commandKind: MapCommandKind;
  robotId: string;
  executionTier: ExecutionTier;
  policyIds: readonly string[];
  rationale: string;
  requestedByUserId?: string;
  approvingActorUserIds?: readonly string[];
  mapContext: MapCommandContextInput;
}>;

export type SubmitMapCommandIntentOutput = Readonly<{
  commandIntentId: string;
  evidenceId: EvidenceIdType;
  decision: 'Allow';
}>;

type ParsedMapContext = Readonly<{
  siteId: string;
  floorId?: string;
  mapLayerId?: string;
  zoneId?: string;
  hazardousZone?: boolean;
  safetyClassifiedZone?: boolean;
}>;

export type ParsedSubmitMapCommandIntentInput = Readonly<{
  workspaceId: WorkspaceIdType;
  commandKind: MapCommandKind;
  robotId: string;
  executionTier: ExecutionTier;
  policyIds: readonly PolicyIdType[];
  rationale: string;
  requestedByUserId: UserIdType;
  approvingActorUserIds: readonly UserIdType[];
  mapContext: ParsedMapContext;
}>;

export type SubmitMapCommandIntentPolicyError = Forbidden | Conflict;

function parseRequiredString(value: unknown, fieldName: string): Result<string, ValidationFailed> {
  if (typeof value !== 'string' || value.trim() === '') {
    return err({
      kind: 'ValidationFailed',
      message: `${fieldName} must be a non-empty string.`,
    });
  }
  return ok(value);
}

function parseStringArray(
  rawValues: unknown,
  fieldName: string,
): Result<readonly string[], ValidationFailed> {
  if (!Array.isArray(rawValues)) {
    return err({
      kind: 'ValidationFailed',
      message: `${fieldName} must be an array.`,
    });
  }

  const parsed: string[] = [];
  for (const rawValue of rawValues) {
    const valueResult = parseRequiredString(rawValue, `${fieldName}[]`);
    if (!valueResult.ok) return valueResult;
    parsed.push(valueResult.value);
  }
  return ok(parsed);
}

function parsePolicyIds(rawPolicyIds: unknown): Result<readonly PolicyIdType[], ValidationFailed> {
  const idsResult = parseStringArray(rawPolicyIds, 'policyIds');
  if (!idsResult.ok) return idsResult;
  if (idsResult.value.length === 0) {
    return err({
      kind: 'ValidationFailed',
      message: 'policyIds must be a non-empty array of policy identifiers.',
    });
  }
  return ok([...new Set(idsResult.value.map((policyId) => PolicyId(policyId)))]);
}

function parseApprovingActorUserIds(
  rawApprovingActorUserIds: unknown,
): Result<readonly UserIdType[], ValidationFailed> {
  if (rawApprovingActorUserIds === undefined) return ok([]);
  const idsResult = parseStringArray(rawApprovingActorUserIds, 'approvingActorUserIds');
  if (!idsResult.ok) return idsResult;
  return ok([...new Set(idsResult.value.map((userId) => UserId(userId)))]);
}

function parseOptionalString(
  value: unknown,
  fieldName: string,
): Result<string | undefined, ValidationFailed> {
  if (value === undefined) return ok(undefined);
  const parsed = parseRequiredString(value, fieldName);
  if (!parsed.ok) return parsed;
  return ok(parsed.value);
}

function parseMapContextStrings(record: Record<string, unknown>): Result<
  Readonly<{
    siteId: string;
    floorId?: string;
    mapLayerId?: string;
    zoneId?: string;
  }>,
  ValidationFailed
> {
  const siteIdResult = parseRequiredString(record['siteId'], 'mapContext.siteId');
  if (!siteIdResult.ok) return siteIdResult;
  const floorIdResult = parseOptionalString(record['floorId'], 'mapContext.floorId');
  if (!floorIdResult.ok) return floorIdResult;
  const mapLayerIdResult = parseOptionalString(record['mapLayerId'], 'mapContext.mapLayerId');
  if (!mapLayerIdResult.ok) return mapLayerIdResult;
  const zoneIdResult = parseOptionalString(record['zoneId'], 'mapContext.zoneId');
  if (!zoneIdResult.ok) return zoneIdResult;

  return ok({
    siteId: SiteId(siteIdResult.value),
    ...(floorIdResult.value ? { floorId: floorIdResult.value } : {}),
    ...(mapLayerIdResult.value ? { mapLayerId: mapLayerIdResult.value } : {}),
    ...(zoneIdResult.value ? { zoneId: zoneIdResult.value } : {}),
  });
}

function parseMapContext(rawMapContext: unknown): Result<ParsedMapContext, ValidationFailed> {
  if (typeof rawMapContext !== 'object' || rawMapContext === null) {
    return err({
      kind: 'ValidationFailed',
      message: 'mapContext must be an object.',
    });
  }

  const record = rawMapContext as Record<string, unknown>;
  const stringFields = parseMapContextStrings(record);
  if (!stringFields.ok) return stringFields;

  return ok({
    ...stringFields.value,
    ...(typeof record['hazardousZone'] === 'boolean'
      ? { hazardousZone: record['hazardousZone'] }
      : {}),
    ...(typeof record['safetyClassifiedZone'] === 'boolean'
      ? { safetyClassifiedZone: record['safetyClassifiedZone'] }
      : {}),
  });
}

export function parseSubmitMapCommandIntentInput(
  rawInput: SubmitMapCommandIntentInput,
): Result<ParsedSubmitMapCommandIntentInput, ValidationFailed> {
  const workspaceIdResult = parseRequiredString(rawInput.workspaceId, 'workspaceId');
  if (!workspaceIdResult.ok) return workspaceIdResult;
  const robotIdResult = parseRequiredString(rawInput.robotId, 'robotId');
  if (!robotIdResult.ok) return robotIdResult;
  const rationaleResult = parseRequiredString(rawInput.rationale, 'rationale');
  if (!rationaleResult.ok) return rationaleResult;
  const requestedByUserIdResult = parseRequiredString(
    rawInput.requestedByUserId,
    'requestedByUserId',
  );
  if (!requestedByUserIdResult.ok) return requestedByUserIdResult;
  const policyIdsResult = parsePolicyIds(rawInput.policyIds);
  if (!policyIdsResult.ok) return policyIdsResult;
  const approvingActorUserIdsResult = parseApprovingActorUserIds(rawInput.approvingActorUserIds);
  if (!approvingActorUserIdsResult.ok) return approvingActorUserIdsResult;
  const mapContextResult = parseMapContext(rawInput.mapContext);
  if (!mapContextResult.ok) return mapContextResult;

  return ok({
    workspaceId: WorkspaceId(workspaceIdResult.value),
    commandKind: rawInput.commandKind,
    robotId: RobotId(robotIdResult.value),
    executionTier: rawInput.executionTier,
    policyIds: policyIdsResult.value,
    rationale: rationaleResult.value,
    requestedByUserId: UserId(requestedByUserIdResult.value),
    approvingActorUserIds: approvingActorUserIdsResult.value,
    mapContext: mapContextResult.value,
  });
}

function toActionOperation(
  commandKind: MapCommandKind,
): 'robot:estop_request' | 'robot:execute_action' {
  return commandKind === 'RemoteStop' ? 'robot:estop_request' : 'robot:execute_action';
}

export function evaluateMapCommandGovernance(params: {
  policies: readonly PolicyV1[];
  input: ParsedSubmitMapCommandIntentInput;
}): PolicyEvaluationResultV1 {
  const { policies, input } = params;
  const actionOperation = toActionOperation(input.commandKind);
  const hazardousZone =
    input.mapContext.hazardousZone ?? input.commandKind === 'RestrictedZoneMove';
  const safetyClassifiedZone = input.mapContext.safetyClassifiedZone ?? false;

  return evaluatePolicies({
    policies,
    context: {
      initiatorUserId: input.requestedByUserId,
      approverUserIds: input.approvingActorUserIds,
      executionTier: input.executionTier,
      actionOperation,
      proximityZoneActive: hazardousZone,
      ...(safetyClassifiedZone ? { robotHazardClass: 'High' as const } : {}),
      robotContext: {
        hazardousZone,
        safetyClassifiedZone,
        remoteEstopRequest: input.commandKind === 'RemoteStop',
        missionProposerUserId: input.requestedByUserId,
        ...(input.commandKind === 'RemoteStop'
          ? { estopRequesterUserId: input.requestedByUserId }
          : {}),
      },
    },
  });
}

export function toMapCommandPolicyGateError(params: {
  evaluation: PolicyEvaluationResultV1;
  evidenceId: EvidenceIdType;
}): SubmitMapCommandIntentPolicyError | null {
  const { evaluation, evidenceId } = params;
  if (evaluation.violations.length > 0) {
    return {
      kind: 'Forbidden',
      action: APP_ACTIONS.mapCommandSubmit,
      message: `SoD violation: ${evaluation.violations[0]!.kind}. Command intent evidence: ${evidenceId}.`,
    };
  }
  if (evaluation.decision === 'Deny') {
    return {
      kind: 'Forbidden',
      action: APP_ACTIONS.mapCommandSubmit,
      message: `Policy denied map command intent. Command intent evidence: ${evidenceId}.`,
    };
  }
  if (evaluation.decision === 'RequireApproval') {
    return {
      kind: 'Conflict',
      message: `Policy gate requires approval (${evaluation.safetyTierRecommendation ?? 'HumanApprove'}). Command intent evidence: ${evidenceId}.`,
    };
  }
  return null;
}
