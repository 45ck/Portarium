import { describe, expect, it } from 'vitest';

import { parsePlanV1 } from './plan-v1.js';

describe('parsePlanV1: happy path', () => {
  it('parses a minimal PlanV1 with planned effects', () => {
    const plan = parsePlanV1({
      schemaVersion: 1,
      planId: 'plan-1',
      workspaceId: 'ws-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      createdByUserId: 'user-1',
      plannedEffects: [
        {
          effectId: 'eff-1',
          operation: 'Create',
          target: {
            sorName: 'stripe',
            portFamily: 'PaymentsBilling',
            externalId: 'cus_123',
            externalType: 'Customer',
          },
          summary: 'Create customer record',
        },
      ],
    });

    expect(plan.schemaVersion).toBe(1);
    expect(plan.plannedEffects).toHaveLength(1);
    expect(plan.predictedEffects).toBeUndefined();
  });

  it('parses predicted effects with confidence', () => {
    const plan = parsePlanV1({
      schemaVersion: 1,
      planId: 'plan-1',
      workspaceId: 'ws-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      createdByUserId: 'user-1',
      plannedEffects: [],
      predictedEffects: [
        {
          effectId: 'eff-2',
          operation: 'Update',
          target: {
            sorName: 'stripe',
            portFamily: 'PaymentsBilling',
            externalId: 'inv_123',
            externalType: 'Invoice',
          },
          summary: 'Mark invoice as paid',
          confidence: 0.75,
        },
      ],
    });

    expect(plan.predictedEffects?.[0]?.confidence).toBe(0.75);
  });

  it('parses predicted effects without confidence', () => {
    const plan = parsePlanV1({
      schemaVersion: 1,
      planId: 'plan-1',
      workspaceId: 'ws-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      createdByUserId: 'user-1',
      plannedEffects: [],
      predictedEffects: [
        {
          effectId: 'eff-3',
          operation: 'Upsert',
          target: {
            sorName: 'stripe',
            portFamily: 'PaymentsBilling',
            externalId: 'inv_456',
            externalType: 'Invoice',
          },
          summary: 'Ensure invoice exists',
        },
      ],
    });

    expect(plan.predictedEffects?.[0]).toEqual(
      expect.objectContaining({
        operation: 'Upsert',
      }),
    );
    expect(plan.predictedEffects?.[0]).not.toHaveProperty('confidence');
  });

  it('parses planned effects with idempotencyKey', () => {
    const plan = parsePlanV1({
      schemaVersion: 1,
      planId: 'plan-1',
      workspaceId: 'ws-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      createdByUserId: 'user-1',
      plannedEffects: [
        {
          effectId: 'eff-4',
          operation: 'Delete',
          target: {
            sorName: 'stripe',
            portFamily: 'PaymentsBilling',
            externalId: 'cus_999',
            externalType: 'Customer',
          },
          summary: 'Delete customer record',
          idempotencyKey: 'delete-cus_999',
        },
      ],
    });

    expect(plan.plannedEffects[0]?.idempotencyKey).toBe('delete-cus_999');
  });
});

