import { describe, expect, it } from 'vitest';
import type { ToolCatalogItem } from '@portarium/cockpit-types';
import {
  decisionForCatalogRisk,
  mergeCatalogToolRoutes,
  toolCatalogRoutesFromItems,
} from './policy-tool-catalog';

const CATALOG_TOOL: ToolCatalogItem = {
  schemaVersion: 1,
  toolId: 'portarium-mcp:portarium_run_start',
  toolName: 'portarium_run_start',
  label: 'Run Start',
  provider: 'Portarium MCP',
  description: 'Start a new workflow run in a workspace.',
  source: 'portarium-mcp',
  actionClass: 'external-executor',
  riskCategory: 'Mutation',
  minimumExecutionTier: 'HumanApprove',
  recommendedDecision: 'approval',
  inputSchema: { type: 'object' },
};

describe('policy-tool-catalog', () => {
  it('maps catalog items into policy-controller tool routes', () => {
    const routes = toolCatalogRoutesFromItems([CATALOG_TOOL]);

    expect(routes).toEqual([
      {
        id: 'catalog-portarium-run-start',
        label: 'Run Start',
        toolName: 'portarium_run_start',
        provider: 'Portarium MCP',
        actionClass: 'external-executor',
        currentDecision: 'approval',
        decision: 'approval',
        description: 'Start a new workflow run in a workspace.',
        riskCategory: 'Mutation',
        source: 'catalog',
      },
    ]);
  });

  it('merges catalog routes while preserving local decisions and seed rows', () => {
    const catalogRoutes = toolCatalogRoutesFromItems([CATALOG_TOOL]);
    const merged = mergeCatalogToolRoutes(catalogRoutes, [
      {
        ...catalogRoutes[0]!,
        currentDecision: 'deny',
        decision: 'deny',
      },
      {
        id: 'seed-standing-email-read',
        label: 'Standing email read',
        toolName: 'calvin.standing_cloud_browser_query',
        provider: 'Gateway bridge',
        actionClass: 'standing-read',
        currentDecision: 'allow',
        decision: 'allow',
        source: 'runtime-seed',
      },
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      toolName: 'portarium_run_start',
      currentDecision: 'deny',
      decision: 'deny',
      source: 'catalog',
    });
    expect(merged[1]).toMatchObject({
      toolName: 'calvin.standing_cloud_browser_query',
      source: 'runtime-seed',
    });
  });

  it.each([
    ['ReadOnly', 'allow'],
    ['Mutation', 'approval'],
    ['Unknown', 'approval'],
    ['Dangerous', 'deny'],
  ] as const)('maps %s risk to a fallback %s decision', (riskCategory, decision) => {
    expect(decisionForCatalogRisk(riskCategory)).toBe(decision);
  });
});
