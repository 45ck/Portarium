import { appContextFromWorkspaceAuthClaims } from '../../application/iam/claims-to-context.js';
import type {
  AuthenticateBearerTokenInput,
  AuthenticationPort,
} from '../../application/ports/authentication.js';
import { err, ok, type Result } from '../../application/common/result.js';
import type { AppContext, Unauthorized } from '../../application/common/index.js';

export type DevTokenAuthenticationConfig = Readonly<{
  /** Static bearer token that grants access. Must be a non-empty string. */
  token: string;
  /** Workspace ID to bind to the synthetic AppContext. */
  workspaceId: string;
  /** User ID to use in the synthetic AppContext. Defaults to "dev-user". */
  userId?: string;
}>;

function extractBearerToken(header: string | undefined): string | null {
  if (typeof header !== 'string' || header.trim() === '') return null;
  const trimmed = header.trim();
  const space = trimmed.indexOf(' ');
  if (space === -1 || trimmed.slice(0, space).toLowerCase() !== 'bearer') return null;
  const token = trimmed.slice(space + 1).trim();
  return token === '' ? null : token;
}

/**
 * Development-only authentication adapter.
 *
 * Accepts a statically configured bearer token and returns a synthetic
 * AppContext (admin role, configured workspace) without any JWKS validation.
 *
 * NEVER use in production. Intended for local development only — enable via
 * PORTARIUM_DEV_TOKEN (see docs/getting-started/local-dev.md).
 */
export class DevTokenAuthentication implements AuthenticationPort {
  readonly #token: string;
  readonly #workspaceId: string;
  readonly #userId: string;

  public constructor(config: DevTokenAuthenticationConfig) {
    if (!config.token || config.token.trim() === '') {
      throw new Error('DevTokenAuthentication: token must be a non-empty string.');
    }
    if (!config.workspaceId || config.workspaceId.trim() === '') {
      throw new Error('DevTokenAuthentication: workspaceId must be a non-empty string.');
    }
    this.#token = config.token.trim();
    this.#workspaceId = config.workspaceId.trim();
    this.#userId = (config.userId ?? 'dev-user').trim() || 'dev-user';
  }

  public authenticateBearerToken(
    input: AuthenticateBearerTokenInput,
  ): Promise<Result<AppContext, Unauthorized>> {
    const presented = extractBearerToken(input.authorizationHeader);
    if (presented === null) {
      return Promise.resolve(
        err({ kind: 'Unauthorized', message: 'Missing or invalid Authorization header.' }),
      );
    }

    if (presented !== this.#token) {
      return Promise.resolve(err({ kind: 'Unauthorized', message: 'Invalid dev token.' }));
    }

    if (
      input.expectedWorkspaceId !== undefined &&
      input.expectedWorkspaceId !== this.#workspaceId
    ) {
      return Promise.resolve(err({ kind: 'Unauthorized', message: 'Workspace scope mismatch.' }));
    }

    try {
      const { ctx } = appContextFromWorkspaceAuthClaims({
        claims: { sub: this.#userId, workspaceId: this.#workspaceId, roles: ['admin'] },
        correlationId: input.correlationId,
        ...(input.traceparent ? { traceparent: input.traceparent } : {}),
        ...(input.tracestate ? { tracestate: input.tracestate } : {}),
      });
      return Promise.resolve(ok(ctx));
    } catch {
      return Promise.resolve(
        err({ kind: 'Unauthorized', message: 'Failed to build dev auth context.' }),
      );
    }
  }
}
