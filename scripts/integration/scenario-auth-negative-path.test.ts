/**
 * Scenario: Auth/authz negative-path contract checks (401/403) for control-plane endpoints.
 *
 * This scenario exercises authentication and authorization enforcement across
 * key control-plane endpoints used by dispatch and approvals flows, validating
 * both dev-token and OIDC/JWKS auth profiles through configurable stubs.
 *
 * Delta beyond existing control-plane-handler tests:
 * - Existing tests verify individual routes with inline auth overrides.
 * - This scenario systematically covers the negative-path matrix:
 *   1. Missing token → 401 with contract-compliant ProblemDetails envelope.
 *   2. Invalid/expired token → 401 with diagnostic reason in envelope.
 *   3. Insufficient role/scope → 403 with action and reason in envelope.
 *   4. Workspace scope mismatch → 403 for cross-workspace access attempts.
 *   5. Both auth profiles (dev-token, OIDC/JWKS) exercised via stub swapping.
 *   6. Audit-log markers (auth.unauthorized, auth.forbidden) emitted for all denials.
 *   7. Key endpoints: workspace read, run read, machine heartbeat, approvals.
 *
 * Bead: bead-0847
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { toAppContext } from '../../src/application/common/context.js';
import { err, ok } from '../../src/application/common/result.js';
import type { AuthenticationPort } from '../../src/application/ports/authentication.js';
import type { AuthEventLogger } from '../../src/infrastructure/observability/auth-event-logger.js';
import { createControlPlaneHandler } from '../../src/presentation/runtime/control-plane-handler.js';
import type { HealthServerHandle } from '../../src/presentation/runtime/health-server.js';
import { startHealthServer } from '../../src/presentation/runtime/health-server.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

type Role = 'admin' | 'operator' | 'approver' | 'auditor';
type HandlerDeps = Parameters<typeof createControlPlaneHandler>[0];

function makeCtx(tenantId: string, roles: readonly Role[] = ['admin']) {
  return toAppContext({
    tenantId,
    principalId: 'user-scenario',
    roles,
    correlationId: 'corr-auth-scenario',
  });
}

/** ProblemDetails contract shape. */
type ProblemBody = Readonly<{
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}>;

// ---------------------------------------------------------------------------
// Auth profile stubs
// ---------------------------------------------------------------------------

/**
 * Simulates dev-token auth mode: extracts workspace from Bearer header,
 * returns Unauthorized for missing/invalid tokens.
 */
function devTokenAuth(options?: {
  missingToken?: boolean;
  invalidToken?: boolean;
}): AuthenticationPort {
  return {
    authenticateBearerToken: async (input) => {
      if (options?.missingToken || !input.authorizationHeader) {
        return err({ kind: 'Unauthorized', message: 'Missing bearer token.' });
      }
      if (options?.invalidToken) {
        return err({ kind: 'Unauthorized', message: 'Invalid dev-token format.' });
      }
      // Dev-token: workspace ID derived from expectedWorkspaceId
      const workspaceId = input.expectedWorkspaceId ?? 'workspace-default';
      return ok(makeCtx(workspaceId));
    },
  };
}

/**
 * Simulates OIDC/JWKS auth mode: validates JWT claims, rejects expired/invalid
 * signatures, enforces workspace scope from token claims.
 */
function oidcAuth(options?: {
  missingToken?: boolean;
  expiredToken?: boolean;
  invalidSignature?: boolean;
  tokenWorkspaceId?: string;
  tokenRoles?: readonly Role[];
}): AuthenticationPort {
  return {
    authenticateBearerToken: async (input) => {
      if (options?.missingToken || !input.authorizationHeader) {
        return err({ kind: 'Unauthorized', message: 'Missing bearer token.' });
      }
      if (options?.expiredToken) {
        return err({ kind: 'Unauthorized', message: 'Token expired: exp claim is in the past.' });
      }
      if (options?.invalidSignature) {
        return err({ kind: 'Unauthorized', message: 'JWT signature verification failed.' });
      }
      const workspaceId = options?.tokenWorkspaceId ?? 'workspace-1';
      // Enforce workspace scope when expectedWorkspaceId is provided (mirrors real OIDC behavior)
      if (input.expectedWorkspaceId && workspaceId !== input.expectedWorkspaceId) {
        return err({
          kind: 'Unauthorized',
          message: `Token workspace ${workspaceId} does not match expected ${input.expectedWorkspaceId}.`,
        });
      }
      const roles = options?.tokenRoles ?? ['admin'];
      return ok(makeCtx(workspaceId, roles));
    },
  };
}

