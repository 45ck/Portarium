import { describe, expect, it, vi } from 'vitest';

import { parseRunV1 } from '../../domain/runs/run-v1.js';
import { TenantId } from '../../domain/primitives/index.js';
import { toAppContext } from '../common/context.js';
import { APP_ACTIONS } from '../common/actions.js';
import { type AuthorizationPort, type RunStore } from '../ports/index.js';
import { getRun } from './get-run.js';
import { createCanonicalRunSeedV1 } from '../../domain/testing/canonical-seeds-v1.js';

const RUN = parseRunV1(createCanonicalRunSeedV1());

describe('getRun', () => {
  it('returns run when present', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => true) };
    const runStore: RunStore = {
      getRunById: vi.fn(async () => RUN),
      saveRun: vi.fn(async () => undefined),
    };

    const result = await getRun(
      { authorization, runStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        workspaceId: 'ws-1',
        runId: 'run-1',
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success response.');
    }
    expect(result.value.runId).toBe('run-1');
  });

  it('returns NotFound when missing', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => true) };
    const runStore: RunStore = {
      getRunById: vi.fn(async () => null),
      saveRun: vi.fn(async () => undefined),
    };

    const result = await getRun(
      { authorization, runStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      {
        workspaceId: 'ws-1',
        runId: 'run-2',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected not found response.');
    }
    expect(result.error.kind).toBe('NotFound');
  });

  it('denies access', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => false) };
    const runStore: RunStore = {
      getRunById: vi.fn(async () => RUN),
      saveRun: vi.fn(async () => undefined),
    };

    const result = await getRun(
      { authorization, runStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['auditor'],
      }),
      {
        workspaceId: 'ws-1',
        runId: 'run-1',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected forbidden response.');
    }
    expect(result.error.kind).toBe('Forbidden');
    expect(authorization.isAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TenantId('tenant-1') }),
      APP_ACTIONS.runRead,
    );
    expect(runStore.getRunById).not.toHaveBeenCalled();
  });
});
