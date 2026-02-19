import { describe, expect, it } from 'vitest';

import { redactStructuredLogValue } from './structured-log.js';

describe('redactStructuredLogValue', () => {
  it('redacts common sensitive keys recursively', () => {
    const redacted = redactStructuredLogValue({
      authorization: 'Bearer abc',
      nested: {
        apiKey: '123',
        token: 'jwt',
        keep: 'ok',
      },
      list: [{ password: 'secret' }, { value: 1 }],
    });

    expect(redacted).toEqual({
      authorization: '[REDACTED]',
      nested: {
        apiKey: '[REDACTED]',
        token: '[REDACTED]',
        keep: 'ok',
      },
      list: [{ password: '[REDACTED]' }, { value: 1 }],
    });
  });
});
