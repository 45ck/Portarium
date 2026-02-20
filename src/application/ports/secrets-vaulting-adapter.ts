import type { ExternalObjectRef } from '../../domain/canonical/external-object-ref.js';
import type { TenantId } from '../../domain/primitives/index.js';

export const SECRETS_VAULTING_OPERATIONS_V1 = [
  'getSecret',
  'putSecret',
  'deleteSecret',
  'listSecrets',
  'rotateSecret',
  'createCertificate',
  'getCertificate',
  'renewCertificate',
  'listCertificates',
  'encrypt',
  'decrypt',
  'createKey',
  'listKeys',
  'getAuditLog',
  'setSecretPolicy',
] as const;

export type SecretsVaultingOperationV1 = (typeof SECRETS_VAULTING_OPERATIONS_V1)[number];

export type SecretsVaultingOperationResultV1 =
  | Readonly<{ kind: 'externalRef'; externalRef: ExternalObjectRef }>
  | Readonly<{ kind: 'externalRefs'; externalRefs: readonly ExternalObjectRef[] }>
  | Readonly<{ kind: 'accepted'; operation: SecretsVaultingOperationV1 }>
  | Readonly<{ kind: 'opaque'; payload: Readonly<Record<string, unknown>> }>;

export type SecretsVaultingExecuteInputV1 = Readonly<{
  tenantId: TenantId;
  operation: SecretsVaultingOperationV1;
  payload?: Readonly<Record<string, unknown>>;
}>;

export type SecretsVaultingExecuteOutputV1 =
  | Readonly<{ ok: true; result: SecretsVaultingOperationResultV1 }>
  | Readonly<{
      ok: false;
      error: 'unsupported_operation' | 'not_found' | 'validation_error' | 'provider_error';
      message: string;
    }>;

export interface SecretsVaultingAdapterPort {
  execute(input: SecretsVaultingExecuteInputV1): Promise<SecretsVaultingExecuteOutputV1>;
}
