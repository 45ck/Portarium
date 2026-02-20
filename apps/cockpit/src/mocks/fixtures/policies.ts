// ---------------------------------------------------------------------------
// Mock Policies & SoD Constraints fixture
// ---------------------------------------------------------------------------

export type { PolicyCondition, PolicySummary, SodConstraint } from '@portarium/cockpit-types';
import type { PolicySummary, SodConstraint } from '@portarium/cockpit-types';

export const MOCK_POLICIES: PolicySummary[] = [
  {
    policyId: 'pol-001',
    name: 'SOC 2 CC6.1 — Logical access controls',
    description: 'Ensures logical access controls are enforced for all system interactions.',
    status: 'Active',
    ruleText:
      'WHEN actor.role NOT IN ("Admin", "Operator") THEN DENY action.type = "write:external"',
    conditions: [
      { field: 'actor.role', operator: 'in', value: 'Admin,Operator' },
      { field: 'action.type', operator: 'eq', value: 'write:external' },
    ],
  },
  {
    policyId: 'pol-002',
    name: 'GDPR Art. 25 — Data minimization',
    description: 'Data processing must comply with GDPR data minimization principles.',
    status: 'Active',
    ruleText: 'WHEN data.category = "PII" AND action.scope != "minimal" THEN DENY',
    conditions: [
      { field: 'data.category', operator: 'eq', value: 'PII' },
      { field: 'action.scope', operator: 'neq', value: 'minimal' },
    ],
  },
  {
    policyId: 'pol-003',
    name: 'ISO 27001 A.9 — Access management',
    description: 'Access management controls per ISO 27001 Annex A.9.',
    status: 'Active',
    ruleText: 'WHEN session.mfaVerified = false THEN DENY action.sensitivity > "low"',
    conditions: [
      { field: 'session.mfaVerified', operator: 'eq', value: 'false' },
      { field: 'action.sensitivity', operator: 'gt', value: 'low' },
    ],
  },
  {
    policyId: 'pol-004',
    name: 'Cold Chain Integrity — Temperature thresholds',
    description:
      'Validates temperature readings remain within acceptable range for pharmaceutical transport.',
    status: 'Active',
    ruleText: 'WHEN sensor.tempCelsius > 8 OR sensor.tempCelsius < 2 THEN ALERT AND ESCALATE',
    conditions: [
      { field: 'sensor.tempCelsius', operator: 'gt', value: '8' },
      { field: 'sensor.tempCelsius', operator: 'lt', value: '2' },
    ],
  },
  {
    policyId: 'pol-005',
    name: 'Agent Execution Limit — Rate control',
    description: 'Prevents AI agents from exceeding execution rate limits.',
    status: 'Draft',
    ruleText: 'WHEN agent.execCount_1h > 100 THEN DENY AND NOTIFY admin',
    conditions: [{ field: 'agent.execCount_1h', operator: 'gt', value: '100' }],
  },
  {
    policyId: 'pol-006',
    name: 'Approval SLA — Response time',
    description: 'Approvals must be resolved within the configured SLA window.',
    status: 'Active',
    ruleText: 'WHEN approval.pendingHours > 24 THEN ESCALATE to queue "urgent-approvals"',
    conditions: [{ field: 'approval.pendingHours', operator: 'gt', value: '24' }],
  },
];

export const MOCK_SOD_CONSTRAINTS: SodConstraint[] = [
  {
    constraintId: 'sod-001',
    name: 'Approve ≠ Initiate',
    description: 'Approval actor must differ from run initiator',
    status: 'Active',
    relatedPolicyIds: ['pol-001', 'pol-003'],
  },
  {
    constraintId: 'sod-002',
    name: 'Finance Dual Control',
    description: 'Finance changes require 2 approvers',
    status: 'Active',
    relatedPolicyIds: ['pol-001'],
  },
  {
    constraintId: 'sod-003',
    name: 'IAM Review Independence',
    description: 'IAM reviewer cannot be a Finance team member',
    status: 'Active',
    relatedPolicyIds: ['pol-003'],
  },
  {
    constraintId: 'sod-004',
    name: 'Robot Override Segregation',
    description: 'Safety override actor must not be the mission initiator',
    status: 'Active',
    relatedPolicyIds: ['pol-004'],
  },
];
