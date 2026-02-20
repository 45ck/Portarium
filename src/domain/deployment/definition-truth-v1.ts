import {
  UserId,
  WorkspaceId,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  assertNotBefore,
  readBoolean,
  readInteger,
  readIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export type DeploymentModeV1 = 'Local' | 'Team';
export type DefinitionsTruthModeV1 = 'GitAuthoritative' | 'RuntimeAuthoritative';
export type TruthDivergenceStatusV1 = 'InSync' | 'GitAhead' | 'RuntimeAhead' | 'Conflict';

export type TruthModeTransitionV1 = Readonly<{
  transitionedAtIso: string;
  transitionedByUserId: UserIdType;
  fromMode: DefinitionsTruthModeV1;
  toMode: DefinitionsTruthModeV1;
  reason: string;
}>;

export type DefinitionTruthStateV1 = Readonly<{
  schemaVersion: 1;
  workspaceId: WorkspaceIdType;
  deploymentMode: DeploymentModeV1;
  definitionsTruthMode: DefinitionsTruthModeV1;
  runtimeStateStore: 'Database';
  gitRef?: string;
  appliedGitRef?: string;
  runtimeHasUnappliedMutations: boolean;
  divergenceStatus: TruthDivergenceStatusV1;
  lastReconciledAtIso?: string;
  transitionLog: readonly TruthModeTransitionV1[];
}>;

export class DefinitionTruthParseError extends Error {
  public override readonly name = 'DefinitionTruthParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseDefinitionTruthStateV1(value: unknown): DefinitionTruthStateV1 {
  const record = readRecord(value, 'DefinitionTruthState', DefinitionTruthParseError);
  const schemaVersion = readInteger(record, 'schemaVersion', DefinitionTruthParseError);
  if (schemaVersion !== 1) {
    throw new DefinitionTruthParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const workspaceId = WorkspaceId(readString(record, 'workspaceId', DefinitionTruthParseError));
  const deploymentMode = parseDeploymentMode(
    readString(record, 'deploymentMode', DefinitionTruthParseError),
  );
  const definitionsTruthMode = parseDefinitionsTruthMode(
    readString(record, 'definitionsTruthMode', DefinitionTruthParseError),
  );
  const runtimeStateStore = parseRuntimeStateStore(
    readString(record, 'runtimeStateStore', DefinitionTruthParseError),
  );

  const gitRef = readOptionalString(record, 'gitRef', DefinitionTruthParseError);
  const appliedGitRef = readOptionalString(record, 'appliedGitRef', DefinitionTruthParseError);
  const runtimeHasUnappliedMutations = readBoolean(
    record,
    'runtimeHasUnappliedMutations',
    DefinitionTruthParseError,
  );
  const divergenceStatus = parseDivergenceStatus(
    readString(record, 'divergenceStatus', DefinitionTruthParseError),
  );
  const lastReconciledAtIso = readOptionalString(
    record,
    'lastReconciledAtIso',
    DefinitionTruthParseError,
  );
  if (lastReconciledAtIso !== undefined) {
    readIsoString({ lastReconciledAtIso }, 'lastReconciledAtIso', DefinitionTruthParseError);
  }

  if (definitionsTruthMode === 'GitAuthoritative' && gitRef === undefined) {
    throw new DefinitionTruthParseError(
      'gitRef is required when definitionsTruthMode is GitAuthoritative.',
    );
  }

  const transitionLog = parseTransitionLog(record['transitionLog']);
  if (transitionLog.length > 0 && lastReconciledAtIso !== undefined) {
    const latestTransition = transitionLog[transitionLog.length - 1]!;
    assertNotBefore(
      latestTransition.transitionedAtIso,
      lastReconciledAtIso,
      DefinitionTruthParseError,
      {
        anchorLabel: 'transitionLog[last].transitionedAtIso',
        laterLabel: 'lastReconciledAtIso',
      },
    );
  }

  return {
    schemaVersion: 1,
    workspaceId,
    deploymentMode,
    definitionsTruthMode,
    runtimeStateStore,
    ...(gitRef !== undefined ? { gitRef } : {}),
    ...(appliedGitRef !== undefined ? { appliedGitRef } : {}),
    runtimeHasUnappliedMutations,
    divergenceStatus,
    ...(lastReconciledAtIso !== undefined ? { lastReconciledAtIso } : {}),
    transitionLog,
  };
}

type TransitionParams = Readonly<{
  state: DefinitionTruthStateV1;
  toMode: DefinitionsTruthModeV1;
  transitionedAtIso: string;
  transitionedByUserId: UserIdType;
  reason: string;
  gitRef?: string;
}>;

export function transitionDefinitionsTruthModeV1(params: TransitionParams): DefinitionTruthStateV1 {
  const parsedAt = readIsoString(
    { transitionedAtIso: params.transitionedAtIso },
    'transitionedAtIso',
    DefinitionTruthParseError,
  );
  void parsedAt;
  if (params.reason.trim() === '') {
    throw new DefinitionTruthParseError('reason must be a non-empty string.');
  }

  if (params.state.definitionsTruthMode === params.toMode) {
    return params.state;
  }

  const nextGitRef = params.gitRef ?? params.state.gitRef;
  if (params.toMode === 'GitAuthoritative' && nextGitRef === undefined) {
    throw new DefinitionTruthParseError(
      'gitRef is required when transitioning to GitAuthoritative.',
    );
  }

  const transition: TruthModeTransitionV1 = {
    transitionedAtIso: params.transitionedAtIso,
    transitionedByUserId: params.transitionedByUserId,
    fromMode: params.state.definitionsTruthMode,
    toMode: params.toMode,
    reason: params.reason,
  };

  return {
    ...params.state,
    definitionsTruthMode: params.toMode,
    ...(nextGitRef !== undefined ? { gitRef: nextGitRef } : {}),
    divergenceStatus:
      params.toMode === 'GitAuthoritative'
        ? params.state.runtimeHasUnappliedMutations
          ? 'Conflict'
          : 'GitAhead'
        : 'RuntimeAhead',
    transitionLog: [...params.state.transitionLog, transition],
  };
}

type DivergenceInput = Readonly<{
  gitRef?: string;
  appliedGitRef?: string;
  runtimeHasUnappliedMutations: boolean;
}>;

export function evaluateTruthDivergenceV1(input: DivergenceInput): TruthDivergenceStatusV1 {
  const gitAhead =
    input.gitRef !== undefined &&
    input.appliedGitRef !== undefined &&
    input.gitRef !== input.appliedGitRef;

  if (gitAhead && input.runtimeHasUnappliedMutations) return 'Conflict';
  if (gitAhead) return 'GitAhead';
  if (input.runtimeHasUnappliedMutations) return 'RuntimeAhead';
  return 'InSync';
}

function parseTransitionLog(raw: unknown): readonly TruthModeTransitionV1[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new DefinitionTruthParseError('transitionLog must be an array when provided.');
  }

  const transitions = raw.map((item, i) => {
    const record = readRecord(item, `transitionLog[${i}]`, DefinitionTruthParseError);
    const transitionedAtIso = readIsoString(record, 'transitionedAtIso', DefinitionTruthParseError);
    const transitionedByUserId = UserId(
      readString(record, 'transitionedByUserId', DefinitionTruthParseError),
    );
    const fromMode = parseDefinitionsTruthMode(
      readString(record, 'fromMode', DefinitionTruthParseError),
    );
    const toMode = parseDefinitionsTruthMode(
      readString(record, 'toMode', DefinitionTruthParseError),
    );
    const reason = readString(record, 'reason', DefinitionTruthParseError);
    return {
      transitionedAtIso,
      transitionedByUserId,
      fromMode,
      toMode,
      reason,
    };
  });

  for (let i = 1; i < transitions.length; i += 1) {
    const previous = transitions[i - 1]!;
    const current = transitions[i]!;
    assertNotBefore(
      previous.transitionedAtIso,
      current.transitionedAtIso,
      DefinitionTruthParseError,
      {
        anchorLabel: `transitionLog[${i - 1}].transitionedAtIso`,
        laterLabel: `transitionLog[${i}].transitionedAtIso`,
      },
    );
  }

  return transitions;
}

function parseDeploymentMode(value: string): DeploymentModeV1 {
  if (value === 'Local' || value === 'Team') return value;
  throw new DefinitionTruthParseError('deploymentMode must be one of: Local, Team.');
}

function parseDefinitionsTruthMode(value: string): DefinitionsTruthModeV1 {
  if (value === 'GitAuthoritative' || value === 'RuntimeAuthoritative') return value;
  throw new DefinitionTruthParseError(
    'definitionsTruthMode must be one of: GitAuthoritative, RuntimeAuthoritative.',
  );
}

function parseDivergenceStatus(value: string): TruthDivergenceStatusV1 {
  if (
    value === 'InSync' ||
    value === 'GitAhead' ||
    value === 'RuntimeAhead' ||
    value === 'Conflict'
  )
    return value;
  throw new DefinitionTruthParseError(
    'divergenceStatus must be one of: InSync, GitAhead, RuntimeAhead, Conflict.',
  );
}

function parseRuntimeStateStore(value: string): 'Database' {
  if (value === 'Database') return value;
  throw new DefinitionTruthParseError('runtimeStateStore must be "Database".');
}
