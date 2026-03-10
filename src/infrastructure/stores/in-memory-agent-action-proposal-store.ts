import type {
  ApprovalId,
  ProposalId,
  TenantId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type { AgentActionProposalV1 } from '../../domain/machines/index.js';
import type { AgentActionProposalStore } from '../../application/ports/agent-action-proposal-store.js';

/** Default idempotency key TTL: 24 hours in milliseconds. */
const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** Run cleanup every N saveProposal calls. */
const CLEANUP_INTERVAL = 100;

export interface InMemoryAgentActionProposalStoreOptions {
  /** TTL for idempotency key entries in milliseconds. Defaults to 24h. */
  idempotencyTtlMs?: number;
  /** Clock function for testability. Defaults to Date.now. */
  now?: () => number;
}

export class InMemoryAgentActionProposalStore implements AgentActionProposalStore {
  readonly #store = new Map<string, AgentActionProposalV1>();
  /** Maps idempotencyKey → insertion timestamp for TTL expiry. */
  readonly #idempotencyTimestamps = new Map<string, number>();
  readonly #idempotencyTtlMs: number;
  readonly #now: () => number;
  #saveCount = 0;

  public constructor(options?: InMemoryAgentActionProposalStoreOptions) {
    this.#idempotencyTtlMs = options?.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS;
    this.#now = options?.now ?? (() => Date.now());
  }

  public async getProposalById(
    tenantId: TenantId,
    proposalId: ProposalId,
  ): Promise<AgentActionProposalV1 | null> {
    return this.#store.get(this.#key(tenantId, proposalId)) ?? null;
  }

  public async getProposalByApprovalId(
    tenantId: TenantId,
    approvalId: ApprovalId,
  ): Promise<AgentActionProposalV1 | null> {
    const prefix = `${String(tenantId)}:`;
    for (const [key, proposal] of this.#store.entries()) {
      if (
        key.startsWith(prefix) &&
        proposal.approvalId &&
        String(proposal.approvalId) === String(approvalId)
      ) {
        return proposal;
      }
    }
    return null;
  }

  public async getProposalByIdempotencyKey(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    idempotencyKey: string,
  ): Promise<AgentActionProposalV1 | null> {
    const idemKey = this.#idempotencyKey(workspaceId, idempotencyKey);

    // TTL check: the idempotency key must have a non-expired timestamp to be valid.
    // If the timestamp is missing (never set or already cleaned up) or expired,
    // treat as not found — the key slot is available for reuse.
    const insertedAt = this.#idempotencyTimestamps.get(idemKey);
    if (insertedAt === undefined) return null;
    if (this.#now() - insertedAt > this.#idempotencyTtlMs) {
      this.#idempotencyTimestamps.delete(idemKey);
      return null;
    }

    const prefix = `${String(tenantId)}:`;
    for (const [key, proposal] of this.#store.entries()) {
      if (
        key.startsWith(prefix) &&
        proposal.idempotencyKey === idempotencyKey &&
        String(proposal.workspaceId) === String(workspaceId)
      ) {
        return proposal;
      }
    }
    return null;
  }

  public async saveProposal(tenantId: TenantId, proposal: AgentActionProposalV1): Promise<void> {
    // Enforce unique constraint on idempotencyKey within a workspace.
    // If a non-expired proposal with the same idempotency key already exists
    // (race loser), silently skip the duplicate — the first writer wins.
    if (proposal.idempotencyKey) {
      const idemKey = this.#idempotencyKey(proposal.workspaceId, proposal.idempotencyKey);
      const insertedAt = this.#idempotencyTimestamps.get(idemKey);

      if (insertedAt !== undefined && this.#now() - insertedAt <= this.#idempotencyTtlMs) {
        // Key is live — check if it belongs to a different proposal.
        for (const existing of this.#store.values()) {
          if (
            existing.idempotencyKey === proposal.idempotencyKey &&
            String(existing.workspaceId) === String(proposal.workspaceId) &&
            String(existing.proposalId) !== String(proposal.proposalId)
          ) {
            // Duplicate idempotency key — silently ignore (first writer wins).
            return;
          }
        }
      } else {
        // Key is either expired or never existed — clean up any stale entry
        // with the same idempotency key so lookups return the new proposal.
        for (const [key, existing] of this.#store.entries()) {
          if (
            existing.idempotencyKey === proposal.idempotencyKey &&
            String(existing.workspaceId) === String(proposal.workspaceId) &&
            String(existing.proposalId) !== String(proposal.proposalId)
          ) {
            this.#store.delete(key);
            break;
          }
        }
      }
      this.#idempotencyTimestamps.set(idemKey, this.#now());
    }
    this.#store.set(this.#key(tenantId, proposal.proposalId), proposal);

    this.#saveCount++;
    if (this.#saveCount >= CLEANUP_INTERVAL) {
      this.#saveCount = 0;
      this.cleanup();
    }
  }

  /**
   * Removes expired idempotency timestamps.
   * Called automatically every {@link CLEANUP_INTERVAL} saves, or can be invoked externally.
   */
  public cleanup(): void {
    const now = this.#now();
    for (const [idemKey, insertedAt] of this.#idempotencyTimestamps) {
      if (now - insertedAt > this.#idempotencyTtlMs) {
        this.#idempotencyTimestamps.delete(idemKey);
      }
    }
  }

  #key(tenantId: TenantId, proposalId: ProposalId): string {
    return `${String(tenantId)}:${String(proposalId)}`;
  }

  #idempotencyKey(workspaceId: WorkspaceId, idempotencyKey: string): string {
    return `${String(workspaceId)}:${idempotencyKey}`;
  }
}
