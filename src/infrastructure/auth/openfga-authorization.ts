import type { AppAction } from '../../application/common/actions.js';
import type { AppContext } from '../../application/common/context.js';
import { isAllowedWorkspaceAction } from '../../application/iam/rbac/workspace-rbac.js';
import type { AuthorizationPort } from '../../application/ports/authorization.js';

export type OpenFgaAuthorizationConfig = Readonly<{
  apiUrl: string;
  storeId: string;
  /** Pin the authorization model ID to prevent model-drift authorization changes. */
  authorizationModelId?: string;
  apiToken?: string;
  fetchImpl?: typeof fetch;
  /**
   * Injectable environment map (default: `process.env`).
   * Injected in tests to control NODE_ENV without stubbing process.env.
   */
  env?: Record<string, string | undefined>;
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

/**
 * Sanitize a principalId for use in OpenFGA tuple keys.
 *
 * If the id looks like an email address, only the local-part is retained to
 * avoid leaking the domain portion into OpenFGA audit logs. The full id
 * should be stored in your identity store — not in authorization tuples.
 *
 * Example: "alice@example.com" → "alice"
 */
export function sanitizePrincipalForTuple(principalId: string): string {
  const atIndex = principalId.indexOf('@');
  if (atIndex > 0) {
    return principalId.slice(0, atIndex);
  }
  return principalId;
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

    if (!config.authorizationModelId) {
      const env = config.env ?? process.env;
      const nodeEnv = (env['NODE_ENV'] ?? '').trim();
      const isDevOrTest = nodeEnv === 'development' || nodeEnv === 'test';

      if (!isDevOrTest) {
        // Non-dev/test environment with no pinned model ID: this is a misconfiguration that
        // could allow silent authorization changes on OpenFGA model updates. Fail fast.
        throw new Error(
          `[portarium] FATAL: OpenFGA authorizationModelId is not pinned and NODE_ENV="${nodeEnv}". ` +
            'Unpinned model IDs allow silent authorization changes on model updates. ' +
            'Set PORTARIUM_OPENFGA_AUTHORIZATION_MODEL_ID to a specific model ID in production.',
        );
      }

      // In dev/test: warn but allow unpinned model ID for local iteration.
      console.warn(
        '[OpenFGA] WARNING: authorizationModelId is not pinned. Authorization checks will use ' +
          'the latest model version. Set authorizationModelId to a specific model ID in production.',
      );
    }
  }

  public async isAllowed(ctx: AppContext, action: AppAction): Promise<boolean> {
    if (!isAllowedWorkspaceAction({ roles: ctx.roles }, action)) {
      return false;
    }

    const endpoint = `${this.#apiUrl}/stores/${encodeURIComponent(this.#storeId)}/check`;
    const payload = {
      tuple_key: {
        user: `user:${sanitizePrincipalForTuple(ctx.principalId)}`,
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
