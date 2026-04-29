import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseApprovalV1 } from '../../domain/approvals/index.js';
import { ApprovalId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import {
  buildInMemoryApprovalStore,
  buildControlPlaneDeps,
  getJoseAuthConfigWarnings,
} from './control-plane-handler.bootstrap.js';

const AUTH_ENV_KEYS = [
  'PORTARIUM_JWKS_URI',
  'PORTARIUM_JWT_ISSUER',
  'PORTARIUM_JWT_AUDIENCE',
  'PORTARIUM_DEV_TOKEN',
  'PORTARIUM_DEV_WORKSPACE_ID',
  'PORTARIUM_DEV_USER_ID',
  'ENABLE_DEV_AUTH',
  'DEV_STUB_STORES',
  'NODE_ENV',
] as const;

let savedEnv: Partial<Record<(typeof AUTH_ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of AUTH_ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
});

afterEach(() => {
  for (const key of AUTH_ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('getJoseAuthConfigWarnings', () => {
  it('returns no warnings when both issuer and audience are set', () => {
    const warnings = getJoseAuthConfigWarnings({
      PORTARIUM_JWT_ISSUER: 'https://auth.example.com',
      PORTARIUM_JWT_AUDIENCE: 'portarium-api',
    });
    expect(warnings).toHaveLength(0);
  });

  it('returns a warning when PORTARIUM_JWT_ISSUER is absent', () => {
    const warnings = getJoseAuthConfigWarnings({
      PORTARIUM_JWT_AUDIENCE: 'portarium-api',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/PORTARIUM_JWT_ISSUER/);
    expect(warnings[0]).toMatch(/issuer/i);
  });

  it('returns a warning when PORTARIUM_JWT_AUDIENCE is absent', () => {
    const warnings = getJoseAuthConfigWarnings({
      PORTARIUM_JWT_ISSUER: 'https://auth.example.com',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/PORTARIUM_JWT_AUDIENCE/);
    expect(warnings[0]).toMatch(/audience/i);
  });

  it('returns two warnings when both issuer and audience are absent', () => {
    const warnings = getJoseAuthConfigWarnings({});
    expect(warnings).toHaveLength(2);
    const text = warnings.join('\n');
    expect(text).toMatch(/PORTARIUM_JWT_ISSUER/);
    expect(text).toMatch(/PORTARIUM_JWT_AUDIENCE/);
  });

  it('returns a warning when PORTARIUM_JWT_ISSUER is whitespace-only', () => {
    const warnings = getJoseAuthConfigWarnings({
      PORTARIUM_JWT_ISSUER: '   ',
      PORTARIUM_JWT_AUDIENCE: 'portarium-api',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/PORTARIUM_JWT_ISSUER/);
  });

  it('returns a warning when PORTARIUM_JWT_AUDIENCE is whitespace-only', () => {
    const warnings = getJoseAuthConfigWarnings({
      PORTARIUM_JWT_ISSUER: 'https://auth.example.com',
      PORTARIUM_JWT_AUDIENCE: '  ',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/PORTARIUM_JWT_AUDIENCE/);
  });

  it('warnings include guidance on what value to set', () => {
    const warnings = getJoseAuthConfigWarnings({});
    expect(warnings[0]).toMatch(/Set PORTARIUM_JWT_ISSUER/);
    expect(warnings[1]).toMatch(/Set PORTARIUM_JWT_AUDIENCE/);
  });

  it('returns a readonly array', () => {
    const warnings = getJoseAuthConfigWarnings({});
    expect(Array.isArray(warnings)).toBe(true);
  });
});

describe('buildControlPlaneDeps auth startup gate', () => {
  it('fails startup when no authentication source is configured', async () => {
    for (const key of AUTH_ENV_KEYS) delete process.env[key];

    await expect(buildControlPlaneDeps()).rejects.toThrow(/Authentication is not configured/);
  });

  it('fails startup when JWKS auth is configured without issuer or audience validation', async () => {
    for (const key of AUTH_ENV_KEYS) delete process.env[key];
    process.env['PORTARIUM_JWKS_URI'] = 'https://auth.example.com/.well-known/jwks.json';

    await expect(buildControlPlaneDeps()).rejects.toThrow(/PORTARIUM_JWT_ISSUER/);
    await expect(buildControlPlaneDeps()).rejects.toThrow(/PORTARIUM_JWT_AUDIENCE/);
  });

  it('fails startup when JWKS auth is configured without issuer validation', async () => {
    for (const key of AUTH_ENV_KEYS) delete process.env[key];
    process.env['PORTARIUM_JWKS_URI'] = 'https://auth.example.com/.well-known/jwks.json';
    process.env['PORTARIUM_JWT_AUDIENCE'] = 'portarium-api';

    await expect(buildControlPlaneDeps()).rejects.toThrow(/PORTARIUM_JWT_ISSUER/);
  });

  it('fails startup when JWKS auth is configured without audience validation', async () => {
    for (const key of AUTH_ENV_KEYS) delete process.env[key];
    process.env['PORTARIUM_JWKS_URI'] = 'https://auth.example.com/.well-known/jwks.json';
    process.env['PORTARIUM_JWT_ISSUER'] = 'https://auth.example.com';

    await expect(buildControlPlaneDeps()).rejects.toThrow(/PORTARIUM_JWT_AUDIENCE/);
  });
});

describe('buildInMemoryApprovalStore', () => {
  it('scopes getApprovalById and listApprovals by tenant and workspace', async () => {
    const store = buildInMemoryApprovalStore();
    const approval = (workspaceId: string, runId: string) =>
      parseApprovalV1({
        schemaVersion: 1,
        approvalId: 'approval-shared-id',
        workspaceId,
        runId,
        planId: 'plan-1',
        prompt: 'Approve governed action',
        status: 'Pending',
        requestedAtIso: '2026-02-20T00:00:00.000Z',
        requestedByUserId: 'user-1',
      });

    await store.saveApproval(TenantId('tenant-a'), approval('ws-a', 'run-a'));
    await store.saveApproval(TenantId('tenant-a'), approval('ws-b', 'run-b'));
    await store.saveApproval(TenantId('tenant-b'), approval('ws-a', 'run-c'));

    await expect(
      store.getApprovalById(
        TenantId('tenant-a'),
        WorkspaceId('ws-a'),
        ApprovalId('approval-shared-id'),
      ),
    ).resolves.toMatchObject({ workspaceId: 'ws-a', runId: 'run-a' });
    await expect(
      store.getApprovalById(
        TenantId('tenant-a'),
        WorkspaceId('ws-c'),
        ApprovalId('approval-shared-id'),
      ),
    ).resolves.toBeNull();

    const tenantAWorkspaceA = await store.listApprovals(TenantId('tenant-a'), WorkspaceId('ws-a'), {
      limit: 10,
    });
    expect(tenantAWorkspaceA.items).toHaveLength(1);
    expect(tenantAWorkspaceA.items[0]?.runId).toBe('run-a');

    const tenantBWorkspaceA = await store.listApprovals(TenantId('tenant-b'), WorkspaceId('ws-a'), {
      limit: 10,
    });
    expect(tenantBWorkspaceA.items).toHaveLength(1);
    expect(tenantBWorkspaceA.items[0]?.runId).toBe('run-c');
  });
});
