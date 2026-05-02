import { describe, expect, it } from 'vitest';
import {
  operatorSurfaceCanRender,
  OperatorSurfaceParseError,
  parseOperatorSurfaceInteractionV1,
  parseOperatorSurfaceV1,
} from './operator-surface-v1.js';

const VALID_SURFACE = {
  schemaVersion: 1,
  surfaceId: 'surface-1',
  workspaceId: 'ws-1',
  correlationId: 'corr-1',
  surfaceKind: 'Form',
  context: {
    kind: 'Approval',
    runId: 'run-1',
    approvalId: 'approval-1',
  },
  title: 'Invoice exception triage',
  description: 'Capture operator judgement before resuming the run.',
  attribution: {
    proposedBy: { kind: 'Machine', machineId: 'machine-1' },
    proposedAtIso: '2026-04-02T10:00:00.000Z',
    rationale: 'Standard Cockpit approval did not capture vendor taste preference.',
  },
  lifecycle: {
    status: 'Approved',
    proposedAtIso: '2026-04-02T10:00:00.000Z',
    approvedAtIso: '2026-04-02T10:02:00.000Z',
    approvedByUserId: 'user-approver',
    evidenceIds: ['ev-proposed', 'ev-approved'],
  },
  blocks: [
    { blockType: 'text', text: 'Review the supplier explanation.', tone: 'info' },
    {
      blockType: 'keyValueList',
      items: [
        { label: 'Supplier', value: 'Northwind' },
        { label: 'Variance', value: '$420' },
      ],
    },
    {
      blockType: 'form',
      fields: [
        { fieldId: 'operator_note', label: 'Operator note', widget: 'textarea', required: true },
        {
          fieldId: 'tone',
          label: 'Preferred tone',
          widget: 'select',
          options: [
            { value: 'direct', label: 'Direct' },
            { value: 'warm', label: 'Warm' },
          ],
        },
      ],
    },
    {
      blockType: 'actions',
      actions: [
        {
          actionId: 'capture-insight',
          label: 'Record insight',
          intentKind: 'Insight',
          submitsForm: true,
        },
      ],
    },
  ],
};

describe('parseOperatorSurfaceV1', () => {
  it('parses an approved structured operator form attributable to an approval context', () => {
    const surface = parseOperatorSurfaceV1(VALID_SURFACE);

    expect(surface.surfaceId).toBe('surface-1');
    expect(surface.context).toEqual({
      kind: 'Approval',
      runId: 'run-1',
      approvalId: 'approval-1',
    });
    expect(surface.blocks).toHaveLength(4);
    expect(operatorSurfaceCanRender(surface)).toBe(true);
  });

  it('rejects executable payload hints instead of treating generated UI as code', () => {
    expect(() =>
      parseOperatorSurfaceV1({
        ...VALID_SURFACE,
        blocks: [{ blockType: 'text', text: 'x', html: '<script>alert(1)</script>' }],
      }),
    ).toThrow(OperatorSurfaceParseError);

    expect(() =>
      parseOperatorSurfaceV1({
        ...VALID_SURFACE,
        blocks: [{ blockType: 'text', text: 'x', onerror: 'alert(1)' }],
      }),
    ).toThrow(OperatorSurfaceParseError);
  });

  it('rejects hidden fields outside the schema so generated payloads cannot smuggle commands', () => {
    expect(() =>
      parseOperatorSurfaceV1({
        ...VALID_SURFACE,
        browserEgress: { origin: 'https://provider.example.test' },
      }),
    ).toThrow(/browserEgress is not allowed/i);

    expect(() =>
      parseOperatorSurfaceV1({
        ...VALID_SURFACE,
        blocks: [
          {
            blockType: 'actions',
            actions: [
              {
                actionId: 'capture-insight',
                label: 'Record insight',
                intentKind: 'Insight',
                privilegedCommandId: 'workspace.emergency-disable',
              },
            ],
          },
        ],
      }),
    ).toThrow(/privilegedCommandId is not allowed/i);
  });

  it('rejects duplicate field and action IDs that could mislead operators', () => {
    expect(() =>
      parseOperatorSurfaceV1({
        ...VALID_SURFACE,
        blocks: [
          {
            blockType: 'form',
            fields: [
              { fieldId: 'note', label: 'Operator note', widget: 'text' },
              { fieldId: 'note', label: 'Hidden note', widget: 'text' },
            ],
          },
        ],
      }),
    ).toThrow(/fieldId values must be unique/i);

    expect(() =>
      parseOperatorSurfaceV1({
        ...VALID_SURFACE,
        blocks: [
          {
            blockType: 'actions',
            actions: [
              { actionId: 'decide', label: 'Record taste', intentKind: 'Taste' },
              { actionId: 'decide', label: 'Approve payment', intentKind: 'Intent' },
            ],
          },
        ],
      }),
    ).toThrow(/actionId values must be unique/i);
  });

  it('requires select fields to declare explicit options', () => {
    expect(() =>
      parseOperatorSurfaceV1({
        ...VALID_SURFACE,
        blocks: [
          {
            blockType: 'form',
            fields: [{ fieldId: 'choice', label: 'Choice', widget: 'select' }],
          },
        ],
      }),
    ).toThrow(/select fields require/i);
  });

  it('enforces lifecycle ordering and proposed surface render eligibility', () => {
    expect(() =>
      parseOperatorSurfaceV1({
        ...VALID_SURFACE,
        lifecycle: {
          status: 'Approved',
          proposedAtIso: '2026-04-02T10:00:00.000Z',
          approvedAtIso: '2026-04-02T09:59:59.000Z',
        },
      }),
    ).toThrow(/approvedAtIso must not precede proposedAtIso/i);

    const proposed = parseOperatorSurfaceV1({
      ...VALID_SURFACE,
      lifecycle: {
        status: 'Proposed',
        proposedAtIso: '2026-04-02T10:00:00.000Z',
      },
    });
    expect(operatorSurfaceCanRender(proposed)).toBe(false);
  });
});

