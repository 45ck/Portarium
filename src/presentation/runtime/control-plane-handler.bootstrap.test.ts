import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseApprovalV1 } from '../../domain/approvals/index.js';
import { ApprovalId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import {
  buildInMemoryApprovalStore,
  buildControlPlaneDeps,
  buildJoseAuthenticationConfigFromEnv,
  getJoseAuthConfigWarnings,
} from './control-plane-handler.bootstrap.js';

const AUTH_ENV_KEYS = [
  'PORTARIUM_JWKS_URI',
  'PORTARIUM_JWT_ISSUER',
  'PORTARIUM_JWT_AUDIENCE',
  'PORTARIUM_JWT_AUTHORIZED_PARTY',
  'PORTARIUM_JWT_TRUSTED_ISSUERS',
  'PORTARIUM_JWT_REQUIRED_TOKEN_TYPE',
  'PORTARIUM_CORS_ALLOWED_ORIGINS',
  'PORTARIUM_ENVIRONMENT',
  'PORTARIUM_DEV_TOKEN',
  'PORTARIUM_DEV_WORKSPACE_ID',
  'PORTARIUM_DEV_USER_ID',
  'ENABLE_DEV_AUTH',
  'DEV_STUB_STORES',
  'NODE_ENV',
  'PORTARIUM_USE_POSTGRES_STORES',
  'PORTARIUM_DATABASE_URL',
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

  it('fails startup when production CORS is configured with a wildcard origin', async () => {
    for (const key of AUTH_ENV_KEYS) delete process.env[key];
    process.env['NODE_ENV'] = 'production';
    process.env['PORTARIUM_CORS_ALLOWED_ORIGINS'] = '*';

    await expect(buildControlPlaneDeps()).rejects.toThrow(/wildcard/);
  });
});

describe('buildJoseAuthenticationConfigFromEnv', () => {
  it('wires authorized party, trusted issuers, audience, and token type from env', () => {
    const config = buildJoseAuthenticationConfigFromEnv({
      NODE_ENV: 'production',
      PORTARIUM_JWKS_URI: 'https://auth.example.com/.well-known/jwks.json',
      PORTARIUM_JWT_ISSUER: 'https://auth.example.com',
      PORTARIUM_JWT_AUDIENCE: 'portarium-api,portarium-cockpit',
      PORTARIUM_JWT_AUTHORIZED_PARTY: 'portarium-cockpit',
      PORTARIUM_JWT_TRUSTED_ISSUERS: 'https://auth.example.com',
      PORTARIUM_JWT_REQUIRED_TOKEN_TYPE: 'at+JWT',
    });

    expect(config).toMatchObject({
      jwksUri: 'https://auth.example.com/.well-known/jwks.json',
      issuer: 'https://auth.example.com',
      audience: ['portarium-api', 'portarium-cockpit'],
      authorizedParty: 'portarium-cockpit',
      trustedIssuers: ['https://auth.example.com'],
      requiredTokenType: 'at+JWT',
    });
  });

  it('fails production JWKS startup when hardening settings are missing', () => {
    expect(() =>
      buildJoseAuthenticationConfigFromEnv({
        NODE_ENV: 'production',
        PORTARIUM_JWKS_URI: 'https://auth.example.com/.well-known/jwks.json',
        PORTARIUM_JWT_ISSUER: 'https://auth.example.com',
        PORTARIUM_JWT_AUDIENCE: 'portarium-api',
      }),
    ).toThrow(/PORTARIUM_JWT_AUTHORIZED_PARTY/);
    expect(() =>
      buildJoseAuthenticationConfigFromEnv({
        NODE_ENV: 'production',
        PORTARIUM_JWKS_URI: 'https://auth.example.com/.well-known/jwks.json',
        PORTARIUM_JWT_ISSUER: 'https://auth.example.com',
        PORTARIUM_JWT_AUDIENCE: 'portarium-api',
      }),
    ).toThrow(/PORTARIUM_JWT_TRUSTED_ISSUERS/);
    expect(() =>
      buildJoseAuthenticationConfigFromEnv({
        NODE_ENV: 'production',
        PORTARIUM_JWKS_URI: 'https://auth.example.com/.well-known/jwks.json',
        PORTARIUM_JWT_ISSUER: 'https://auth.example.com',
        PORTARIUM_JWT_AUDIENCE: 'portarium-api',
      }),
    ).toThrow(/PORTARIUM_JWT_REQUIRED_TOKEN_TYPE/);
  });

  it('rejects unsupported JWT required token type values', () => {
    expect(() =>
      buildJoseAuthenticationConfigFromEnv({
        NODE_ENV: 'production',
        PORTARIUM_JWKS_URI: 'https://auth.example.com/.well-known/jwks.json',
        PORTARIUM_JWT_ISSUER: 'https://auth.example.com',
        PORTARIUM_JWT_AUDIENCE: 'portarium-api',
        PORTARIUM_JWT_AUTHORIZED_PARTY: 'portarium-cockpit',
        PORTARIUM_JWT_TRUSTED_ISSUERS: 'https://auth.example.com',
        PORTARIUM_JWT_REQUIRED_TOKEN_TYPE: 'id+JWT',
      }),
    ).toThrow(/PORTARIUM_JWT_REQUIRED_TOKEN_TYPE/);
  });

  it('requires trusted issuers to include the configured issuer', () => {
    expect(() =>
      buildJoseAuthenticationConfigFromEnv({
        NODE_ENV: 'production',
        PORTARIUM_JWKS_URI: 'https://auth.example.com/.well-known/jwks.json',
        PORTARIUM_JWT_ISSUER: 'https://auth.example.com',
        PORTARIUM_JWT_AUDIENCE: 'portarium-api',
        PORTARIUM_JWT_AUTHORIZED_PARTY: 'portarium-cockpit',
        PORTARIUM_JWT_TRUSTED_ISSUERS: 'https://other-idp.example.com',
        PORTARIUM_JWT_REQUIRED_TOKEN_TYPE: 'at+JWT',
      }),
    ).toThrow(/must include PORTARIUM_JWT_ISSUER/);
  });
});