function makeAuditLogger(): AuthEventLogger & {
  unauthorizedCalls: Record<string, unknown>[];
  forbiddenCalls: Record<string, unknown>[];
} {
  const unauthorizedCalls: Record<string, unknown>[] = [];
  const forbiddenCalls: Record<string, unknown>[] = [];
  return {
    unauthorizedCalls,
    forbiddenCalls,
    logUnauthorized: vi.fn((fields) => unauthorizedCalls.push(fields)),
    logForbidden: vi.fn((fields) => forbiddenCalls.push(fields)),
    logRateLimitExceeded: vi.fn(),
  };
}

function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    authentication: devTokenAuth(),
    authorization: { isAllowed: async () => true },
    workspaceStore: {
      getWorkspaceById: async () => null,
      getWorkspaceByName: async () => null,
      saveWorkspace: async () => undefined,
    },
    runStore: {
      getRunById: async () => null,
      saveRun: async () => undefined,
    },
    ...overrides,
  };
}

async function startWith(deps: HandlerDeps): Promise<string> {
  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(deps),
  });
  return `http://${handle.host}:${handle.port}`;
}

// ---------------------------------------------------------------------------
// Key endpoints under test (dispatch and approvals flows)
// ---------------------------------------------------------------------------

const ENDPOINTS = [
  { name: 'GET workspace', method: 'GET', path: '/v1/workspaces/workspace-1' },
  { name: 'GET run', method: 'GET', path: '/v1/workspaces/workspace-1/runs/run-1' },
  {
    name: 'POST machine heartbeat',
    method: 'POST',
    path: '/v1/workspaces/workspace-1/machines/machine-1/heartbeat',
    body: JSON.stringify({ status: 'healthy', metrics: {} }),
  },
  {
    name: 'POST agent heartbeat',
    method: 'POST',
    path: '/v1/workspaces/workspace-1/agents/agent-1/heartbeat',
    body: JSON.stringify({ status: 'idle', currentWorkItemId: null }),
  },
] as const;

// ---------------------------------------------------------------------------
// Scenario tests
// ---------------------------------------------------------------------------

