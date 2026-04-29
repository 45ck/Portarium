/**
 * HTTP client for the Portarium control plane.
 *
 * Wraps the agent-actions:propose endpoint and approval polling.
 * All methods are soft-fail and return typed results.
 */
import type { PortariumPluginConfig } from '../config.js';

export interface ProposeActionInput {
  readonly toolName: string;
  readonly parameters: Record<string, unknown>;
  readonly sessionKey: string;
  readonly correlationId?: string;
  /** The agentId to attribute this proposal to (defaults to sessionKey). */
  readonly agentId?: string;
  /** The execution tier hint ('Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly'). */
  readonly executionTier?: string;
  /** Human-readable rationale for this tool call. Defaults to a generated description. */
  readonly rationale?: string;
  /** Policy IDs to evaluate against. Falls back to config.defaultPolicyIds. */
  readonly policyIds?: readonly string[];
}

export type ProposeActionResult =
  | { readonly status: 'allowed' }
  | { readonly status: 'denied'; readonly reason: string }
  | { readonly status: 'awaiting_approval'; readonly approvalId: string; readonly actionId: string }
  | { readonly status: 'error'; readonly reason: string };

export type ApprovalPollResult =
  | { readonly approved: true }
  | { readonly approved: false; readonly reason: string }
  | { readonly status: 'pending' }
  | { readonly status: 'expired' }
  | { readonly status: 'executed' }
  | { readonly status: 'request_changes'; readonly reason: string }
  | { readonly status: 'error'; readonly reason: string };

export interface RunStatus {
  readonly runId: string;
  readonly stage: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ApprovalSummary {
  readonly approvalId: string;
  readonly toolName: string;
  readonly status: 'pending' | 'approved' | 'denied' | 'expired';
  readonly createdAt: string;
}

export interface CapabilityInfo {
  readonly capabilityId: string;
  readonly requiredTier: string;
  readonly riskClass: string;
}

export class PortariumClient {
  readonly #config: PortariumPluginConfig;
  readonly #fetchImpl: typeof fetch;

  public constructor(config: PortariumPluginConfig, fetchImpl?: typeof fetch) {
    this.#config = config;
    this.#fetchImpl = fetchImpl ?? globalThis.fetch;
  }

