import { describe, expect, it, vi } from 'vitest';
import {
  createCockpitExtensionFetch,
  getDefaultCockpitExtensionBrowserEgressPolicy,
  resolveCockpitExtensionBrowserEgressDecision,
  type CockpitExtensionBrowserEgressContext,
  type CockpitExtensionBrowserEgressPolicy,
} from './browser-egress-policy';

const context = {
  extensionId: 'example.reference',
  routeId: 'example-reference-overview',
  workspaceId: 'ws-demo',
  principalId: 'user-1',
  correlationId: 'corr-1',
} satisfies CockpitExtensionBrowserEgressContext;

const policy = {
  policyId: 'cockpit-extension-browser-egress',
  policyVersion: '1',
  allowedOrigins: ['https://cockpit.example.test', 'https://api.example.test'],
  allowedPathPrefixes: ['/auth/', '/v1/'],
} satisfies CockpitExtensionBrowserEgressPolicy;

describe('cockpit extension browser egress policy', () => {
  it('allows same-origin host API paths under the configured policy', () => {
    const decision = resolveCockpitExtensionBrowserEgressDecision({
      url: '/v1/workspaces/ws-demo/evidence?cursor=secret',
      context,
      policy,
      baseOrigin: 'https://cockpit.example.test',
      nowIso: '2026-04-30T02:00:00.000Z',
    });

    expect(decision).toEqual({
      allowed: true,
      audit: {
        decision: 'allow',
        reason: 'approved-host-api-origin',
        surface: 'extension-browser-egress',
        policyId: 'cockpit-extension-browser-egress',
        policyVersion: '1',
        extensionId: 'example.reference',
        routeId: 'example-reference-overview',
        workspaceId: 'ws-demo',
        principalId: 'user-1',
        correlationId: 'corr-1',
        requestKind: 'fetch',
        method: 'GET',
        attemptedOrigin: 'https://cockpit.example.test',
        attemptedPath: '/v1/workspaces/ws-demo/evidence',
        attemptedUrl: 'https://cockpit.example.test/v1/workspaces/ws-demo/evidence',
        allowedOrigins: ['https://api.example.test', 'https://cockpit.example.test'],
        allowedPathPrefixes: ['/auth/', '/v1/'],
        timestampIso: '2026-04-30T02:00:00.000Z',
      },
    });
  });

  it('denies undeclared external origins with deterministic audit metadata', () => {
    const decision = resolveCockpitExtensionBrowserEgressDecision({
      url: 'https://external.example.test/v1/accounts?token=secret#fragment',
      method: 'POST',
      context,
      policy,
      baseOrigin: 'https://cockpit.example.test',
      nowIso: '2026-04-30T02:00:00.000Z',
    });

    expect(decision).toEqual({
      allowed: false,
      audit: {
        decision: 'deny',
        reason: 'forbidden-origin',
        surface: 'extension-browser-egress',
        policyId: 'cockpit-extension-browser-egress',
        policyVersion: '1',
        extensionId: 'example.reference',
        routeId: 'example-reference-overview',
        workspaceId: 'ws-demo',
        principalId: 'user-1',
        correlationId: 'corr-1',
        requestKind: 'fetch',
        method: 'POST',
        attemptedOrigin: 'https://external.example.test',
        attemptedPath: '/v1/accounts',
        attemptedUrl: 'https://external.example.test/v1/accounts',
        allowedOrigins: ['https://api.example.test', 'https://cockpit.example.test'],
        allowedPathPrefixes: ['/auth/', '/v1/'],
        timestampIso: '2026-04-30T02:00:00.000Z',
      },
    });
  });

  it('denies same-origin non-API paths so extension code cannot widen egress by path', () => {
    const decision = resolveCockpitExtensionBrowserEgressDecision({
      url: '/download/raw-export.csv',
      context,
      policy,
      baseOrigin: 'https://cockpit.example.test',
      nowIso: '2026-04-30T02:00:00.000Z',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.audit).toMatchObject({
      decision: 'deny',
      reason: 'forbidden-path',
      attemptedOrigin: 'https://cockpit.example.test',
      attemptedPath: '/download/raw-export.csv',
    });
  });

  it('fails closed when the host policy has no approved origins', () => {
    const decision = resolveCockpitExtensionBrowserEgressDecision({
      url: '/v1/workspaces/ws-demo/evidence',
      context,
      policy: { ...policy, allowedOrigins: [] },
      baseOrigin: 'https://cockpit.example.test',
      nowIso: '2026-04-30T02:00:00.000Z',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.audit.reason).toBe('missing-policy');
  });

  it('blocks network dispatch before fetch when egress is denied', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}'));
    const extensionFetch = createCockpitExtensionFetch(context, {
      policy,
      baseOrigin: 'https://cockpit.example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(extensionFetch('https://external.example.test/v1/accounts')).rejects.toMatchObject(
      {
        name: 'CockpitExtensionBrowserEgressError',
        audit: {
          decision: 'deny',
          reason: 'forbidden-origin',
          extensionId: 'example.reference',
          routeId: 'example-reference-overview',
        },
      },
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('keeps the default policy generic and host-owned', () => {
    const defaultPolicy = getDefaultCockpitExtensionBrowserEgressPolicy(
      'https://cockpit.example.test',
    );

    expect(defaultPolicy).toMatchObject({
      policyId: 'cockpit-extension-browser-egress',
      policyVersion: '1',
      allowedOrigins: ['https://cockpit.example.test'],
      allowedPathPrefixes: ['/auth/', '/v1/'],
    });
    expect(JSON.stringify(defaultPolicy)).not.toMatch(
      /tenant|customer|vertical|salesforce|stripe|odoo|hubspot/i,
    );
  });
});
