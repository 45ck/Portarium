/**
 * Polls Portarium for an approval decision, blocking until resolved, timed out, or expired.
 */
import type { PortariumPluginConfig } from '../config.js';
import type { PortariumClient } from '../client/portarium-client.js';

export type WaitForDecisionResult =
  | { readonly approved: true }
  | { readonly approved: false; readonly reason: string };

export class ApprovalPoller {
  readonly #client: PortariumClient;
  readonly #config: PortariumPluginConfig;

  public constructor(client: PortariumClient, config: PortariumPluginConfig) {
    this.#client = client;
    this.#config = config;
  }

  public async waitForDecision(approvalId: string): Promise<WaitForDecisionResult> {
    const deadline = Date.now() + this.#config.approvalTimeoutMs;

    while (Date.now() < deadline) {
      const result = await this.#client.pollApproval(approvalId);

      if ('approved' in result) {
        return result.approved ? { approved: true } : { approved: false, reason: result.reason };
      }

      if (result.status === 'expired') {
        return { approved: false, reason: 'Approval expired before a decision was made' };
      }

      if (result.status === 'error') {
        // Log but don't fail: transient errors shouldn't cancel approval wait
        // Keep polling until timeout
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
