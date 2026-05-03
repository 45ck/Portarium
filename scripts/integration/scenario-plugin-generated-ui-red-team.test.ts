/**
 * Scenario eval: pilot red-team for generated operator surfaces.
 *
 * This keeps the agent-generated UI pilot path schema-driven and proves that
 * use evidence remains linked to the governed Run and Approval Gate context.
 */

import { describe, expect, it } from 'vitest';

import {
  OperatorSurfaceParseError,
  operatorSurfaceCanRender,
  parseOperatorSurfaceInteractionV1,
  parseOperatorSurfaceV1,
} from '../../src/domain/operator-surfaces/index.js';
import { UserId } from '../../src/domain/primitives/index.js';
import { buildOperatorSurfaceEvidenceEntry } from '../../src/application/services/operator-surface-evidence.js';

const PILOT_SURFACE = {
  schemaVersion: 1,
  surfaceId: 'surface-pilot-red-team',
  workspaceId: 'ws-pilot-red-team',
  correlationId: 'corr-pilot-red-team',
  surfaceKind: 'Form',
  context: {
    kind: 'Approval',
    runId: 'run-pilot-red-team',
    approvalId: 'approval-pilot-red-team',
  },
  title: 'Pilot exception review',
  description: 'Capture a structured operator judgement before the run resumes.',
  attribution: {
    proposedBy: { kind: 'Machine', machineId: 'machine-pilot-red-team' },
    proposedAtIso: '2026-05-03T10:00:00.000Z',
    rationale: 'The standard approval panel cannot capture this pilot review signal.',
  },
  lifecycle: {
    status: 'Rendered',
    proposedAtIso: '2026-05-03T10:00:00.000Z',
    approvedAtIso: '2026-05-03T10:01:00.000Z',
    approvedByUserId: 'user-approver',
    renderedAtIso: '2026-05-03T10:02:00.000Z',
    renderedByUserId: 'user-operator',
    evidenceIds: ['ev-proposed', 'ev-approved', 'ev-rendered'],
  },
  blocks: [
    { blockType: 'text', text: 'Review the pilot exception.', tone: 'info' },
    {
      blockType: 'form',
      fields: [
        { fieldId: 'operator_note', label: 'Operator note', widget: 'textarea', required: true },
        {
          fieldId: 'risk_reading',
          label: 'Risk reading',
          widget: 'select',
          required: true,
          options: [
            { value: 'expected', label: 'Expected' },
            { value: 'needs-escalation', label: 'Needs escalation' },
          ],
        },
      ],
    },
    {
      blockType: 'actions',
      actions: [
        {
          actionId: 'record-insight',
          label: 'Record insight',
          intentKind: 'Insight',
          submitsForm: true,
        },
      ],
    },
  ],
} as const;

