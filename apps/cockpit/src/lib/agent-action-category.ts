import type { AgentActionProposalMeta } from '@portarium/cockpit-types';

export type AgentActionCategoryVariant = 'secondary' | 'warning' | 'destructive' | 'outline';

export interface AgentActionCategoryPresentation {
  label: string;
  variant: AgentActionCategoryVariant;
  guidance: string;
  isUnclassified: boolean;
}

const CATEGORY_PRESENTATION: Record<
  AgentActionProposalMeta['toolCategory'],
  AgentActionCategoryPresentation
> = {
  ReadOnly: {
    label: 'Read-only',
    variant: 'secondary',
    guidance: 'Read-only tools should not change external systems.',
    isUnclassified: false,
  },
  Mutation: {
    label: 'Mutation',
    variant: 'warning',
    guidance: 'Mutation tools will change a connected system or artifact.',
    isUnclassified: false,
  },
  Dangerous: {
    label: 'Dangerous',
    variant: 'destructive',
    guidance: 'Dangerous tools can create broad or hard-to-reverse impact.',
    isUnclassified: false,
  },
  Unknown: {
    label: 'Unclassified',
    variant: 'outline',
    guidance:
      'The backend did not match this tool to a known category; review the tool name, tier, rationale, and evidence before approving.',
    isUnclassified: true,
  },
};

export function getAgentActionCategoryPresentation(
  category: AgentActionProposalMeta['toolCategory'] | string | null | undefined,
): AgentActionCategoryPresentation {
  if (!category || !(category in CATEGORY_PRESENTATION)) {
    return CATEGORY_PRESENTATION.Unknown;
  }

  return CATEGORY_PRESENTATION[category as AgentActionProposalMeta['toolCategory']];
}