  public async proposeAction(input: ProposeActionInput): Promise<ProposeActionResult> {
    const url = `${this.#config.portariumUrl}/v1/workspaces/${encodeURIComponent(this.#config.workspaceId)}/agent-actions:propose`;

    try {
      const response = await this.#fetchImpl(url, {
        method: 'POST',
        headers: this.#headers(),
        body: JSON.stringify({
          // Required by ProposeAgentActionInput on the control plane
          agentId: input.agentId ?? input.sessionKey,
          actionKind: 'tool_call',
          toolName: input.toolName,
          parameters: input.parameters,
          rationale:
            input.rationale ?? `Agent tool call: ${input.toolName} (session: ${input.sessionKey})`,
          policyIds: input.policyIds ?? [...this.#config.defaultPolicyIds],
          executionTier: input.executionTier ?? this.#config.defaultExecutionTier,
          ...(input.correlationId ? { correlationId: input.correlationId } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        if (response.status === 409) {
          return { status: 'denied', reason: 'Policy denied by control plane (409)' };
        }
        if (response.status === 401 || response.status === 403) {
          return { status: 'error', reason: 'Unauthorized — check bearerToken config' };
        }
        return {
          status: 'error',
          reason: `Control plane returned HTTP ${response.status}`,
        };
      }

      const json = await readJsonObject(response, 'proposal response');
      if (!json.ok) {
        return { status: 'error', reason: json.reason };
      }
      const body = json.body;
      return parseProposalResponse(body);
    } catch (error) {
      return {
        status: 'error',
        reason: error instanceof Error ? error.message : 'Network error contacting Portarium',
      };
    }
  }

  public async pollApproval(approvalId: string): Promise<ApprovalPollResult> {
    const url = `${this.#config.portariumUrl}/v1/workspaces/${encodeURIComponent(this.#config.workspaceId)}/approvals/${encodeURIComponent(approvalId)}`;

    try {
      const response = await this.#fetchImpl(url, {
        method: 'GET',
        headers: this.#headers(),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        return { status: 'error', reason: `HTTP ${response.status} polling approval` };
      }

      const json = await readJsonObject(response, 'approval polling response');
      if (!json.ok) {
        return { status: 'error', reason: json.reason };
      }
      const body = json.body;
      return parseApprovalStatus(body);
    } catch (error) {
      return {
        status: 'error',
        reason: error instanceof Error ? error.message : 'Network error polling approval',
      };
    }
  }

  public async getRunStatus(runId: string): Promise<RunStatus | null> {
    const url = `${this.#config.portariumUrl}/v1/workspaces/${encodeURIComponent(this.#config.workspaceId)}/runs/${encodeURIComponent(runId)}`;

    try {
      const response = await this.#fetchImpl(url, {
        method: 'GET',
        headers: this.#headers(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return null;
      const json = await readJsonObject(response, 'run status response');
      if (!json.ok) return null;
      const body = json.body;
      return {
        runId: String(body.runId ?? body.id ?? runId),
        stage: String(body.stage ?? body.status ?? 'unknown'),
        createdAt: String(body.createdAt ?? ''),
        updatedAt: String(body.updatedAt ?? ''),
      };
    } catch {
      return null;
    }
  }

  public async listPendingApprovals(): Promise<ApprovalSummary[]> {
    const url = `${this.#config.portariumUrl}/v1/workspaces/${encodeURIComponent(this.#config.workspaceId)}/approvals?status=Pending`;

    try {
      const response = await this.#fetchImpl(url, {
        method: 'GET',
        headers: this.#headers(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return [];
      const json = await readJsonObject(response, 'approval list response');
      if (!json.ok) return [];
      const body = json.body;
      const items = Array.isArray(body.items) ? body.items : [];
      return items.map((item: Record<string, unknown>) => ({
        approvalId: String(item.id ?? item.approvalId ?? ''),
        toolName: String(item.toolName ?? item.capability ?? 'unknown'),
        status: parseApprovalSummaryStatus(item.status),
        createdAt: String(item.createdAt ?? ''),
      }));
    } catch {
      return [];
    }
  }

  public async ping(): Promise<{
    ok: boolean;
    status?: number;
    error?: string;
    portariumUrl: string;
    workspaceId: string;
  }> {
    const url = `${this.#config.portariumUrl}/health`;
    try {
      const response = await this.#fetchImpl(url, {
        headers: { authorization: `Bearer ${this.#config.bearerToken}` },
        signal: AbortSignal.timeout(5_000),
      });
      return {
        ok: response.ok,
        status: response.status,
        portariumUrl: this.#config.portariumUrl,
        workspaceId: this.#config.workspaceId,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        portariumUrl: this.#config.portariumUrl,
        workspaceId: this.#config.workspaceId,
      };
    }
  }

  public async lookupCapability(toolName: string): Promise<CapabilityInfo | null> {
    const url = `${this.#config.portariumUrl}/v1/workspaces/${encodeURIComponent(this.#config.workspaceId)}/capabilities/${encodeURIComponent(toolName)}`;

    try {
      const response = await this.#fetchImpl(url, {
        method: 'GET',
        headers: this.#headers(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return null;
      const json = await readJsonObject(response, 'capability lookup response');
      if (!json.ok) return null;
      const body = json.body;
      return {
        capabilityId: String(body.capabilityId ?? toolName),
        requiredTier: String(body.requiredTier ?? 'HumanApprove'),
        riskClass: String(body.riskClass ?? 'unknown'),
      };
    } catch {
      return null;
    }
  }

  #headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      authorization: `Bearer ${this.#config.bearerToken}`,
      'x-portarium-tenant-id': this.#config.tenantId,
      'x-portarium-workspace-id': this.#config.workspaceId,
    };
  }
}

