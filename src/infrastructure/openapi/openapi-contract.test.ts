import path from 'node:path';

import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import { appendEvidenceEntryV1 } from '../../domain/evidence/evidence-chain-v1.js';
import {
  parseCreateEvidenceRetentionScheduleRequestV1,
  parseCreateLegalHoldRequestV1,
  parseEvidenceDispositionJobV1,
  parseEvidenceRetentionScheduleV1,
  parseExecuteEvidenceDispositionRequestV1,
  parseLegalHoldV1,
} from '../../domain/evidence/evidence-governance-v1.js';
import {
  parseMachineInvocationProgressEventV1,
  parseMachineInvocationRequestV1,
  parseMachineInvocationResponseV1,
} from '../../domain/machine-invocations/index.js';
import { parsePlanV1 } from '../../domain/plan/plan-v1.js';
import { parsePolicyV1 } from '../../domain/policy/policy-v1.js';
import { parseRunV1 } from '../../domain/runs/run-v1.js';
import { createCanonicalSeedBundleV1 } from '../../domain/testing/canonical-seeds-v1.js';
import { parseWorkItemV1 } from '../../domain/work-items/work-item-v1.js';
import { parseCredentialGrantV1 } from '../../domain/credentials/credential-grant-v1.js';
import { parseAdapterRegistrationV1 } from '../../domain/adapters/adapter-registration-v1.js';
import { HashSha256, PORT_FAMILIES } from '../../domain/primitives/index.js';
import { NodeCryptoEvidenceHasher } from '../crypto/node-crypto-evidence-hasher.js';
import {
  buildJsonSchemaFromComponents,
  findDuplicates,
  listOperationIds,
  mustRecord,
  readText,
  resolveRepoRoot,
  validateOrThrow,
} from './openapi-contract.test-helpers.js';

const OPENAPI_SPEC_RELATIVE_PATH = 'docs/spec/openapi/portarium-control-plane.v1.yaml';

