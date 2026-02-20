import { describe, it, expect } from 'vitest';
import {
  PortariumClient,
  PortariumApiError,
} from './portarium-client.js';

describe('infrastructure/sdk re-export', () => {
  it('exports PortariumClient class', () => {
    expect(typeof PortariumClient).toBe('function');
  });

  it('exports PortariumApiError class', () => {
    expect(typeof PortariumApiError).toBe('function');
    const error = new PortariumApiError({
      type: 'about:blank',
      title: 'Test',
      status: 400,
    });
    expect(error.name).toBe('PortariumApiError');
    expect(error.problem.status).toBe(400);
  });
});
