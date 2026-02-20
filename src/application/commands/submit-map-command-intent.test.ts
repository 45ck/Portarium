import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parsePolicyV1, type PolicyV1 } from '../../domain/policy/index.js';
import { TenantId } from '../../domain/primitives/index.js';
import { toAppContext } from '../common/context.js';
import type {
  AuthorizationPort,
  Clock,
  EventPublisher,
  EvidenceLogPort,
  IdGenerator,
  PolicyStore,
  UnitOfWork,
} from '../ports/index.js';
import { submitMapCommandIntent } from './submit-map-command-intent.js';

function makePolicy(overrides: Partial<PolicyV1> = {}): PolicyV1 {
  return parsePolicyV1({
    schemaVersion: 1,
    policyId: 'pol-1',
    workspaceId: 'ws-1',
    name: 'Map Governance Policy',
    active: true,
    priority: 1,
    version: 1,
    createdAtIso: '2026-02-20T00:00:00.000Z',
    createdByUserId: 'policy-admin-1',
    ...overrides,
  });
}

describe('submitMapCommandIntent', () => {
  let authorization: AuthorizationPort;
  let clock: Clock;
  let idGenerator: IdGenerator;
  let unitOfWork: UnitOfWork;
  let policyStore: PolicyStore;
  let eventPublisher: EventPublisher;
  let evidenceLog: EvidenceLogPort;

  beforeEach(() => {
    authorization = { isAllowed: vi.fn(async () => true) };
    clock = { nowIso: vi.fn(() => '2026-02-20T03:12:00.000Z') };
    let idSeq = 0;
    idGenerator = { generateId: vi.fn(() => `id-${++idSeq}`) };
    unitOfWork = { execute: vi.fn(async (fn) => fn()) };
    policyStore = { getPolicyById: vi.fn(async () => makePolicy()) };
    eventPublisher = { publish: vi.fn(async () => undefined) };
    evidenceLog = {
      appendEntry: vi.fn(async (_tenantId, entry) => ({
        ...entry,
        hashSha256: 'hash-sha-256' as never,
      })),
    };
  });

  it('rejects hazardous-zone self-approval with explicit SoD reason and writes audit evidence', async () => {
    policyStore.getPolicyById = vi.fn(async () =>
      makePolicy({
        sodConstraints: [{ kind: 'HazardousZoneNoSelfApproval' }],
      }),
    );

    const result = await submitMapCommandIntent(
      { authorization, clock, idGenerator, unitOfWork, policyStore, eventPublisher, evidenceLog },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'operator-1',
        correlationId: 'corr-map-1',
        roles: ['operator'],
      }),
      {
        workspaceId: 'ws-1',
        commandKind: 'RestrictedZoneMove',
        robotId: 'robot-7',
        executionTier: 'HumanApprove',
        policyIds: ['pol-1'],
        rationale: 'Move robot through restricted zone.',
        requestedByUserId: 'operator-1',
        approvingActorUserIds: ['operator-1'],
        mapContext: {
          siteId: 'site-a',
          floorId: 'floor-1',
          zoneId: 'zone-red',
          mapLayerId: 'ml-1',
          hazardousZone: true,
          safetyClassifiedZone: true,
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected rejection.');
    expect(result.error.kind).toBe('Forbidden');
    expect(result.error.message).toMatch(/SoD violation: HazardousZoneNoSelfApprovalViolation/i);
    expect(evidenceLog.appendEntry).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);

    const evidenceInput = (evidenceLog.appendEntry as ReturnType<typeof vi.fn>).mock.calls[0]?.[
      1
    ] as {
      links?: {
        externalRefs?: { externalType: string; externalId: string }[];
      };
    };
    const refs = evidenceInput.links?.externalRefs ?? [];
    expect(refs.some((ref) => ref.externalType === 'MapContext')).toBe(true);
    expect(refs.some((ref) => ref.externalType === 'ApprovingActors')).toBe(true);
  });

  it('returns Conflict when remote stop is policy-gated for approval in Auto tier', async () => {
    const result = await submitMapCommandIntent(
      { authorization, clock, idGenerator, unitOfWork, policyStore, eventPublisher, evidenceLog },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'operator-2',
        correlationId: 'corr-map-2',
        roles: ['operator'],
      }),
      {
        workspaceId: 'ws-1',
        commandKind: 'RemoteStop',
        robotId: 'robot-9',
        executionTier: 'Auto',
        policyIds: ['pol-1'],
        rationale: 'Stop request from map alert.',
        mapContext: {
          siteId: 'site-a',
          zoneId: 'aisle-3',
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected conflict.');
    expect(result.error.kind).toBe('Conflict');
    expect(result.error.message).toMatch(/Policy gate requires approval/i);
    expect(evidenceLog.appendEntry).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
  });

  it('rejects safety-classified command when dual-approval requirement is unmet', async () => {
    policyStore.getPolicyById = vi.fn(async () =>
      makePolicy({
        sodConstraints: [{ kind: 'SafetyClassifiedZoneDualApproval' }],
      }),
    );

    const result = await submitMapCommandIntent(
      { authorization, clock, idGenerator, unitOfWork, policyStore, eventPublisher, evidenceLog },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'operator-10',
        correlationId: 'corr-map-2b',
        roles: ['operator'],
      }),
      {
        workspaceId: 'ws-1',
        commandKind: 'RestrictedZoneMove',
        robotId: 'robot-10',
        executionTier: 'HumanApprove',
        policyIds: ['pol-1'],
        rationale: 'Single approver in safety-classified zone.',
        requestedByUserId: 'operator-10',
        approvingActorUserIds: ['approver-1'],
        mapContext: {
          siteId: 'site-a',
          zoneId: 'zone-safe-1',
          hazardousZone: true,
          safetyClassifiedZone: true,
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected rejection.');
    expect(result.error.kind).toBe('Forbidden');
    expect(result.error.message).toMatch(/SafetyClassifiedZoneDualApprovalViolation/i);
  });

  it('allows safety-classified command when dual-approval requirement is met', async () => {
    policyStore.getPolicyById = vi.fn(async () =>
      makePolicy({
        sodConstraints: [{ kind: 'SafetyClassifiedZoneDualApproval' }],
      }),
    );

    const result = await submitMapCommandIntent(
      { authorization, clock, idGenerator, unitOfWork, policyStore, eventPublisher, evidenceLog },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'operator-11',
        correlationId: 'corr-map-2c',
        roles: ['operator'],
      }),
      {
        workspaceId: 'ws-1',
        commandKind: 'RestrictedZoneMove',
        robotId: 'robot-12',
        executionTier: 'HumanApprove',
        policyIds: ['pol-1'],
        rationale: 'Dual approvers in safety-classified zone.',
        requestedByUserId: 'operator-11',
        approvingActorUserIds: ['approver-1', 'approver-2'],
        mapContext: {
          siteId: 'site-a',
          zoneId: 'zone-safe-2',
          hazardousZone: true,
          safetyClassifiedZone: true,
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected allow.');
    expect(result.value.decision).toBe('Allow');
  });

  it('allows restricted-zone move in ManualOnly tier when SoD is satisfied', async () => {
    policyStore.getPolicyById = vi.fn(async () =>
      makePolicy({
        sodConstraints: [{ kind: 'HazardousZoneNoSelfApproval' }],
      }),
    );

    const result = await submitMapCommandIntent(
      { authorization, clock, idGenerator, unitOfWork, policyStore, eventPublisher, evidenceLog },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'operator-3',
        correlationId: 'corr-map-3',
        roles: ['operator'],
      }),
      {
        workspaceId: 'ws-1',
        commandKind: 'RestrictedZoneMove',
        robotId: 'robot-11',
        executionTier: 'ManualOnly',
        policyIds: ['pol-1'],
        rationale: 'Manual restricted-zone command path.',
        requestedByUserId: 'operator-3',
        approvingActorUserIds: ['approver-7'],
        mapContext: {
          siteId: 'site-b',
          floorId: 'floor-2',
          zoneId: 'charging',
          hazardousZone: true,
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected allow.');
    expect(result.value.decision).toBe('Allow');
    expect(String(result.value.commandIntentId)).toMatch(/^id-/);
    expect(String(result.value.evidenceId)).toMatch(/^id-/);
    expect(evidenceLog.appendEntry).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
  });

  it('denies user without map-command submit authorization', async () => {
    authorization.isAllowed = vi.fn(async () => false);

    const result = await submitMapCommandIntent(
      { authorization, clock, idGenerator, unitOfWork, policyStore, eventPublisher, evidenceLog },
      toAppContext({
        tenantId: 'ws-1',
        principalId: 'auditor-1',
        correlationId: 'corr-map-4',
        roles: ['auditor'],
      }),
      {
        workspaceId: 'ws-1',
        commandKind: 'RestrictedZoneMove',
        robotId: 'robot-3',
        executionTier: 'HumanApprove',
        policyIds: ['pol-1'],
        rationale: 'Audit test',
        mapContext: {
          siteId: 'site-a',
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected forbidden.');
    expect(result.error.kind).toBe('Forbidden');
    expect(authorization.isAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TenantId('ws-1') }),
      'map-command:submit',
    );
    expect(evidenceLog.appendEntry).not.toHaveBeenCalled();
  });
});