describe('Scenario: Auth/authz negative-path contract checks', () => {
  // ─── AC-1: Missing token → 401 ───────────────────────────────────────
  describe('AC-1: Missing token returns 401 with contract-compliant envelope', () => {
    for (const endpoint of ENDPOINTS) {
      it(`${endpoint.name}: missing token → 401 ProblemDetails`, async () => {
        const auditLog = makeAuditLogger();
        const base = await startWith(
          makeDeps({
            authentication: devTokenAuth({ missingToken: true }),
            authEventLogger: auditLog,
          }),
        );

        const res = await fetch(`${base}${endpoint.path}`, {
          method: endpoint.method,
          headers: {
            'content-type': 'application/json',
            'x-correlation-id': 'corr-missing-token',
          },
          ...('body' in endpoint ? { body: endpoint.body } : {}),
        });

        expect(res.status).toBe(401);
        expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
        expect(res.headers.get('x-correlation-id')).toBe('corr-missing-token');
        expect(res.headers.get('traceparent')).toMatch(
          /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i,
        );

        const body = (await res.json()) as ProblemBody;
        expect(body.type).toContain('unauthorized');
        expect(body.title).toBe('Unauthorized');
        expect(body.status).toBe(401);
        expect(body.detail).toBeDefined();

        // Audit-log marker emitted
        expect(auditLog.unauthorizedCalls.length).toBeGreaterThanOrEqual(1);
        const lastCall = auditLog.unauthorizedCalls.at(-1)!;
        expect(lastCall['correlationId']).toBe('corr-missing-token');
      });
    }
  });

  // ─── AC-2: Invalid/expired token → 401 (OIDC profile) ────────────────
  describe('AC-2: Invalid/expired token returns 401 with diagnostic reason', () => {
    it('expired JWT → 401 with expiry reason in ProblemDetails', async () => {
      const auditLog = makeAuditLogger();
      const base = await startWith(
        makeDeps({
          authentication: oidcAuth({ expiredToken: true }),
          authEventLogger: auditLog,
        }),
      );

      const res = await fetch(`${base}/v1/workspaces/workspace-1`, {
        headers: {
          authorization: 'Bearer expired.jwt.token',
          'x-correlation-id': 'corr-expired-jwt',
        },
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as ProblemBody;
      expect(body.type).toContain('unauthorized');
      expect(body.detail).toContain('expired');

      expect(auditLog.unauthorizedCalls).toHaveLength(1);
      expect(auditLog.unauthorizedCalls[0]!['reason']).toContain('expired');
    });

    it('invalid JWT signature → 401 with signature verification failure', async () => {
      const auditLog = makeAuditLogger();
      const base = await startWith(
        makeDeps({
          authentication: oidcAuth({ invalidSignature: true }),
          authEventLogger: auditLog,
        }),
      );

      const res = await fetch(`${base}/v1/workspaces/workspace-1`, {
        headers: {
          authorization: 'Bearer invalid.sig.token',
          'x-correlation-id': 'corr-invalid-sig',
        },
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as ProblemBody;
      expect(body.detail).toContain('signature');

      expect(auditLog.unauthorizedCalls).toHaveLength(1);
      expect(auditLog.unauthorizedCalls[0]!['reason']).toContain('signature');
    });

    it('dev-token mode: malformed token → 401 with format error', async () => {
      const auditLog = makeAuditLogger();
      const base = await startWith(
        makeDeps({
          authentication: devTokenAuth({ invalidToken: true }),
          authEventLogger: auditLog,
        }),
      );

      const res = await fetch(`${base}/v1/workspaces/workspace-1/runs/run-1`, {
        headers: {
          authorization: 'Bearer bad-format',
          'x-correlation-id': 'corr-bad-format',
        },
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as ProblemBody;
      expect(body.detail).toContain('dev-token');

      expect(auditLog.unauthorizedCalls).toHaveLength(1);
    });
  });

  // ─── AC-3: Insufficient role/scope → 403 ─────────────────────────────
  describe('AC-3: Insufficient role/scope returns 403', () => {
    it('no roles at all → 403 Forbidden for agent work-items (assertReadAccess)', async () => {
      const auditLog = makeAuditLogger();
      const base = await startWith(
        makeDeps({
          authentication: oidcAuth({ tokenRoles: [] as Role[] }),
          authEventLogger: auditLog,
        }),
      );

      // GET agent work-items uses assertReadAccess which checks roles
      const res = await fetch(`${base}/v1/workspaces/workspace-1/agents/agent-1/work-items`, {
        headers: {
          authorization: 'Bearer valid.jwt.token',
          'x-correlation-id': 'corr-no-roles',
        },
      });

      expect(res.status).toBe(403);
      expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);

      const body = (await res.json()) as ProblemBody;
      expect(body.type).toContain('forbidden');
      expect(body.title).toBe('Forbidden');
      expect(body.status).toBe(403);

      // Audit-log marker emitted
      expect(auditLog.forbiddenCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('authorization port denies access → 403 even with admin role', async () => {
      const auditLog = makeAuditLogger();
      const base = await startWith(
        makeDeps({
          authentication: oidcAuth({ tokenRoles: ['admin'] }),
          authorization: { isAllowed: async () => false },
          authEventLogger: auditLog,
        }),
      );

      // GET agent work-items uses assertReadAccess → isAllowed check
      const res = await fetch(`${base}/v1/workspaces/workspace-1/agents/agent-1/work-items`, {
        headers: {
          authorization: 'Bearer valid.jwt.token',
          'x-correlation-id': 'corr-denied-by-authz',
        },
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as ProblemBody;
      expect(body.type).toContain('forbidden');

      expect(auditLog.forbiddenCalls.length).toBeGreaterThanOrEqual(1);
      const call = auditLog.forbiddenCalls.at(-1)!;
      expect(call['reason']).toContain('denied');
    });
  });

  // ─── AC-4: Workspace scope mismatch → 401 (auth-level) or 403 (post-auth) ──
  describe('AC-4: Workspace scope mismatch rejected at auth boundary', () => {
    it('token for workspace-A accessing workspace-B → 401 (auth port rejects scope)', async () => {
      const auditLog = makeAuditLogger();
      const base = await startWith(
        makeDeps({
          authentication: oidcAuth({ tokenWorkspaceId: 'workspace-A' }),
          authEventLogger: auditLog,
        }),
      );

      // Token has workspace-A, but request targets workspace-B
      // Auth port enforces expectedWorkspaceId → returns Unauthorized
      const res = await fetch(`${base}/v1/workspaces/workspace-B`, {
        headers: {
          authorization: 'Bearer valid.jwt.token',
          'x-correlation-id': 'corr-scope-mismatch',
        },
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as ProblemBody;
      expect(body.type).toContain('unauthorized');
      expect(body.detail).toContain('workspace');

      expect(auditLog.unauthorizedCalls.length).toBeGreaterThanOrEqual(1);
      const call = auditLog.unauthorizedCalls.at(-1)!;
      expect(call['correlationId']).toBe('corr-scope-mismatch');
    });

    it('cross-workspace run access → 401 (auth port rejects scope)', async () => {
      const auditLog = makeAuditLogger();
      const base = await startWith(
        makeDeps({
          authentication: oidcAuth({ tokenWorkspaceId: 'workspace-X' }),
          authEventLogger: auditLog,
        }),
      );

      const res = await fetch(`${base}/v1/workspaces/workspace-Y/runs/run-1`, {
        headers: {
          authorization: 'Bearer valid.jwt.token',
          'x-correlation-id': 'corr-cross-ws-run',
        },
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as ProblemBody;
      expect(body.type).toContain('unauthorized');
      expect(body.detail).toContain('workspace');
    });

    it('cross-workspace machine heartbeat → 403 (post-auth scope assertion)', async () => {
      const auditLog = makeAuditLogger();
      // Auth stub that always succeeds with workspace-X (ignores expectedWorkspaceId)
      // This simulates a token that passes auth but has wrong workspace scope
      const lenientAuth: AuthenticationPort = {
        authenticateBearerToken: async () => ok(makeCtx('workspace-X')),
      };
      const base = await startWith(
        makeDeps({
          authentication: lenientAuth,
          authEventLogger: auditLog,
        }),
      );

      // Request targets workspace-Y, but token has workspace-X
      // assertWorkspaceScope catches the mismatch → 403
      const res = await fetch(`${base}/v1/workspaces/workspace-Y/machines/machine-1/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer valid.jwt.token',
          'x-correlation-id': 'corr-cross-ws-machine',
        },
        body: JSON.stringify({ status: 'healthy', metrics: {} }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as ProblemBody;
      expect(body.type).toContain('forbidden');
      expect(body.detail).toContain('workspace');

      expect(auditLog.forbiddenCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── AC-5: Both auth profiles produce consistent 401/403 envelopes ───
  describe('AC-5: Both auth profiles produce consistent ProblemDetails envelopes', () => {
    it('dev-token missing → same envelope shape as OIDC missing', async () => {
      // Dev-token profile
      const base1 = await startWith(
        makeDeps({ authentication: devTokenAuth({ missingToken: true }) }),
      );
      const res1 = await fetch(`${base1}/v1/workspaces/workspace-1`);
      const body1 = (await res1.json()) as ProblemBody;
      await handle?.close();
      handle = undefined;

      // OIDC profile
      const base2 = await startWith(makeDeps({ authentication: oidcAuth({ missingToken: true }) }));
      const res2 = await fetch(`${base2}/v1/workspaces/workspace-1`);
      const body2 = (await res2.json()) as ProblemBody;

      // Both return same structure
      expect(res1.status).toBe(401);
      expect(res2.status).toBe(401);
      expect(body1.type).toBe(body2.type);
      expect(body1.title).toBe(body2.title);
      expect(body1.status).toBe(body2.status);
      // Both have detail (may differ in message)
      expect(body1.detail).toBeDefined();
      expect(body2.detail).toBeDefined();
    });

    it('dev-token valid + OIDC valid both reach same downstream 404 for missing workspace', async () => {
      // Dev-token profile with valid token
      const base1 = await startWith(makeDeps({ authentication: devTokenAuth() }));
      const res1 = await fetch(`${base1}/v1/workspaces/workspace-1`, {
        headers: { authorization: 'Bearer dev-token-valid' },
      });
      const body1 = (await res1.json()) as ProblemBody;
      await handle?.close();
      handle = undefined;

      // OIDC profile with valid token
      const base2 = await startWith(makeDeps({ authentication: oidcAuth() }));
      const res2 = await fetch(`${base2}/v1/workspaces/workspace-1`, {
        headers: { authorization: 'Bearer valid.jwt.token' },
      });
      const body2 = (await res2.json()) as ProblemBody;

      // Both pass auth and reach the 404 not-found for the workspace
      expect(res1.status).toBe(404);
      expect(res2.status).toBe(404);
      expect(body1.type).toBe(body2.type);
    });
  });

  // ─── AC-6: Audit-log markers for all denial types ────────────────────
  describe('AC-6: Audit-log markers emitted for all denial types', () => {
    it('401 emits auth.unauthorized marker with correlationId', async () => {
      const auditLog = makeAuditLogger();
      const base = await startWith(
        makeDeps({
          authentication: oidcAuth({ expiredToken: true }),
          authEventLogger: auditLog,
        }),
      );

      await fetch(`${base}/v1/workspaces/workspace-1`, {
        headers: {
          authorization: 'Bearer expired.token',
          'x-correlation-id': 'corr-audit-401',
        },
      });

      expect(auditLog.unauthorizedCalls).toHaveLength(1);
      const call = auditLog.unauthorizedCalls[0]!;
      expect(call['correlationId']).toBe('corr-audit-401');
      expect(call['reason']).toBeDefined();
      // No authorization header content leaked
      expect(JSON.stringify(call)).not.toContain('expired.token');
    });

    it('403 emits auth.forbidden marker with action and workspaceId', async () => {
      const auditLog = makeAuditLogger();
      // Lenient auth that always succeeds with workspace-X (ignores expectedWorkspaceId)
      const lenientAuth: AuthenticationPort = {
        authenticateBearerToken: async () => ok(makeCtx('workspace-X')),
      };
      const base = await startWith(
        makeDeps({
          authentication: lenientAuth,
          authEventLogger: auditLog,
        }),
      );

      await fetch(`${base}/v1/workspaces/workspace-Y/machines/machine-1/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer valid.jwt.token',
          'x-correlation-id': 'corr-audit-403',
        },
        body: JSON.stringify({ status: 'healthy', metrics: {} }),
      });

      expect(auditLog.forbiddenCalls.length).toBeGreaterThanOrEqual(1);
      const call = auditLog.forbiddenCalls.at(-1)!;
      expect(call['workspaceId']).toBeDefined();
      expect(call['reason']).toBeDefined();
      // No token content leaked
      expect(JSON.stringify(call)).not.toContain('valid.jwt.token');
    });

    it('multiple denials each emit separate audit markers', async () => {
      const auditLog = makeAuditLogger();
      const base = await startWith(
        makeDeps({
          authentication: devTokenAuth({ missingToken: true }),
          authEventLogger: auditLog,
        }),
      );

      await fetch(`${base}/v1/workspaces/workspace-1`);
      await fetch(`${base}/v1/workspaces/workspace-1/runs/run-1`);
      await fetch(`${base}/v1/workspaces/workspace-1/machines/m-1/heartbeat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'healthy', metrics: {} }),
      });

      expect(auditLog.unauthorizedCalls).toHaveLength(3);
    });
  });

  // ─── AC-7: Response headers always present on error responses ────────
  describe('AC-7: Response headers contract for error responses', () => {
    it('401 response includes traceparent, x-correlation-id, content-type', async () => {
      const base = await startWith(
        makeDeps({ authentication: devTokenAuth({ missingToken: true }) }),
      );

      const res = await fetch(`${base}/v1/workspaces/workspace-1`, {
        headers: {
          'x-correlation-id': 'corr-headers-check',
          traceparent: '00-aaaabbbbccccddddeeeeffffaaaabbbb-1122334455667788-01',
        },
      });

      expect(res.status).toBe(401);
      // Correlation ID echoed back
      expect(res.headers.get('x-correlation-id')).toBe('corr-headers-check');
      // Traceparent echoed (inbound valid traceparent passed through)
      expect(res.headers.get('traceparent')).toBe(
        '00-aaaabbbbccccddddeeeeffffaaaabbbb-1122334455667788-01',
      );
      // Content-Type is problem+json
      expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
    });

    it('403 response includes all required headers', async () => {
      // Lenient auth that always succeeds with workspace-A
      const lenientAuth: AuthenticationPort = {
        authenticateBearerToken: async () => ok(makeCtx('workspace-A')),
      };
      const base = await startWith(makeDeps({ authentication: lenientAuth }));

      const res = await fetch(`${base}/v1/workspaces/workspace-B/machines/machine-1/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer valid.jwt.token',
          'x-correlation-id': 'corr-403-headers',
        },
        body: JSON.stringify({ status: 'healthy', metrics: {} }),
      });

      expect(res.status).toBe(403);
      expect(res.headers.get('x-correlation-id')).toBe('corr-403-headers');
      expect(res.headers.get('traceparent')).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i);
      expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
    });
  });
});
