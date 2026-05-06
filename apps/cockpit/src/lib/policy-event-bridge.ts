import { useEffect, useRef } from 'react';

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
