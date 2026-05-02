import { createHash } from 'node:crypto';

import {
  ArtifactId,
  EvidenceId,
  HashSha256,
  RunId,
  WorkspaceId,
  type ArtifactId as ArtifactIdType,
  type EvidenceId as EvidenceIdType,
} from '../../domain/primitives/index.js';
import {
  buildWeeklyAutonomyDigestArtifactV1,
  DIGEST_EXECUTION_TIERS,
  renderWeeklyAutonomyDigestMarkdown,
  type DigestExecutionTier,
  type PolicyAdjustmentKind,
  type WeeklyAutonomyDigestArtifactV1,
} from '../../domain/runs/index.js';
import { parseRetentionScheduleV1 } from '../../domain/evidence/index.js';
import type { ArtifactV1 } from '../../domain/runs/index.js';
import {
  APP_ACTIONS,
  err,
  ok,
  type AppContext,
  type DependencyFailure,
  type Forbidden,
  type Result,
  type ValidationFailed,
} from '../common/index.js';
import type {
  AuthorizationPort,
  Clock,
  EvidenceLogPort,
  EvidencePayloadLocation,
  EvidencePayloadStorePort,
  IdGenerator,
  WeeklyAutonomyDigestActivityStore,
} from '../ports/index.js';

export type WeeklyAutonomyDigestCurrentPolicyTiers = Readonly<Record<string, DigestExecutionTier>>;

export type GenerateWeeklyAutonomyDigestArtifactInput = Readonly<{
  workspaceId: string;
  runId: string;
  periodStartIso: string;
  periodEndIso: string;
  historyWindowStartIso: string;
  currentPolicyTiers?: WeeklyAutonomyDigestCurrentPolicyTiers;
  artifactLocation: EvidencePayloadLocation;
  retentionSchedule?: unknown;
}>;

export type GenerateWeeklyAutonomyDigestArtifactOutput = Readonly<{
  digest: WeeklyAutonomyDigestArtifactV1;
  markdown: string;
  artifact: ArtifactV1;
  evidenceId: EvidenceIdType;
}>;

export type GenerateWeeklyAutonomyDigestArtifactError =
  | Forbidden
  | ValidationFailed
  | DependencyFailure;

export type GenerateWeeklyAutonomyDigestArtifactDeps = Readonly<{
  authorization: AuthorizationPort;
  activityStore: WeeklyAutonomyDigestActivityStore;
  payloadStore: EvidencePayloadStorePort;
  evidenceLog: EvidenceLogPort;
  clock: Clock;
  idGenerator: IdGenerator;
}>;

export type AcknowledgeWeeklyAutonomyDigestInput = Readonly<{
  workspaceId: string;
  artifactId: string;
  artifactUri: string;
  digestHashSha256: string;
  periodStartIso: string;
  periodEndIso: string;
  rationale?: string;
}>;

export type AcknowledgeWeeklyAutonomyDigestOutput = Readonly<{
  artifactId: ArtifactIdType;
  evidenceId: EvidenceIdType;
  acknowledgedAtIso: string;
}>;

export type AcknowledgeWeeklyAutonomyDigestError = Forbidden | ValidationFailed | DependencyFailure;

export type AcknowledgeWeeklyAutonomyDigestDeps = Readonly<{
  authorization: AuthorizationPort;
  evidenceLog: EvidenceLogPort;
  clock: Clock;
  idGenerator: IdGenerator;
}>;

export type DraftPolicyCalibrationShortcutInput = Readonly<{
  workspaceId: string;
  artifactId: string;
  artifactUri: string;
  digestHashSha256: string;
  recommendationId: string;
  actionClass: string;
  adjustment: PolicyAdjustmentKind;
  currentTier: DigestExecutionTier;
  recommendedTier: DigestExecutionTier;
  rationale: string;
}>;

export type DraftPolicyCalibrationShortcutOutput = Readonly<{
  draftId: string;
  artifactId: ArtifactIdType;
  evidenceId: EvidenceIdType;
  effect: 'draft-policy-change-only';
}>;

export type DraftPolicyCalibrationShortcutError = Forbidden | ValidationFailed | DependencyFailure;

export type DraftPolicyCalibrationShortcutDeps = Readonly<{
  authorization: AuthorizationPort;
  evidenceLog: EvidenceLogPort;
  clock: Clock;
  idGenerator: IdGenerator;
}>;

export async function generateWeeklyAutonomyDigestArtifact(
  deps: GenerateWeeklyAutonomyDigestArtifactDeps,
  ctx: AppContext,
  input: GenerateWeeklyAutonomyDigestArtifactInput,
): Promise<
  Result<GenerateWeeklyAutonomyDigestArtifactOutput, GenerateWeeklyAutonomyDigestArtifactError>
> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.autonomyDigestGenerate);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.autonomyDigestGenerate,
      message: 'Caller is not permitted to generate autonomy digests.',
    });
  }

  const validated = validateGenerateInput(input);
  if (!validated.ok) return validated;
  const workspaceId = WorkspaceId(input.workspaceId);

  let observations;
  try {
    observations = await deps.activityStore.listObservations(ctx.tenantId, workspaceId, {
      periodStartIso: input.periodStartIso,
      periodEndIso: input.periodEndIso,
      historyWindowStartIso: input.historyWindowStartIso,
    });
  } catch (error) {
    return dependencyFailure(error, 'Unable to load autonomy digest activity.');
  }

  const artifactId = nextId(deps.idGenerator, 'weekly autonomy digest artifact');
  if (!artifactId.ok) return artifactId;
  const evidenceId = nextId(deps.idGenerator, 'weekly autonomy digest evidence');
  if (!evidenceId.ok) return evidenceId;
  const generatedAtIso = deps.clock.nowIso();
  if (generatedAtIso.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
  }

  let digestWithoutHash: WeeklyAutonomyDigestArtifactV1;
  try {
    digestWithoutHash = buildWeeklyAutonomyDigestArtifactV1({
      artifactId: artifactId.value,
      workspaceId: input.workspaceId,
      periodStartIso: input.periodStartIso,
      periodEndIso: input.periodEndIso,
      historyWindowStartIso: input.historyWindowStartIso,
      generatedAtIso,
      observations,
      ...(input.currentPolicyTiers !== undefined
        ? { currentPolicyTiers: input.currentPolicyTiers }
        : {}),
    });
  } catch (error) {
    return validationFailure(error, 'Weekly autonomy digest input is invalid.');
  }

  const markdown = renderWeeklyAutonomyDigestMarkdown(digestWithoutHash);
  const markdownBytes = new TextEncoder().encode(markdown);
  const digestHashSha256 = HashSha256(createHash('sha256').update(markdownBytes).digest('hex'));
  const digest = {
    ...digestWithoutHash,
    digestHashSha256,
  };
  const storageRef = evidencePayloadUri(input.artifactLocation);

  const retentionScheduleResult = parseOptionalRetentionSchedule(input.retentionSchedule);
  if (!retentionScheduleResult.ok) return retentionScheduleResult;

  try {
    await deps.payloadStore.put({
      location: input.artifactLocation,
      bytes: markdownBytes,
    });
    if (retentionScheduleResult.value !== undefined) {
      await deps.payloadStore.applyWormControls({
        location: input.artifactLocation,
        retentionSchedule: retentionScheduleResult.value,
      });
    }
    await deps.evidenceLog.appendEntry(ctx.tenantId, {
      schemaVersion: 1,
      evidenceId: EvidenceId(evidenceId.value),
      workspaceId,
      correlationId: ctx.correlationId,
      occurredAtIso: generatedAtIso,
      category: 'System',
      summary: `Weekly Autonomy Digest ${artifactId.value} generated for ${input.periodStartIso}..${input.periodEndIso}.`,
      actor: { kind: 'System' },
      payloadRefs: [
        {
          kind: 'Artifact',
          uri: storageRef,
          contentType: 'text/markdown',
          sha256: digestHashSha256,
        },
      ],
    });
  } catch (error) {
    return dependencyFailure(error, 'Unable to persist weekly autonomy digest evidence.');
  }

  return ok({
    digest,
    markdown,
    evidenceId: EvidenceId(evidenceId.value),
    artifact: {
      schemaVersion: 1,
      artifactId: ArtifactId(artifactId.value),
      runId: RunId(input.runId),
      evidenceId: EvidenceId(evidenceId.value),
      mimeType: 'text/markdown',
      sizeBytes: markdownBytes.byteLength,
      storageRef,
      hashSha256: digestHashSha256,
      ...(retentionScheduleResult.value !== undefined
        ? { retentionSchedule: retentionScheduleResult.value }
        : {}),
      createdAtIso: generatedAtIso,
    },
  });
}

