import { afterEach, describe, expect, it } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { err, ok } from '../../application/common/result.js';
import { TenantId } from '../../domain/primitives/index.js';
import { MCP_TOOLS } from '../../infrastructure/mcp/mcp-tool-schemas.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';

let handle: HealthServerHandle | undefined;

const WORKSPACE_ID = 'workspace-1';
const NOW = '2026-05-01T00:00:00.000Z';

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

function makeCtx() {
  return toAppContext({
    tenantId: TenantId(WORKSPACE_ID),
    principalId: 'user-admin',
    roles: ['admin'],
    correlationId: 'corr-tool-catalog-contract',
  });
}

async function startServer(unauthorized = false, overrides: Record<string, unknown> = {}) {
  const deps = {
    authentication: {
      authenticateBearerToken: async () =>
        unauthorized
          ? err({ kind: 'Unauthorized' as const, message: 'Missing token.' })
          : ok(makeCtx()),
    },
    authorization: { isAllowed: async () => true },
    workspaceStore: {
      getWorkspaceById: async () => null,
      getWorkspaceByName: async () => null,
      saveWorkspace: async () => undefined,
    },
    runStore: {
      getRunById: async () => null,
      saveRun: async () => undefined,
    },
    clock: () => new Date(NOW),
    ...overrides,
  };

  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(
      deps as unknown as Parameters<typeof createControlPlaneHandler>[0],
    ),
  });
}

function url(path: string): string {
  return `http://${handle!.host}:${handle!.port}${path}`;
}

function workspacePath(path: string): string {
  return `/v1/workspaces/${WORKSPACE_ID}${path}`;
}

describe('tool catalog runtime contract route', () => {
  it('lists registered MCP tools with policy defaults', async () => {
    await startServer();

    const res = await fetch(url(workspacePath('/tool-catalog')));

    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBeTruthy();
    const body = (await res.json()) as {
      schemaVersion: number;
      workspaceId: string;
      issuedAtIso: string;
      items: Array<{
        toolName: string;
        source: string;
        actionClass: string;
        riskCategory: string;
        minimumExecutionTier: string;
        recommendedDecision: string;
      }>;
    };
    expect(body).toMatchObject({
      schemaVersion: 1,
      workspaceId: WORKSPACE_ID,
      issuedAtIso: NOW,
    });
    expect(body.items).toHaveLength(MCP_TOOLS.length);

    expect(body.items.find((item) => item.toolName === 'portarium_run_get')).toMatchObject({
      source: 'portarium-mcp',
      actionClass: 'local-status',
      riskCategory: 'ReadOnly',
      minimumExecutionTier: 'Auto',
      recommendedDecision: 'allow',
    });
    expect(body.items.find((item) => item.toolName === 'portarium_run_start')).toMatchObject({
      source: 'portarium-mcp',
      actionClass: 'external-executor',
      riskCategory: 'Mutation',
      minimumExecutionTier: 'HumanApprove',
      recommendedDecision: 'approval',
    });
  });

  it('returns 401 when unauthenticated', async () => {
    await startServer(true);

    const res = await fetch(url(workspacePath('/tool-catalog')));

    expect(res.status).toBe(401);
  });

  it('merges connector-contributed tools without overriding registered MCP tools', async () => {
    await startServer(false, {
      toolCatalogSource: {
        listTools: async (input: { workspaceId: string }) => {
          expect(input.workspaceId).toBe(WORKSPACE_ID);
          return [
            {
              toolName: 'gmail.message.send',
              label: 'Gmail Send',
              provider: 'Gmail',
              description: 'Send an approved Gmail draft.',
              source: 'gmail-connector',
              inputSchema: { type: 'object' },
            },
            {
              toolName: 'portarium_run_get',
              label: 'Shadow Run Get',
              provider: 'Shadow',
              description: 'This duplicate must not replace the MCP registry entry.',
              source: 'shadow-provider',
            },
          ];
        },
      },
    });

    const res = await fetch(url(workspacePath('/tool-catalog')));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{
        toolName: string;
        label: string;
        provider: string;
        source: string;
        riskCategory: string;
        recommendedDecision: string;
      }>;
    };
    expect(body.items).toHaveLength(MCP_TOOLS.length + 1);
    expect(body.items.find((item) => item.toolName === 'gmail.message.send')).toMatchObject({
      label: 'Gmail Send',
      provider: 'Gmail',
      source: 'gmail-connector',
      riskCategory: 'Mutation',
      recommendedDecision: 'approval',
    });
    expect(body.items.find((item) => item.toolName === 'portarium_run_get')).toMatchObject({
      label: 'Run Get',
      provider: 'Portarium MCP',
      source: 'portarium-mcp',
    });
  });

  it('fails closed when the connector catalog source is unavailable', async () => {
    await startServer(false, {
      toolCatalogSource: {
        listTools: async () => {
          throw new Error('catalog source unavailable');
        },
      },
    });

    const res = await fetch(url(workspacePath('/tool-catalog')));

    expect(res.status).toBe(503);
  });
});
