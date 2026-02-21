import type { AppAction } from './actions.js';

export type AppErrorKind =
  | 'Unauthorized'
  | 'Forbidden'
  | 'ValidationFailed'
  | 'Conflict'
  | 'NotFound'
  | 'DependencyFailure'
  | 'RateLimitExceeded';

export type Unauthorized = Readonly<{
  kind: 'Unauthorized';
  message: string;
}>;

export type Forbidden = Readonly<{
  kind: 'Forbidden';
  action: AppAction;
  message: string;
}>;

/** A single field-level violation, serialised into RFC 9457 `errors` extension. */
export type FieldViolation = Readonly<{
  field: string;
  message: string;
}>;

export type ValidationFailed = Readonly<{
  kind: 'ValidationFailed';
  message: string;
  /** Legacy single-field pointer — prefer `errors` for new code. */
  field?: string;
  /** Structured per-field violations for RFC 9457 Problem Details. */
  errors?: readonly FieldViolation[];
}>;

export type Conflict = Readonly<{
  kind: 'Conflict';
  message: string;
}>;

export type NotFound = Readonly<{
  kind: 'NotFound';
  message: string;
  resource: string;
}>;

export type DependencyFailure = Readonly<{
  kind: 'DependencyFailure';
  message: string;
}>;

/**
 * HTTP 412 Precondition Failed — the `If-Match` ETag provided by the caller
 * does not match the current resource version.
 */
export type PreconditionFailed = Readonly<{
  kind: 'PreconditionFailed';
  message: string;
  /** The ETag that was expected (as sent in `If-Match`). */
  ifMatch: string;
}>;

/**
 * HTTP 429 Too Many Requests — the request exceeds the configured rate limit
 * for the tenant, user, or action.
 */
export type RateLimitExceeded = Readonly<{
  kind: 'RateLimitExceeded';
  message: string;
  /** Seconds until the rate limit window resets. */
  retryAfterSeconds: number;
}>;

export type AppError =
  | Unauthorized
  | Forbidden
  | ValidationFailed
  | Conflict
  | NotFound
  | DependencyFailure
  | PreconditionFailed
  | RateLimitExceeded;

/** Map an application error kind to its canonical HTTP status code. */
export function toHttpStatus(error: AppError): number {
  switch (error.kind) {
    case 'Unauthorized':
      return 401;
    case 'Forbidden':
      return 403;
    case 'ValidationFailed':
      return 422;
    case 'Conflict':
      return 409;
    case 'NotFound':
      return 404;
    case 'DependencyFailure':
      return 502;
    case 'PreconditionFailed':
      return 412;
    case 'RateLimitExceeded':
      return 429;
  }
}

/** Type guard — returns true when the value is a well-formed AppError. */
export function isAppError(value: unknown): value is AppError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate['kind'] === 'Unauthorized' ||
    candidate['kind'] === 'Forbidden' ||
    candidate['kind'] === 'ValidationFailed' ||
    candidate['kind'] === 'Conflict' ||
    candidate['kind'] === 'NotFound' ||
    candidate['kind'] === 'DependencyFailure' ||
    candidate['kind'] === 'PreconditionFailed' ||
    candidate['kind'] === 'RateLimitExceeded'
  );
}
