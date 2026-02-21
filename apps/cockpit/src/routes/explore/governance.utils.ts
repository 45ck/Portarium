import type { EvidenceEntry, PolicySummary } from '@portarium/cockpit-types';

export type GovernancePolicy = PolicySummary & {
  tier?: string;
  scope?: string;
  ruleCount?: number;
  affectedWorkflowIds?: string[];
};

export type GovernanceAuditFilter =
  | 'all'
  | 'PolicyViolation'
  | 'Policy'
  | 'Approval'
  | 'Action'
  | 'Plan'
  | 'System';

function inferScopeFromConditions(policy: PolicySummary): string {
  const families = Array.from(
    new Set(
      policy.conditions
        .map((condition) => condition.field.split('.')[0]?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return families.length > 0 ? families.join(', ') : 'Global';
}

export function getPolicyTier(policy: GovernancePolicy): string {
  return policy.tier ?? 'Unspecified';
}

export function getPolicyScope(policy: GovernancePolicy): string {
  return policy.scope ?? inferScopeFromConditions(policy);
}

export function getRuleCount(policy: GovernancePolicy): number {
  return policy.ruleCount ?? policy.conditions.length;
}

export function getAffectedWorkflowIds(policy: GovernancePolicy): string[] {
  return policy.affectedWorkflowIds ?? [];
}

export function normalizeAuditCategory(entry: EvidenceEntry): GovernanceAuditFilter {
  const rawCategory = String((entry as { category: string }).category);
  if (rawCategory === 'PolicyViolation') return 'PolicyViolation';

  if (rawCategory === 'Policy') {
    const normalized = entry.summary.toLowerCase();
    if (
      normalized.includes('violation') ||
      normalized.includes('deny') ||
      normalized.includes('denied') ||
      normalized.includes('blocked')
    ) {
      return 'PolicyViolation';
    }
  }

  if (
    rawCategory === 'Policy' ||
    rawCategory === 'Approval' ||
    rawCategory === 'Action' ||
    rawCategory === 'Plan' ||
    rawCategory === 'System'
  ) {
    return rawCategory;
  }

  return 'System';
}

export function filterAuditEntries(
  entries: EvidenceEntry[],
  filter: GovernanceAuditFilter,
): EvidenceEntry[] {
  if (filter === 'all') return entries;
  return entries.filter((entry) => normalizeAuditCategory(entry) === filter);
}
