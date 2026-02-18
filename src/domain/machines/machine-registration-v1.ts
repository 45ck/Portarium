import {
  AgentId,
  MachineId,
  WorkspaceId,
  type AgentId as AgentIdType,
  type ExecutionTier,
  type MachineId as MachineIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  readBoolean,
  readInteger,
  readIsoString,
  readOptionalString,
  readRecord,
  readString,
  readStringArray,
} from '../validation/parse-utils.js';

// ---------------------------------------------------------------------------
// Machine auth configuration
// ---------------------------------------------------------------------------

/**
 * How the control plane authenticates to the machine runtime endpoint.
 *
 * - `bearer`:  present a Bearer token; secretRef points to a CredentialGrant or vault path.
 * - `apiKey`:  present an API key header; secretRef points to the key material.
 * - `mtls`:    mutual TLS; secretRef points to a client certificate reference.
 * - `none`:    no authentication (development/internal trust boundary only).
 */
export type MachineAuthKind = 'bearer' | 'apiKey' | 'mtls' | 'none';

export type MachineAuthConfigV1 = Readonly<{
  kind: MachineAuthKind;
  /** Optional reference to a CredentialGrant ID or vault path holding the secret. */
  secretRef?: string;
}>;

// ---------------------------------------------------------------------------
// Machine registration aggregate
// ---------------------------------------------------------------------------

export type MachineRegistrationV1 = Readonly<{
  schemaVersion: 1;
  machineId: MachineIdType;
  workspaceId: WorkspaceIdType;
  endpointUrl: string;
  active: boolean;
  displayName: string;
  /** Capability allowlist — only these capability strings may be invoked on this machine. */
  capabilities: readonly string[];
  registeredAtIso: string;
  /** Authentication configuration for the machine endpoint (absent = no auth required). */
  authConfig?: MachineAuthConfigV1;
}>;

export class MachineRegistrationParseError extends Error {
  public override readonly name = 'MachineRegistrationParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseMachineRegistrationV1(value: unknown): MachineRegistrationV1 {
  const record = readRecord(value, 'MachineRegistration', MachineRegistrationParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', MachineRegistrationParseError);
  if (schemaVersion !== 1) {
    throw new MachineRegistrationParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const machineId = MachineId(readString(record, 'machineId', MachineRegistrationParseError));
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', MachineRegistrationParseError));
  const endpointUrl = readString(record, 'endpointUrl', MachineRegistrationParseError);
  const active = readBoolean(record, 'active', MachineRegistrationParseError);
  const displayName = readString(record, 'displayName', MachineRegistrationParseError);
  const capabilities = readStringArray(record, 'capabilities', MachineRegistrationParseError, {
    minLength: 1,
  });
  const registeredAtIso = readIsoString(record, 'registeredAtIso', MachineRegistrationParseError);
  const authConfig = parseMachineAuthConfig(record['authConfig']);

  return {
    schemaVersion: 1,
    machineId,
    workspaceId,
    endpointUrl,
    active,
    displayName,
    capabilities,
    registeredAtIso,
    ...(authConfig !== undefined ? { authConfig } : {}),
  };
}

function parseMachineAuthConfig(raw: unknown): MachineAuthConfigV1 | undefined {
  if (raw === undefined) return undefined;

  const record = readRecord(raw, 'authConfig', MachineRegistrationParseError);
  const kind = readString(record, 'kind', MachineRegistrationParseError);

  if (kind !== 'bearer' && kind !== 'apiKey' && kind !== 'mtls' && kind !== 'none') {
    throw new MachineRegistrationParseError(
      `authConfig.kind must be one of: bearer, apiKey, mtls, none. Got: "${kind}"`,
    );
  }

  const secretRef = readOptionalString(record, 'secretRef', MachineRegistrationParseError);

  return {
    kind,
    ...(secretRef !== undefined ? { secretRef } : {}),
  };
}

// ---------------------------------------------------------------------------
// Agent configuration entity
// ---------------------------------------------------------------------------

/**
 * An agent configuration binds an AI agent identity to a machine runtime,
 * declares the policy tier under which it executes, and enumerates the tool
 * names it is permitted to call.
 *
 * Multiple agents can share a single machine (gateway) endpoint.
 */
export type AgentConfigV1 = Readonly<{
  schemaVersion: 1;
  agentId: AgentIdType;
  workspaceId: WorkspaceIdType;
  machineId: MachineIdType;
  displayName: string;
  /**
   * Execution tier controlling approval requirements for actions dispatched
   * through this agent (matches WorkflowActionV1.executionTier semantics).
   */
  policyTier: ExecutionTier;
  /**
   * Allowlist of tool names the agent is permitted to invoke.
   * An empty list means the agent may not call any tools.
   */
  allowedTools: readonly string[];
  registeredAtIso: string;
}>;

export class AgentConfigParseError extends Error {
  public override readonly name = 'AgentConfigParseError';

  public constructor(message: string) {
    super(message);
  }
}

const EXECUTION_TIERS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;

export function parseAgentConfigV1(value: unknown): AgentConfigV1 {
  const record = readRecord(value, 'AgentConfig', AgentConfigParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', AgentConfigParseError);
  if (schemaVersion !== 1) {
    throw new AgentConfigParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const agentId = AgentId(readString(record, 'agentId', AgentConfigParseError));
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', AgentConfigParseError));
  const machineId = MachineId(readString(record, 'machineId', AgentConfigParseError));
  const displayName = readString(record, 'displayName', AgentConfigParseError);

  const policyTierRaw = readString(record, 'policyTier', AgentConfigParseError);
  if (!(EXECUTION_TIERS as readonly string[]).includes(policyTierRaw)) {
    throw new AgentConfigParseError(
      `policyTier must be one of: ${EXECUTION_TIERS.join(', ')}. Got: "${policyTierRaw}"`,
    );
  }

  const allowedTools = readStringArray(record, 'allowedTools', AgentConfigParseError, {
    minLength: 0,
  });

  const registeredAtIso = readIsoString(record, 'registeredAtIso', AgentConfigParseError);

  return {
    schemaVersion: 1,
    agentId,
    workspaceId,
    machineId,
    displayName,
    policyTier: policyTierRaw as ExecutionTier,
    allowedTools,
    registeredAtIso,
  };
}
