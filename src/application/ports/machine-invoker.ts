import type {
  ActionId,
  AgentId,
  CorrelationId,
  MachineId,
  RunId,
  TenantId,
} from '../../domain/primitives/index.js';

// ---------------------------------------------------------------------------
// Result discriminated union
// ---------------------------------------------------------------------------

/** Invocation succeeded — raw output from the machine/agent runtime. */
export type MachineInvokerSuccess = Readonly<{
  ok: true;
  /** Raw output payload returned by the machine runtime (JSON-serialisable). */
  output: unknown;
}>;

export type MachineInvokerErrorKind =
  | 'Unauthorized'
  | 'RateLimited'
  | 'PolicyDenied'
  | 'Timeout'
  | 'RemoteError';

/** Invocation failed — discriminated by errorKind for upstream policy decisions. */
export type MachineInvokerFailure = Readonly<{
  ok: false;
  errorKind: MachineInvokerErrorKind;
  message: string;
}>;

export type MachineInvokerResult = MachineInvokerSuccess | MachineInvokerFailure;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** Correlation envelope passed with every machine invocation. */
type InvocationCorrelation = Readonly<{
  tenantId: TenantId;
  runId: RunId;
  actionId: ActionId;
  correlationId: CorrelationId;
}>;

/**
 * Input for invoking an agent task via the OpenAI-compatible Responses API
 * (POST /v1/responses on the OpenClaw Gateway or compatible runtime).
 */
export type RunAgentInput = InvocationCorrelation &
  Readonly<{
    machineId: MachineId;
    agentId: AgentId;
    /** Prompt or message payload forwarded to the agent runtime. */
    prompt: string;
    /** Optional capability to assert before invocation (checked against machine allowlist). */
    capability?: string;
  }>;

/**
 * Input for invoking a constrained tool via the tool-gated endpoint
 * (POST /tools/invoke on the OpenClaw Gateway or compatible runtime).
 */
export type InvokeToolInput = InvocationCorrelation &
  Readonly<{
    machineId: MachineId;
    /** Tool name to invoke (must be in the machine's capability allowlist). */
    toolName: string;
    /** Arbitrary tool-specific input parameters. */
    parameters: Record<string, unknown>;
  }>;

// ---------------------------------------------------------------------------
// Port interface
// ---------------------------------------------------------------------------

/**
 * Port for invoking external machine and agent runtimes from within the
 * application layer.  Infrastructure adapters (e.g. OpenClawGatewayAdapter)
 * implement this interface; no HTTP or SDK imports belong here.
 */
export interface MachineInvokerPort {
  /**
   * Invoke an agent task via the OpenAI-compatible Responses API.
   * Implementations inject auth credentials and propagate the correlation envelope.
   */
  runAgent(input: RunAgentInput): Promise<MachineInvokerResult>;

  /**
   * Invoke a constrained tool via the tool-gated endpoint.
   * Implementations enforce the machine capability allowlist before dispatch.
   */
  invokeTool(input: InvokeToolInput): Promise<MachineInvokerResult>;
}
