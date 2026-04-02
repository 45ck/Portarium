/**
 * PortariumEngine — validation middleware for agent tool calls.
 *
 * Validates tool calls against policy rules, enforces call limits,
 * and invokes the audit hook on every decision.
 */

import type {
  AuditEvent,
  CallLimitRule,
  EngineConfig,
  ExecutionTier,
  PolicyRule,
  ToolCall,
  ValidationDecision,
} from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesTool(pattern: string | RegExp, toolName: string): boolean {
  if (typeof pattern === 'string') {
    if (pattern.endsWith('*')) {
      return toolName.startsWith(pattern.slice(0, -1));
    }
    return pattern === toolName;
  }
  return pattern.test(toolName);
}

function applyRules(rules: PolicyRule[], call: ToolCall): ExecutionTier | null {
  for (const rule of rules) {
    if (rule.matchTool !== undefined && !matchesTool(rule.matchTool, call.toolName)) {
      continue;
    }
    if (rule.matchArgs !== undefined && !rule.matchArgs(call.args)) {
      continue;
    }
    return rule.tier;
  }
  return null;
}

// ---------------------------------------------------------------------------
// PortariumEngine
// ---------------------------------------------------------------------------

export class PortariumEngine {
  private readonly rules: PolicyRule[];
  private readonly callLimits: CallLimitRule[];
  private readonly defaultTier: ExecutionTier;
  private readonly onAudit?: EngineConfig['onAudit'];

  /** Session-scoped call counters. Reset by calling resetSession(). */
  private readonly callCounts = new Map<string, number>();

  constructor(config: EngineConfig = {}) {
    this.rules = config.rules ?? [];
    this.callLimits = config.callLimits ?? [];
    this.defaultTier = config.defaultTier ?? 'auto';
    this.onAudit = config.onAudit;
  }

  /**
   * Validate a tool call.
   *
   * @param call - The tool call to validate.
   * @returns A ValidationDecision — allow, block, or require-approval.
   */
  async validate(call: ToolCall): Promise<ValidationDecision> {
    // 1. Check call limits
    const limitRule = this.callLimits.find((r) => r.toolName === call.toolName);
    if (limitRule !== undefined) {
      const count = (this.callCounts.get(call.toolName) ?? 0) + 1;
      this.callCounts.set(call.toolName, count);
      if (count > limitRule.maxCallsPerSession) {
        const decision: ValidationDecision = {
          outcome: 'block',
          reason: `Call limit exceeded: ${call.toolName} is limited to ${limitRule.maxCallsPerSession} calls per session (this is call #${count}).`,
        };
        await this.emit(call, 'auto', decision);
        return decision;
      }
    }

    // 2. Evaluate policy rules
    const matchedTier = applyRules(this.rules, call);
    const tier = matchedTier ?? this.defaultTier;

    // 3. Build decision
    let decision: ValidationDecision;
    if (tier === 'auto' || tier === 'assisted') {
      decision = { outcome: 'allow', tier };
    } else if (tier === 'human-approve' || tier === 'manual-only') {
      decision = {
        outcome: 'require-approval',
        tier,
        reason: `Tool call '${call.toolName}' requires human approval (tier: ${tier}).`,
      };
    } else {
      // Exhaustiveness guard
      decision = { outcome: 'allow', tier: 'auto' };
    }

    await this.emit(call, tier, decision);
    return decision;
  }

  /**
   * Reset session-scoped call counters.
   * Call this at the start of each new agent session.
   */
  resetSession(): void {
    this.callCounts.clear();
  }

  private async emit(
    call: ToolCall,
    tier: ExecutionTier,
    decision: ValidationDecision,
  ): Promise<void> {
    if (this.onAudit === undefined) return;
    const event: AuditEvent = {
      callId: call.callId,
      toolName: call.toolName,
      args: call.args,
      tier,
      decision,
      timestamp: new Date().toISOString(),
      metadata: call.metadata,
    };
    await this.onAudit(event);
  }
}
