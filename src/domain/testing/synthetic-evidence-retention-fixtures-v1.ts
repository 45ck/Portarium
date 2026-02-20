import type { EvidenceEntryV1 } from '../evidence/evidence-entry-v1.js';
import type { RetentionScheduleV1 } from '../evidence/retention-schedule-v1.js';
import {
  CorrelationId,
  EvidenceId,
  RunId,
  UserId,
  WorkItemId,
  WorkspaceId,
} from '../primitives/index.js';

export type SyntheticEvidencePayloadLocationV1 = Readonly<{
  bucket: string;
  key: string;
}>;

export type SyntheticRetentionFixtureEventInputV1 = Omit<
  EvidenceEntryV1,
  'previousHash' | 'hashSha256' | 'signatureBase64'
>;

export type ProofOfRetentionFixtureV1 = Readonly<{
  payloadLocation: SyntheticEvidencePayloadLocationV1;
  retentionSchedule: RetentionScheduleV1;
  events: Readonly<{
    captured: SyntheticRetentionFixtureEventInputV1;
    disposed: SyntheticRetentionFixtureEventInputV1;
  }>;
}>;

export type LegalHoldWorkflowFixtureV1 = Readonly<{
  payloadLocation: SyntheticEvidencePayloadLocationV1;
  retentionSchedule: RetentionScheduleV1;
  legalHoldEnabledSchedule: RetentionScheduleV1;
  legalHoldReleasedSchedule: RetentionScheduleV1;
  events: Readonly<{
    captured: SyntheticRetentionFixtureEventInputV1;
    legalHoldApplied: SyntheticRetentionFixtureEventInputV1;
    legalHoldReleased: SyntheticRetentionFixtureEventInputV1;
    disposed: SyntheticRetentionFixtureEventInputV1;
  }>;
}>;

const SYNTHETIC_RETENTION_FIXTURE_IDS_V1 = {
  workspaceId: WorkspaceId('ws-retention-seed-1'),
  runId: RunId('run-retention-seed-1'),
  workItemId: WorkItemId('wi-retention-seed-1'),
  correlationId: CorrelationId('corr-retention-seed-1'),
  actorUserId: UserId('user-retention-seed-1'),
  proofCaptureEvidenceId: EvidenceId('evi-proof-capture-1'),
  proofDisposeEvidenceId: EvidenceId('evi-proof-dispose-1'),
  holdCaptureEvidenceId: EvidenceId('evi-hold-capture-1'),
  holdAppliedEvidenceId: EvidenceId('evi-hold-applied-1'),
  holdReleasedEvidenceId: EvidenceId('evi-hold-released-1'),
  holdDisposeEvidenceId: EvidenceId('evi-hold-dispose-1'),
} as const;

export function createProofOfRetentionFixtureV1(): ProofOfRetentionFixtureV1 {
  const payloadLocation = {
    bucket: 'evidence',
    key: `runs/${SYNTHETIC_RETENTION_FIXTURE_IDS_V1.runId}/proof-retention-snapshot.json`,
  } as const;
  const payloadUri = `evidence://${payloadLocation.key}`;
  const retentionSchedule: RetentionScheduleV1 = {
    retentionClass: 'Compliance',
    retainUntilIso: '2026-03-01T00:00:00.000Z',
  };

  return {
    payloadLocation,
    retentionSchedule,
    events: {
      captured: createProofCapturedEvent(payloadUri),
      disposed: createProofDisposedEvent(),
    },
  };
}

export function createLegalHoldWorkflowFixtureV1(): LegalHoldWorkflowFixtureV1 {
  const payloadLocation = {
    bucket: 'evidence',
    key: `runs/${SYNTHETIC_RETENTION_FIXTURE_IDS_V1.runId}/legal-hold-proof.log`,
  } as const;
  const payloadUri = `evidence://${payloadLocation.key}`;
  const retentionSchedule: RetentionScheduleV1 = {
    retentionClass: 'Compliance',
    retainUntilIso: '2026-03-01T00:00:00.000Z',
  };

  return {
    payloadLocation,
    retentionSchedule,
    legalHoldEnabledSchedule: {
      retentionClass: 'Compliance',
      legalHold: true,
    },
    legalHoldReleasedSchedule: {
      retentionClass: 'Compliance',
      legalHold: false,
    },
    events: {
      captured: createLegalHoldCapturedEvent(payloadUri),
      legalHoldApplied: createLegalHoldAppliedEvent(),
      legalHoldReleased: createLegalHoldReleasedEvent(),
      disposed: createLegalHoldDisposedEvent(),
    },
  };
}

