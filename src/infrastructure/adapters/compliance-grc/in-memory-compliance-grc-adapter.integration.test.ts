import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryComplianceGrcAdapter } from './in-memory-compliance-grc-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryComplianceGrcAdapter integration', () => {
  it('supports control, risk, policy, and audit operational flow', async () => {
    const adapter = new InMemoryComplianceGrcAdapter({
      seed: InMemoryComplianceGrcAdapter.seedMinimal(TENANT),
    });

    const controls = await adapter.execute({ tenantId: TENANT, operation: 'listControls' });
    expect(controls.ok).toBe(true);
    if (!controls.ok || controls.result.kind !== 'externalRefs') return;
    const seedControlId = controls.result.externalRefs[0]!.externalId;

    const seedControl = await adapter.execute({
      tenantId: TENANT,
      operation: 'getControl',
      payload: { controlId: seedControlId },
    });
    expect(seedControl.ok).toBe(true);
    if (!seedControl.ok || seedControl.result.kind !== 'externalRef') return;
    expect(seedControl.result.externalRef.externalId).toBe(seedControlId);

    const createdControl = await adapter.execute({
      tenantId: TENANT,
      operation: 'createControl',
      payload: { name: 'Quarterly access review' },
    });
    expect(createdControl.ok).toBe(true);
    if (!createdControl.ok || createdControl.result.kind !== 'externalRef') return;
    const controlId = createdControl.result.externalRef.externalId;

    const updatedControl = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateControlStatus',
      payload: { controlId, status: 'implemented' },
    });
    expect(updatedControl.ok).toBe(true);
    if (!updatedControl.ok || updatedControl.result.kind !== 'externalRef') return;
    expect(updatedControl.result.externalRef.displayLabel).toContain('implemented');

    const risks = await adapter.execute({ tenantId: TENANT, operation: 'listRisks' });
    expect(risks.ok).toBe(true);
    if (!risks.ok || risks.result.kind !== 'externalRefs') return;
    expect(risks.result.externalRefs.length).toBeGreaterThan(0);

    const createdRisk = await adapter.execute({
      tenantId: TENANT,
      operation: 'createRisk',
      payload: { name: 'Unmanaged privileged account risk' },
    });
    expect(createdRisk.ok).toBe(true);
    if (!createdRisk.ok || createdRisk.result.kind !== 'externalRef') return;
    const riskId = createdRisk.result.externalRef.externalId;

    const assessedRisk = await adapter.execute({
      tenantId: TENANT,
      operation: 'assessRisk',
      payload: { riskId, score: 8.8 },
    });
    expect(assessedRisk.ok).toBe(true);
    if (!assessedRisk.ok || assessedRisk.result.kind !== 'externalRef') return;
    expect(assessedRisk.result.externalRef.externalType).toBe('risk_assessment');

    const policies = await adapter.execute({ tenantId: TENANT, operation: 'listPolicies' });
    expect(policies.ok).toBe(true);
    if (!policies.ok || policies.result.kind !== 'externalRefs') return;
    const seedPolicyId = policies.result.externalRefs[0]!.externalId;

    const seedPolicy = await adapter.execute({
      tenantId: TENANT,
      operation: 'getPolicy',
      payload: { policyId: seedPolicyId },
    });
    expect(seedPolicy.ok).toBe(true);
    if (!seedPolicy.ok || seedPolicy.result.kind !== 'externalRef') return;
    expect(seedPolicy.result.externalRef.externalId).toBe(seedPolicyId);

    const createdPolicy = await adapter.execute({
      tenantId: TENANT,
      operation: 'createPolicy',
      payload: { title: 'Evidence Retention Policy' },
    });
    expect(createdPolicy.ok).toBe(true);
    if (!createdPolicy.ok || createdPolicy.result.kind !== 'externalRef') return;
    const policyId = createdPolicy.result.externalRef.externalId;

    const publishedPolicy = await adapter.execute({
      tenantId: TENANT,
      operation: 'publishPolicy',
      payload: { policyId },
    });
    expect(publishedPolicy.ok).toBe(true);
    if (!publishedPolicy.ok || publishedPolicy.result.kind !== 'externalRef') return;
    expect(publishedPolicy.result.externalRef.displayLabel).toContain('Published');

    const audits = await adapter.execute({ tenantId: TENANT, operation: 'listAudits' });
    expect(audits.ok).toBe(true);
    if (!audits.ok || audits.result.kind !== 'externalRefs') return;
    expect(audits.result.externalRefs.length).toBeGreaterThan(0);

    const createdAudit = await adapter.execute({
      tenantId: TENANT,
      operation: 'createAudit',
      payload: { name: 'SOC 2 Type II Internal Readiness' },
    });
    expect(createdAudit.ok).toBe(true);
    if (!createdAudit.ok || createdAudit.result.kind !== 'externalRef') return;
    const auditId = createdAudit.result.externalRef.externalId;

    const fetchedAudit = await adapter.execute({
      tenantId: TENANT,
      operation: 'getAudit',
      payload: { auditId },
    });
    expect(fetchedAudit.ok).toBe(true);
    if (!fetchedAudit.ok || fetchedAudit.result.kind !== 'externalRef') return;
    expect(fetchedAudit.result.externalRef.externalId).toBe(auditId);
  });

  it('supports findings, evidence, and framework mapping flow', async () => {
    const adapter = new InMemoryComplianceGrcAdapter({
      seed: InMemoryComplianceGrcAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const findings = await adapter.execute({ tenantId: TENANT, operation: 'listFindings' });
    expect(findings.ok).toBe(true);
    if (!findings.ok || findings.result.kind !== 'tickets') return;
    expect(findings.result.tickets.length).toBeGreaterThan(0);

    const createdFinding = await adapter.execute({
      tenantId: TENANT,
      operation: 'createFinding',
      payload: { subject: 'Missing encryption evidence', priority: 'high' },
    });
    expect(createdFinding.ok).toBe(true);
    if (!createdFinding.ok || createdFinding.result.kind !== 'ticket') return;
    expect(createdFinding.result.ticket.createdAtIso).toBe('2026-02-19T00:00:00.000Z');
    expect(createdFinding.result.ticket.priority).toBe('high');

    const evidenceRequests = await adapter.execute({
      tenantId: TENANT,
      operation: 'listEvidenceRequests',
    });
    expect(evidenceRequests.ok).toBe(true);
    if (!evidenceRequests.ok || evidenceRequests.result.kind !== 'externalRefs') return;
    expect(evidenceRequests.result.externalRefs.length).toBeGreaterThan(0);

    const uploadedEvidence = await adapter.execute({
      tenantId: TENANT,
      operation: 'uploadEvidence',
      payload: { title: 'Access Review Export', mimeType: 'application/pdf', sizeBytes: 2048 },
    });
    expect(uploadedEvidence.ok).toBe(true);
    if (!uploadedEvidence.ok || uploadedEvidence.result.kind !== 'document') return;
    expect(uploadedEvidence.result.document.createdAtIso).toBe('2026-02-19T00:00:00.000Z');
    expect(uploadedEvidence.result.document.sizeBytes).toBe(2048);

    const frameworks = await adapter.execute({ tenantId: TENANT, operation: 'listFrameworks' });
    expect(frameworks.ok).toBe(true);
    if (!frameworks.ok || frameworks.result.kind !== 'externalRefs') return;
    const frameworkId = frameworks.result.externalRefs[0]!.externalId;

    const fetchedFramework = await adapter.execute({
      tenantId: TENANT,
      operation: 'getFramework',
      payload: { frameworkId },
    });
    expect(fetchedFramework.ok).toBe(true);
    if (!fetchedFramework.ok || fetchedFramework.result.kind !== 'externalRef') return;
    expect(fetchedFramework.result.externalRef.externalId).toBe(frameworkId);

    const mappedControl = await adapter.execute({
      tenantId: TENANT,
      operation: 'mapControlToFramework',
      payload: { controlRef: 'control-1000', frameworkRef: frameworkId },
    });
    expect(mappedControl.ok).toBe(true);
    if (!mappedControl.ok || mappedControl.result.kind !== 'externalRef') return;
    expect(mappedControl.result.externalRef.externalType).toBe('control_framework_mapping');
  });

  it('returns validation and not-found errors for invalid payloads', async () => {
    const adapter = new InMemoryComplianceGrcAdapter({
      seed: InMemoryComplianceGrcAdapter.seedMinimal(TENANT),
    });

    const missingControlId = await adapter.execute({
      tenantId: TENANT,
      operation: 'updateControlStatus',
      payload: {},
    });
    expect(missingControlId).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'controlId is required for updateControlStatus.',
    });

    const missingFrameworkRef = await adapter.execute({
      tenantId: TENANT,
      operation: 'mapControlToFramework',
      payload: { controlRef: 'control-1000' },
    });
    expect(missingFrameworkRef).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'frameworkRef is required for mapControlToFramework.',
    });

    const unknownPolicy = await adapter.execute({
      tenantId: TENANT,
      operation: 'publishPolicy',
      payload: { policyId: 'policy-does-not-exist' },
    });
    expect(unknownPolicy).toEqual({
      ok: false,
      error: 'not_found',
      message: 'Policy policy-does-not-exist was not found.',
    });

    const unknownRisk = await adapter.execute({
      tenantId: TENANT,
      operation: 'assessRisk',
      payload: { riskId: 'risk-does-not-exist' },
    });
    expect(unknownRisk).toEqual({
      ok: false,
      error: 'not_found',
      message: 'Risk risk-does-not-exist was not found.',
    });
  });
});
