import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { handlers } from './handlers';

const server = setupServer(...handlers);

describe('cockpit mock handlers', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('returns an unauthenticated web session response in demo mode', async () => {
    const response = await fetch('http://cockpit.localhost/auth/session');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      title: 'Unauthorized',
      status: 401,
    });
  });
});
