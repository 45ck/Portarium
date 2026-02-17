import type { TenantId } from '../../domain/primitives/index.js';

export type IdempotencyKey = Readonly<{
  tenantId: TenantId;
  commandName: string;
  requestKey: string;
}>;

export interface IdempotencyStore {
  get<T>(key: IdempotencyKey): Promise<T | null>;
  set<T>(key: IdempotencyKey, value: T): Promise<void>;
}