describe('parsePlanV1: validation', () => {
  it('rejects out-of-range confidence', () => {
    expect(() =>
      parsePlanV1({
        schemaVersion: 1,
        planId: 'plan-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        plannedEffects: [],
        predictedEffects: [
          {
            effectId: 'eff-2',
            operation: 'Update',
            target: {
              sorName: 'stripe',
              portFamily: 'PaymentsBilling',
              externalId: 'inv_123',
              externalType: 'Invoice',
            },
            summary: 'Mark invoice as paid',
            confidence: 2,
          },
        ],
      }),
    ).toThrow(/confidence/i);
  });

  it('rejects invalid top-level inputs and schema versions', () => {
    expect(() => parsePlanV1('nope')).toThrow(/Plan must be an object/i);

    expect(() =>
      parsePlanV1({
        schemaVersion: 2,
        planId: 'plan-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        plannedEffects: [],
      }),
    ).toThrow(/schemaVersion/i);

    expect(() =>
      parsePlanV1({
        schemaVersion: 1.5,
        planId: 'plan-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        plannedEffects: [],
      }),
    ).toThrow(/schemaVersion/i);
  });

  it('rejects invalid plannedEffects and predictedEffects shapes', () => {
    expect(() =>
      parsePlanV1({
        schemaVersion: 1,
        planId: 'plan-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        plannedEffects: {},
      }),
    ).toThrow(/plannedEffects must be an array/i);

    expect(() =>
      parsePlanV1({
        schemaVersion: 1,
        planId: 'plan-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        plannedEffects: [],
        predictedEffects: {},
      }),
    ).toThrow(/predictedEffects must be an array/i);
  });

  it('rejects invalid plannedEffects entries', () => {
    expect(() =>
      parsePlanV1({
        schemaVersion: 1,
        planId: 'plan-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        plannedEffects: [null],
      }),
    ).toThrow(/plannedEffects\[0\].*object/i);
  });

  it('rejects invalid nested targets and required strings', () => {
    expect(() =>
      parsePlanV1({
        schemaVersion: 1,
        planId: 'plan-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        plannedEffects: [
          {
            effectId: 'eff-1',
            operation: 'Create',
            target: {
              sorName: 'stripe',
              portFamily: 'NotARealPortFamily',
              externalId: 'x',
              externalType: 'Thing',
            },
            summary: 'Create thing',
          },
        ],
      }),
    ).toThrow(/portFamily/i);

    expect(() =>
      parsePlanV1({
        schemaVersion: 1,
        planId: 'plan-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        plannedEffects: [
          {
            effectId: 'eff-1',
            operation: 'Create',
            target: {
              sorName: 'stripe',
              portFamily: 'PaymentsBilling',
              externalId: 'x',
              externalType: 'Thing',
            },
            summary: '   ',
          },
        ],
      }),
    ).toThrow(/summary/i);
  });

  it('rejects invalid operation values', () => {
    expect(() =>
      parsePlanV1({
        schemaVersion: 1,
        planId: 'plan-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        plannedEffects: [
          {
            effectId: 'eff-1',
            operation: 'MakeItSo',
            target: {
              sorName: 'stripe',
              portFamily: 'PaymentsBilling',
              externalId: 'cus_123',
              externalType: 'Customer',
            },
            summary: 'Nope',
          },
        ],
      }),
    ).toThrow(/operation/i);
  });

  it('rejects invalid confidence types', () => {
    expect(() =>
      parsePlanV1({
        schemaVersion: 1,
        planId: 'plan-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        plannedEffects: [],
        predictedEffects: [
          {
            effectId: 'eff-2',
            operation: 'Update',
            target: {
              sorName: 'stripe',
              portFamily: 'PaymentsBilling',
              externalId: 'inv_123',
              externalType: 'Invoice',
            },
            summary: 'Mark invoice as paid',
            confidence: NaN,
          },
        ],
      }),
    ).toThrow(/confidence/i);

    expect(() =>
      parsePlanV1({
        schemaVersion: 1,
        planId: 'plan-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        plannedEffects: [],
        predictedEffects: [
          {
            effectId: 'eff-2',
            operation: 'Update',
            target: {
              sorName: 'stripe',
              portFamily: 'PaymentsBilling',
              externalId: 'inv_123',
              externalType: 'Invoice',
            },
            summary: 'Mark invoice as paid',
            confidence: Number.POSITIVE_INFINITY,
          },
        ],
      }),
    ).toThrow(/confidence/i);
  });

  it('rejects invalid idempotencyKey values', () => {
    expect(() =>
      parsePlanV1({
        schemaVersion: 1,
        planId: 'plan-1',
        workspaceId: 'ws-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
        createdByUserId: 'user-1',
        plannedEffects: [
          {
            effectId: 'eff-4',
            operation: 'Delete',
            target: {
              sorName: 'stripe',
              portFamily: 'PaymentsBilling',
              externalId: 'cus_999',
              externalType: 'Customer',
            },
            summary: 'Delete customer record',
            idempotencyKey: '   ',
          },
        ],
      }),
    ).toThrow(/idempotencyKey/i);
  });
});