describe('scenario: plugin and generated UI pilot red-team', () => {
  it('accepts only typed schema data and links every generated-surface interaction to evidence context', () => {
    const surface = parseOperatorSurfaceV1(PILOT_SURFACE);

    expect(operatorSurfaceCanRender(surface)).toBe(true);
    const interaction = parseOperatorSurfaceInteractionV1(surface, {
      schemaVersion: 1,
      surfaceId: 'surface-pilot-red-team',
      workspaceId: 'ws-pilot-red-team',
      runId: 'run-pilot-red-team',
      approvalId: 'approval-pilot-red-team',
      actionId: 'record-insight',
      intentKind: 'Intent',
      submittedByUserId: 'user-operator',
      submittedAtIso: '2026-05-03T10:03:00.000Z',
      values: {
        operator_note: 'Hold the run until the extra receipt is attached.',
        risk_reading: 'needs-escalation',
      },
    });

    expect(interaction).toEqual({
      schemaVersion: 1,
      surfaceId: 'surface-pilot-red-team',
      workspaceId: 'ws-pilot-red-team',
      runId: 'run-pilot-red-team',
      approvalId: 'approval-pilot-red-team',
      actionId: 'record-insight',
      intentKind: 'Insight',
      submittedByUserId: 'user-operator',
      submittedAtIso: '2026-05-03T10:03:00.000Z',
      values: {
        operator_note: 'Hold the run until the extra receipt is attached.',
        risk_reading: 'needs-escalation',
      },
    });

    const evidenceEvents = ['proposed', 'approved', 'rendered', 'used'] as const;
    const evidence = evidenceEvents.map((event) =>
      buildOperatorSurfaceEvidenceEntry({
        surface,
        event,
        evidenceId: `ev-${event}`,
        occurredAtIso: '2026-05-03T10:03:00.000Z',
        actor: { kind: 'User', userId: UserId('user-operator') },
      }),
    );

    expect(evidence.map((entry) => entry.evidence.category)).toEqual([
      'OperatorSurface',
      'OperatorSurface',
      'OperatorSurface',
      'OperatorSurface',
    ]);
    expect(evidence.map((entry) => entry.evidence.links)).toEqual([
      { runId: 'run-pilot-red-team', approvalId: 'approval-pilot-red-team' },
      { runId: 'run-pilot-red-team', approvalId: 'approval-pilot-red-team' },
      { runId: 'run-pilot-red-team', approvalId: 'approval-pilot-red-team' },
      { runId: 'run-pilot-red-team', approvalId: 'approval-pilot-red-team' },
    ]);
    expect(evidence.map((entry) => entry.evidence.payloadRefs?.[0]?.uri)).toEqual([
      'portarium://operator-surfaces/surface-pilot-red-team/proposed',
      'portarium://operator-surfaces/surface-pilot-red-team/approved',
      'portarium://operator-surfaces/surface-pilot-red-team/rendered',
      'portarium://operator-surfaces/surface-pilot-red-team/used',
    ]);
  });

  it('rejects generated UI attempts to smuggle code, egress, commands, or foreign context', () => {
    expect(() =>
      parseOperatorSurfaceV1({
        ...PILOT_SURFACE,
        blocks: [{ blockType: 'text', text: 'x', scriptUrl: 'https://example.invalid/payload.js' }],
      }),
    ).toThrow(OperatorSurfaceParseError);

    expect(() =>
      parseOperatorSurfaceV1({
        ...PILOT_SURFACE,
        browserEgress: { origins: ['https://provider.example.test'] },
      }),
    ).toThrow(/browserEgress is not allowed/i);

    expect(() =>
      parseOperatorSurfaceV1({
        ...PILOT_SURFACE,
        blocks: [
          {
            blockType: 'actions',
            actions: [
              {
                actionId: 'record-insight',
                label: 'Record insight',
                intentKind: 'Insight',
                commandId: 'workspace.emergency-disable',
              },
            ],
          },
        ],
      }),
    ).toThrow(/commandId is not allowed/i);

    const surface = parseOperatorSurfaceV1(PILOT_SURFACE);
    expect(() =>
      parseOperatorSurfaceInteractionV1(surface, {
        schemaVersion: 1,
        surfaceId: 'surface-pilot-red-team',
        workspaceId: 'ws-other',
        runId: 'run-pilot-red-team',
        approvalId: 'approval-pilot-red-team',
        actionId: 'record-insight',
        submittedByUserId: 'user-operator',
        submittedAtIso: '2026-05-03T10:03:00.000Z',
        values: {
          operator_note: 'Try to cross tenant context.',
          risk_reading: 'expected',
        },
      }),
    ).toThrow(/workspaceId must match/i);

    expect(() =>
      parseOperatorSurfaceInteractionV1(surface, {
        schemaVersion: 1,
        surfaceId: 'surface-pilot-red-team',
        workspaceId: 'ws-pilot-red-team',
        runId: 'run-pilot-red-team',
        approvalId: 'approval-pilot-red-team',
        actionId: 'record-insight',
        submittedByUserId: 'user-operator',
        submittedAtIso: '2026-05-03T10:03:00.000Z',
        values: {
          operator_note: 'Try to submit undeclared authority.',
          risk_reading: 'expected',
          privilegedCommandId: 'workspace.emergency-disable',
        },
      }),
    ).toThrow(/declared form fields/i);
  });
});
