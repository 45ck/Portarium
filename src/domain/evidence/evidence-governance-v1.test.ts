import { describe, expect, it } from 'vitest';

import {
  EvidenceGovernanceParseError,
  parseCreateEvidenceRetentionScheduleRequestV1,
  parseCreateLegalHoldRequestV1,
  parseEvidenceDispositionJobV1,
  parseEvidenceRetentionScheduleV1,
  parseExecuteEvidenceDispositionRequestV1,
  parseLegalHoldV1,
  parseUpdateEvidenceRetentionScheduleRequestV1,
  parseUpdateLegalHoldRequestV1,
} from './evidence-governance-v1.js';

describe('Evidence governance parsers', () => {
  it('parses retention schedules and create/update requests', () => {
    const schedule = parseEvidenceRetentionScheduleV1({
      schemaVersion: 1,
      scheduleId: 'schedule-1',
      workspaceId: 'ws-1',
      categories: ['Plan', 'Action'],
      defaultDisposition: 'Quarantine',
      retentionDays: 90,
      legalHoldOverrides: true,
      createdByUserId: 'user-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      updatedAtIso: '2026-02-16T01:00:00.000Z',
      description: 'Evidence retention schedule',
    });

    expect(schedule.scheduleId).toBe('schedule-1');
    expect(schedule.categories).toHaveLength(2);

    const create = parseCreateEvidenceRetentionScheduleRequestV1({
      schemaVersion: 1,
      categories: ['Approval'],
      defaultDisposition: 'Destroy',
      retentionDays: 30,
      legalHoldOverrides: false,
    });
    expect(create.legalHoldOverrides).toBe(false);

    const update = parseUpdateEvidenceRetentionScheduleRequestV1({
      retentionDays: 180,
      description: 'Updated window',
    });
    expect(update.retentionDays).toBe(180);
  });

  it('rejects invalid retention payloads', () => {
    expect(() =>
      parseEvidenceRetentionScheduleV1({
        schemaVersion: 2,
        scheduleId: 'schedule-1',
        workspaceId: 'ws-1',
        categories: ['Plan'],
        defaultDisposition: 'Destroy',
        retentionDays: 90,
        legalHoldOverrides: true,
        createdByUserId: 'user-1',
        createdAtIso: '2026-02-16T00:00:00.000Z',
      }),
    ).toThrow(/schemaVersion/i);

    expect(() => parseUpdateEvidenceRetentionScheduleRequestV1({})).toThrow(
      /must include at least one field/i,
    );

    expect(() =>
      parseCreateEvidenceRetentionScheduleRequestV1({
        schemaVersion: 1,
        categories: [],
        defaultDisposition: 'Destroy',
        retentionDays: 90,
      }),
    ).toThrow(/non-empty array/i);
  });

  it('parses disposition operations', () => {
    const job = parseEvidenceDispositionJobV1({
      jobId: 'job-1',
      evidenceId: 'evi-1',
      action: 'DeIdentify',
      status: 'Queued',
      reason: 'GDPR request',
    });
    expect(job.status).toBe('Queued');

    const execute = parseExecuteEvidenceDispositionRequestV1({
      action: 'Destroy',
      reason: 'right-to-erasure',
      actorUserId: 'user-2',
    });
    expect(execute.reason).toBe('right-to-erasure');
  });

  it('parses legal hold create/update requests', () => {
    const hold = parseLegalHoldV1({
      schemaVersion: 1,
      holdId: 'hold-1',
      workspaceId: 'ws-1',
      evidenceCategory: 'System',
      description: 'Payroll hold',
      active: true,
      reason: 'Audit freeze',
      createdByUserId: 'user-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      expiresAtIso: '2026-03-01T00:00:00.000Z',
    });
    expect(hold.holdId).toBe('hold-1');

    const create = parseCreateLegalHoldRequestV1({
      schemaVersion: 1,
      evidenceCategory: 'Policy',
      description: 'Legal hold',
      reason: 'Court request',
      active: false,
    });
    expect(create.active).toBe(false);

    const update = parseUpdateLegalHoldRequestV1({
      reason: 'Hold cleared',
    });
    expect(update.reason).toBe('Hold cleared');

    const execute = parseExecuteEvidenceDispositionRequestV1({
      action: 'Destroy',
    });
    expect(execute.action).toBe('Destroy');
  });

  it('rejects invalid legal hold and execute payloads', () => {
    expect(() =>
      parseCreateLegalHoldRequestV1({
        schemaVersion: 1,
        evidenceCategory: 'Unknown',
        description: 'x',
        reason: 'y',
        active: true,
      } as unknown),
    ).toThrow(EvidenceGovernanceParseError);

    expect(() => parseUpdateLegalHoldRequestV1({})).toThrow(EvidenceGovernanceParseError);
    expect(() =>
      parseExecuteEvidenceDispositionRequestV1({
        reason: 'x',
      } as unknown),
    ).toThrow(EvidenceGovernanceParseError);
  });
});
