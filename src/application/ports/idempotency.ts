import type { TenantId } from '../../domain/primitives/index.js';

export type IdempotencyKey = Readonly<{
  tenantId: TenantId;
  commandName: string;
  requestKey: string;
}>;

export type IdempotencyReservationBeginInput = Readonly<{
  fingerprint: string;
  reservedAtIso: string;
  leaseExpiresAtIso?: string;
}>;

export type IdempotencyReservationCompleteInput<T> = Readonly<{
  fingerprint: string;
  completedAtIso: string;
  value: T;
}>;

export type IdempotencyReservationReleaseInput = Readonly<{
  fingerprint: string;
  releasedAtIso: string;
  reason: string;
}>;

export type IdempotencyReservationBeginResult =
  | Readonly<{ status: 'Began' }>
  | Readonly<{ status: 'InProgress'; fingerprint: string; leaseExpiresAtIso?: string }>
  | Readonly<{ status: 'Completed'; fingerprint: string; value: unknown }>
  | Readonly<{ status: 'Conflict'; fingerprint?: string }>;

export interface IdempotencyStore {
  get<T>(key: IdempotencyKey): Promise<T | null>;
  set<T>(key: IdempotencyKey, value: T): Promise<void>;
  begin?(
    key: IdempotencyKey,
    input: IdempotencyReservationBeginInput,
  ): Promise<IdempotencyReservationBeginResult>;
  complete?<T>(
    key: IdempotencyKey,
    input: IdempotencyReservationCompleteInput<T>,
  ): Promise<boolean>;
  release?(key: IdempotencyKey, input: IdempotencyReservationReleaseInput): Promise<boolean>;
}