export async function acknowledgeWeeklyAutonomyDigest(
  deps: AcknowledgeWeeklyAutonomyDigestDeps,
  ctx: AppContext,
  input: AcknowledgeWeeklyAutonomyDigestInput,
): Promise<Result<AcknowledgeWeeklyAutonomyDigestOutput, AcknowledgeWeeklyAutonomyDigestError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.autonomyDigestAcknowledge);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.autonomyDigestAcknowledge,
      message: 'Caller is not permitted to acknowledge autonomy digests.',
    });
  }

  const validated = validateDigestReferenceInput(input);
  if (!validated.ok) return validated;

  const evidenceId = nextId(deps.idGenerator, 'weekly autonomy digest acknowledgement evidence');
  if (!evidenceId.ok) return evidenceId;
  const acknowledgedAtIso = deps.clock.nowIso();
  if (acknowledgedAtIso.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
  }

  try {
    await deps.evidenceLog.appendEntry(ctx.tenantId, {
      schemaVersion: 1,
      evidenceId: EvidenceId(evidenceId.value),
      workspaceId: WorkspaceId(input.workspaceId),
      correlationId: ctx.correlationId,
      occurredAtIso: acknowledgedAtIso,
      category: 'System',
      summary:
        `Weekly Autonomy Digest ${input.artifactId} acknowledged by ${String(ctx.principalId)}. ${input.rationale?.trim() ?? ''}`.trim(),
      actor: { kind: 'User', userId: ctx.principalId },
      payloadRefs: [
        {
          kind: 'Artifact',
          uri: input.artifactUri,
          contentType: 'text/markdown',
          sha256: HashSha256(input.digestHashSha256),
        },
      ],
    });
  } catch (error) {
    return dependencyFailure(error, 'Unable to append autonomy digest acknowledgement evidence.');
  }

  return ok({
    artifactId: ArtifactId(input.artifactId),
    evidenceId: EvidenceId(evidenceId.value),
    acknowledgedAtIso,
  });
}

export async function draftPolicyCalibrationShortcutFromDigest(
  deps: DraftPolicyCalibrationShortcutDeps,
  ctx: AppContext,
  input: DraftPolicyCalibrationShortcutInput,
): Promise<Result<DraftPolicyCalibrationShortcutOutput, DraftPolicyCalibrationShortcutError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.policyCalibrationDraft);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.policyCalibrationDraft,
      message: 'Caller is not permitted to draft policy calibration changes.',
    });
  }

  const validated = validatePolicyCalibrationInput(input);
  if (!validated.ok) return validated;

  const draftId = nextId(deps.idGenerator, 'policy calibration draft');
  if (!draftId.ok) return draftId;
  const evidenceId = nextId(deps.idGenerator, 'policy calibration shortcut evidence');
  if (!evidenceId.ok) return evidenceId;
  const occurredAtIso = deps.clock.nowIso();
  if (occurredAtIso.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
  }

  try {
    await deps.evidenceLog.appendEntry(ctx.tenantId, {
      schemaVersion: 1,
      evidenceId: EvidenceId(evidenceId.value),
      workspaceId: WorkspaceId(input.workspaceId),
      correlationId: ctx.correlationId,
      occurredAtIso,
      category: 'Policy',
      summary: `Policy calibration shortcut ${draftId.value} drafted from digest ${input.artifactId}: ${input.adjustment} ${input.actionClass} ${input.currentTier}->${input.recommendedTier}. ${input.rationale.trim()}`,
      actor: { kind: 'User', userId: ctx.principalId },
      payloadRefs: [
        {
          kind: 'Artifact',
          uri: input.artifactUri,
          contentType: 'text/markdown',
          sha256: HashSha256(input.digestHashSha256),
        },
        {
          kind: 'Snapshot',
          uri: `portarium://policy-calibration-drafts/${draftId.value}`,
          contentType: 'application/json',
        },
      ],
    });
  } catch (error) {
    return dependencyFailure(error, 'Unable to append policy calibration shortcut evidence.');
  }

  return ok({
    draftId: draftId.value,
    artifactId: ArtifactId(input.artifactId),
    evidenceId: EvidenceId(evidenceId.value),
    effect: 'draft-policy-change-only',
  });
}

function validateGenerateInput(
  input: GenerateWeeklyAutonomyDigestArtifactInput,
): Result<true, ValidationFailed> {
  const common = validatePeriodInput(input);
  if (!common.ok) return common;
  if (typeof input.runId !== 'string' || input.runId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'runId must be a non-empty string.' });
  }
  if (typeof input.artifactLocation.bucket !== 'string' || input.artifactLocation.bucket === '') {
    return err({
      kind: 'ValidationFailed',
      message: 'artifactLocation.bucket must be a non-empty string.',
    });
  }
  if (typeof input.artifactLocation.key !== 'string' || input.artifactLocation.key === '') {
    return err({
      kind: 'ValidationFailed',
      message: 'artifactLocation.key must be a non-empty string.',
    });
  }
  if (input.currentPolicyTiers !== undefined) {
    for (const [actionClass, tier] of Object.entries(input.currentPolicyTiers)) {
      if (actionClass.trim() === '' || !DIGEST_EXECUTION_TIERS.includes(tier)) {
        return err({
          kind: 'ValidationFailed',
          message: 'currentPolicyTiers must map non-empty action classes to digest tiers.',
        });
      }
    }
  }
  return ok(true);
}

