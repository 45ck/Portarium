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

interface VaultKvReadResponse {
  data?: {
    data?: Record<string, string>;
    metadata?: { version?: number; created_time?: string };
  };
}

interface VaultReadUrlInput {
  vaultAddr: string;
  kvMount: string;
  tenantId: string;
  credentialName: string;
  version: number | undefined;
}

function buildVaultReadUrl(input: VaultReadUrlInput): string {
  const path = `${input.kvMount}/data/${input.tenantId}/${input.credentialName}`;
  const versionQs = input.version !== undefined ? `?version=${input.version}` : '';
  return `${input.vaultAddr}/v1/${path}${versionQs}`;
}

function mapErrorResponse(
  response: Response,
  credentialName: string,
  tenantId: string,
): CredentialProviderError | null {
  switch (response.status) {
    case 404:
      return {
        kind: 'CredentialNotFound',
        message: `Credential '${credentialName}' not found for tenant '${tenantId}'.`,
      };
    case 403:
      return {
        kind: 'CredentialAccessDenied',
        message: `Access denied to credential '${credentialName}' for tenant '${tenantId}'.`,
      };
    default:
      return response.ok
        ? null
        : {
            kind: 'CredentialProviderUnavailable',
            message: `Vault returned HTTP ${response.status}.`,
          };
  }
}

function parseSecretValue(
  body: VaultKvReadResponse,
  credentialName: string,
): Result<CredentialValue, CredentialProviderError> {
  const secret = body.data?.data?.['value'];
  if (typeof secret !== 'string') {
    return err({
      kind: 'CredentialNotFound',
      message: `Credential '${credentialName}' has no 'value' key.`,
    });
  }

  const metadata = body.data?.metadata;
  return ok({
    secret,
    version: metadata?.version ?? 0,
    createdAtIso: metadata?.created_time ?? new Date(0).toISOString(),
  });
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
    const url = buildVaultReadUrl({
      vaultAddr: this.#vaultAddr,
      kvMount: this.#kvMount,
      tenantId,
      credentialName: ref.credentialName,
      version: ref.version,
    });

    try {
      const response = await this.#fetchImpl(url, {
        method: 'GET',
        headers: {
          'x-vault-token': this.#token,
          'content-type': 'application/json',
        },
      });

      const providerError = mapErrorResponse(response, ref.credentialName, tenantId);
      if (providerError) return err(providerError);

      const body = (await response.json()) as VaultKvReadResponse;
      return parseSecretValue(body, ref.credentialName);
    } catch {
      return err({
        kind: 'CredentialProviderUnavailable',
        message: 'Vault connection failed.',
      });
    }
  }
}
