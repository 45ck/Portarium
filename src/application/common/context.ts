import {
  CorrelationId,
  TenantId,
  UserId,
  type CorrelationId as CorrelationIdType,
  type TenantId as TenantIdType,
  type UserId as UserIdType,
} from '../../domain/primitives/index.js';

export type AppContext = Readonly<{
  tenantId: TenantIdType;
  principalId: UserIdType;
  roles: readonly string[];
  scopes: readonly string[];
  correlationId: CorrelationIdType;
}>;

export const DEFAULT_SCOPES: readonly string[] = [];

export const toAppContext = ({
  tenantId,
  principalId,
  roles = [],
  scopes = [],
  correlationId,
}: {
  tenantId: string;
  principalId: string;
  roles?: readonly string[];
  scopes?: readonly string[];
  correlationId: string;
}): AppContext => ({
  tenantId: TenantId(tenantId),
  principalId: UserId(principalId),
  roles: [...roles],
  scopes: [...scopes],
  correlationId: CorrelationId(correlationId),
});
