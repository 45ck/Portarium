import { EvidenceId } from '../../domain/primitives/index.js';
import {
  attachPolicyChangeReplayReportEvidenceV1,
  type PolicyShadowReplayReportV1,
} from '../../domain/policy/index.js';
import {
  APP_ACTIONS,
  type AppContext,
  type DependencyFailure,
  type Forbidden,
  type NotFound,
  type Result,
  type ValidationFailed,
  err,
  ok,
} from '../common/index.js';
import type {
  AuthorizationPort,
  EvidenceLogPort,
  IdGenerator,
  PolicyStore,
  UnitOfWork,
} from '../ports/index.js';
import {
  buildPolicyChangeReplay,
  type PreviewPolicyChangeReplayDeps,
  type PreviewPolicyChangeReplayInput,
} from '../queries/preview-policy-change-replay.js';

type PolicyReplayWriteStore = PreviewPolicyChangeReplayDeps['policyStore'] &
  Required<Pick<PolicyStore, 'savePolicyChange'>>;

export type RecordPolicyChangeReplayReportInput = PreviewPolicyChangeReplayInput;

export type RecordPolicyChangeReplayReportOutput = Readonly<{
  policyChangeId: string;
  evidenceId: string;
  report: PolicyShadowReplayReportV1;
}>;

export type RecordPolicyChangeReplayReportError =
  | Forbidden
  | ValidationFailed
  | NotFound
  | DependencyFailure;

export interface RecordPolicyChangeReplayReportDeps extends Omit<
  PreviewPolicyChangeReplayDeps,
  'authorization' | 'policyStore'
> {
  authorization: AuthorizationPort;
  idGenerator: IdGenerator;
  policyStore: PolicyReplayWriteStore;
  evidenceLog: EvidenceLogPort;
  unitOfWork: UnitOfWork;
}

export async function recordPolicyChangeReplayReport(
  deps: RecordPolicyChangeReplayReportDeps,
  ctx: AppContext,
  input: RecordPolicyChangeReplayReportInput,
): Promise<Result<RecordPolicyChangeReplayReportOutput, RecordPolicyChangeReplayReportError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.policyChangeReplay);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.policyChangeReplay,
      message: 'Caller is not permitted to replay policy changes.',
    });
  }

  const built = await buildPolicyChangeReplay(deps, ctx, input);
  if (!built.ok) return built;

  try {
    return await deps.unitOfWork.execute(async () => {
      const evidenceId = EvidenceId(deps.idGenerator.generateId());
      const evidence = await deps.evidenceLog.appendEntry(ctx.tenantId, {
        schemaVersion: 1,
        evidenceId,
        workspaceId: built.value.change.workspaceId,
        correlationId: ctx.correlationId,
        occurredAtIso: built.value.report.generatedAtIso,
        category: 'Policy',
        summary: `Policy replay report: ${String(built.value.change.policyId)} v${built.value.change.proposedPolicy.version}`,
        actor: { kind: 'User', userId: ctx.principalId },
        links: {},
        payloadRefs: [
          {
            kind: 'Snapshot',
            uri: `policy-change://${String(built.value.change.policyChangeId)}/replay-report/${String(evidenceId)}`,
            contentType: 'application/vnd.portarium.policy-shadow-replay+json',
          },
        ],
      });
      await deps.policyStore.savePolicyChange(
        ctx.tenantId,
        built.value.change.workspaceId,
        attachPolicyChangeReplayReportEvidenceV1({
          change: built.value.change,
          replayReportEvidenceId: evidence.evidenceId,
        }),
      );

      return ok({
        policyChangeId: String(built.value.change.policyChangeId),
        evidenceId: String(evidence.evidenceId),
        report: built.value.report,
      });
    });
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message:
        error instanceof Error ? error.message : 'Failed to record policy replay report evidence.',
    });
  }
}
