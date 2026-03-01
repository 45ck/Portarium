/**
 * Structured audit record for sidecar egress decisions (ADR-0115).
 *
 * Emitted for every egress attempt — both allowed and denied.
 * In 'enforce' mode, denied requests are blocked.
 * In 'monitor' mode, denied requests are logged but forwarded.
 */
export type EgressAuditRecord = Readonly<{
  timestamp: number;
  enforcementMode: 'enforce' | 'monitor';
  policyDecision: 'allow' | 'deny';
  destinationHost: string;
  destinationPort: number | undefined;
  httpMethod: string;
  httpPath: string;
  responseStatus: number | undefined;
  policyReason: string | undefined;
  latencyMs: number;
  tenantId: string | undefined;
  workflowRunId: string | undefined;
  agentSpiffeId: string | undefined;
}>;

/**
 * Sink for egress audit records.
 * Implementations can write to structured log, event bus, or in-memory buffer (tests).
 */
export interface EgressAuditSink {
  emit(record: EgressAuditRecord): void;
}
