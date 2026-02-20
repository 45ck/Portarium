import { describe, expect, it } from 'vitest';

import { APP_ACTIONS } from './actions.js';
import { isAppError, toHttpStatus } from './errors.js';
import type { AppError } from './errors.js';

const FORBIDDEN: AppError = {
  kind: 'Forbidden',
  action: APP_ACTIONS.runStart,
  message: 'Not allowed.',
};

const VALIDATION_FAILED: AppError = {
  kind: 'ValidationFailed',
  message: 'Invalid input.',
};

const CONFLICT: AppError = {
  kind: 'Conflict',
  message: 'Already exists.',
};

const NOT_FOUND: AppError = {
  kind: 'NotFound',
  message: 'Resource missing.',
  resource: 'Workflow',
};

const DEPENDENCY_FAILURE: AppError = {
  kind: 'DependencyFailure',
  message: 'Downstream failed.',
};

const PRECONDITION_FAILED: AppError = {
  kind: 'PreconditionFailed',
  message: 'ETag mismatch.',
  ifMatch: '"abc123"',
};

describe('toHttpStatus', () => {
  it('maps Forbidden → 403', () => {
    expect(toHttpStatus(FORBIDDEN)).toBe(403);
  });

  it('maps ValidationFailed → 422', () => {
    expect(toHttpStatus(VALIDATION_FAILED)).toBe(422);
  });

  it('maps Conflict → 409', () => {
    expect(toHttpStatus(CONFLICT)).toBe(409);
  });

  it('maps NotFound → 404', () => {
    expect(toHttpStatus(NOT_FOUND)).toBe(404);
  });

  it('maps DependencyFailure → 502', () => {
    expect(toHttpStatus(DEPENDENCY_FAILURE)).toBe(502);
  });

  it('maps PreconditionFailed → 412', () => {
    expect(toHttpStatus(PRECONDITION_FAILED)).toBe(412);
  });
});

describe('isAppError', () => {
  it('returns true for each AppError kind', () => {
    expect(isAppError(FORBIDDEN)).toBe(true);
    expect(isAppError(VALIDATION_FAILED)).toBe(true);
    expect(isAppError(CONFLICT)).toBe(true);
    expect(isAppError(NOT_FOUND)).toBe(true);
    expect(isAppError(DEPENDENCY_FAILURE)).toBe(true);
    expect(isAppError(PRECONDITION_FAILED)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isAppError(null)).toBe(false);
  });

  it('returns false for non-object primitives', () => {
    expect(isAppError('Forbidden')).toBe(false);
    expect(isAppError(403)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
  });

  it('returns false for an object with an unknown kind', () => {
    expect(isAppError({ kind: 'UnknownError', message: 'oops' })).toBe(false);
  });

  it('returns false for an empty object', () => {
    expect(isAppError({})).toBe(false);
  });
});
