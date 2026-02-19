import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryComplianceGrcAdapter } from './in-memory-compliance-grc-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryComplianceGrcAdapter', () => {
  it('returns tenant-scoped controls, risks, and findings', async () => {
    const seedA = InMemoryComplianceGrcAdapter.seedMinimal(TENANT_A);
    const seedB = InMemoryComplianceGrcAdapter.seedMinimal(TENANT_B);
    const adapter = new InMemoryComplianceGrcAdapter({
      seed: {
        ...seedA,
        controls: [...seedA.controls!, ...seedB.controls!],
        risks: [...seedA.risks!, ...seedB.risks!],
        findings: [...seedA.findings!, ...seedB.findings!],
      },
    });

    const controls = await adapter.execute({ tenantId: TENANT_A, operation: 'listControls' });
    expect(controls.ok).toBe(true);
    if (!controls.ok || controls.result.kind !== 'externalRefs') return;
    expect(controls.result.externalRefs).toHaveLength(1);
    expect(controls.result.externalRefs[0]?.externalId).toBe('control-1000');

    const risks = await adapter.execute({ tenantId: TENANT_A, operation: 'listRisks' });
    expect(risks.ok).toBe(true);
    if (!risks.ok || risks.result.kind !== 'externalRefs') return;
    expect(risks.result.externalRefs).toHaveLength(1);
    expect(risks.result.externalRefs[0]?.externalId).toBe('risk-1000');

    const findings = await adapter.execute({ tenantId: TENANT_A, operation: 'listFindings' });
    expect(findings.ok).toBe(true);
    if (!findings.ok || findings.result.kind !== 'tickets') return;
    expect(findings.result.tickets).toHaveLength(1);
    expect(findings.result.tickets[0]?.tenantId).toBe(TENANT_A);
  });

  it('supports control, risk, policy, and audit operations', async () => {
    const adapter = new InMemoryComplianceGrcAdapter({
      seed: InMemoryComplianceGrcAdapter.seedMinimal(TENANT_A),
    });

    const createdControl = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createControl',
      payload: { name: 'Privileged Access Review' },
    });
    expect(createdControl.ok).toBe(true);
    if (!createdControl.ok || createdControl.result.kind !== 'externalRef') return;
    const controlId = createdControl.result.externalRef.externalId;

    const fetchedControl = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getControl',
      payload: { controlId },
    });
    expect(fetchedControl.ok).toBe(true);
    if (!fetchedControl.ok || fetchedControl.result.kind !== 'externalRef') return;
    expect(fetchedControl.result.externalRef.externalId).toBe(controlId);

    const updatedControlStatus = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'updateControlStatus',
      payload: { controlId, status: 'implemented' },
    });
    expect(updatedControlStatus.ok).toBe(true);
    if (!updatedControlStatus.ok || updatedControlStatus.result.kind !== 'externalRef') return;
    expect(updatedControlStatus.result.externalRef.displayLabel).toContain('status=implemented');

    const createdRisk = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createRisk',
      payload: { name: 'Privileged escalation risk' },
    });
    expect(createdRisk.ok).toBe(true);
    if (!createdRisk.ok || createdRisk.result.kind !== 'externalRef') return;
    const riskId = createdRisk.result.externalRef.externalId;

    const assessedRisk = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'assessRisk',
      payload: { riskId, score: 7.2 },
    });
    expect(assessedRisk.ok).toBe(true);
    if (!assessedRisk.ok || assessedRisk.result.kind !== 'externalRef') return;
    expect(assessedRisk.result.externalRef.externalType).toBe('risk_assessment');

    const createdPolicy = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createPolicy',
      payload: { title: 'Access Governance Policy' },
    });
    expect(createdPolicy.ok).toBe(true);
    if (!createdPolicy.ok || createdPolicy.result.kind !== 'externalRef') return;
    const policyId = createdPolicy.result.externalRef.externalId;

    const publishedPolicy = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'publishPolicy',
      payload: { policyId },
    });
    expect(publishedPolicy.ok).toBe(true);
    if (!publishedPolicy.ok || publishedPolicy.result.kind !== 'externalRef') return;
    expect(publishedPolicy.result.externalRef.displayLabel).toContain('Published');

    const createdAudit = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createAudit',
      payload: { name: 'ISO 27001 Internal Audit' },
    });
    expect(createdAudit.ok).toBe(true);
    if (!createdAudit.ok || createdAudit.result.kind !== 'externalRef') return;
    const auditId = createdAudit.result.externalRef.externalId;

    const fetchedAudit = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getAudit',
      payload: { auditId },
    });
    expect(fetchedAudit.ok).toBe(true);
    if (!fetchedAudit.ok || fetchedAudit.result.kind !== 'externalRef') return;
    expect(fetchedAudit.result.externalRef.externalId).toBe(auditId);
  });

  it('supports finding, evidence, and framework mapping operations', async () => {
    const adapter = new InMemoryComplianceGrcAdapter({
      seed: InMemoryComplianceGrcAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const createdFinding = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createFinding',
      payload: { subject: 'Quarterly access review incomplete', priority: 'urgent' },
    });
    expect(createdFinding.ok).toBe(true);
    if (!createdFinding.ok || createdFinding.result.kind !== 'ticket') return;
    expect(createdFinding.result.ticket.createdAtIso).toBe('2026-02-19T00:00:00.000Z');
    expect(createdFinding.result.ticket.priority).toBe('urgent');

    const evidenceRequests = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'listEvidenceRequests',
    });
    expect(evidenceRequests.ok).toBe(true);
    if (!evidenceRequests.ok || evidenceRequests.result.kind !== 'externalRefs') return;
    expect(evidenceRequests.result.externalRefs.length).toBeGreaterThan(0);

    const uploadedEvidence = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'uploadEvidence',
      payload: {
        title: 'Q1 Access Review Snapshot',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      },
    });
    expect(uploadedEvidence.ok).toBe(true);
    if (!uploadedEvidence.ok || uploadedEvidence.result.kind !== 'document') return;
    expect(uploadedEvidence.result.document.createdAtIso).toBe('2026-02-19T00:00:00.000Z');
    expect(uploadedEvidence.result.document.sizeBytes).toBe(1024);

    const frameworks = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'listFrameworks',
    });
    expect(frameworks.ok).toBe(true);
    if (!frameworks.ok || frameworks.result.kind !== 'externalRefs') return;
    const frameworkId = frameworks.result.externalRefs[0]!.externalId;

    const framework = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getFramework',
      payload: { frameworkId },
    });
    expect(framework.ok).toBe(true);
    if (!framework.ok || framework.result.kind !== 'externalRef') return;
    expect(framework.result.externalRef.externalId).toBe(frameworkId);

    const mappedFramework = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'mapControlToFramework',
      payload: { controlRef: 'control-1000', frameworkRef: frameworkId },
    });
    expect(mappedFramework.ok).toBe(true);
    if (!mappedFramework.ok || mappedFramework.result.kind !== 'externalRef') return;
    expect(mappedFramework.result.externalRef.externalType).toBe('control_framework_mapping');
  });

  it('returns validation and not-found errors for malformed inputs', async () => {
    const adapter = new InMemoryComplianceGrcAdapter({
      seed: InMemoryComplianceGrcAdapter.seedMinimal(TENANT_A),
    });

    const missingControlName = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createControl',
      payload: {},
    });
    expect(missingControlName).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'name is required for createControl.',
    });

    const missingRiskRef = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'assessRisk',
      payload: {},
    });
    expect(missingRiskRef).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'riskId is required for assessRisk.',
    });

    const invalidEvidenceSize = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'uploadEvidence',
      payload: { title: 'SOC2 evidence', sizeBytes: -1 },
    });
    expect(invalidEvidenceSize).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'sizeBytes must be a non-negative number for uploadEvidence.',
    });

    const missingControl = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'mapControlToFramework',
      payload: { controlRef: 'control-does-not-exist', frameworkRef: 'framework-1000' },
    });
    expect(missingControl).toEqual({
      ok: false,
      error: 'not_found',
      message: 'Control control-does-not-exist was not found.',
    });
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemoryComplianceGrcAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'listControls',
    });
    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported ComplianceGrc operation: bogusOperation.',
    });
  });
});