describe('OpenAPI contract', () => {
  it('OpenAPI parses and operationIds are unique', async () => {
    const repoRoot = resolveRepoRoot();
    const specPath = path.join(repoRoot, OPENAPI_SPEC_RELATIVE_PATH);

    const doc = parseYaml(await readText(specPath));
    const docObj = mustRecord(doc, 'OpenAPI');

    expect(docObj['openapi']).toBe('3.1.0');

    const info = mustRecord(docObj['info'], 'OpenAPI.info');
    expect(typeof info['title']).toBe('string');
    expect(typeof info['version']).toBe('string');

    const pathsObj = mustRecord(docObj['paths'], 'OpenAPI.paths');

    const expectedPaths = [
      '/v1/workspaces',
      '/v1/workspaces/{workspaceId}',
      '/v1/workspaces/{workspaceId}/cockpit/extension-context',
      '/v1/workspaces/{workspaceId}/users',
      '/v1/workspaces/{workspaceId}/users/{userId}',
      '/v1/workspaces/{workspaceId}/work-items',
      '/v1/workspaces/{workspaceId}/work-items/{workItemId}',
      '/v1/workspaces/{workspaceId}/work-items/{workItemId}/assignment',
      '/v1/workspaces/{workspaceId}/workforce',
      '/v1/workspaces/{workspaceId}/workforce/{workforceMemberId}',
      '/v1/workspaces/{workspaceId}/workforce/{workforceMemberId}/availability',
      '/v1/workspaces/{workspaceId}/workforce/queues',
      '/v1/workspaces/{workspaceId}/location-events:stream',
      '/v1/workspaces/{workspaceId}/location-events',
      '/v1/workspaces/{workspaceId}/map-layers',
      '/v1/workspaces/{workspaceId}/human-tasks',
      '/v1/workspaces/{workspaceId}/human-tasks/{humanTaskId}',
      '/v1/workspaces/{workspaceId}/human-tasks/{humanTaskId}/assign',
      '/v1/workspaces/{workspaceId}/human-tasks/{humanTaskId}/complete',
      '/v1/workspaces/{workspaceId}/human-tasks/{humanTaskId}/escalate',
      '/v1/workspaces/{workspaceId}/plans/{planId}',
      '/v1/workspaces/{workspaceId}/evidence',
      '/v1/workspaces/{workspaceId}/evidence/retention',
      '/v1/workspaces/{workspaceId}/evidence/retention/{scheduleId}',
      '/v1/workspaces/{workspaceId}/evidence/{evidenceId}/disposition',
      '/v1/workspaces/{workspaceId}/legal-holds',
      '/v1/workspaces/{workspaceId}/legal-holds/{holdId}',
      '/v1/workspaces/{workspaceId}/approvals',
      '/v1/workspaces/{workspaceId}/runs',
      '/v1/workspaces/{workspaceId}/runs/{runId}/cancel',
      '/v1/workspaces/{workspaceId}/machines/{machineId}/invocations',
      '/v1/workspaces/{workspaceId}/machines/{machineId}/invocations/{invocationId}',
      '/v1/workspaces/{workspaceId}/machines/{machineId}/invocations/{invocationId}/stream',
    ];
    for (const p of expectedPaths) {
      expect(Object.prototype.hasOwnProperty.call(pathsObj, p)).toBe(true);
    }

    const operationIds = listOperationIds(pathsObj);
    expect(operationIds.length).toBeGreaterThan(0);
    expect(findDuplicates(operationIds)).toEqual([]);
  });

  it('PortFamily enum matches domain primitives', async () => {
    const repoRoot = resolveRepoRoot();
    const specPath = path.join(repoRoot, OPENAPI_SPEC_RELATIVE_PATH);

    const doc = mustRecord(parseYaml(await readText(specPath)), 'OpenAPI');
    const components = mustRecord(doc['components'], 'OpenAPI.components');
    const schemas = mustRecord(components['schemas'], 'OpenAPI.components.schemas');
    const portFamily = mustRecord(schemas['PortFamily'], 'components.schemas.PortFamily');

    const enumRaw = portFamily['enum'];
    if (!Array.isArray(enumRaw) || enumRaw.some((x) => typeof x !== 'string')) {
      throw new Error('PortFamily.enum must be an array of strings');
    }

    expect(enumRaw).toEqual([...PORT_FAMILIES]);
  });

  it('PlanV1, EvidenceEntryV1, evidence governance schemas, machine invocation schemas, WorkItemV1, CredentialGrantV1, AdapterRegistrationV1, PolicyV1, and DecideApprovalRequest schemas validate representative payloads', async () => {
    const repoRoot = resolveRepoRoot();
    const specPath = path.join(repoRoot, OPENAPI_SPEC_RELATIVE_PATH);

    const doc = mustRecord(parseYaml(await readText(specPath)), 'OpenAPI');
    const components = mustRecord(doc['components'], 'OpenAPI.components');
    const schemas = mustRecord(components['schemas'], 'OpenAPI.components.schemas');

    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats.default(ajv);

    const planSchema = buildJsonSchemaFromComponents({
      rootName: 'PlanV1',
      componentsSchemas: schemas,
    });
    const validatePlan = ajv.compile(planSchema);

    const plan = {
      schemaVersion: 1,
      planId: 'plan-1',
      workspaceId: 'ws-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      createdByUserId: 'user-1',
      plannedEffects: [
        {
          effectId: 'eff-1',
          operation: 'Create',
          target: {
            sorName: 'stripe',
            portFamily: 'PaymentsBilling',
            externalId: 'cus_123',
            externalType: 'Customer',
            displayLabel: 'cus_123',
            deepLinkUrl: 'https://dashboard.stripe.com/customers/cus_123',
          },
          summary: 'Create Customer in Stripe',
          idempotencyKey: 'idempotency-1',
        },
      ],
    };

    expect(() => parsePlanV1(plan)).not.toThrow();
    expect(() => validateOrThrow(validatePlan, plan)).not.toThrow();

    const invalidPlan = { ...plan, schemaVersion: 2 };
    expect(() => parsePlanV1(invalidPlan)).toThrow(/schemaVersion/i);
    expect(validatePlan(invalidPlan)).toBe(false);

    const evidenceSchema = buildJsonSchemaFromComponents({
      rootName: 'EvidenceEntryV1',
      componentsSchemas: schemas,
    });
    const validateEvidence = ajv.compile(evidenceSchema);

    const hasher = new NodeCryptoEvidenceHasher();
    const seeds = createCanonicalSeedBundleV1();
    const evidence = appendEvidenceEntryV1({ previous: undefined, next: seeds.evidence, hasher });
    expect(() => validateOrThrow(validateEvidence, evidence)).not.toThrow();

    const invalidEvidence = { ...evidence, hashSha256: HashSha256('not-a-sha') };
    expect(validateEvidence(invalidEvidence)).toBe(false);

    const retentionScheduleSchema = buildJsonSchemaFromComponents({
      rootName: 'EvidenceRetentionScheduleV1',
      componentsSchemas: schemas,
    });
    const validateRetentionSchedule = ajv.compile(retentionScheduleSchema);
    const createRetentionScheduleSchema = buildJsonSchemaFromComponents({
      rootName: 'CreateEvidenceRetentionScheduleRequest',
      componentsSchemas: schemas,
    });
    const validateCreateRetentionSchedule = ajv.compile(createRetentionScheduleSchema);
    const legalHoldSchema = buildJsonSchemaFromComponents({
      rootName: 'LegalHoldV1',
      componentsSchemas: schemas,
    });
    const validateLegalHold = ajv.compile(legalHoldSchema);
    const createLegalHoldSchema = buildJsonSchemaFromComponents({
      rootName: 'CreateLegalHoldRequest',
      componentsSchemas: schemas,
    });
    const validateCreateLegalHold = ajv.compile(createLegalHoldSchema);
    const executeDispositionSchema = buildJsonSchemaFromComponents({
      rootName: 'ExecuteEvidenceDispositionRequest',
      componentsSchemas: schemas,
    });
    const validateExecuteDisposition = ajv.compile(executeDispositionSchema);
    const dispositionJobSchema = buildJsonSchemaFromComponents({
      rootName: 'EvidenceDispositionJobV1',
      componentsSchemas: schemas,
    });
    const validateDispositionJob = ajv.compile(dispositionJobSchema);
    const machineInvocationRequestSchema = buildJsonSchemaFromComponents({
      rootName: 'MachineInvocationRequestV1',
      componentsSchemas: schemas,
    });
    const validateMachineInvocationRequest = ajv.compile(machineInvocationRequestSchema);
    const machineInvocationResponseSchema = buildJsonSchemaFromComponents({
      rootName: 'MachineInvocationResponseV1',
      componentsSchemas: schemas,
    });
    const validateMachineInvocationResponse = ajv.compile(machineInvocationResponseSchema);
    const machineInvocationProgressSchema = buildJsonSchemaFromComponents({
      rootName: 'MachineInvocationProgressEventV1',
      componentsSchemas: schemas,
    });
    const validateMachineInvocationProgress = ajv.compile(machineInvocationProgressSchema);

    const retentionSchedule = {
      schemaVersion: 1,
      scheduleId: 'schedule-1',
      workspaceId: 'ws-1',
      categories: ['Plan', 'Action'],
      defaultDisposition: 'Quarantine',
      retentionDays: 90,
      legalHoldOverrides: true,
      createdByUserId: 'user-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
      description: 'Evidence retention schedule',
    };
    expect(() => parseEvidenceRetentionScheduleV1(retentionSchedule)).not.toThrow();
    expect(() => validateOrThrow(validateRetentionSchedule, retentionSchedule)).not.toThrow();

    const createRetentionSchedule = {
      schemaVersion: 1,
      categories: ['Approval'],
      defaultDisposition: 'Destroy',
      retentionDays: 30,
      legalHoldOverrides: false,
    };
    expect(() =>
      parseCreateEvidenceRetentionScheduleRequestV1(createRetentionSchedule),
    ).not.toThrow();
    expect(() =>
      validateOrThrow(validateCreateRetentionSchedule, createRetentionSchedule),
    ).not.toThrow();

    const legalHold = {
      schemaVersion: 1,
      holdId: 'hold-1',
      workspaceId: 'ws-1',
      evidenceCategory: 'System',
      description: 'Audit freeze',
      active: true,
      reason: 'Litigation',
      createdByUserId: 'user-1',
      createdAtIso: '2026-02-16T00:00:00.000Z',
    };
    expect(() => parseLegalHoldV1(legalHold)).not.toThrow();
    expect(() => validateOrThrow(validateLegalHold, legalHold)).not.toThrow();

    const createLegalHold = {
      schemaVersion: 1,
      evidenceCategory: 'Policy',
      description: 'Preserve policy evidence',
      reason: 'Compliance review',
      active: true,
    };
    expect(() => parseCreateLegalHoldRequestV1(createLegalHold)).not.toThrow();
    expect(() => validateOrThrow(validateCreateLegalHold, createLegalHold)).not.toThrow();

    const executeDisposition = {
      action: 'Destroy',
      reason: 'right-to-erasure',
      actorUserId: 'user-2',
    };
    expect(() => parseExecuteEvidenceDispositionRequestV1(executeDisposition)).not.toThrow();
    expect(() => validateOrThrow(validateExecuteDisposition, executeDisposition)).not.toThrow();

    const dispositionJob = {
      jobId: 'job-1',
      evidenceId: 'evi-1',
      action: 'DeIdentify',
      status: 'Queued',
      reason: 'GDPR request',
    };
    expect(() => parseEvidenceDispositionJobV1(dispositionJob)).not.toThrow();
    expect(() => validateOrThrow(validateDispositionJob, dispositionJob)).not.toThrow();

    const machineInvocationRequest = {
      schemaVersion: 1,
      invocationId: 'invocation-1',
      machineId: 'machine-1',
      workspaceId: 'ws-1',
      runId: 'run-1',
      action: 'poster.generate',
      input: {
        prompt: 'Create a concise changelog summary',
      },
      callbackUrl: 'https://control-plane.local/hooks/machine-events',
      idempotencyKey: 'idempotency-1',
    };
    expect(() => parseMachineInvocationRequestV1(machineInvocationRequest)).not.toThrow();
    expect(() =>
      validateOrThrow(validateMachineInvocationRequest, machineInvocationRequest),
    ).not.toThrow();

    const machineInvocationResponse = {
      schemaVersion: 1,
      invocationId: 'invocation-1',
      status: 'completed',
      statusUrl:
        'https://control-plane.local/v1/workspaces/ws-1/machines/machine-poster-1/invocations/invocation-1',
      artifactUris: ['s3://artifacts/ws-1/runs/run-9001/poster/summary.md'],
    };
    expect(() => parseMachineInvocationResponseV1(machineInvocationResponse)).not.toThrow();
    expect(() =>
      validateOrThrow(validateMachineInvocationResponse, machineInvocationResponse),
    ).not.toThrow();

    const machineInvocationProgress = {
      schemaVersion: 1,
      invocationId: 'invocation-1',
      status: 'running',
      progressRatio: 0.62,
      step: 'rendering',
      diagnostics: 'page 3/5 complete',
    };
    expect(() => parseMachineInvocationProgressEventV1(machineInvocationProgress)).not.toThrow();
    expect(() =>
      validateOrThrow(validateMachineInvocationProgress, machineInvocationProgress),
    ).not.toThrow();

    const runSchema = buildJsonSchemaFromComponents({
      rootName: 'RunV1',
      componentsSchemas: schemas,
    });
    const validateRun = ajv.compile(runSchema);

    expect(() => parseRunV1(seeds.run)).not.toThrow();
    expect(() => validateOrThrow(validateRun, seeds.run)).not.toThrow();

    const invalidRun = { ...seeds.run, status: 'Done' };
    expect(() => parseRunV1(invalidRun)).toThrow(/status/i);
    expect(validateRun(invalidRun)).toBe(false);

    const invalidRetentionSchedule = { ...retentionSchedule, categories: [] };
    expect(validateRetentionSchedule(invalidRetentionSchedule)).toBe(false);

    const invalidLegalHold = { ...legalHold, active: 'yes' };
    expect(validateLegalHold(invalidLegalHold)).toBe(false);

    const invalidDispositionJob = { ...dispositionJob, status: 'Unknown' };
    expect(validateDispositionJob(invalidDispositionJob)).toBe(false);

    const invalidMachineInvocationRequest = {
      ...machineInvocationRequest,
      callbackUrl: 'ftp://bad.example',
    };
    expect(validateMachineInvocationRequest(invalidMachineInvocationRequest)).toBe(false);

    const invalidMachineInvocationResponse = {
      ...machineInvocationResponse,
      status: 'bogus',
    };
    expect(validateMachineInvocationResponse(invalidMachineInvocationResponse)).toBe(false);

    const invalidMachineInvocationProgress = {
      ...machineInvocationProgress,
      progressRatio: 2,
    };
    expect(validateMachineInvocationProgress(invalidMachineInvocationProgress)).toBe(false);

    const workItemSchema = buildJsonSchemaFromComponents({
      rootName: 'WorkItemV1',
      componentsSchemas: schemas,
    });
    const validateWorkItem = ajv.compile(workItemSchema);

    const workItem = seeds.workItem;

    expect(() => parseWorkItemV1(workItem)).not.toThrow();
    expect(() => validateOrThrow(validateWorkItem, workItem)).not.toThrow();

    const invalidWorkItem = { ...workItem, status: 'Unknown' };
    expect(() => parseWorkItemV1(invalidWorkItem)).toThrow(/status/i);
    expect(validateWorkItem(invalidWorkItem)).toBe(false);

    const credentialGrantSchema = buildJsonSchemaFromComponents({
      rootName: 'CredentialGrantV1',
      componentsSchemas: schemas,
    });
    const validateCredentialGrant = ajv.compile(credentialGrantSchema);

    const credentialGrant = {
      schemaVersion: 1,
      credentialGrantId: 'cg-1',
      workspaceId: 'ws-1',
      adapterId: 'adapter-1',
      credentialsRef: 'vault://secrets/cg-1',
      scope: 'invoice:read',
      issuedAtIso: '2026-02-16T00:00:00.000Z',
      expiresAtIso: '2026-12-16T00:00:00.000Z',
      lastRotatedAtIso: '2026-06-16T00:00:00.000Z',
    };

    expect(() => parseCredentialGrantV1(credentialGrant)).not.toThrow();
    expect(() => validateOrThrow(validateCredentialGrant, credentialGrant)).not.toThrow();

    const invalidCredentialGrant = { ...credentialGrant, schemaVersion: 2 };
    expect(() => parseCredentialGrantV1(invalidCredentialGrant)).toThrow(/schemaVersion/i);
    expect(validateCredentialGrant(invalidCredentialGrant)).toBe(false);

    const adapterRegistrationSchema = buildJsonSchemaFromComponents({
      rootName: 'AdapterRegistrationV1',
      componentsSchemas: schemas,
    });
    const validateAdapterRegistration = ajv.compile(adapterRegistrationSchema);

    const adapterRegistration = {
      schemaVersion: 1,
      adapterId: 'adapter-1',
      workspaceId: 'ws-1',
      providerSlug: 'quickbooks',
      portFamily: 'FinanceAccounting',
      enabled: true,
      executionPolicy: {
        tenantIsolationMode: 'PerTenantWorker',
        egressAllowlist: ['https://api.quickbooks.example'],
        credentialScope: 'capabilityMatrix',
        sandboxVerified: true,
        sandboxAvailable: true,
      },
      capabilityMatrix: [
        {
          capability: 'invoice:read',
          operation: 'invoice:read',
          requiresAuth: true,
        },
      ],
      machineRegistrations: [
        {
          machineId: 'machine-1',
          endpointUrl: 'https://api.example.com/v1',
          active: true,
        },
      ],
    };

    expect(() => parseAdapterRegistrationV1(adapterRegistration)).not.toThrow();
    expect(() => validateOrThrow(validateAdapterRegistration, adapterRegistration)).not.toThrow();

    const invalidAdapterRegistration = {
      ...adapterRegistration,
      capabilityMatrix: [],
    };
    expect(() => parseAdapterRegistrationV1(invalidAdapterRegistration)).toThrow(
      /capabilityMatrix/i,
    );
    expect(validateAdapterRegistration(invalidAdapterRegistration)).toBe(false);

    const policySchema = buildJsonSchemaFromComponents({
      rootName: 'PolicyV1',
      componentsSchemas: schemas,
    });
    const validatePolicy = ajv.compile(policySchema);
    const decideApprovalRequestSchema = buildJsonSchemaFromComponents({
      rootName: 'DecideApprovalRequest',
      componentsSchemas: schemas,
    });
    const validateDecideApprovalRequest = ajv.compile(decideApprovalRequestSchema);

    const policy = seeds.policy;

    expect(() => parsePolicyV1(policy)).not.toThrow();
    expect(() => validateOrThrow(validatePolicy, policy)).not.toThrow();

    const decideApprovalRequest = {
      decision: 'Approved',
      rationale: 'Second approver sign-off.',
      sodConstraints: [{ kind: 'SafetyClassifiedZoneDualApproval' }],
      previousApproverIds: ['approver-1'],
      robotContext: {
        safetyClassifiedZone: true,
        missionProposerUserId: 'operator-1',
      },
    };

    expect(validateDecideApprovalRequest(decideApprovalRequest)).toBe(true);

    const invalidPolicy = {
      ...policy,
      rules: [{ ruleId: 'r-1', condition: 'x', effect: 'Maybe' }],
    };
    expect(() => parsePolicyV1(invalidPolicy)).toThrow(/effect/i);
    expect(validatePolicy(invalidPolicy)).toBe(false);

    const invalidDecideApprovalRequest = {
      ...decideApprovalRequest,
      previousApproverIds: [''],
    };
    expect(validateDecideApprovalRequest(invalidDecideApprovalRequest)).toBe(false);
  });
});
