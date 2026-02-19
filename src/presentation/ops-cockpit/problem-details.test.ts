import { describe, expect, it } from 'vitest';

import { isProblemDetails, parseProblemDetails, ProblemDetailsError } from './problem-details.js';

describe('Problem Details parsing and mapping', () => {
  it('accepts RFC 9457-like payloads', () => {
    const value = {
      type: 'https://portarium.dev/problems/rate-limited',
      title: 'Rate limited',
      status: 429,
      detail: 'Try again later',
      instance: 'urn:run:attempt-1',
      errors: {
        workspaceId: ['missing header'],
      },
    };

    expect(isProblemDetails(value)).toBe(true);
    expect(parseProblemDetails(value).title).toBe('Rate limited');
  });

  it('rejects non-problem payloads', () => {
    expect(isProblemDetails(null)).toBe(false);
    expect(isProblemDetails({})).toBe(false);
    expect(isProblemDetails({ type: 12, title: 'x', status: 500 })).toBe(false);
  });

  it('throws ProblemDetailsError only through runtime constructor flow', () => {
    const details = {
      type: 'https://portarium.dev/problems/forbidden',
      title: 'Forbidden',
      status: 403,
    };

    const error = new ProblemDetailsError(details);
    expect(error.problem.title).toBe('Forbidden');
    expect(error.status).toBe(403);
    expect(error.name).toBe('ProblemDetailsError');
  });
});
