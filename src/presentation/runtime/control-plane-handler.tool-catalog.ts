/**
 * Tool catalog HTTP handlers for the control-plane runtime.
 *
 * Endpoints:
 *   GET /v1/workspaces/:workspaceId/tool-catalog
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { TraceContext } from '../../application/common/trace-context.js';
import type { ToolCatalogSourceTool } from '../../application/ports/tool-catalog-source.js';
import type { ExecutionTier } from '../../domain/primitives/index.js';
import {
  classifyOpenClawToolBlastRadiusV1,
  type OpenClawToolRiskCategoryV1,
} from '../../domain/machines/openclaw-tool-blast-radius-v1.js';
import { MCP_TOOLS } from '../../infrastructure/mcp/mcp-tool-schemas.js';
import {
  type ControlPlaneDeps,
  GENERIC_DEPENDENCY_FAILURE_DETAIL,
  PROBLEM_TYPES,
  assertReadAccess,
  assertWorkspaceScope,
  authenticate,
  checkIfNoneMatch,
  computeETag,
  problemFromError,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';

type ToolCatalogArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  traceContext: TraceContext;
  workspaceId: string;
}>;

export type ToolCatalogRecommendedDecision = 'allow' | 'sandbox' | 'approval' | 'deny';

export type ToolCatalogItem = Readonly<{
  schemaVersion: 1;
  toolId: string;
  toolName: string;
  label: string;
  provider: string;
  description: string;
  source: 'portarium-mcp' | string;
  actionClass: string;
  riskCategory: OpenClawToolRiskCategoryV1;
  minimumExecutionTier: ExecutionTier;
  recommendedDecision: ToolCatalogRecommendedDecision;
  inputSchema: Record<string, unknown>;
}>;

export type ToolCatalogResponse = Readonly<{
  schemaVersion: 1;
  workspaceId: string;
  issuedAtIso: string;
  items: readonly ToolCatalogItem[];
}>;

export async function handleListToolCatalog(args: ToolCatalogArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId } = args;

  const auth = await authenticate(deps, {
    req,
    correlationId,
    traceContext,
    expectedWorkspaceId: workspaceId,
  });
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }

  const scopeCheck = assertWorkspaceScope(auth.ctx, workspaceId, deps.authEventLogger);
  if (!scopeCheck.ok) {
    respondProblem(res, problemFromError(scopeCheck.error, pathname), correlationId, traceContext);
    return;
  }

  const readAccess = await assertReadAccess(deps, auth.ctx);
  if (!readAccess.ok) {
    respondProblem(res, problemFromError(readAccess.error, pathname), correlationId, traceContext);
    return;
  }

  let contributedTools: readonly ToolCatalogSourceTool[] = [];
  if (deps.toolCatalogSource) {
    try {
      contributedTools = await deps.toolCatalogSource.listTools({
        workspaceId,
        tenantId: String(auth.ctx.tenantId),
        principalId: String(auth.ctx.principalId),
        roles: auth.ctx.roles,
      });
    } catch {
      respondProblem(
        res,
        {
          type: PROBLEM_TYPES.serviceUnavailable,
          title: 'Service Unavailable',
          status: 503,
          detail: GENERIC_DEPENDENCY_FAILURE_DETAIL,
          instance: pathname,
        },
        correlationId,
        traceContext,
      );
      return;
    }
  }

  const body = buildToolCatalogResponse(workspaceId, deps.clock?.() ?? new Date(), contributedTools);
  const etag = computeETag(body);
  res.setHeader('ETag', etag);
  if (checkIfNoneMatch(req, etag)) {
    res.statusCode = 304;
    res.setHeader('x-correlation-id', correlationId);
    res.end();
    return;
  }

  respondJson(res, { statusCode: 200, correlationId, traceContext, body });
}

export function buildToolCatalogResponse(
  workspaceId: string,
  issuedAt: Date,
  contributedTools: readonly ToolCatalogSourceTool[] = [],
): ToolCatalogResponse {
  return {
    schemaVersion: 1,
    workspaceId,
    issuedAtIso: issuedAt.toISOString(),
    items: uniqueByToolName([
      ...MCP_TOOLS.map(toolCatalogItemFromMcpTool),
      ...contributedTools.map(toolCatalogItemFromSourceTool),
    ]),
  };
}

function toolCatalogItemFromMcpTool(tool: (typeof MCP_TOOLS)[number]): ToolCatalogItem {
  const risk = classifyOpenClawToolBlastRadiusV1(tool.name);
  return {
    schemaVersion: 1,
    toolId: `portarium-mcp:${tool.name}`,
    toolName: tool.name,
    label: labelForToolName(tool.name),
    provider: 'Portarium MCP',
    description: tool.description,
    source: 'portarium-mcp',
    actionClass: actionClassForRisk(risk.category),
    riskCategory: risk.category,
    minimumExecutionTier: risk.minimumTier,
    recommendedDecision: recommendedDecisionForTier(risk.minimumTier),
    inputSchema: tool.inputSchema,
  };
}

function toolCatalogItemFromSourceTool(tool: ToolCatalogSourceTool): ToolCatalogItem {
  const risk = classifyOpenClawToolBlastRadiusV1(tool.toolName);
  const riskCategory = tool.riskCategory ?? risk.category;
  const minimumExecutionTier = tool.minimumExecutionTier ?? risk.minimumTier;
  return {
    schemaVersion: 1,
    toolId: tool.toolId ?? `${tool.source}:${tool.toolName}`,
    toolName: tool.toolName,
    label: tool.label ?? labelForToolName(tool.toolName),
    provider: tool.provider,
    description: tool.description ?? '',
    source: tool.source,
    actionClass: tool.actionClass ?? actionClassForRisk(riskCategory),
    riskCategory,
    minimumExecutionTier,
    recommendedDecision: tool.recommendedDecision ?? recommendedDecisionForTier(minimumExecutionTier),
    inputSchema: tool.inputSchema ?? { type: 'object', additionalProperties: true },
  };
}

function uniqueByToolName(items: readonly ToolCatalogItem[]): readonly ToolCatalogItem[] {
  const seen = new Set<string>();
  const unique: ToolCatalogItem[] = [];
  for (const item of items) {
    if (seen.has(item.toolName)) continue;
    seen.add(item.toolName);
    unique.push(item);
  }
  return unique;
}

function actionClassForRisk(category: OpenClawToolRiskCategoryV1): string {
  switch (category) {
    case 'ReadOnly':
      return 'local-status';
    case 'Mutation':
    case 'Dangerous':
      return 'external-executor';
    case 'Unknown':
      return 'approval-draft';
  }
}

function recommendedDecisionForTier(tier: ExecutionTier): ToolCatalogRecommendedDecision {
  switch (tier) {
    case 'Auto':
      return 'allow';
    case 'Assisted':
      return 'sandbox';
    case 'HumanApprove':
      return 'approval';
    case 'ManualOnly':
      return 'deny';
  }
}

function labelForToolName(toolName: string): string {
  return toolName
    .replace(/^portarium_/, '')
    .split(/[_:.-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
