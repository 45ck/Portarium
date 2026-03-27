/**
 * @portarium/engine
 *
 * Validation middleware for agent tool calls.
 *
 * @example
 * ```typescript
 * import { PortariumEngine } from '@portarium/engine';
 *
 * const engine = new PortariumEngine({
 *   rules: [
 *     { name: 'Block destructive ops', matchTool: /^(delete|drop|truncate)/, tier: 'human-approve' },
 *     { name: 'Auto-approve reads', matchTool: /^(get|list|search|read)/, tier: 'auto' },
 *   ],
 *   callLimits: [
 *     { toolName: 'send_email', maxCallsPerSession: 10 },
 *   ],
 *   defaultTier: 'assisted',
 *   onAudit: (event) => console.log('[audit]', event),
 * });
 *
 * const result = await engine.validate({
 *   callId: crypto.randomUUID(),
 *   toolName: 'delete_file',
 *   args: { path: '/important/file.txt' },
 * });
 *
 * if (result.outcome === 'require-approval') {
 *   // Gate execution — send to Portarium control plane for human review
 * }
 * ```
 */

export { PortariumEngine } from './engine.js';
export type {
  AuditEvent,
  AuditHook,
  CallLimitRule,
  EngineConfig,
  ExecutionTier,
  PolicyRule,
  ToolArg,
  ToolCall,
  ValidationDecision,
} from './types.js';
