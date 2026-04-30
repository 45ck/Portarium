import { describe, expect, it, vi } from 'vitest';

import {
  CorrelationId,
  EvidenceId,
  HashSha256,
  RunId,
  TenantId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type { EvidenceEntryV1 } from '../../domain/evidence/index.js';
import { APP_ACTIONS } from '../common/actions.js';
import { toAppContext } from '../common/context.js';
import type { AuthorizationPort, EvidenceQueryStore } from '../ports/index.js';
import { listRunEvidence } from './list-run-evidence.js';

const EVIDENCE: EvidenceEntryV1 = {
  schemaVersion: 1,
  evidenceId: EvidenceId('ev-1'),
  workspaceId: WorkspaceId('ws-1'),
  correlationId: CorrelationId('corr-1'),
  occurredAtIso: '2026-01-01T00:00:00.000Z',
  category: 'Action',
  summary: 'Run action completed',
  actor: { kind: 'System' },
  links: { runId: RunId('run-1') },
  hashSha256: HashSha256('sha256:2222222222222222222222222222222222222222222222222222222222222222'),
};

describe('listRunEvidence', () => {
  it('constrains evidence reads to the requested run', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => true) };
    const evidenceQueryStore: EvidenceQueryStore = {
      listEvidenceEntries: vi.fn(async () => ({ items: [EVIDENCE] })),
    };

    const result = await listRunEvidence(
      { authorization, evidenceQueryStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['operator'],
      }),
      { workspaceId: 'ws-1', runId: 'run-1', limit: 10 },
    );

    expect(result.ok).toBe(true);
    expect(evidenceQueryStore.listEvidenceEntries).toHaveBeenCalledWith(
      TenantId('tenant-1'),
      WorkspaceId('ws-1'),
      { filter: { runId: 'run-1' }, pagination: { limit: 10 } },
    );
  });

  it('denies access without evidence:read capability', async () => {
    const authorization: AuthorizationPort = { isAllowed: vi.fn(async () => false) };
    const evidenceQueryStore: EvidenceQueryStore = {
      listEvidenceEntries: vi.fn(async () => ({ items: [EVIDENCE] })),
    };

    const result = await listRunEvidence(
      { authorization, evidenceQueryStore },
      toAppContext({
        tenantId: 'tenant-1',
        principalId: 'user-1',
        correlationId: 'corr-1',
        roles: ['auditor'],
      }),
      { workspaceId: 'ws-1', runId: 'run-1' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected Forbidden.');
    expect(result.error.kind).toBe('Forbidden');
    expect(authorization.isAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TenantId('tenant-1') }),
      APP_ACTIONS.evidenceRead,
    );
    expect(evidenceQueryStore.listEvidenceEntries).not.toHaveBeenCalled();
  });
});
