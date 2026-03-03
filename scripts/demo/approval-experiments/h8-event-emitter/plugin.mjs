/**
 * H8 plugin — re-exports the approval bus and provides a convenience helper
 * for registering in-process approval handlers.
 *
 * Usage:
 *   import { createApprovalHandler } from './plugin.mjs';
 *
 *   const unsubscribe = createApprovalHandler(async ({ approvalId, toolName }) => {
 *     console.log(`Deciding on ${toolName}`);
 *     return { decision: 'approved' };
 *   });
 */

import { approvalBus } from './proxy-extension.mjs';

export { approvalBus };

/**
 * Register a handler that is called every time an approval is required.
 * The handler receives the approval payload and must return a decision.
 * The decision is emitted back on the bus automatically.
 *
 * @param {(payload: { approvalId: string; toolName: string; parameters: Record<string,unknown> }) =>
 *   Promise<{ decision: 'approved'|'denied'; reason?: string }>} handler
 * @returns {() => void} unsubscribe function
 */
export function createApprovalHandler(handler) {
  /** @param {{ approvalId: string; toolName: string; parameters: Record<string,unknown> }} payload */
  const listener = async (payload) => {
    try {
      const result = await handler(payload);
      approvalBus.emit(`approval:decision:${payload.approvalId}`, result);
    } catch (err) {
      approvalBus.emit(`approval:decision:${payload.approvalId}`, {
        decision: 'denied',
        reason: `Handler error: ${err.message}`,
      });
    }
  };

  approvalBus.on('approval:required', listener);

  return () => {
    approvalBus.off('approval:required', listener);
  };
}