type JsonObjectReadResult =
  | { readonly ok: true; readonly body: Record<string, unknown> }
  | { readonly ok: false; readonly reason: string };

async function readJsonObject(
  response: Pick<Response, 'headers' | 'json'>,
  context: string,
): Promise<JsonObjectReadResult> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.trim().toLowerCase().startsWith('application/json')) {
    return {
      ok: false,
      reason: `Portarium returned unexpected content-type for ${context}: ${contentType || '(none)'}`,
    };
  }

  try {
    const body = (await response.json()) as unknown;
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return {
        ok: false,
        reason: `Portarium returned non-object JSON for ${context}`,
      };
    }
    return { ok: true, body: body as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      reason: `Portarium returned invalid JSON for ${context}`,
    };
  }
}

function parseProposalResponse(body: Record<string, unknown>): ProposeActionResult {
  // Actual Portarium control plane response: { decision: 'Allow'|'NeedsApproval'|'Denied', proposalId, approvalId?, message? }
  const decision = body.decision as string | undefined;

  if (decision === 'Allow') {
    return { status: 'allowed' };
  }
  if (decision === 'Denied') {
    return {
      status: 'denied',
      reason: String(body.message ?? body.reason ?? 'Policy denied'),
    };
  }
  if (decision === 'NeedsApproval') {
    const approvalId = String(body.approvalId ?? '');
    const actionId = String(body.proposalId ?? body.actionId ?? '');
    if (!approvalId) {
      return { status: 'error', reason: 'Portarium returned NeedsApproval without approvalId' };
    }
    return { status: 'awaiting_approval', approvalId, actionId };
  }

  // Fallbacks for older / alternative response shapes
  const status = body.status as string | undefined;
  if (status === 'allowed' || status === 'auto_allowed') return { status: 'allowed' };
  if (status === 'denied' || status === 'policy_denied') {
    return { status: 'denied', reason: String(body.reason ?? body.message ?? 'Policy denied') };
  }
  if (status === 'awaiting_approval' || status === 'pending_approval') {
    const approvalId = String(body.approvalId ?? body.id ?? '');
    const actionId = String(body.actionId ?? '');
    if (!approvalId) {
      return { status: 'error', reason: 'Portarium returned awaiting_approval without approvalId' };
    }
    return { status: 'awaiting_approval', approvalId, actionId };
  }
  if (typeof body.allowed === 'boolean') {
    if (body.allowed) return { status: 'allowed' };
    return { status: 'denied', reason: String(body.message ?? body.reason ?? 'Denied') };
  }

  return { status: 'error', reason: `Unrecognised proposal response: ${JSON.stringify(body)}` };
}

function parseApprovalStatus(body: Record<string, unknown>): ApprovalPollResult {
  // Normalize to lowercase for comparison — control plane uses capitalized values (Approved, Denied, etc.)
  const status = String(body.status ?? '').toLowerCase();

  if (status === 'approved') return { approved: true };
  if (status === 'denied')
    return {
      approved: false,
      reason: String(body.reason ?? body.rationale ?? 'Denied by operator'),
    };
  if (status === 'expired') return { status: 'expired' };
  if (status === 'executed') return { status: 'executed' };
  if (status === 'requestchanges' || status === 'request_changes') {
    return {
      status: 'request_changes',
      reason: String(body.reason ?? body.rationale ?? 'Operator requested changes'),
    };
  }
  if (status === 'pending') return { status: 'pending' };
  return { status: 'error', reason: `Unknown approval status: ${String(body.status)}` };
}

function parseApprovalSummaryStatus(status: unknown): ApprovalSummary['status'] {
  const normalized = String(status ?? 'pending').toLowerCase();

  if (normalized === 'approved') return 'approved';
  if (normalized === 'denied') return 'denied';
  if (normalized === 'expired') return 'expired';
  return 'pending';
}
