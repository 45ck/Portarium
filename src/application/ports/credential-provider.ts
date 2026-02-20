/**
 * Port for retrieving credentials from a secure credential store.
 *
 * All SoR (System of Record) credentials must be fetched through this port
 * rather than read from environment variables or config files. The production
 * implementation delegates to HashiCorp Vault.
 *
 * @see .specify/specs/credential-vault-migration-v1.md
 */

import type { TenantId as TenantIdType } from '../../domain/primitives/index.js';
import type { Result } from '../common/result.js';

/** Identifies a credential stored in the vault. */
export type CredentialReference = Readonly<{
  /** Tenant/workspace scope. */
  tenantId: TenantIdType;
  /** Logical name of the credential (e.g. 'erpnext-api-key', 'github-oauth-token'). */
  credentialName: string;
  /** Optional version pin. When omitted, the latest version is returned. */
  version?: number;
}>;

/** The resolved credential value. */
export type CredentialValue = Readonly<{
  /** Opaque secret value. */
  secret: string;
  /** Vault-assigned version number. */
  version: number;
  /** ISO-8601 timestamp when this version was created in the vault. */
  createdAtIso: string;
}>;

export type CredentialProviderError = Readonly<{
  kind: 'CredentialNotFound' | 'CredentialAccessDenied' | 'CredentialProviderUnavailable';
  message: string;
}>;

export interface CredentialProviderPort {
  /**
   * Retrieve a credential by reference.
   *
   * Returns an error result rather than throwing on expected failures
   * (not found, denied, provider down).
   */
  getCredential(
    ref: CredentialReference,
  ): Promise<Result<CredentialValue, CredentialProviderError>>;
}
