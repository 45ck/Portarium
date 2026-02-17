export type AppErrorKind =
  | 'Forbidden'
  | 'ValidationFailed'
  | 'Conflict'
  | 'NotFound'
  | 'DependencyFailure';

export type Forbidden = Readonly<{
  kind: 'Forbidden';
  message: string;
  action: string;
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
