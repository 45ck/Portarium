import type { TenantId as TenantIdType } from '../../domain/primitives/index.js';
import type {
  CredentialStorePort,
  RotateSecretResult,
  SecretValue,
} from '../../application/ports/credential-store.js';
import { err, ok, type Result } from '../../application/common/result.js';
import type { DependencyFailure, NotFound } from '../../application/common/errors.js';

export type VaultCredentialStoreConfig = Readonly<{
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

function tenantSecretPath(kvMount: string, tenantId: TenantIdType, secretRef: string): string {
  return `${kvMount}/data/${tenantId}/${secretRef}`;
}

function tenantDeletePath(kvMount: string, tenantId: TenantIdType, secretRef: string): string {
  return `${kvMount}/metadata/${tenantId}/${secretRef}`;
}

/**
 * HashiCorp Vault KV v2 implementation of the CredentialStore port.
 *
 * Secrets are stored under `<kvMount>/data/<tenantId>/<secretRef>` to
 * enforce tenant isolation at the path level.
 */
export class VaultCredentialStore implements CredentialStorePort {
  readonly #vaultAddr: string;
  readonly #token: string;
  readonly #kvMount: string;
  readonly #fetchImpl: typeof fetch;

  public constructor(config: VaultCredentialStoreConfig) {
    this.#vaultAddr = normalizeAddr(config.vaultAddr);
    this.#token = config.token;
    this.#kvMount = config.kvMountPath ?? 'secret';
    this.#fetchImpl = config.fetchImpl ?? fetch;
  }

  public async getSecret(
    tenantId: TenantIdType,
    secretRef: string,
  ): Promise<Result<SecretValue, NotFound | DependencyFailure>> {
    const path = tenantSecretPath(this.#kvMount, tenantId, secretRef);
    const url = `${this.#vaultAddr}/v1/${path}`;

    try {
      const response = await this.#fetchImpl(url, {
        method: 'GET',
        headers: this.#headers(),
      });

      if (response.status === 404) {
        return err({
          kind: 'NotFound',
          message: `Secret not found: ${secretRef}`,
          resource: 'Secret',
        });
      }

      if (!response.ok) {
        return err({
          kind: 'DependencyFailure',
          message: `Vault returned status ${response.status}`,
        });
      }

      const body = (await response.json()) as {
        data?: { data?: Record<string, string>; metadata?: { version?: number } };
      };
      const secretData = body.data?.data;
      const value = secretData?.['value'];
      if (typeof value !== 'string') {
        return err({
          kind: 'NotFound',
          message: `Secret data missing "value" key: ${secretRef}`,
          resource: 'Secret',
        });
      }

      return ok({
        value,
        ...(body.data?.metadata?.version !== undefined
          ? { version: String(body.data.metadata.version) }
          : {}),
      });
    } catch {
      return err({ kind: 'DependencyFailure', message: 'Vault connection failed' });
    }
  }

  public async rotateSecret(
    tenantId: TenantIdType,
    secretRef: string,
  ): Promise<Result<RotateSecretResult, NotFound | DependencyFailure>> {
    const path = tenantSecretPath(this.#kvMount, tenantId, secretRef);
    const url = `${this.#vaultAddr}/v1/${path}`;
    const newValue = generateSecretValue();

    try {
      const response = await this.#fetchImpl(url, {
        method: 'POST',
        headers: this.#headers(),
        body: JSON.stringify({ data: { value: newValue } }),
      });

      if (!response.ok) {
        return err({
          kind: 'DependencyFailure',
          message: `Vault returned status ${response.status}`,
        });
      }

      const body = (await response.json()) as {
        data?: { version?: number };
      };
      const version = body.data?.version;

      return ok({ newVersion: String(version ?? 'unknown') });
    } catch {
      return err({ kind: 'DependencyFailure', message: 'Vault connection failed' });
    }
  }

  public async revokeSecret(
    tenantId: TenantIdType,
    secretRef: string,
  ): Promise<Result<void, NotFound | DependencyFailure>> {
    const path = tenantDeletePath(this.#kvMount, tenantId, secretRef);
    const url = `${this.#vaultAddr}/v1/${path}`;

    try {
      const response = await this.#fetchImpl(url, {
        method: 'DELETE',
        headers: this.#headers(),
      });

      if (response.status === 404) {
        return err({
          kind: 'NotFound',
          message: `Secret not found: ${secretRef}`,
          resource: 'Secret',
        });
      }

      if (!response.ok) {
        return err({
          kind: 'DependencyFailure',
          message: `Vault returned status ${response.status}`,
        });
      }

      return ok(undefined);
    } catch {
      return err({ kind: 'DependencyFailure', message: 'Vault connection failed' });
    }
  }

  #headers(): Record<string, string> {
    return {
      'x-vault-token': this.#token,
      'content-type': 'application/json',
    };
  }
}

function generateSecretValue(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
