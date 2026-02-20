import type { AppContext } from '../../application/common/context.js';
import { isAllowedWorkspaceAction } from '../../application/iam/rbac/workspace-rbac.js';

/**
 * Resource-scoped actions that extend beyond workspace-level RBAC.
 * These map to OpenFGA relations on specific resource objects.
 */
export type ResourceAction =
  | 'agent:register'
  | 'agent:read'
  | 'machine:control'
  | 'machine:read'
  | 'run:create'
  | 'run:read'
  | 'run:cancel';

export type ResourceType = 'agent' | 'machine' | 'run';

export type ResourceCheckInput = Readonly<{
  resourceType: ResourceType;
  resourceId: string;
  action: ResourceAction;
}>;

export type OpenFgaResourceAuthorizationConfig = Readonly<{
  apiUrl: string;
  storeId: string;
  authorizationModelId?: string;
  apiToken?: string;
  fetchImpl?: typeof fetch;
}>;

type OpenFgaCheckResponse = Readonly<{
  allowed?: boolean;
}>;

function normalizeBaseUrl(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, '');
}

function toRelation(action: ResourceAction): string {
  return action.replace(/[^A-Za-z0-9_]/g, '_');
}

function toObjectRef(input: ResourceCheckInput, workspaceId: string): string {
  return `${input.resourceType}:${workspaceId}/${input.resourceId}`;
}

function asAllowed(response: unknown): boolean {
  if (typeof response !== 'object' || response === null) return false;
  return (response as OpenFgaCheckResponse).allowed === true;
}

/**
 * Maps resource actions to the workspace-level RBAC action required as a prerequisite.
 * If a resource action has no workspace-level prerequisite, it returns undefined.
 */
function resourceActionToWorkspaceAction(
  action: ResourceAction,
): 'workspace:register' | 'run:start' | 'run:read' | undefined {
  switch (action) {
    case 'agent:register':
    case 'machine:control':
      return 'workspace:register';
    case 'run:create':
      return 'run:start';
    case 'agent:read':
    case 'machine:read':
    case 'run:read':
      return 'run:read';
    case 'run:cancel':
      return 'run:start';
  }
}

/**
 * Resource-level authorization that combines workspace RBAC with OpenFGA
 * fine-grained checks.
 *
 * Flow:
 * 1. Check workspace-level RBAC (fast, local)
 * 2. Check OpenFGA resource-level relation (remote)
 */
export class OpenFgaResourceAuthorization {
  readonly #apiUrl: string;
  readonly #storeId: string;
  readonly #authorizationModelId: string | undefined;
  readonly #apiToken: string | undefined;
  readonly #fetchImpl: typeof fetch;

  public constructor(config: OpenFgaResourceAuthorizationConfig) {
    this.#apiUrl = normalizeBaseUrl(config.apiUrl);
    this.#storeId = config.storeId;
    this.#authorizationModelId = config.authorizationModelId;
    this.#apiToken = config.apiToken;
    this.#fetchImpl = config.fetchImpl ?? fetch;
  }

  public async isAllowedOnResource(
    ctx: AppContext,
    input: ResourceCheckInput,
  ): Promise<boolean> {
    const workspaceAction = resourceActionToWorkspaceAction(input.action);
    if (workspaceAction && !isAllowedWorkspaceAction({ roles: ctx.roles }, workspaceAction)) {
      return false;
    }

    const endpoint = `${this.#apiUrl}/stores/${encodeURIComponent(this.#storeId)}/check`;
    const payload = {
      tuple_key: {
        user: `user:${ctx.principalId}`,
        relation: toRelation(input.action),
        object: toObjectRef(input, ctx.tenantId.toString()),
      },
      ...(this.#authorizationModelId
        ? { authorization_model_id: this.#authorizationModelId }
        : {}),
    };

    try {
      const response = await this.#fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.#apiToken ? { authorization: `Bearer ${this.#apiToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        return false;
      }
      const body = await response.json();
      return asAllowed(body);
    } catch {
      return false;
    }
  }
}
