import { describe, expect, it } from 'vitest';

import type {
  ActionId,
  CorrelationId,
  MachineId,
  RunId,
  TenantId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type {
  InvokeToolInput,
  MachineInvokerPort,
  MachineInvokerResult,
  RunAgentInput,
} from '../ports/machine-invoker.js';
import type { WorkspaceActor } from '../iam/workspace-actor.js';
import {
  ActionGatedToolInvoker,
  type ActionGatedToolInvokeInput,
  type ActionGatedToolInvokeResult,
} from './action-gated-tool-invoker.js';

// ---------------------------------------------------------------------------
// Stub invoker
// ---------------------------------------------------------------------------

type CapturedToolCall = Readonly<{
  toolName: string;
  parameters: Record<string, unknown>;
  tenantId: TenantId;
  runId: RunId;
  actionId: ActionId;
  correlationId: CorrelationId;
  machineId: MachineId;
  policyTier?: string;
}>;

function createStubInvoker(result: MachineInvokerResult = { ok: true, output: { stub: true } }): {
  invoker: MachineInvokerPort;
  calls: CapturedToolCall[];
} {
  const calls: CapturedToolCall[] = [];

  const invoker: MachineInvokerPort = {
    runAgent: async (_input: RunAgentInput): Promise<MachineInvokerResult> => {
      return { ok: false, errorKind: 'RemoteError', message: 'Not implemented in stub.' };
    },
    invokeTool: async (input: InvokeToolInput): Promise<MachineInvokerResult> => {
      calls.push({
        toolName: input.toolName,
        parameters: input.parameters,
        tenantId: input.tenantId,
        runId: input.runId,
        actionId: input.actionId,
        correlationId: input.correlationId,
        machineId: input.machineId,
        ...(input.policyTier !== undefined ? { policyTier: input.policyTier } : {}),
      });
      return result;
    },
  };

  return { invoker, calls };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OPERATOR_ACTOR: WorkspaceActor = {
  userId: 'user-op-1' as UserId,
  workspaceId: 'ws-1' as WorkspaceId,
  roles: ['operator'],
};

const ADMIN_ACTOR: WorkspaceActor = {
  userId: 'user-admin-1' as UserId,
  workspaceId: 'ws-1' as WorkspaceId,
  roles: ['admin'],
};

const AUDITOR_ACTOR: WorkspaceActor = {
  userId: 'user-audit-1' as UserId,
  workspaceId: 'ws-1' as WorkspaceId,
  roles: ['auditor'],
};

function baseInput(actor: WorkspaceActor): ActionGatedToolInvokeInput {
  return {
    actor,
    tenantId: 'ws-1' as TenantId,
    runId: 'run-1' as RunId,
    actionId: 'action-1' as ActionId,
    correlationId: 'corr-1' as CorrelationId,
    machineId: 'machine-1' as MachineId,
    toolName: 'read:file',
    parameters: { path: '/tmp/data.json' },
    policyTier: 'Auto',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActionGatedToolInvoker', () => {
  describe('authorization gate', () => {
    it('allows operators to invoke tools', async () => {
      const { invoker, calls } = createStubInvoker();
      const gated = new ActionGatedToolInvoker(invoker);

      const result = await gated.invoke(baseInput(OPERATOR_ACTOR));

      expect(result.proposed).toBe(true);
      expect(calls).toHaveLength(1);
    });

    it('allows admins to invoke tools', async () => {
      const { invoker, calls } = createStubInvoker();
      const gated = new ActionGatedToolInvoker(invoker);

      const result = await gated.invoke(baseInput(ADMIN_ACTOR));

      expect(result.proposed).toBe(true);
      expect(calls).toHaveLength(1);
    });

    it('denies auditors with clear authorization error', async () => {
      const { invoker, calls } = createStubInvoker();
      const gated = new ActionGatedToolInvoker(invoker);

      const result = await gated.invoke(baseInput(AUDITOR_ACTOR));

      expect(result).toEqual({
        proposed: false,
        denied: true,
        reason: 'authorization',
        message: 'Actor lacks required role for tool:invoke.',
      });
      expect(calls).toHaveLength(0);
    });
  });

  describe('policy gate', () => {
    it('allows read-only tools at Auto tier', async () => {
      const { invoker, calls } = createStubInvoker();
      const gated = new ActionGatedToolInvoker(invoker);

      const result = await gated.invoke({
        ...baseInput(OPERATOR_ACTOR),
        toolName: 'list:items',
        policyTier: 'Auto',
      });

      expect(result.proposed).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.toolName).toBe('list:items');
    });

    it('denies dangerous tools at Auto tier with policy error', async () => {
      const { invoker, calls } = createStubInvoker();
      const gated = new ActionGatedToolInvoker(invoker);

      const result = await gated.invoke({
        ...baseInput(OPERATOR_ACTOR),
        toolName: 'shell.exec',
        policyTier: 'Auto',
      });

      expect(result).toEqual({
        proposed: false,
        denied: true,
        reason: 'policy',
        message: 'Policy denied tool "shell.exec" at tier "Auto"; requires "ManualOnly".',
      });
      expect(calls).toHaveLength(0);
    });

    it('denies mutation tools at Auto tier', async () => {
      const { invoker, calls } = createStubInvoker();
      const gated = new ActionGatedToolInvoker(invoker);

      const result = await gated.invoke({
        ...baseInput(OPERATOR_ACTOR),
        toolName: 'create:ticket',
        policyTier: 'Auto',
      });

      assertDenied(result);
      expect(result.reason).toBe('policy');
      expect(calls).toHaveLength(0);
    });

    it('allows mutation tools at HumanApprove tier', async () => {
      const { invoker, calls } = createStubInvoker();
      const gated = new ActionGatedToolInvoker(invoker);

      const result = await gated.invoke({
        ...baseInput(OPERATOR_ACTOR),
        toolName: 'create:ticket',
        policyTier: 'HumanApprove',
      });

      expect(result.proposed).toBe(true);
      expect(calls).toHaveLength(1);
    });

    it('allows dangerous tools at ManualOnly tier', async () => {
      const { invoker, calls } = createStubInvoker();
      const gated = new ActionGatedToolInvoker(invoker);

      const result = await gated.invoke({
        ...baseInput(OPERATOR_ACTOR),
        toolName: 'shell.exec',
        policyTier: 'ManualOnly',
      });

      expect(result.proposed).toBe(true);
      expect(calls).toHaveLength(1);
    });
  });

  describe('identity preservation', () => {
    it('preserves tenantId and correlationId end-to-end', async () => {
      const { invoker, calls } = createStubInvoker();
      const gated = new ActionGatedToolInvoker(invoker);

      await gated.invoke({
        ...baseInput(OPERATOR_ACTOR),
        tenantId: 'tenant-xyz' as TenantId,
        runId: 'run-xyz' as RunId,
        actionId: 'action-xyz' as ActionId,
        correlationId: 'corr-xyz' as CorrelationId,
        machineId: 'machine-xyz' as MachineId,
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        tenantId: 'tenant-xyz',
        runId: 'run-xyz',
        actionId: 'action-xyz',
        correlationId: 'corr-xyz',
        machineId: 'machine-xyz',
      });
    });

    it('preserves policyTier through to the underlying invoker', async () => {
      const { invoker, calls } = createStubInvoker();
      const gated = new ActionGatedToolInvoker(invoker);

      await gated.invoke({
        ...baseInput(OPERATOR_ACTOR),
        toolName: 'list:items',
        policyTier: 'Assisted',
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]!.policyTier).toBe('Assisted');
    });
  });

  describe('execution flow', () => {
    it('returns underlying invoker success with proposed=true', async () => {
      const { invoker } = createStubInvoker({ ok: true, output: { data: 42 } });
      const gated = new ActionGatedToolInvoker(invoker);

      const result = await gated.invoke(baseInput(OPERATOR_ACTOR));

      expect(result).toEqual({ ok: true, output: { data: 42 }, proposed: true });
    });

    it('returns underlying invoker failure with proposed=true', async () => {
      const { invoker } = createStubInvoker({
        ok: false,
        errorKind: 'Timeout',
        message: 'Gateway request timed out.',
      });
      const gated = new ActionGatedToolInvoker(invoker);

      const result = await gated.invoke(baseInput(OPERATOR_ACTOR));

      expect(result).toEqual({
        ok: false,
        errorKind: 'Timeout',
        message: 'Gateway request timed out.',
        proposed: true,
      });
    });

    it('authorization check runs before policy check', async () => {
      const { invoker, calls } = createStubInvoker();
      const gated = new ActionGatedToolInvoker(invoker);

      // Auditor + dangerous tool — should fail on authorization, not policy
      const result = await gated.invoke({
        ...baseInput(AUDITOR_ACTOR),
        toolName: 'shell.exec',
        policyTier: 'Auto',
      });

      assertDenied(result);
      expect(result.reason).toBe('authorization');
      expect(calls).toHaveLength(0);
    });

    it('does not call underlying invoker when denied', async () => {
      const { invoker, calls } = createStubInvoker();
      const gated = new ActionGatedToolInvoker(invoker);

      await gated.invoke(baseInput(AUDITOR_ACTOR));
      await gated.invoke({
        ...baseInput(OPERATOR_ACTOR),
        toolName: 'shell.exec',
        policyTier: 'Auto',
      });

      expect(calls).toHaveLength(0);
    });
  });
});

function assertDenied(
  result: ActionGatedToolInvokeResult,
): asserts result is Extract<ActionGatedToolInvokeResult, { denied: true }> {
  expect(result.proposed).toBe(false);
  if (!('denied' in result)) throw new Error('Expected denied result.');
}
