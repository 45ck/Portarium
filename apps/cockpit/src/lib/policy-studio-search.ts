export const EXECUTION_TIER_VALUES = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;

export type ExecutionTier = (typeof EXECUTION_TIER_VALUES)[number];

export interface PolicyStudioSearch {
  slice?: string;
  precedent?: string;
  scenario?: string;
  draftTier?: ExecutionTier;
  draftEvidence?: string;
  draftRationale?: string;
}

export interface PolicyStudioReturnSearch {
  returnSlice?: string;
  returnPrecedent?: string;
  returnScenario?: string;
  returnDraftTier?: ExecutionTier;
  returnDraftEvidence?: string;
  returnDraftRationale?: string;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

export function parseExecutionTier(value: unknown): ExecutionTier | undefined {
  return typeof value === 'string' && EXECUTION_TIER_VALUES.includes(value as ExecutionTier)
    ? (value as ExecutionTier)
    : undefined;
}

export function parseDelimitedSearchList(value: unknown): string[] | undefined {
  const raw = readString(value);
  if (!raw) return undefined;

  const items = raw
    .split('||')
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}

export function serializeDelimitedSearchList(items: string[]): string | undefined {
  return items.length > 0 ? items.join('||') : undefined;
}

export function validatePolicyStudioSearch(search: Record<string, unknown>): PolicyStudioSearch {
  return {
    slice: readString(search.slice),
    precedent: readString(search.precedent),
    scenario: readString(search.scenario),
    draftTier: parseExecutionTier(search.draftTier),
    draftEvidence: readString(search.draftEvidence),
    draftRationale: readString(search.draftRationale),
  };
}

export function validatePolicyStudioReturnSearch(
  search: Record<string, unknown>,
): PolicyStudioReturnSearch {
  return {
    returnSlice: readString(search.returnSlice),
    returnPrecedent: readString(search.returnPrecedent),
    returnScenario: readString(search.returnScenario),
    returnDraftTier: parseExecutionTier(search.returnDraftTier),
    returnDraftEvidence: readString(search.returnDraftEvidence),
    returnDraftRationale: readString(search.returnDraftRationale),
  };
}

export function toApprovalReturnSearch(search: PolicyStudioSearch): PolicyStudioReturnSearch {
  return {
    returnSlice: search.slice,
    returnPrecedent: search.precedent,
    returnScenario: search.scenario,
    returnDraftTier: search.draftTier,
    returnDraftEvidence: search.draftEvidence,
    returnDraftRationale: search.draftRationale,
  };
}

export function fromApprovalReturnSearch(search: PolicyStudioReturnSearch): PolicyStudioSearch {
  return {
    slice: search.returnSlice,
    precedent: search.returnPrecedent,
    scenario: search.returnScenario,
    draftTier: search.returnDraftTier,
    draftEvidence: search.returnDraftEvidence,
    draftRationale: search.returnDraftRationale,
  };
}
