import { useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PolicyUpdatePayload {
  policyId: string;
  policyName: string;
  changeDescription: string;
  /** 'tighten' adds a new approval card; 'relax' removes one */
  effect: 'tighten' | 'relax';
  /** Approval IDs affected by this policy change */
  affectedApprovalIds: string[];
}

// ---------------------------------------------------------------------------
// Event bridge (browser CustomEvents — no libraries)
// ---------------------------------------------------------------------------

const EVENT_NAME = 'portarium:policy-updated';

export function emitPolicyUpdate(payload: PolicyUpdatePayload): void {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
}

export function onPolicyUpdate(callback: (payload: PolicyUpdatePayload) => void): () => void {
  const handler = (e: Event) => {
    callback((e as CustomEvent<PolicyUpdatePayload>).detail);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function usePolicyUpdates(callback: (payload: PolicyUpdatePayload) => void): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    return onPolicyUpdate((payload) => callbackRef.current(payload));
  }, []);
}

// ---------------------------------------------------------------------------
// Demo presets — easy triggers for the showcase
// ---------------------------------------------------------------------------

/** Simulate tightening: Communication Approval now requires ManualOnly */
export function emitDemoTighten(): void {
  emitPolicyUpdate({
    policyId: 'COMMUNICATION-APPROVAL-001',
    policyName: 'External Email Approval',
    changeDescription: 'Tier changed to ManualOnly — all pending emails now require manual review',
    effect: 'tighten',
    affectedApprovalIds: ['apr-oc-3299'],
  });
}

/** Simulate relaxing: Sub-Agent Inbox Update now auto-approved */
export function emitDemoRelax(): void {
  emitPolicyUpdate({
    policyId: 'SUBAGENT-APPLY-001',
    policyName: 'Sub-Agent Inbox Update Approval',
    changeDescription: 'Tier changed to Auto — inbox label updates are now auto-approved',
    effect: 'relax',
    affectedApprovalIds: ['apr-oc-3206'],
  });
}

/**
 * Hook that returns stable demo trigger functions.
 * Only used by the demo button — keeps the approvals page clean.
 */
export function useDemoTriggers() {
  const triggerTighten = useCallback(() => emitDemoTighten(), []);
  const triggerRelax = useCallback(() => emitDemoRelax(), []);
  return { triggerTighten, triggerRelax } as const;
}
