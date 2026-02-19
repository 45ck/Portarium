import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TenantId } from '../../domain/primitives/index.js';
import { parseWorkspaceV1 } from '../../domain/workspaces/workspace-v1.js';
import { registerWorkspace } from './register-workspace.js';
import { toAppContext } from '../common/context.js';
import { APP_ACTIONS } from '../common/actions.js';
import type {
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  IdempotencyStore,
  UnitOfWork,
  WorkspaceStore,
} from '../ports/index.js';

const WORKSPACE_INPUT = {
  schemaVersion: 1,
  workspaceId: 'ws-1',
  tenantId: 'tenant-1',
  name: 'Primary Workspace',
  createdAtIso: '2026-02-17T00:00:00.000Z',
};

describe('registerWorkspace', () => {
  let authorization: AuthorizationPort;
  let clock: Clock;
  let idGenerator: IdGenerator;
  let idempotency: IdempotencyStore;
  let unitOfWork: UnitOfWork;
  let workspaceStore: WorkspaceStore;
  let eventPublisher: EventPublisher;

  beforeEach(() => {
    authorization = {
      isAllowed: vi.fn(async () => true),
    };

    clock = {
      nowIso: vi.fn(() => '2026-02-17T00:00:00.000Z'),
    };

    idGenerator = {
      generateId: vi.fn(() => 'evt-1'),
    };

    idempotency = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => undefined),
    };

    unitOfWork = {
      execute: vi.fn(async (fn) => fn()),
    };

    workspaceStore = {
      getWorkspaceById: vi.fn(async () => null),
      getWorkspaceByName: vi.fn(async () => null),
      saveWorkspace: vi.fn(async () => undefined),
    };

    eventPublisher = {
      publish: vi.fn(async () => undefined),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a workspace and emits an idempotent event', async () => {
    const output = await registerWorkspace(
      {
        authorization,
        clock,
        idGenerator,
        idempotency,
        unitOfWork,
        workspaceStore,
        eventPublisher,
      },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['admin'],
      }),
      {
        idempotencyKey: 'request-1',
        workspace: WORKSPACE_INPUT,
      },
    );

    expect(output.ok).toBe(true);
    if (!output.ok) throw new Error('Expected success response.');
    expect(output.value.workspaceId).toBe('ws-1');
    expect(authorization.isAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TenantId('tenant-1') }),
      APP_ACTIONS.workspaceRegister,
    );
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
    expect(idempotency.set).toHaveBeenCalledTimes(1);
    expect(workspaceStore.saveWorkspace).toHaveBeenCalledTimes(1);
  });

  it('returns cached output when the idempotency key repeats', async () => {
    idempotency.get = vi.fn(async () => ({ workspaceId: 'ws-1' })) as IdempotencyStore['get'];

    const output = await registerWorkspace(
      {
        authorization,
        clock,
        idGenerator,
        idempotency,
        unitOfWork,
        workspaceStore,
        eventPublisher,
      },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['admin'],
      }),
      {
        idempotencyKey: 'request-1',
        workspace: WORKSPACE_INPUT,
      },
    );

    expect(output.ok).toBe(true);
    if (!output.ok) throw new Error('Expected success response.');
    expect(output.value.workspaceId).toBe('ws-1');
    expect(workspaceStore.saveWorkspace).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('fails dependency validation when clock returns empty timestamp', async () => {
    clock.nowIso = vi.fn(() => '');
    const output = await registerWorkspace(
      {
        authorization,
        clock,
        idGenerator,
        idempotency,
        unitOfWork,
        workspaceStore,
        eventPublisher,
      },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['admin'],
      }),
      {
        idempotencyKey: 'request-1',
        workspace: WORKSPACE_INPUT,
      },
    );

    expect(output.ok).toBe(false);
    if (output.ok) {
      throw new Error('Expected dependency failure response.');
    }
    expect(output.error.kind).toBe('DependencyFailure');
  });

  it('fails dependency validation when id generator returns empty id', async () => {
    idGenerator.generateId = vi.fn(() => '');
    const output = await registerWorkspace(
      {
        authorization,
        clock,
        idGenerator,
        idempotency,
        unitOfWork,
        workspaceStore,
        eventPublisher,
      },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['admin'],
      }),
      {
        idempotencyKey: 'request-1',
        workspace: WORKSPACE_INPUT,
      },
    );

    expect(output.ok).toBe(false);
    if (output.ok) {
      throw new Error('Expected dependency failure response.');
    }
    expect(output.error.kind).toBe('DependencyFailure');
  });

  it('rejects tenant boundary mismatch', async () => {
    const output = await registerWorkspace(
      {
        authorization,
        clock,
        idGenerator,
        idempotency,
        unitOfWork,
        workspaceStore,
        eventPublisher,
      },
      toAppContext({
        tenantId: 'tenant-other',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['admin'],
      }),
      {
        idempotencyKey: 'request-1',
        workspace: WORKSPACE_INPUT,
      },
    );

    expect(output.ok).toBe(false);
    if (output.ok) throw new Error('Expected forbidden response.');
    expect(output.error.kind).toBe('Forbidden');
  });

  it('rejects duplicate workspace names across ids', async () => {
    workspaceStore.getWorkspaceByName = vi.fn(async () =>
      parseWorkspaceV1({
        schemaVersion: 1,
        workspaceId: 'ws-existing',
        tenantId: 'tenant-1',
        name: WORKSPACE_INPUT.name,
        createdAtIso: '2026-02-16T00:00:00.000Z',
      }),
    );

    const output = await registerWorkspace(
      {
        authorization,
        clock,
        idGenerator,
        idempotency,
        unitOfWork,
        workspaceStore,
        eventPublisher,
      },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['admin'],
      }),
      {
        idempotencyKey: 'request-2',
        workspace: WORKSPACE_INPUT,
      },
    );

    expect(output.ok).toBe(false);
    if (output.ok) throw new Error('Expected conflict response.');
    expect(output.error.kind).toBe('Conflict');
    expect(output.error.message).toContain('already in use');
    expect(workspaceStore.saveWorkspace).not.toHaveBeenCalled();
  });
});
