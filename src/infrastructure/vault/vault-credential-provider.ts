/**
 * Vault-backed implementation of the CredentialProviderPort.
 *
 * Wraps the HashiCorp Vault KV v2 API to provide tenant-scoped credential
 * retrieval with version pinning support.
 *
 * @see .specify/specs/credential-vault-migration-v1.md
 */

import type { TenantId as TenantIdType } from '../../domain/primitives/index.js';
import type {
  CredentialProviderPort,
  CredentialReference,
  CredentialValue,
  CredentialProviderError,
} from '../../application/ports/credential-provider.js';
import { err, ok, type Result } from '../../application/common/result.js';

export type VaultCredentialProviderConfig = Readonly<{
  /** Vault base URL (e.g. http://127.0.0.1:8200). */
  vaultAddr: string;
  /** Vault authentication token. */
  token: string;
  /** KV v2 mount path. Defaults to "secret". */
  kvMountPath?: string;
  /** Optional fetch implementation for testing. */
  fetchImpl?: typeof fetch;
}>;

function normalizeAddr(addr: string): string {
  return addr.replace(/\/+$/, '');
}

export class VaultCredentialProvider implements CredentialProviderPort {
  readonly #vaultAddr: string;
  readonly #token: string;
  readonly #kvMount: string;
  readonly #fetchImpl: typeof fetch;

  public constructor(config: VaultCredentialProviderConfig) {
    this.#vaultAddr = normalizeAddr(config.vaultAddr);
    this.#token = config.token;
    this.#kvMount = config.kvMountPath ?? 'secret';
    this.#fetchImpl = config.fetchImpl ?? fetch;
  }

  public async getCredential(
    ref: CredentialReference,
  ): Promise<Result<CredentialValue, CredentialProviderError>> {
    const tenantId: TenantIdType = ref.tenantId;
    const path = `${this.#kvMount}/data/${tenantId}/${ref.credentialName}`;
    const versionQs = ref.version !== undefined ? `?version=${ref.version}` : '';
    const url = `${this.#vaultAddr}/v1/${path}${versionQs}`;

    try {
      const response = await this.#fetchImpl(url, {
        method: 'GET',
        headers: {
          'x-vault-token': this.#token,
          'content-type': 'application/json',
        },
      });

      if (response.status === 404) {
        return err({
          kind: 'CredentialNotFound',
          message: `Credential '${ref.credentialName}' not found for tenant '${tenantId}'.`,
        });
      }

      if (response.status === 403) {
        return err({
          kind: 'CredentialAccessDenied',
          message: `Access denied to credential '${ref.credentialName}' for tenant '${tenantId}'.`,
        });
      }

      if (!response.ok) {
        return err({
          kind: 'CredentialProviderUnavailable',
          message: `Vault returned HTTP ${response.status}.`,
        });
      }

      const body = (await response.json()) as {
        data?: {
          data?: Record<string, string>;
          metadata?: { version?: number; created_time?: string };
        };
      };

      const secretData = body.data?.data;
      const secret = secretData?.['value'];
      if (typeof secret !== 'string') {
        return err({
          kind: 'CredentialNotFound',
          message: `Credential '${ref.credentialName}' has no 'value' key.`,
        });
      }

      const metadata = body.data?.metadata;
      return ok({
        secret,
        version: metadata?.version ?? 0,
        createdAtIso: metadata?.created_time ?? new Date(0).toISOString(),
      });
    } catch {
      return err({
        kind: 'CredentialProviderUnavailable',
        message: 'Vault connection failed.',
      });
    }
  }
}
