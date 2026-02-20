import type { TenantId as TenantIdType } from '../../domain/primitives/index.js';
import type { Result } from '../common/result.js';
import type { DependencyFailure, NotFound } from '../common/errors.js';

export type SecretValue = Readonly<{
  /** The resolved secret material. Callers must not log or persist this value. */
  value: string;
  /** Vault lease or version metadata, if available. */
  version?: string;
}>;

export type RotateSecretResult = Readonly<{
  /** The new version identifier after rotation. */
  newVersion: string;
}>;

export interface CredentialStorePort {
  /**
   * Retrieve a secret by tenant-scoped reference.
   * The secretRef is typically a vault path like `secret/data/<tenantId>/<name>`.
   */
  getSecret(
    tenantId: TenantIdType,
    secretRef: string,
  ): Promise<Result<SecretValue, NotFound | DependencyFailure>>;

  /**
   * Rotate a secret. The store generates or accepts a new value and returns
   * the new version identifier.
   */
  rotateSecret(
    tenantId: TenantIdType,
    secretRef: string,
  ): Promise<Result<RotateSecretResult, NotFound | DependencyFailure>>;

  /**
   * Revoke/delete a secret. After revocation, subsequent getSecret calls
   * for this ref must return NotFound.
   */
  revokeSecret(
    tenantId: TenantIdType,
    secretRef: string,
  ): Promise<Result<void, NotFound | DependencyFailure>>;
}
