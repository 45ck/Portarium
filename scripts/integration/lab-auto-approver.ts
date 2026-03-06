/**
 * Auto-approver utility for CI tests.
 *
 * Background poller that auto-decides pending approvals so no human is needed.
 * Used by scenario-live-approval-lifecycle.test.ts.
 */

export interface AutoApproverHandle {
  stop: () => void;
  readonly approvedIds: string[];
  readonly deniedIds: string[];
}

export function startAutoApprover(
  proxyUrl: string,
  opts?: {
    pollIntervalMs?: number;
    approveDelayMs?: number;
    decision?: 'approved' | 'denied';
  },
): AutoApproverHandle {
  const pollIntervalMs = opts?.pollIntervalMs ?? 200;
  const approveDelayMs = opts?.approveDelayMs ?? 500;
  const decision = opts?.decision ?? 'approved';

  const processed = new Set<string>();
  const approvedIds: string[] = [];
  const deniedIds: string[] = [];
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      const resp = await fetch(`${proxyUrl}/approvals?status=pending`);
      if (!resp.ok) return;
      const data = (await resp.json()) as {
        approvals: { approvalId: string; toolName: string }[];
      };
      for (const approval of data.approvals) {
        if (processed.has(approval.approvalId)) continue;
        processed.add(approval.approvalId);

        // Delay so the agent sees "pending" first
        await new Promise((r) => setTimeout(r, approveDelayMs));
        if (stopped) return;

        const decideResp = await fetch(`${proxyUrl}/approvals/${approval.approvalId}/decide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision }),
        });
        if (decideResp.ok) {
          if (decision === 'approved') {
            approvedIds.push(approval.approvalId);
          } else {
            deniedIds.push(approval.approvalId);
          }
        }
      }
    } catch {
      // Non-fatal — proxy may not be up yet
    }
  };

  const interval = setInterval(() => void tick(), pollIntervalMs);

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
    },
    approvedIds,
    deniedIds,
  };
}
