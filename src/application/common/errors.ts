import type { AppAction } from './actions.js';

export type AppErrorKind =
  | 'Forbidden'
  | 'ValidationFailed'
  | 'Conflict'
  | 'NotFound'
  | 'DependencyFailure';

export type Forbidden = Readonly<{
  kind: 'Forbidden';
  action: AppAction;
  message: string;
}>;

export type ValidationFailed = Readonly<{
  kind: 'ValidationFailed';
  message: string;
  field?: string;
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

export type AppError = Forbidden | ValidationFailed | Conflict | NotFound | DependencyFailure;

/** Map an application error kind to its canonical HTTP status code. */
export function toHttpStatus(error: AppError): number {
  switch (error.kind) {
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
  }
}

/** Type guard — returns true when the value is a well-formed AppError. */
export function isAppError(value: unknown): value is AppError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate['kind'] === 'Forbidden' ||
    candidate['kind'] === 'ValidationFailed' ||
    candidate['kind'] === 'Conflict' ||
    candidate['kind'] === 'NotFound' ||
    candidate['kind'] === 'DependencyFailure'
  );
}
