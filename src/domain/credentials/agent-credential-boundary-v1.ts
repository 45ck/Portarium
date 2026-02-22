import {
  AdapterId,
  AgentCredentialBoundaryId,
  AgentId,
  CredentialGrantId,
  RunId,
  WorkspaceId,
  type AdapterId as AdapterIdType,
  type AgentCredentialBoundaryId as AgentCredentialBoundaryIdType,
  type AgentId as AgentIdType,
  type CredentialGrantId as CredentialGrantIdType,
  type RunId as RunIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  assertNotBefore,
  readInteger,
  readIsoString,
  readOptionalIsoString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

/**
 * A scoped credential entry within an agent credential boundary.
 * The effectiveScope is always a subset of the originating grant's scope,
 * enforcing least-privilege access for the agent.
 */
export type AgentCredentialScopeV1 = Readonly<{
  credentialGrantId: CredentialGrantIdType;
  /** The adapter this credential targets. */
  adapterId: AdapterIdType;
  /**
   * Narrowed scope for this agent — must be a subset of the originating
   * CredentialGrantV1's scope. Expressed as a space-separated list of
   * permission tokens (e.g. "read:invoices").
   */
  effectiveScope: string;
}>;

/**
 * Defines the credential boundary for an agent during a specific workflow run.
 *
 * A boundary is always run-scoped and TTL-bounded. It holds the minimal set of
 * credential grants the agent needs, each narrowed to least-privilege scope.
 * When the run completes (or the boundary expires/is revoked), the agent loses
 * access to all credentials within it.
 */
export type AgentCredentialBoundaryV1 = Readonly<{
  schemaVersion: 1;
  boundaryId: AgentCredentialBoundaryIdType;
  agentId: AgentIdType;
  runId: RunIdType;
  workspaceId: WorkspaceIdType;
  /** Non-empty list of scoped credential entries for this agent. */
  grants: readonly AgentCredentialScopeV1[];
  issuedAtIso: string;
  /** Required: boundaries must always be TTL-bounded. */
  expiresAtIso: string;
  revokedAtIso?: string;
}>;

export class AgentCredentialBoundaryParseError extends Error {
  public override readonly name = 'AgentCredentialBoundaryParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseAgentCredentialBoundaryV1(value: unknown): AgentCredentialBoundaryV1 {
  const record = readRecord(value, 'AgentCredentialBoundary', AgentCredentialBoundaryParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', AgentCredentialBoundaryParseError);
  if (schemaVersion !== 1) {
    throw new AgentCredentialBoundaryParseError('schemaVersion must be 1.');
  }

  const boundaryId = AgentCredentialBoundaryId(
    readString(record, 'boundaryId', AgentCredentialBoundaryParseError),
  );
  const agentId = AgentId(readString(record, 'agentId', AgentCredentialBoundaryParseError));
  const runId = RunId(readString(record, 'runId', AgentCredentialBoundaryParseError));
  const workspaceId = WorkspaceId(
    readString(record, 'workspaceId', AgentCredentialBoundaryParseError),
  );

  const grantsRaw = record['grants'];
  if (!Array.isArray(grantsRaw) || grantsRaw.length === 0) {
    throw new AgentCredentialBoundaryParseError('grants must be a non-empty array.');
  }

  const seenGrantIds = new Set<string>();
  const grants: AgentCredentialScopeV1[] = grantsRaw.map((item: unknown, idx: number) => {
    const entry = readRecord(item, `grants[${idx}]`, AgentCredentialBoundaryParseError);
    const credentialGrantId = CredentialGrantId(
      readString(entry, 'credentialGrantId', AgentCredentialBoundaryParseError),
    );
    const adapterId = AdapterId(readString(entry, 'adapterId', AgentCredentialBoundaryParseError));
    const effectiveScope = readString(entry, 'effectiveScope', AgentCredentialBoundaryParseError);
    if (effectiveScope.trim() === '') {
      throw new AgentCredentialBoundaryParseError(
        `grants[${idx}].effectiveScope must be a non-empty string.`,
      );
    }

    const grantKey = String(credentialGrantId);
    if (seenGrantIds.has(grantKey)) {
      throw new AgentCredentialBoundaryParseError(
        `grants must not contain duplicate credentialGrantId '${grantKey}'.`,
      );
    }
    seenGrantIds.add(grantKey);

    return { credentialGrantId, adapterId, effectiveScope };
  });

  const issuedAtIso = readIsoString(record, 'issuedAtIso', AgentCredentialBoundaryParseError);
  const expiresAtIso = readIsoString(record, 'expiresAtIso', AgentCredentialBoundaryParseError);

  assertNotBefore(issuedAtIso, expiresAtIso, AgentCredentialBoundaryParseError, {
    anchorLabel: 'issuedAtIso',
    laterLabel: 'expiresAtIso',
  });

  const revokedAtIso = readOptionalIsoString(
    record,
    'revokedAtIso',
    AgentCredentialBoundaryParseError,
  );

  if (revokedAtIso !== undefined) {
    assertNotBefore(issuedAtIso, revokedAtIso, AgentCredentialBoundaryParseError, {
      anchorLabel: 'issuedAtIso',
      laterLabel: 'revokedAtIso',
    });
  }

  return {
    schemaVersion: 1,
    boundaryId,
    agentId,
    runId,
    workspaceId,
    grants,
    issuedAtIso,
    expiresAtIso,
    ...(revokedAtIso !== undefined ? { revokedAtIso } : {}),
  };
}

export type AgentCredentialBoundaryStatus = 'Active' | 'Expired' | 'Revoked';

/**
 * Derives the current lifecycle status of an agent credential boundary.
 * Revoked takes precedence over expiry.
 */
export function deriveAgentCredentialBoundaryStatus(
  boundary: AgentCredentialBoundaryV1,
  now: Date,
): AgentCredentialBoundaryStatus {
  if (boundary.revokedAtIso !== undefined) return 'Revoked';
  const expiresAt = new Date(boundary.expiresAtIso);
  if (expiresAt <= now) return 'Expired';
  return 'Active';
}
