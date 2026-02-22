import { describe, expect, it, vi } from 'vitest';

import type { PortariumLogger } from './logger.js';
import { createAuthEventLogger } from './auth-event-logger.js';

function makeLogger(): {
  logger: PortariumLogger;
  calls: { level: string; msg: string; fields: unknown }[];
} {
  const calls: { level: string; msg: string; fields: unknown }[] = [];
  const logger: PortariumLogger = {
    debug: vi.fn((msg, fields) => calls.push({ level: 'debug', msg, fields })),
    info: vi.fn((msg, fields) => calls.push({ level: 'info', msg, fields })),
    warn: vi.fn((msg, fields) => calls.push({ level: 'warn', msg, fields })),
    error: vi.fn((msg, fields) => calls.push({ level: 'error', msg, fields })),
    child: vi.fn(() => logger),
  };
  return { logger, calls };
}

describe('createAuthEventLogger', () => {
  describe('logUnauthorized', () => {
    it('logs at error level with event auth.unauthorized and httpStatus 401', () => {
      const { logger, calls } = makeLogger();
      const authLogger = createAuthEventLogger(logger);

      authLogger.logUnauthorized({
        correlationId: 'corr-1',
        workspaceId: 'ws-1',
        reason: 'Token expired',
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]!.level).toBe('error');
      expect(calls[0]!.msg).toBe('auth.unauthorized');
      expect(calls[0]!.fields).toMatchObject({
        event: 'auth.unauthorized',
        httpStatus: 401,
        correlationId: 'corr-1',
        workspaceId: 'ws-1',
        reason: 'Token expired',
      });
    });

    it('omits workspaceId and reason when not provided', () => {
      const { logger, calls } = makeLogger();
      const authLogger = createAuthEventLogger(logger);

      authLogger.logUnauthorized({ correlationId: 'corr-2' });

      expect(calls[0]!.fields).not.toHaveProperty('workspaceId');
      expect(calls[0]!.fields).not.toHaveProperty('reason');
    });

    it('never logs Authorization header content', () => {
      const { logger, calls } = makeLogger();
      const authLogger = createAuthEventLogger(logger);

      // The Authorization header is never passed to logUnauthorized — this
      // test documents that the interface design prevents accidental logging.
      authLogger.logUnauthorized({ correlationId: 'corr-3', reason: 'Invalid signature' });

      const serialized = JSON.stringify(calls[0]!.fields);
      expect(serialized.toLowerCase()).not.toContain('bearer');
      expect(serialized.toLowerCase()).not.toContain('authorization');
    });
  });

  describe('logForbidden', () => {
    it('logs at error level with event auth.forbidden and httpStatus 403', () => {
      const { logger, calls } = makeLogger();
      const authLogger = createAuthEventLogger(logger);

      authLogger.logForbidden({
        correlationId: 'corr-4',
        workspaceId: 'ws-2',
        action: 'workspace.read',
        reason: 'Read access denied.',
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]!.level).toBe('error');
      expect(calls[0]!.msg).toBe('auth.forbidden');
      expect(calls[0]!.fields).toMatchObject({
        event: 'auth.forbidden',
        httpStatus: 403,
        correlationId: 'corr-4',
        workspaceId: 'ws-2',
        action: 'workspace.read',
        reason: 'Read access denied.',
      });
    });

    it('logs with only reason when optional fields are absent', () => {
      const { logger, calls } = makeLogger();
      const authLogger = createAuthEventLogger(logger);

      authLogger.logForbidden({ reason: 'Operator role required.' });

      expect(calls[0]!.fields).toMatchObject({
        event: 'auth.forbidden',
        reason: 'Operator role required.',
      });
      expect(calls[0]!.fields).not.toHaveProperty('correlationId');
      expect(calls[0]!.fields).not.toHaveProperty('workspaceId');
      expect(calls[0]!.fields).not.toHaveProperty('action');
    });

    it('never logs token or secret values', () => {
      const { logger, calls } = makeLogger();
      const authLogger = createAuthEventLogger(logger);

      authLogger.logForbidden({ workspaceId: 'ws-3', reason: 'Scope mismatch.' });

      const serialized = JSON.stringify(calls[0]!.fields);
      expect(serialized.toLowerCase()).not.toContain('token');
      expect(serialized.toLowerCase()).not.toContain('secret');
    });
  });

  describe('logRateLimitExceeded', () => {
    it('logs at warn level with event rate_limit.exceeded and httpStatus 429', () => {
      const { logger, calls } = makeLogger();
      const authLogger = createAuthEventLogger(logger);

      authLogger.logRateLimitExceeded({
        workspaceId: 'ws-4',
        path: '/v1/workspaces/ws-4/runs',
        retryAfterSeconds: 30,
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]!.level).toBe('warn');
      expect(calls[0]!.msg).toBe('rate_limit.exceeded');
      expect(calls[0]!.fields).toMatchObject({
        event: 'rate_limit.exceeded',
        httpStatus: 429,
        workspaceId: 'ws-4',
        path: '/v1/workspaces/ws-4/runs',
        retryAfterSeconds: 30,
      });
    });

    it('includes all required fields for rate limit event', () => {
      const { logger, calls } = makeLogger();
      const authLogger = createAuthEventLogger(logger);

      authLogger.logRateLimitExceeded({
        workspaceId: 'ws-5',
        path: '/v1/workspaces/ws-5/actions',
        retryAfterSeconds: 60,
      });

      const fields = calls[0]!.fields as Record<string, unknown>;
      expect(fields['workspaceId']).toBe('ws-5');
      expect(fields['path']).toBe('/v1/workspaces/ws-5/actions');
      expect(fields['retryAfterSeconds']).toBe(60);
    });
  });
});
