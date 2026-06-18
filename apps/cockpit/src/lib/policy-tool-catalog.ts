import type { ToolCatalogItem } from '@portarium/cockpit-types';
import type {
  PolicyControllerDecision,
  PolicyControllerToolRoute,
} from '@/lib/policy-controller-draft';

export const RUNTIME_TOOL_ROUTE_SEEDS: readonly PolicyControllerToolRoute[] = [
  {
    id: 'seed-control-plane-status',
    label: 'Control Plane status',
    toolName: 'control-plane.status',
    provider: 'Portarium',
    actionClass: 'local-status',
    currentDecision: 'allow',
    decision: 'allow',
    description: 'Health and policy status reads.',
    riskCategory: 'ReadOnly',
    minimumExecutionTier: 'Auto',
    source: 'runtime-seed',
  },
  {
    id: 'seed-context-pack',
    label: 'Context summary builder',
    toolName: 'openclaw.context_pack.build',
    provider: 'Gateway',
    actionClass: 'context-pack',
    currentDecision: 'allow',
    decision: 'allow',
    description: 'Builds a summary from approved evidence pointers.',
    riskCategory: 'ReadOnly',
    minimumExecutionTier: 'Auto',
    source: 'runtime-seed',
  },
  {
    id: 'seed-browser-read',
    label: 'Governed browser read',
    toolName: 'openclaw.browser.query',
    provider: 'Gateway',
    actionClass: 'browser-query',
    currentDecision: 'allow',
    decision: 'allow',
    description: 'Runs a narrow browser read through a governed gateway.',
    riskCategory: 'ReadOnly',
    minimumExecutionTier: 'Auto',
    source: 'runtime-seed',
  },
  {
    id: 'seed-standing-email-read',
    label: 'Standing email read',
    toolName: 'calvin.standing_cloud_browser_query',
    provider: 'Gateway bridge',
    actionClass: 'standing-read',
    currentDecision: 'allow',
    decision: 'allow',
    description: 'One-at-a-time approved source read through a private bridge.',
    riskCategory: 'ReadOnly',
    minimumExecutionTier: 'Auto',
    source: 'runtime-seed',
  },
  {
    id: 'seed-approval-draft',
    label: 'Approval card draft',
    toolName: 'approval_card.draft',
    provider: 'Approval flow',
    actionClass: 'approval-draft',
    currentDecision: 'allow',
    decision: 'allow',
    description: 'Creates a review packet without executing the requested action.',
    riskCategory: 'ReadOnly',
    minimumExecutionTier: 'Auto',
    source: 'runtime-seed',
  },
  {
    id: 'seed-live-change',
    label: 'Live change invoke',
    toolName: 'tools.invoke.external',
    provider: 'Executor gate',
    actionClass: 'external-executor',
    currentDecision: 'deny',
    decision: 'deny',
    description: 'Calls a tool that can change an external or live system.',
    riskCategory: 'Dangerous',
    minimumExecutionTier: 'ManualOnly',
    source: 'runtime-seed',
  },
];

export function toolCatalogRoutesFromItems(
  items: readonly ToolCatalogItem[],
): readonly PolicyControllerToolRoute[] {
  return items.map((item) => ({
    id: catalogRouteId(item),
    label: item.label,
    toolName: item.toolName,
    provider: item.provider,
    actionClass: item.actionClass,
    currentDecision: item.recommendedDecision,
    decision: item.recommendedDecision,
    description: item.description,
    riskCategory: item.riskCategory,
    minimumExecutionTier: item.minimumExecutionTier,
    source: 'catalog',
  }));
}

export function mergeCatalogToolRoutes(
  catalogRoutes: readonly PolicyControllerToolRoute[],
  currentRoutes: readonly PolicyControllerToolRoute[],
): PolicyControllerToolRoute[] {
  if (catalogRoutes.length === 0) return [...currentRoutes];

  const currentById = new Map(currentRoutes.map((tool) => [tool.id, tool]));
  const nonCatalogCurrentByToolName = new Map(
    currentRoutes.filter((tool) => tool.source !== 'catalog').map((tool) => [tool.toolName, tool]),
  );
  const mergedCurrentIds = new Set<string>();
  const catalogToolNames = new Set(catalogRoutes.map((tool) => tool.toolName));
  const mergedCatalogRoutes = catalogRoutes.map((tool) => {
    const existing = currentById.get(tool.id) ?? nonCatalogCurrentByToolName.get(tool.toolName);
    if (!existing) return tool;
    mergedCurrentIds.add(existing.id);
    return {
      ...tool,
      currentDecision: existing.currentDecision,
      decision: existing.decision,
    };
  });

  const localOnlyRoutes = currentRoutes.filter(
    (tool) => !mergedCurrentIds.has(tool.id) && !catalogToolNames.has(tool.toolName),
  );
  return [...mergedCatalogRoutes, ...localOnlyRoutes];
}

export function decisionForCatalogRisk(
  riskCategory: ToolCatalogItem['riskCategory'],
): PolicyControllerDecision {
  switch (riskCategory) {
    case 'ReadOnly':
      return 'allow';
    case 'Mutation':
    case 'Unknown':
      return 'approval';
    case 'Dangerous':
      return 'deny';
  }
}

function catalogRouteId(item: ToolCatalogItem): string {
  const slug =
    (item.toolId || `${item.source}:${item.provider}:${item.toolName}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || item.toolId;
  return `catalog-${slug}`;
}
