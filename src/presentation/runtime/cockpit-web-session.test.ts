import type { IncomingMessage } from 'node:http';

import { describe, expect, it } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import {
  DEFAULT_COCKPIT_SESSION_COOKIE,
  InMemoryCockpitWebSessionStore,
  WEB_SESSION_REQUEST_HEADER,
  authenticateCockpitWebSession,
  buildSessionCookie,
  isUnsafeSessionRequestAllowed,
  readSessionIdFromCookie,
} from './cockpit-web-session.js';

function makeRequest(
  headers: Record<string, string | string[] | undefined> = {},
  method = 'GET',
): IncomingMessage {
  return { method, headers } as IncomingMessage;
}

function makeContext() {
  return toAppContext({
    tenantId: 'workspace-1',
    principalId: 'user-1',
    roles: ['operator'],
    scopes: ['extensions.read'],
    capabilities: ['objects:read'],
    correlationId: 'corr-1',
  });
}

describe('cockpit web session helpers', () => {
  it('ignores malformed session cookie encoding', () => {
    const req = makeRequest({
      cookie: `${DEFAULT_COCKPIT_SESSION_COOKIE}=%E0%A4%A`,
    });

    expect(readSessionIdFromCookie(req)).toBeUndefined();
  });

  it('accepts repeated request-marker headers for unsafe methods', () => {
    const req = makeRequest({ [WEB_SESSION_REQUEST_HEADER]: ['0', 'true'] }, 'POST');

    expect(isUnsafeSessionRequestAllowed(req)).toBe(true);
  });

  it('accepts configured cross-origin Cockpit mutations after the request marker', async () => {
    const store = new InMemoryCockpitWebSessionStore();
    const record = store.create({
      ctx: makeContext(),
      ttlMs: 60_000,
      nowMs: 1_000,
    });

    const result = await authenticateCockpitWebSession({
      req: makeRequest(
        {
          cookie: `${DEFAULT_COCKPIT_SESSION_COOKIE}=${encodeURIComponent(record.sessionId)}`,
          host: 'localhost:8080',
          origin: 'http://localhost:5173',
          'sec-fetch-site': 'same-site',
          [WEB_SESSION_REQUEST_HEADER]: '1',
        },
        'POST',
      ),
      store,
      config: { trustedOrigins: ['http://localhost:5173'] },
      nowMs: 2_000,
      correlationId: 'corr-2',
      traceContext: {
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
      expectedWorkspaceId: 'workspace-1',
      requireExpectedWorkspaceId: true,
    });

    expect(result?.ok).toBe(true);
  });

  it('accepts cookie-backed unsafe requests from configured CORS origins', () => {
    const previousCorsAllowedOrigins = process.env['PORTARIUM_CORS_ALLOWED_ORIGINS'];
    process.env['PORTARIUM_CORS_ALLOWED_ORIGINS'] = 'http://localhost:5173';
    try {
      const req = makeRequest(
        {
          [WEB_SESSION_REQUEST_HEADER]: '1',
          host: 'localhost:8080',
          origin: 'http://localhost:5173',
        },
        'POST',
      );

      expect(isUnsafeSessionRequestAllowed(req)).toBe(true);
    } finally {
      if (previousCorsAllowedOrigins === undefined) {
        delete process.env['PORTARIUM_CORS_ALLOWED_ORIGINS'];
      } else {
        process.env['PORTARIUM_CORS_ALLOWED_ORIGINS'] = previousCorsAllowedOrigins;
      }
    }
  });

  it('requires the request marker for cookie-authenticated mutations', async () => {
    const store = new InMemoryCockpitWebSessionStore();
    const record = store.create({
      ctx: makeContext(),
      ttlMs: 60_000,
      nowMs: 1_000,
    });

    const result = await authenticateCockpitWebSession({
      req: makeRequest(
        {
          cookie: `${DEFAULT_COCKPIT_SESSION_COOKIE}=${encodeURIComponent(record.sessionId)}`,
        },
        'POST',
      ),
      store,
      config: undefined,
      nowMs: 2_000,
      correlationId: 'corr-2',
      traceContext: {
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
      expectedWorkspaceId: 'workspace-1',
      requireExpectedWorkspaceId: true,
    });

    expect(result?.ok).toBe(false);
    if (!result || result.ok) throw new Error('Expected unauthorized result.');
    expect(result.error.message).toContain('X-Portarium-Request');
  });

  it('builds secure cookies when forwarded proto indicates https in development', () => {
    const previousNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';
    try {
      const cookie = buildSessionCookie(
        makeRequest({ 'x-forwarded-proto': 'http, https' }),
        'session-1',
        60_000,
      );
      expect(cookie).toContain('Secure');
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnv;
      }
    }
  });
});
