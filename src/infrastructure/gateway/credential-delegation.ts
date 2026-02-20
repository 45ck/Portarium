/**
 * Credential delegation for MCP/gateway.
 *
 * The gateway acquires Vault-backed provider credentials on behalf of callers.
 * MCP clients authenticate with a workspace-scoped JWT; the gateway exchanges
 * this for a System-of-Record (SoR) credential. No secrets are exposed in MCP
 * tool responses.
 *
 * This module defines the delegation contract and an in-memory implementation
 * for testing / local dev. Production wires a Vault-backed adapter.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CredentialScope = Readonly<{
  workspaceId: string;
  /** Provider key (e.g. 'github', 'jira', 'erpnext'). */
  provider: string;
  /** Optional narrowing scope (e.g. repo, project). */
  resource?: string;
}>;

export type DelegatedCredential = Readonly<{
  /** Opaque bearer token or API key for the target provider. */
  token: string;
  /** ISO timestamp when the credential expires. */
  expiresAtIso: string;
  /** Provider name for audit trail. */
  provider: string;
}>;

export type CredentialDelegationResult =
  | Readonly<{ ok: true; credential: DelegatedCredential }>
  | Readonly<{ ok: false; reason: string }>;

// ---------------------------------------------------------------------------
// Port interface
// ---------------------------------------------------------------------------

export interface CredentialDelegationPort {
  /**
   * Exchange a workspace-scoped JWT claim for a provider credential.
   * Returns the credential without exposing vault secrets to the caller.
   */
  acquireCredential(scope: CredentialScope): Promise<CredentialDelegationResult>;

  /**
   * Revoke a previously delegated credential (best-effort).
   */
  revokeCredential(scope: CredentialScope): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory implementation (for testing / local dev)
// ---------------------------------------------------------------------------

export type InMemoryCredentialEntry = Readonly<{
  token: string;
  expiresAtIso: string;
}>;

export class InMemoryCredentialDelegation implements CredentialDelegationPort {
  readonly #store = new Map<string, InMemoryCredentialEntry>();

  public seed(scope: CredentialScope, entry: InMemoryCredentialEntry): void {
    this.#store.set(scopeKey(scope), entry);
  }

  public acquireCredential(
    scope: CredentialScope,
  ): Promise<CredentialDelegationResult> {
    return Promise.resolve(this.#resolveCredential(scope));
  }

  #resolveCredential(scope: CredentialScope): CredentialDelegationResult {
    const entry = this.#store.get(scopeKey(scope));
    if (!entry) {
      return {
        ok: false,
        reason: `No credential available for ${scope.provider} in workspace ${scope.workspaceId}.`,
      };
    }

    if (new Date(entry.expiresAtIso).getTime() < Date.now()) {
      return {
        ok: false,
        reason: `Credential for ${scope.provider} in workspace ${scope.workspaceId} has expired.`,
      };
    }

    return {
      ok: true,
      credential: {
        token: entry.token,
        expiresAtIso: entry.expiresAtIso,
        provider: scope.provider,
      },
    };
  }

  public revokeCredential(scope: CredentialScope): Promise<void> {
    this.#store.delete(scopeKey(scope));
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scopeKey(scope: CredentialScope): string {
  return `${scope.workspaceId}:${scope.provider}${scope.resource ? `:${scope.resource}` : ''}`;
}

/**
 * Redact a credential token for safe inclusion in logs / tool responses.
 * Returns the first 4 and last 4 characters with the rest masked.
 */
export function redactToken(token: string): string {
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}${'*'.repeat(Math.min(token.length - 8, 20))}${token.slice(-4)}`;
}