function createProofCapturedEvent(payloadUri: string): SyntheticRetentionFixtureEventInputV1 {
  return {
    schemaVersion: 1,
    evidenceId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.proofCaptureEvidenceId,
    workspaceId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.workspaceId,
    correlationId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.correlationId,
    occurredAtIso: '2026-02-20T00:00:00.000Z',
    category: 'Action',
    summary: 'Synthetic evidence payload captured for proof-of-retention workflow.',
    actor: { kind: 'User', userId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.actorUserId },
    links: {
      runId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.runId,
      workItemId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.workItemId,
    },
    payloadRefs: [{ kind: 'Snapshot', uri: payloadUri, contentType: 'application/json' }],
  };
}

function createProofDisposedEvent(): SyntheticRetentionFixtureEventInputV1 {
  return {
    schemaVersion: 1,
    evidenceId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.proofDisposeEvidenceId,
    workspaceId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.workspaceId,
    correlationId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.correlationId,
    occurredAtIso: '2026-03-02T00:00:00.000Z',
    category: 'Policy',
    summary: 'Synthetic disposition metadata recorded after retention expiry.',
    actor: { kind: 'System' },
    links: {
      runId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.runId,
      workItemId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.workItemId,
    },
  };
}

function createLegalHoldCapturedEvent(payloadUri: string): SyntheticRetentionFixtureEventInputV1 {
  return {
    schemaVersion: 1,
    evidenceId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.holdCaptureEvidenceId,
    workspaceId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.workspaceId,
    correlationId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.correlationId,
    occurredAtIso: '2026-02-20T00:00:00.000Z',
    category: 'Action',
    summary: 'Synthetic evidence payload captured for legal-hold workflow.',
    actor: { kind: 'User', userId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.actorUserId },
    links: {
      runId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.runId,
      workItemId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.workItemId,
    },
    payloadRefs: [{ kind: 'Log', uri: payloadUri, contentType: 'text/plain' }],
  };
}

function createLegalHoldAppliedEvent(): SyntheticRetentionFixtureEventInputV1 {
  return {
    schemaVersion: 1,
    evidenceId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.holdAppliedEvidenceId,
    workspaceId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.workspaceId,
    correlationId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.correlationId,
    occurredAtIso: '2026-02-22T00:00:00.000Z',
    category: 'Policy',
    summary:
      'Legal hold applied to synthetic retention fixture (holdId=hold-synthetic-1, basis=compliance).',
    actor: { kind: 'System' },
    links: {
      runId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.runId,
      workItemId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.workItemId,
    },
  };
}

function createLegalHoldReleasedEvent(): SyntheticRetentionFixtureEventInputV1 {
  return {
    schemaVersion: 1,
    evidenceId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.holdReleasedEvidenceId,
    workspaceId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.workspaceId,
    correlationId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.correlationId,
    occurredAtIso: '2026-03-03T00:00:00.000Z',
    category: 'Policy',
    summary: 'Legal hold released for synthetic retention fixture (holdId=hold-synthetic-1).',
    actor: { kind: 'System' },
    links: {
      runId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.runId,
      workItemId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.workItemId,
    },
  };
}

function createLegalHoldDisposedEvent(): SyntheticRetentionFixtureEventInputV1 {
  return {
    schemaVersion: 1,
    evidenceId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.holdDisposeEvidenceId,
    workspaceId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.workspaceId,
    correlationId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.correlationId,
    occurredAtIso: '2026-03-03T00:05:00.000Z',
    category: 'Policy',
    summary: 'Synthetic disposition metadata recorded after legal-hold release.',
    actor: { kind: 'System' },
    links: {
      runId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.runId,
      workItemId: SYNTHETIC_RETENTION_FIXTURE_IDS_V1.workItemId,
    },
  };
}
