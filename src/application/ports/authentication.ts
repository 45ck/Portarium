import type { AppContext } from '../common/context.js';
import type { Result } from '../common/result.js';
import type { Unauthorized } from '../common/errors.js';

export type AuthenticateBearerTokenInput = Readonly<{
  authorizationHeader: string | undefined;
  correlationId: string;
  traceparent?: string;
  tracestate?: string;
  /** When present, enforce that the token's workspaceId matches this expected workspace. */
  expectedWorkspaceId?: string;
  /** When true, reject authentication unless expectedWorkspaceId is present and non-empty. */
  requireExpectedWorkspaceId?: boolean;
}>;

export interface AuthenticationPort {
  authenticateBearerToken(
    input: AuthenticateBearerTokenInput,
  ): Promise<Result<AppContext, Unauthorized>>;
}
