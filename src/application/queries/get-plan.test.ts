import { describe, expect, it, vi } from 'vitest';

import { parsePlanV1 } from '../../domain/plan/index.js';
import { TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import { APP_ACTIONS } from '../common/actions.js';
import { toAppContext } from '../common/context.js';
import type { AuthorizationPort, PlanQueryStore } from '../ports/index.js';
import { getPlan } from './get-plan.js';

const PLAN = parsePlanV1({
  schemaVersion: 1,
  planId: 'plan-1',
  workspaceId: 'ws-1',
  createdAtIso: '2026-01-01T00:00:00.000Z',
  createdByUserId: 'user-1',
  plannedEffects: [],
});

describe('getPlan', () => {
  it('returns a plan when present', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => true) };
    const planQueryStore: PlanQueryStore = {
      getPlanById: vi.fn(async () => PLAN),
    };

    const result = await getPlan(
      { authorization, planQueryStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      { workspaceId: 'ws-1', planId: 'plan-1' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success response.');
    expect(result.value.planId).toBe(PLAN.planId);
    expect(planQueryStore.getPlanById).toHaveBeenCalledWith(
      TenantId('tenant-1'),
      WorkspaceId('ws-1'),
      'plan-1',
    );
  });

  it('returns NotFound when missing', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => true) };
    const planQueryStore: PlanQueryStore = {
      getPlanById: vi.fn(async () => null),
    };

    const result = await getPlan(
      { authorization, planQueryStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      { workspaceId: 'ws-1', planId: 'plan-404' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected NotFound.');
    expect(result.error.kind).toBe('NotFound');
  });

  it('denies access without plan:read capability', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => false) };
    const planQueryStore: PlanQueryStore = {
      getPlanById: vi.fn(async () => PLAN),
    };

    const result = await getPlan(
      { authorization, planQueryStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['auditor'],
      }),
      { workspaceId: 'ws-1', planId: 'plan-1' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected Forbidden.');
    expect(result.error.kind).toBe('Forbidden');
    expect(authorization.isAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TenantId('tenant-1') }),
      APP_ACTIONS.planRead,
    );
    expect(planQueryStore.getPlanById).not.toHaveBeenCalled();
  });
});
