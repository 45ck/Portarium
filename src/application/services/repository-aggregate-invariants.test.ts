import { describe, expect, it } from 'vitest';

import { parseAdapterRegistrationV1 } from '../../domain/adapters/adapter-registration-v1.js';
import { parseRunV1 } from '../../domain/runs/index.js';
import { parseWorkflowV1 } from '../../domain/workflows/workflow-v1.js';
import { parseWorkspaceV1 } from '../../domain/workspaces/workspace-v1.js';
import {
  ensureRunIdIsUnique,
  ensureSingleActiveAdapterPerPort,
  ensureSingleActiveWorkflowVersion,
  ensureWorkspaceNameIsUnique,
} from './repository-aggregate-invariants.js';

const WORKSPACE = parseWorkspaceV1({
  schemaVersion: 1,
  workspaceId: 'ws-1',
  tenantId: 'tenant-1',
  name: 'Primary',
  createdAtIso: '2026-02-17T00:00:00.000Z',
});

const WORKFLOW_V1_ACTIVE = parseWorkflowV1({
  schemaVersion: 1,
  workflowId: 'wf-1',
  workspaceId: 'ws-1',
  name: 'Onboard',
  version: 1,
  active: true,
  executionTier: 'Auto',
  actions: [
    {
      actionId: 'act-1',
      order: 1,
      portFamily: 'ItsmItOps',
      operation: 'workflow:simulate',
    },
  ],
});

const WORKFLOW_V2_ACTIVE = parseWorkflowV1({
  ...WORKFLOW_V1_ACTIVE,
  workflowId: 'wf-2',
  version: 2,
  active: true,
});

const ADAPTER_ITSM = parseAdapterRegistrationV1({
  schemaVersion: 1,
  adapterId: 'adapter-itsm-1',
  workspaceId: 'ws-1',
  providerSlug: 'service-now',
  portFamily: 'ItsmItOps',
  enabled: true,
  capabilityMatrix: [{ operation: 'workflow:simulate', requiresAuth: true }],
  executionPolicy: {
    tenantIsolationMode: 'PerTenantWorker',
    egressAllowlist: ['https://api.service-now.example'],
    credentialScope: 'capabilityMatrix',
    sandboxVerified: true,
    sandboxAvailable: true,
  },
});

describe('repository aggregate invariants', () => {
  it('detects workspace-name uniqueness conflicts', () => {
    const conflict = ensureWorkspaceNameIsUnique(
      parseWorkspaceV1({
        schemaVersion: 1,
        workspaceId: 'ws-2',
        tenantId: 'tenant-1',
        name: 'Primary',
        createdAtIso: '2026-02-16T00:00:00.000Z',
      }),
      WORKSPACE,
    );

    expect(conflict).not.toBeNull();
    expect(conflict?.kind).toBe('Conflict');
  });

  it('requires a single active workflow version and selected active head', () => {
    const conflict = ensureSingleActiveWorkflowVersion({
      workflowName: WORKFLOW_V1_ACTIVE.name,
      selectedWorkflowId: WORKFLOW_V1_ACTIVE.workflowId,
      workflowVersions: [WORKFLOW_V1_ACTIVE, WORKFLOW_V2_ACTIVE],
    });

    expect(conflict).not.toBeNull();
    expect(conflict?.message).toContain('multiple active versions');
  });

  it('requires exactly one active adapter per required port family', () => {
    const noAdapter = ensureSingleActiveAdapterPerPort({
      portFamilies: ['ItsmItOps'],
      adapterRegistrations: [],
    });
    expect(noAdapter).not.toBeNull();
    expect(noAdapter?.message).toContain('no active adapter');

    const manyAdapters = ensureSingleActiveAdapterPerPort({
      portFamilies: ['ItsmItOps'],
      adapterRegistrations: [
        ADAPTER_ITSM,
        parseAdapterRegistrationV1({
          ...ADAPTER_ITSM,
          adapterId: 'adapter-itsm-2',
          providerSlug: 'freshservice',
        }),
      ],
    });
    expect(manyAdapters).not.toBeNull();
    expect(manyAdapters?.message).toContain('multiple active adapters');
  });

  it('detects run-id uniqueness conflicts', () => {
    const existingRun = parseRunV1({
      schemaVersion: 1,
      runId: 'run-1',
      workspaceId: 'ws-1',
      workflowId: 'wf-1',
      correlationId: 'corr-1',
      executionTier: 'Auto',
      initiatedByUserId: 'user-1',
      status: 'Pending',
      createdAtIso: '2026-02-17T00:00:00.000Z',
    });

    const conflict = ensureRunIdIsUnique(existingRun, existingRun.runId);
    expect(conflict).not.toBeNull();
    expect(conflict?.kind).toBe('Conflict');
  });
});
