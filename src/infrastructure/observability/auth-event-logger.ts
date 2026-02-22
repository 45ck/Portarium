import type { PortariumLogger } from './logger.js';

/**
 * Fields logged for a 401 Unauthorized event.
 * Authorization header content is intentionally excluded.
 */
export type UnauthorizedEventFields = Readonly<{
  correlationId: string;
  workspaceId?: string;
  reason?: string;
}>;

/**
 * Fields logged for a 403 Forbidden event.
 */
export type ForbiddenEventFields = Readonly<{
  correlationId?: string;
  workspaceId?: string;
  action?: string;
  reason: string;
}>;

/**
 * Fields logged for a 429 Rate Limit Exceeded event.
 */
export type RateLimitExceededEventFields = Readonly<{
  workspaceId: string;
  path: string;
  retryAfterSeconds: number;
}>;

/**
 * Structured logger for authentication and rate-limit security events.
 *
 * Guarantees:
 * - Authorization header content is NEVER logged.
 * - All events are emitted as structured JSON via the underlying PortariumLogger.
 * - 401/403 events are logged at `error` level; 429 at `warn` level.
 */
export interface AuthEventLogger {
  logUnauthorized(fields: UnauthorizedEventFields): void;
  logForbidden(fields: ForbiddenEventFields): void;
  logRateLimitExceeded(fields: RateLimitExceededEventFields): void;
}

export function createAuthEventLogger(logger: PortariumLogger): AuthEventLogger {
  return {
    logUnauthorized({ correlationId, workspaceId, reason }) {
      logger.error('auth.unauthorized', {
        event: 'auth.unauthorized',
        httpStatus: 401,
        correlationId,
        ...(workspaceId !== undefined && { workspaceId }),
        ...(reason !== undefined && { reason }),
      });
    },

    logForbidden({ correlationId, workspaceId, action, reason }) {
      logger.error('auth.forbidden', {
        event: 'auth.forbidden',
        httpStatus: 403,
        ...(correlationId !== undefined && { correlationId }),
        ...(workspaceId !== undefined && { workspaceId }),
        ...(action !== undefined && { action }),
        reason,
      });
    },

    logRateLimitExceeded({ workspaceId, path, retryAfterSeconds }) {
      logger.warn('rate_limit.exceeded', {
        event: 'rate_limit.exceeded',
        httpStatus: 429,
        workspaceId,
        path,
        retryAfterSeconds,
      });
    },
  };
}
