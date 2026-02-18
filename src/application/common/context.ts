import {
  CorrelationId,
  TenantId,
  UserId,
  isWorkspaceUserRole,
  type CorrelationId as CorrelationIdType,
  type TenantId as TenantIdType,
  type UserId as UserIdType,
  type WorkspaceUserRole,
} from '../../domain/primitives/index.js';

export type AppContext = Readonly<{
  tenantId: TenantIdType;
  principalId: UserIdType;
  roles: readonly WorkspaceUserRole[];
  scopes: readonly string[];
  correlationId: CorrelationIdType;
}>;

export const DEFAULT_SCOPES: readonly string[] = [];

function normalizeRoles(roles: readonly string[] | undefined): readonly WorkspaceUserRole[] {
  if (!roles || roles.length === 0) return [];

  const seen = new Set<string>();
  const out: WorkspaceUserRole[] = [];

  for (const raw of roles) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    if (value === '') continue;
    if (!isWorkspaceUserRole(value)) continue; // deny-by-default for unknown roles
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
}

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
  roles: normalizeRoles(roles),
  scopes: [...scopes],
  correlationId: CorrelationId(correlationId),
});
