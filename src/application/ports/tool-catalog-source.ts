import type { ExecutionTier } from '../../domain/primitives/index.js';

export type ToolCatalogRiskCategory = 'ReadOnly' | 'Mutation' | 'Dangerous' | 'Unknown';
export type ToolCatalogRecommendedDecision = 'allow' | 'sandbox' | 'approval' | 'deny';

export type ToolCatalogSourceTool = Readonly<{
  toolId?: string;
  toolName: string;
  label?: string;
  provider: string;
  description?: string;
  source: string;
  actionClass?: string;
  riskCategory?: ToolCatalogRiskCategory;
  minimumExecutionTier?: ExecutionTier;
  recommendedDecision?: ToolCatalogRecommendedDecision;
  inputSchema?: Record<string, unknown>;
}>;

export type ToolCatalogSourceListInput = Readonly<{
  workspaceId: string;
  tenantId: string;
  principalId: string;
  roles: readonly string[];
}>;

export type ToolCatalogSourcePort = Readonly<{
  listTools(input: ToolCatalogSourceListInput): Promise<readonly ToolCatalogSourceTool[]>;
}>;
