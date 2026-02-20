import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type {
  SecretsVaultingAdapterPort,
  SecretsVaultingExecuteInputV1,
  SecretsVaultingExecuteOutputV1,
} from '../../../application/ports/secrets-vaulting-adapter.js';
import { SECRETS_VAULTING_OPERATIONS_V1 } from '../../../application/ports/secrets-vaulting-adapter.js';

const OPERATION_SET = new Set<string>(SECRETS_VAULTING_OPERATIONS_V1);

type TenantExternalRef = Readonly<{
  tenantId: SecretsVaultingExecuteInputV1['tenantId'];
  externalRef: ExternalObjectRef;
}>;

type SecretEntry = Readonly<{
  tenantId: SecretsVaultingExecuteInputV1['tenantId'];
  path: string;
  externalRef: ExternalObjectRef;
}>;

type InMemorySecretsVaultingAdapterSeed = Readonly<{
  secrets?: readonly SecretEntry[];
  certificates?: readonly TenantExternalRef[];
  keys?: readonly TenantExternalRef[];
  auditLogs?: readonly TenantExternalRef[];
}>;

type InMemorySecretsVaultingAdapterParams = Readonly<{
  seed?: InMemorySecretsVaultingAdapterSeed;
  now?: () => Date;
}>;

function readString(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export class InMemorySecretsVaultingAdapter implements SecretsVaultingAdapterPort {
  readonly #now: () => Date;
  readonly #secrets: SecretEntry[];
  readonly #certificates: TenantExternalRef[];
  readonly #keys: TenantExternalRef[];
  readonly #auditLogs: TenantExternalRef[];
  #secretSequence: number;
  #certificateSequence: number;
  #keySequence: number;
  #cryptoSequence: number;
  #policySequence: number;

  public constructor(params?: InMemorySecretsVaultingAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#secrets = [...(params?.seed?.secrets ?? [])];
    this.#certificates = [...(params?.seed?.certificates ?? [])];
    this.#keys = [...(params?.seed?.keys ?? [])];
    this.#auditLogs = [...(params?.seed?.auditLogs ?? [])];
    this.#secretSequence = this.#secrets.length;
    this.#certificateSequence = this.#certificates.length;
    this.#keySequence = this.#keys.length;
    this.#cryptoSequence = 0;
    this.#policySequence = 0;
  }

  public async execute(
    input: SecretsVaultingExecuteInputV1,
  ): Promise<SecretsVaultingExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported SecretsVaulting operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'getSecret':
        return this.#getSecret(input);
      case 'putSecret':
        return this.#putSecret(input);
      case 'deleteSecret':
        return this.#deleteSecret(input);
      case 'listSecrets':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listSecrets(input) },
        };
      case 'rotateSecret':
        return this.#rotateSecret(input);
      case 'createCertificate':
        return this.#createCertificate(input);
      case 'getCertificate':
        return this.#getCertificate(input);
      case 'renewCertificate':
        return this.#renewCertificate(input);
      case 'listCertificates':
        return {
          ok: true,
          result: {
            kind: 'externalRefs',
            externalRefs: this.#listTenantRefs(this.#certificates, input),
          },
        };
      case 'encrypt':
        return this.#cryptoOperation(input, 'encrypted_payload');
      case 'decrypt':
        return this.#cryptoOperation(input, 'decrypted_payload');
      case 'createKey':
        return this.#createKey(input);
      case 'listKeys':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#keys, input) },
        };
      case 'getAuditLog':
        return {
          ok: true,
          result: {
            kind: 'externalRefs',
            externalRefs: this.#listTenantRefs(this.#auditLogs, input),
          },
        };
      case 'setSecretPolicy':
        return this.#setSecretPolicy(input);
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported SecretsVaulting operation: ${String(input.operation)}.`,
        };
    }
  }

  #getSecret(input: SecretsVaultingExecuteInputV1): SecretsVaultingExecuteOutputV1 {
    const path = readString(input.payload, 'path');
    if (path === null) {
      return { ok: false, error: 'validation_error', message: 'path is required for getSecret.' };
    }
    const secret = this.#secrets.find(
      (item) => item.tenantId === input.tenantId && item.path === path,
    );
    if (secret === undefined) {
      return { ok: false, error: 'not_found', message: `Secret at path ${path} was not found.` };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef: secret.externalRef } };
  }

  #putSecret(input: SecretsVaultingExecuteInputV1): SecretsVaultingExecuteOutputV1 {
    const path = readString(input.payload, 'path');
    if (path === null) {
      return { ok: false, error: 'validation_error', message: 'path is required for putSecret.' };
    }
    const value = readString(input.payload, 'value');
    if (value === null) {
      return { ok: false, error: 'validation_error', message: 'value is required for putSecret.' };
    }

    const existingIndex = this.#secrets.findIndex(
      (item) => item.tenantId === input.tenantId && item.path === path,
    );
    const externalRef: ExternalObjectRef = {
      sorName: 'VaultSuite',
      portFamily: 'SecretsVaulting',
      externalId: `secret-${++this.#secretSequence}`,
      externalType: 'secret_version',
      displayLabel: `${path} updated`,
      deepLinkUrl: `https://vault.example/secrets/${encodeURIComponent(path)}`,
    };
    const next: SecretEntry = { tenantId: input.tenantId, path, externalRef };
    if (existingIndex >= 0) {
      this.#secrets[existingIndex] = next;
    } else {
      this.#secrets.push(next);
    }
    this.#auditLogs.push({
      tenantId: input.tenantId,
      externalRef: {
        sorName: 'VaultSuite',
        portFamily: 'SecretsVaulting',
        externalId: `audit-secret-write-${this.#secretSequence}`,
        externalType: 'audit_log',
        displayLabel: `Secret write at ${path}`,
      },
    });
    void value;
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #deleteSecret(input: SecretsVaultingExecuteInputV1): SecretsVaultingExecuteOutputV1 {
    const path = readString(input.payload, 'path');
    if (path === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'path is required for deleteSecret.',
      };
    }
    const index = this.#secrets.findIndex(
      (item) => item.tenantId === input.tenantId && item.path === path,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Secret at path ${path} was not found.` };
    }
    this.#secrets.splice(index, 1);
    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  #listSecrets(input: SecretsVaultingExecuteInputV1): readonly ExternalObjectRef[] {
    const prefix = readString(input.payload, 'pathPrefix');
    return this.#secrets
      .filter(
        (item) =>
          item.tenantId === input.tenantId && (prefix === null || item.path.startsWith(prefix)),
      )
      .map((item) => item.externalRef);
  }

  #rotateSecret(input: SecretsVaultingExecuteInputV1): SecretsVaultingExecuteOutputV1 {
    const path = readString(input.payload, 'path');
    if (path === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'path is required for rotateSecret.',
      };
    }
    const secret = this.#secrets.find(
      (item) => item.tenantId === input.tenantId && item.path === path,
    );
    if (secret === undefined) {
      return { ok: false, error: 'not_found', message: `Secret at path ${path} was not found.` };
    }

    const rotated: ExternalObjectRef = {
      ...secret.externalRef,
      externalId: `secret-${++this.#secretSequence}`,
      displayLabel: `${path} rotated`,
    };
    const index = this.#secrets.findIndex(
      (item) => item.tenantId === input.tenantId && item.path === path,
    );
    this.#secrets[index] = { tenantId: input.tenantId, path, externalRef: rotated };
    return { ok: true, result: { kind: 'externalRef', externalRef: rotated } };
  }

  #createCertificate(input: SecretsVaultingExecuteInputV1): SecretsVaultingExecuteOutputV1 {
    const commonName = readString(input.payload, 'commonName');
    if (commonName === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'commonName is required for createCertificate.',
      };
    }
    const externalRef: ExternalObjectRef = {
      sorName: 'VaultSuite',
      portFamily: 'SecretsVaulting',
      externalId: `cert-${++this.#certificateSequence}`,
      externalType: 'certificate',
      displayLabel: commonName,
    };
    this.#certificates.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #getCertificate(input: SecretsVaultingExecuteInputV1): SecretsVaultingExecuteOutputV1 {
    return this.#getTenantRef(
      input,
      this.#certificates,
      'certificateId',
      'Certificate',
      'getCertificate',
    );
  }

  #renewCertificate(input: SecretsVaultingExecuteInputV1): SecretsVaultingExecuteOutputV1 {
    const certificateId = readString(input.payload, 'certificateId');
    if (certificateId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'certificateId is required for renewCertificate.',
      };
    }
    const index = this.#certificates.findIndex(
      (item) => item.tenantId === input.tenantId && item.externalRef.externalId === certificateId,
    );
    if (index < 0) {
      return {
        ok: false,
        error: 'not_found',
        message: `Certificate ${certificateId} was not found.`,
      };
    }

    const renewed: ExternalObjectRef = {
      ...this.#certificates[index]!.externalRef,
      externalId: `cert-${++this.#certificateSequence}`,
      displayLabel: `${this.#certificates[index]!.externalRef.displayLabel} renewed`,
    };
    this.#certificates[index] = { tenantId: input.tenantId, externalRef: renewed };
    return { ok: true, result: { kind: 'externalRef', externalRef: renewed } };
  }

  #cryptoOperation(
    input: SecretsVaultingExecuteInputV1,
    externalType: 'encrypted_payload' | 'decrypted_payload',
  ): SecretsVaultingExecuteOutputV1 {
    const data = readString(input.payload, 'data');
    if (data === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: `data is required for ${input.operation}.`,
      };
    }
    const keyRef = readString(input.payload, 'keyRef');
    if (keyRef === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: `keyRef is required for ${input.operation}.`,
      };
    }
    void data;

    const externalRef: ExternalObjectRef = {
      sorName: 'VaultSuite',
      portFamily: 'SecretsVaulting',
      externalId: `crypto-${++this.#cryptoSequence}`,
      externalType,
      displayLabel: `${input.operation} with key ${keyRef}`,
      deepLinkUrl: `https://vault.example/crypto/${this.#cryptoSequence}?at=${encodeURIComponent(
        this.#now().toISOString(),
      )}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #createKey(input: SecretsVaultingExecuteInputV1): SecretsVaultingExecuteOutputV1 {
    const keyName = readString(input.payload, 'keyName');
    if (keyName === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'keyName is required for createKey.',
      };
    }
    const externalRef: ExternalObjectRef = {
      sorName: 'VaultSuite',
      portFamily: 'SecretsVaulting',
      externalId: `key-${++this.#keySequence}`,
      externalType: 'crypto_key',
      displayLabel: keyName,
    };
    this.#keys.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #setSecretPolicy(input: SecretsVaultingExecuteInputV1): SecretsVaultingExecuteOutputV1 {
    const path = readString(input.payload, 'path');
    if (path === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'path is required for setSecretPolicy.',
      };
    }
    const policy = readString(input.payload, 'policy');
    if (policy === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'policy is required for setSecretPolicy.',
      };
    }
    void policy;

    const externalRef: ExternalObjectRef = {
      sorName: 'VaultSuite',
      portFamily: 'SecretsVaulting',
      externalId: `policy-${++this.#policySequence}`,
      externalType: 'secret_policy',
      displayLabel: `Policy set for ${path}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #listTenantRefs(
    source: readonly TenantExternalRef[],
    input: SecretsVaultingExecuteInputV1,
  ): readonly ExternalObjectRef[] {
    return source
      .filter((item) => item.tenantId === input.tenantId)
      .map((item) => item.externalRef);
  }

  #getTenantRef(
    input: SecretsVaultingExecuteInputV1,
    source: readonly TenantExternalRef[],
    key: string,
    label: string,
    operationName: string,
  ): SecretsVaultingExecuteOutputV1 {
    const externalId = readString(input.payload, key);
    if (externalId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: `${key} is required for ${operationName}.`,
      };
    }
    const item = source.find(
      (candidate) =>
        candidate.tenantId === input.tenantId && candidate.externalRef.externalId === externalId,
    );
    if (item === undefined) {
      return { ok: false, error: 'not_found', message: `${label} ${externalId} was not found.` };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef: item.externalRef } };
  }

  public static seedMinimal(
    tenantId: SecretsVaultingExecuteInputV1['tenantId'],
  ): InMemorySecretsVaultingAdapterSeed {
    return {
      secrets: [
        {
          tenantId,
          path: 'secret/app/api-key',
          externalRef: {
            sorName: 'VaultSuite',
            portFamily: 'SecretsVaulting',
            externalId: 'secret-1000',
            externalType: 'secret_version',
            displayLabel: 'secret/app/api-key',
          },
        },
      ],
      certificates: [
        {
          tenantId,
          externalRef: {
            sorName: 'VaultSuite',
            portFamily: 'SecretsVaulting',
            externalId: 'cert-1000',
            externalType: 'certificate',
            displayLabel: 'api.portarium.local',
          },
        },
      ],
      keys: [
        {
          tenantId,
          externalRef: {
            sorName: 'VaultSuite',
            portFamily: 'SecretsVaulting',
            externalId: 'key-1000',
            externalType: 'crypto_key',
            displayLabel: 'default-signing-key',
          },
        },
      ],
      auditLogs: [
        {
          tenantId,
          externalRef: {
            sorName: 'VaultSuite',
            portFamily: 'SecretsVaulting',
            externalId: 'audit-1000',
            externalType: 'audit_log',
            displayLabel: 'Secret read operation',
          },
        },
      ],
    };
  }
}
