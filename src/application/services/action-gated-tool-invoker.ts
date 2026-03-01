import type {
  ActionId,
  CorrelationId,
  ExecutionTier,
  MachineId,
  RunId,
  TenantId,
} from '../../domain/primitives/index.js';
import { evaluateOpenClawToolPolicyV1 } from '../../domain/machines/openclaw-tool-blast-radius-v1.js';
import type { MachineInvokerPort, MachineInvokerResult } from '../ports/machine-invoker.js';
import type { WorkspaceActor } from '../iam/workspace-actor.js';
import { APP_ACTIONS } from '../common/actions.js';
import {
  assertCanPerformWorkspaceAction,
  WorkspaceAuthorizationError,
} from '../iam/rbac/workspace-rbac.js';

// ---------------------------------------------------------------------------
// Input / Result types
// ---------------------------------------------------------------------------

/**
 * Input for proposing a tool invocation through the Portarium Action API.
 *
 * The caller supplies workspace identity (actor) alongside the tool call
 * parameters. The service validates authorization, evaluates blast-radius
 * policy, and — only if both pass — delegates to the underlying
 * MachineInvokerPort for execution.
 */
export type ActionGatedToolInvokeInput = Readonly<{
  /** The authenticated workspace actor requesting the tool invocation. */
  actor: WorkspaceActor;
  /** Tenant scope (must match actor.workspaceId). */
  tenantId: TenantId;
  /** Run that triggered this tool call. */
  runId: RunId;
  /** Unique action ID for this invocation step. */
  actionId: ActionId;
  /** Correlation token for event traceability. */
  correlationId: CorrelationId;
  /** Target machine hosting the tool. */
  machineId: MachineId;
  /** Tool name to invoke. */
  toolName: string;
  /** Tool-specific input parameters. */
  parameters: Record<string, unknown>;
  /** Execution tier for policy evaluation. */
  policyTier: ExecutionTier;
  /** Optional session key for stateful tool sessions. */
  sessionKey?: string;
  /** If true, perform a dry-run without side effects. */
  dryRun?: boolean;
  /** Optional W3C Trace Context propagation. */
  traceparent?: string;
  tracestate?: string;
}>;

export type ActionGatedToolInvokeResult =
  | (MachineInvokerResult & { readonly proposed: true })
  | Readonly<{
      proposed: false;
      denied: true;
      reason: 'authorization' | 'policy';
      message: string;
    }>;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Application service that routes OpenClaw tool execution through the
 * Portarium Action API propose/execute flow.
 *
 * Steps:
 * 1. **Authorize** — assert the actor has the `tool:invoke` permission.
 * 2. **Propose (policy check)** — evaluate blast-radius policy for the tool.
 * 3. **Execute** — delegate to the underlying MachineInvokerPort.
 *
 * If authorization or policy evaluation fails, the call is denied with a
 * clear error before any network call is made.
 */
export class ActionGatedToolInvoker {
  readonly #invoker: MachineInvokerPort;

  public constructor(invoker: MachineInvokerPort) {
    this.#invoker = invoker;
  }

  public async invoke(input: ActionGatedToolInvokeInput): Promise<ActionGatedToolInvokeResult> {
    // Step 1: Authorization gate
    try {
      assertCanPerformWorkspaceAction(input.actor, APP_ACTIONS.toolInvoke);
    } catch (error) {
      if (error instanceof WorkspaceAuthorizationError) {
        return {
          proposed: false,
          denied: true,
          reason: 'authorization',
          message: error.message,
        };
      }
      throw error;
    }

    // Step 2: Blast-radius policy gate
    const policyResult = evaluateOpenClawToolPolicyV1({
      toolName: input.toolName,
      policyTier: input.policyTier,
    });

    if (policyResult.decision === 'Deny') {
      return {
        proposed: false,
        denied: true,
        reason: 'policy',
        message: `Policy denied tool "${input.toolName}" at tier "${input.policyTier}"; requires "${policyResult.violation.requiredTier}".`,
      };
    }

    // Step 3: Execute through underlying invoker
    const result = await this.#invoker.invokeTool({
      tenantId: input.tenantId,
      runId: input.runId,
      actionId: input.actionId,
      correlationId: input.correlationId,
      machineId: input.machineId,
      toolName: input.toolName,
      parameters: input.parameters,
      policyTier: input.policyTier,
      ...(input.sessionKey !== undefined ? { sessionKey: input.sessionKey } : {}),
      ...(input.dryRun !== undefined ? { dryRun: input.dryRun } : {}),
      ...(input.traceparent !== undefined ? { traceparent: input.traceparent } : {}),
      ...(input.tracestate !== undefined ? { tracestate: input.tracestate } : {}),
    });

    return { ...result, proposed: true };
  }
}
