import { describe, expect, it } from 'vitest';
import { parseOperatorSurfaceV1 } from '../../domain/operator-surfaces/index.js';
import { UserId } from '../../domain/primitives/index.js';
import {
  buildOperatorSurfaceEvidenceEntry,
  lifecycleStatusForOperatorSurfaceEvidenceEvent,
} from './operator-surface-evidence.js';

const surface = parseOperatorSurfaceV1({
  schemaVersion: 1,
  surfaceId: 'surface-1',
  workspaceId: 'ws-1',
  correlationId: 'corr-1',
  surfaceKind: 'Card',
  context: { kind: 'Approval', runId: 'run-1', approvalId: 'approval-1' },
  title: 'Follow-up wording',
  attribution: {
    proposedBy: { kind: 'Machine', machineId: 'machine-1' },
    proposedAtIso: '2026-04-02T10:00:00.000Z',
    rationale: 'Need operator wording taste.',
  },
  lifecycle: {
    status: 'Rendered',
    proposedAtIso: '2026-04-02T10:00:00.000Z',
    approvedAtIso: '2026-04-02T10:01:00.000Z',
    renderedAtIso: '2026-04-02T10:02:00.000Z',
  },
  blocks: [{ blockType: 'text', text: 'Choose a response style.' }],
});

describe('buildOperatorSurfaceEvidenceEntry', () => {
  it.each(['proposed', 'approved', 'rendered', 'used'] as const)(
    'builds %s lifecycle evidence linked to run and approval context',
    (event) => {
      const artifact = buildOperatorSurfaceEvidenceEntry({
        surface,
        event,
        evidenceId: `ev-${event}`,
        occurredAtIso: '2026-04-02T10:03:00.000Z',
        actor: { kind: 'User', userId: UserId('user-1') },
      });

      expect(artifact.evidence.category).toBe('OperatorSurface');
      expect(artifact.evidence.links).toEqual({ runId: 'run-1', approvalId: 'approval-1' });
      expect(artifact.evidence.payloadRefs?.[0]?.uri).toBe(
        `portarium://operator-surfaces/surface-1/${event}`,
      );
      expect(artifact.evidence.summary).toContain(event === 'used' ? 'used by an operator' : event);
    },
  );

  it('maps evidence event names to lifecycle status vocabulary', () => {
    expect(lifecycleStatusForOperatorSurfaceEvidenceEvent('proposed')).toBe('Proposed');
    expect(lifecycleStatusForOperatorSurfaceEvidenceEvent('approved')).toBe('Approved');
    expect(lifecycleStatusForOperatorSurfaceEvidenceEvent('rendered')).toBe('Rendered');
    expect(lifecycleStatusForOperatorSurfaceEvidenceEvent('used')).toBe('Used');
  });
});