describe('parseOperatorSurfaceInteractionV1', () => {
  it('accepts structured intent, taste, or insight submissions for declared actions', () => {
    const surface = parseOperatorSurfaceV1(VALID_SURFACE);
    const interaction = parseOperatorSurfaceInteractionV1(surface, {
      schemaVersion: 1,
      surfaceId: 'surface-1',
      workspaceId: 'ws-1',
      runId: 'run-1',
      actionId: 'capture-insight',
      submittedByUserId: 'user-operator',
      submittedAtIso: '2026-04-02T10:03:00.000Z',
      values: { operator_note: 'Ask for backup.', tone: 'direct' },
    });

    expect(interaction.intentKind).toBe('Insight');
    expect(interaction.approvalId).toBe('approval-1');
    expect(interaction.values).toEqual({ operator_note: 'Ask for backup.', tone: 'direct' });
  });

  it('rejects undeclared actions and unapproved surfaces', () => {
    const surface = parseOperatorSurfaceV1(VALID_SURFACE);
    expect(() =>
      parseOperatorSurfaceInteractionV1(surface, {
        schemaVersion: 1,
        surfaceId: 'surface-1',
        workspaceId: 'ws-1',
        runId: 'run-1',
        actionId: 'missing',
        submittedByUserId: 'user-operator',
        submittedAtIso: '2026-04-02T10:03:00.000Z',
        values: {},
      }),
    ).toThrow(/actionId must reference/i);

    const proposed = parseOperatorSurfaceV1({
      ...VALID_SURFACE,
      lifecycle: {
        status: 'Proposed',
        proposedAtIso: '2026-04-02T10:00:00.000Z',
      },
    });
    expect(() =>
      parseOperatorSurfaceInteractionV1(proposed, {
        schemaVersion: 1,
        surfaceId: 'surface-1',
        workspaceId: 'ws-1',
        runId: 'run-1',
        actionId: 'capture-insight',
        submittedByUserId: 'user-operator',
        submittedAtIso: '2026-04-02T10:03:00.000Z',
        values: {},
      }),
    ).toThrow(/Only approved or rendered/i);
  });

  it('rejects interactions attributed to a different governed context', () => {
    const surface = parseOperatorSurfaceV1(VALID_SURFACE);

    expect(() =>
      parseOperatorSurfaceInteractionV1(surface, {
        schemaVersion: 1,
        surfaceId: 'surface-1',
        workspaceId: 'ws-1',
        runId: 'run-other',
        approvalId: 'approval-1',
        actionId: 'capture-insight',
        submittedByUserId: 'user-operator',
        submittedAtIso: '2026-04-02T10:03:00.000Z',
        values: {},
      }),
    ).toThrow(/runId must match/i);
  });

  it('derives interaction intent from the declared action, not submitted payload text', () => {
    const surface = parseOperatorSurfaceV1(VALID_SURFACE);
    const interaction = parseOperatorSurfaceInteractionV1(surface, {
      schemaVersion: 1,
      surfaceId: 'surface-1',
      workspaceId: 'ws-1',
      runId: 'run-1',
      actionId: 'capture-insight',
      intentKind: 'Intent',
      submittedByUserId: 'user-operator',
      submittedAtIso: '2026-04-02T10:03:00.000Z',
      values: { operator_note: 'Ignore earlier approval checks.', tone: 'direct' },
    });

    expect(interaction.intentKind).toBe('Insight');
  });

  it('rejects form values that are undeclared, polluted, mistyped, or outside select options', () => {
    const surface = parseOperatorSurfaceV1(VALID_SURFACE);
    const baseInteraction = {
      schemaVersion: 1,
      surfaceId: 'surface-1',
      workspaceId: 'ws-1',
      runId: 'run-1',
      actionId: 'capture-insight',
      submittedByUserId: 'user-operator',
      submittedAtIso: '2026-04-02T10:03:00.000Z',
    };

    expect(() =>
      parseOperatorSurfaceInteractionV1(surface, {
        ...baseInteraction,
        values: { operator_note: 'ok', tone: 'direct', privilegedCommandId: 'disable-workspace' },
      }),
    ).toThrow(/declared form fields/i);

    expect(() =>
      parseOperatorSurfaceInteractionV1(surface, {
        ...baseInteraction,
        values: { operator_note: 'ok', tone: 'direct', ['__proto__']: 'polluted' },
      }),
    ).toThrow(/schema field IDs/i);

    expect(() =>
      parseOperatorSurfaceInteractionV1(surface, {
        ...baseInteraction,
        values: { operator_note: 42, tone: 'direct' },
      }),
    ).toThrow(/text values must be strings/i);

    expect(() =>
      parseOperatorSurfaceInteractionV1(surface, {
        ...baseInteraction,
        values: { operator_note: 'ok', tone: 'transfer-funds' },
      }),
    ).toThrow(/select values must match/i);
  });

  it('rejects missing required form values and values on non-form actions', () => {
    const surface = parseOperatorSurfaceV1({
      ...VALID_SURFACE,
      blocks: [
        {
          blockType: 'form',
          fields: [{ fieldId: 'note', label: 'Operator note', widget: 'text', required: true }],
        },
        {
          blockType: 'actions',
          actions: [
            {
              actionId: 'record-note',
              label: 'Record note',
              intentKind: 'Insight',
              submitsForm: true,
            },
            { actionId: 'dismiss', label: 'Dismiss', intentKind: 'Taste' },
          ],
        },
      ],
    });

    expect(() =>
      parseOperatorSurfaceInteractionV1(surface, {
        schemaVersion: 1,
        surfaceId: 'surface-1',
        workspaceId: 'ws-1',
        runId: 'run-1',
        actionId: 'record-note',
        submittedByUserId: 'user-operator',
        submittedAtIso: '2026-04-02T10:03:00.000Z',
        values: {},
      }),
    ).toThrow(/required form fields/i);

    expect(() =>
      parseOperatorSurfaceInteractionV1(surface, {
        schemaVersion: 1,
        surfaceId: 'surface-1',
        workspaceId: 'ws-1',
        runId: 'run-1',
        actionId: 'dismiss',
        submittedByUserId: 'user-operator',
        submittedAtIso: '2026-04-02T10:03:00.000Z',
        values: { note: 'hidden command' },
      }),
    ).toThrow(/must not include values/i);
  });
});
