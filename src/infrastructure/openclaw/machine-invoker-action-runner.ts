import type {
  ActionDispatchErrorKind,
  ActionDispatchInput,
  ActionDispatchResult,
  ActionRunnerPort,
} from '../../application/ports/action-runner.js';
import type { MachineInvokerPort } from '../../application/ports/machine-invoker.js';
import type { MachineInvokerErrorKind } from '../../application/ports/machine-invoker.js';
import type { MachineId } from '../../domain/primitives/index.js';

export type MachineInvokerActionRunnerConfig = Readonly<{
  machineInvoker: MachineInvokerPort;
  machineId: MachineId;
  policyTier?: string;
}>;

/**
 * ActionRunnerPort adapter that delegates to MachineInvokerPort.invokeTool().
 *
 * Maps ActionDispatchInput to InvokeToolInput by interpreting flowRef as the
 * tool name and payload as the tool parameters. The machineId and optional
 * policyTier are supplied at construction time.
 */
export class MachineInvokerActionRunner implements ActionRunnerPort {
  readonly #machineInvoker: MachineInvokerPort;
  readonly #machineId: MachineId;
  readonly #policyTier: string | undefined;

  public constructor(config: MachineInvokerActionRunnerConfig) {
    this.#machineInvoker = config.machineInvoker;
    this.#machineId = config.machineId;
    this.#policyTier = config.policyTier;
  }

  public async dispatchAction(input: ActionDispatchInput): Promise<ActionDispatchResult> {
    const result = await this.#machineInvoker.invokeTool({
      machineId: this.#machineId,
      toolName: input.flowRef,
      parameters: input.payload,
      actionId: input.actionId,
      tenantId: input.tenantId,
      runId: input.runId,
      correlationId: input.correlationId,
      ...(this.#policyTier !== undefined ? { policyTier: this.#policyTier } : {}),
    });

    if (result.ok) {
      return { ok: true, output: result.output };
    }

    return {
      ok: false,
      errorKind: mapMachineInvokerErrorKind(result.errorKind),
      message: result.message,
    };
  }
}

function mapMachineInvokerErrorKind(
  kind: MachineInvokerErrorKind,
): ActionDispatchErrorKind {
  switch (kind) {
    case 'Unauthorized':
      return 'Unauthorized';
    case 'RateLimited':
      return 'RateLimited';
    case 'Timeout':
      return 'Timeout';
    case 'PolicyDenied':
    case 'RemoteError':
      return 'RemoteError';
  }
}
