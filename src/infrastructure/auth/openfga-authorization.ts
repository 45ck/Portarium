import type { AppAction } from '../../application/common/actions.js';
import type { AppContext } from '../../application/common/context.js';
import { isAllowedWorkspaceAction } from '../../application/iam/rbac/workspace-rbac.js';
import type { AuthorizationPort } from '../../application/ports/authorization.js';

export type OpenFgaAuthorizationConfig = Readonly<{
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

function toRelation(action: AppAction): string {
  return action.replace(/[^A-Za-z0-9_]/g, '_');
}

function asAllowed(response: unknown): boolean {
  if (typeof response !== 'object' || response === null) return false;
  return (response as OpenFgaCheckResponse).allowed === true;
}

export class OpenFgaAuthorization implements AuthorizationPort {
  readonly #apiUrl: string;
  readonly #storeId: string;
  readonly #authorizationModelId: string | undefined;
  readonly #apiToken: string | undefined;
  readonly #fetchImpl: typeof fetch;

  public constructor(config: OpenFgaAuthorizationConfig) {
    this.#apiUrl = normalizeBaseUrl(config.apiUrl);
    this.#storeId = config.storeId;
    this.#authorizationModelId = config.authorizationModelId;
    this.#apiToken = config.apiToken;
    this.#fetchImpl = config.fetchImpl ?? fetch;
  }

  public async isAllowed(ctx: AppContext, action: AppAction): Promise<boolean> {
    if (!isAllowedWorkspaceAction({ roles: ctx.roles }, action)) {
      return false;
    }

    const endpoint = `${this.#apiUrl}/stores/${encodeURIComponent(this.#storeId)}/check`;
    const payload = {
      tuple_key: {
        user: `user:${ctx.principalId}`,
        relation: toRelation(action),
        object: `workspace:${ctx.tenantId}`,
      },
      ...(this.#authorizationModelId ? { authorization_model_id: this.#authorizationModelId } : {}),
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