describe('buildControlPlaneDeps store bootstrap', () => {
  it('wires workforce, queue, and human-task stores in dev stub mode', async () => {
    for (const key of AUTH_ENV_KEYS) delete process.env[key];
    process.env['NODE_ENV'] = 'test';
    process.env['DEV_STUB_STORES'] = 'true';
    process.env['ENABLE_DEV_AUTH'] = 'true';
    process.env['PORTARIUM_DEV_TOKEN'] = 'dev-token';
    process.env['PORTARIUM_DEV_WORKSPACE_ID'] = 'workspace-1';
    process.env['PORTARIUM_DEV_USER_ID'] = 'user-1';

    const deps = await buildControlPlaneDeps();

    expect(deps.workforceMemberStore?.listWorkforceMembers).toBeTypeOf('function');
    expect(deps.workforceQueueStore?.listWorkforceQueues).toBeTypeOf('function');
    expect(deps.humanTaskStore?.listHumanTasks).toBeTypeOf('function');

    const members = await deps.workforceMemberStore!.listWorkforceMembers!(
      TenantId('workspace-1'),
      {
        workspaceId: 'workspace-1',
        limit: 10,
      },
    );
    const queues = await deps.workforceQueueStore!.listWorkforceQueues!(TenantId('workspace-1'), {
      workspaceId: 'workspace-1',
      limit: 10,
    });
    const tasks = await deps.humanTaskStore!.listHumanTasks!(TenantId('workspace-1'), {
      workspaceId: 'workspace-1',
      limit: 10,
    });

    expect(members.items.map((member) => member.workforceMemberId)).toContain('wm-1');
    expect(queues.items.map((queue) => queue.workforceQueueId)).toContain('queue-finance');
    expect(tasks.items.map((task) => task.humanTaskId)).toContain('ht-1');
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
