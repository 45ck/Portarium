/**
 * Polls Portarium for an approval decision, blocking until resolved, timed out, or expired.
 */
import type { PortariumPluginConfig } from '../config.js';
import type { PortariumClient } from '../client/portarium-client.js';

export type WaitForDecisionResult =
  | { readonly approved: true }
  | { readonly approved: false; readonly reason: string };

/** Maximum consecutive poll errors before aborting the wait. */
const MAX_CONSECUTIVE_ERRORS = 10;

export class ApprovalPoller {
  readonly #client: PortariumClient;
  readonly #config: PortariumPluginConfig;
  readonly #logger: { warn(msg: string): void; error(msg: string): void };

  public constructor(
    client: PortariumClient,
    config: PortariumPluginConfig,
    logger?: { warn(msg: string): void; error(msg: string): void },
  ) {
    this.#client = client;
    this.#config = config;
    this.#logger = logger ?? {
      warn: (msg) => console.warn(msg),
      error: (msg) => console.error(msg),
    };
  }

  public async waitForDecision(approvalId: string): Promise<WaitForDecisionResult> {
    const deadline = Date.now() + this.#config.approvalTimeoutMs;
    let consecutiveErrors = 0;

    while (Date.now() < deadline) {
      const result = await this.#client.pollApproval(approvalId);

      if ('approved' in result) {
        return result.approved ? { approved: true } : { approved: false, reason: result.reason };
      }

      if (result.status === 'expired') {
        return { approved: false, reason: 'Approval expired before a decision was made' };
      }

      // 'executed' is a terminal state — action was already executed downstream
      if (result.status === 'executed') {
        return { approved: true };
      }

      if (result.status === 'error') {
        consecutiveErrors++;
        if (consecutiveErrors === 1) {
          this.#logger.error(
            `[portarium] Approval poll error for ${approvalId}: ${result.reason} — retrying`,
          );
        } else if (consecutiveErrors % 5 === 0) {
          this.#logger.error(
            `[portarium] Approval poll: ${consecutiveErrors} consecutive errors for ${approvalId} — still retrying`,
          );
        }
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          const reason = `Approval polling aborted after ${MAX_CONSECUTIVE_ERRORS} consecutive errors: ${result.reason}`;
          this.#logger.error(`[portarium] ${reason}`);
          return { approved: false, reason };
        }
      } else {
        consecutiveErrors = 0;
      }

      // status === 'pending' — keep waiting
      await sleep(this.#config.pollIntervalMs);
    }

    return {
      approved: false,
      reason: `Approval timed out after ${this.#config.approvalTimeoutMs}ms`,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
