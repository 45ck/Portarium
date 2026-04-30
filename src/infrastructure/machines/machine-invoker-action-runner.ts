/**
 * ActionRunnerPort adapter backed by MachineInvokerPort.
 *
 * Bridges the application-layer ActionRunnerPort (used by
 * executeApprovedAgentAction) to the infrastructure MachineInvokerPort.
 *
 * The flowRef is interpreted as a tool name forwarded to MachineInvokerPort.invokeTool
 * using a fixed machineId extracted from the flowRef (format: "<machineId>/<toolName>").
 * When flowRef has no "/" separator, it is treated as a plain tool name and a
 * passthrough (no-machine) response is returned — this is intentional for
 * environments where no machine registry is wired.
 */

import type {
  ActionDispatchInput,
  ActionDispatchResult,
  ActionRunnerPort,
} from '../../application/ports/index.js';
import type { MachineInvokerPort } from '../../application/ports/index.js';
import { MachineId } from '../../domain/primitives/index.js';

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Implements ActionRunnerPort using an underlying MachineInvokerPort.
 *
 * FlowRef format (recommended):
 *   "<machineId>/<toolName>"
 *
 * When a "/" is present the part before it is used as the machineId and the
 * part after as the toolName.  When no "/" is present the entire flowRef is
 * used as the toolName and the dispatch is attempted against the first
 * registered machine — if no machineId can be resolved a RemoteError is
 * returned.
 */
export class MachineInvokerActionRunner implements ActionRunnerPort {
  readonly #invoker: MachineInvokerPort;
  /** Fallback machineId when the flowRef has no "/" separator. */
  readonly #defaultMachineId: string | undefined;

  constructor(invoker: MachineInvokerPort, defaultMachineId?: string) {
    this.#invoker = invoker;
    this.#defaultMachineId = defaultMachineId;
  }

  async dispatchAction(input: ActionDispatchInput): Promise<ActionDispatchResult> {
    const { flowRef, actionId, tenantId, runId, correlationId, payload } = input;

    const slashIdx = flowRef.indexOf('/');
    let machineIdStr: string;
    let toolName: string;

    if (slashIdx !== -1) {
      machineIdStr = flowRef.slice(0, slashIdx);
      toolName = flowRef.slice(slashIdx + 1);
    } else {
      const defaultId = this.#defaultMachineId;
      if (!defaultId) {
        return {
          ok: false,
          errorKind: 'FlowNotFound',
          message:
            `Cannot resolve machineId from flowRef "${flowRef}". ` +
            'Use "<machineId>/<toolName>" format or provide a defaultMachineId.',
        };
      }
      machineIdStr = defaultId;
      toolName = flowRef;
    }

    if (!machineIdStr.trim() || !toolName.trim()) {
      return {
        ok: false,
        errorKind: 'FlowNotFound',
        message: `Invalid flowRef "${flowRef}": machineId and toolName must be non-empty.`,
      };
    }

    let machineId: ReturnType<typeof MachineId>;
    try {
      machineId = MachineId(machineIdStr);
    } catch {
      return {
        ok: false,
        errorKind: 'FlowNotFound',
        message: `Invalid machineId in flowRef "${flowRef}".`,
      };
    }

    const result = await this.#invoker.invokeTool({
      machineId,
      toolName,
      parameters: payload,
      tenantId,
      runId,
      actionId,
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      correlationId,
    });

    if (result.ok) {
      return { ok: true, output: result.output };
    }

    // Map MachineInvokerErrorKind → ActionDispatchErrorKind
    const errorKind =
      ((): import('../../application/ports/action-runner.js').ActionDispatchErrorKind => {
        switch (result.errorKind) {
          case 'Unauthorized':
            return 'Unauthorized';
          case 'RateLimited':
            return 'RateLimited';
          case 'Timeout':
            return 'Timeout';
          case 'PolicyDenied':
          case 'RemoteError':
          default:
            return 'RemoteError';
        }
      })();

    return {
      ok: false,
      errorKind,
      message: result.message,
    };
  }
}