function validateDigestReferenceInput(
  input: AcknowledgeWeeklyAutonomyDigestInput,
): Result<true, ValidationFailed> {
  const common = validatePeriodInput(input);
  if (!common.ok) return common;
  if (!nonEmpty(input.artifactId)) {
    return err({ kind: 'ValidationFailed', message: 'artifactId must be a non-empty string.' });
  }
  if (!nonEmpty(input.artifactUri)) {
    return err({ kind: 'ValidationFailed', message: 'artifactUri must be a non-empty string.' });
  }
  if (!validHash(input.digestHashSha256)) {
    return err({
      kind: 'ValidationFailed',
      message: 'digestHashSha256 must be a 64-character hex SHA-256 digest.',
    });
  }
  return ok(true);
}

function validatePolicyCalibrationInput(
  input: DraftPolicyCalibrationShortcutInput,
): Result<true, ValidationFailed> {
  const reference = validateDigestArtifactReference(input);
  if (!reference.ok) return reference;
  if (!nonEmpty(input.recommendationId) || !nonEmpty(input.actionClass)) {
    return err({
      kind: 'ValidationFailed',
      message: 'recommendationId and actionClass must be non-empty strings.',
    });
  }
  if (!DIGEST_EXECUTION_TIERS.includes(input.currentTier)) {
    return err({ kind: 'ValidationFailed', message: 'currentTier must be a digest tier.' });
  }
  if (!DIGEST_EXECUTION_TIERS.includes(input.recommendedTier)) {
    return err({ kind: 'ValidationFailed', message: 'recommendedTier must be a digest tier.' });
  }
  if (input.currentTier === input.recommendedTier) {
    return err({
      kind: 'ValidationFailed',
      message: 'recommendedTier must differ from currentTier.',
    });
  }
  if (input.adjustment !== 'promote' && input.adjustment !== 'demote') {
    return err({ kind: 'ValidationFailed', message: 'adjustment must be promote or demote.' });
  }
  if (!nonEmpty(input.rationale)) {
    return err({ kind: 'ValidationFailed', message: 'rationale must be a non-empty string.' });
  }
  return ok(true);
}

function validateDigestArtifactReference(input: {
  workspaceId: string;
  artifactId: string;
  artifactUri: string;
  digestHashSha256: string;
}): Result<true, ValidationFailed> {
  if (!nonEmpty(input.workspaceId)) {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (!nonEmpty(input.artifactId)) {
    return err({ kind: 'ValidationFailed', message: 'artifactId must be a non-empty string.' });
  }
  if (!nonEmpty(input.artifactUri)) {
    return err({ kind: 'ValidationFailed', message: 'artifactUri must be a non-empty string.' });
  }
  if (!validHash(input.digestHashSha256)) {
    return err({
      kind: 'ValidationFailed',
      message: 'digestHashSha256 must be a 64-character hex SHA-256 digest.',
    });
  }
  return ok(true);
}

function validatePeriodInput(input: {
  workspaceId: string;
  periodStartIso: string;
  periodEndIso: string;
}): Result<true, ValidationFailed> {
  if (!nonEmpty(input.workspaceId)) {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  const start = parseDate(input.periodStartIso);
  const end = parseDate(input.periodEndIso);
  if (!start || !end || end <= start) {
    return err({
      kind: 'ValidationFailed',
      message: 'periodStartIso and periodEndIso must be valid ISO timestamps in order.',
    });
  }
  return ok(true);
}

function parseOptionalRetentionSchedule(
  raw: unknown,
): Result<ReturnType<typeof parseRetentionScheduleV1> | undefined, ValidationFailed> {
  if (raw === undefined) return ok(undefined);
  try {
    return ok(parseRetentionScheduleV1(raw));
  } catch (error) {
    return validationFailure(error, 'retentionSchedule is invalid.');
  }
}

function nextId(idGenerator: IdGenerator, label: string): Result<string, DependencyFailure> {
  const id = idGenerator.generateId();
  if (id.trim() !== '') return ok(id);
  return err({ kind: 'DependencyFailure', message: `Unable to generate ${label} identifier.` });
}

function dependencyFailure(error: unknown, fallback: string): Result<never, DependencyFailure> {
  return err({
    kind: 'DependencyFailure',
    message: error instanceof Error ? error.message : fallback,
  });
}

function validationFailure(error: unknown, fallback: string): Result<never, ValidationFailed> {
  return err({
    kind: 'ValidationFailed',
    message: error instanceof Error ? error.message : fallback,
  });
}

function evidencePayloadUri(location: EvidencePayloadLocation): string {
  return `worm://${location.bucket}/${location.key}`;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validHash(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value);
}
