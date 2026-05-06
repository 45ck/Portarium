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
    tier: 'HumanApprove',
    scope: 'actor, action',
    ruleCount: 2,
    affectedWorkflowIds: ['wf-adapter-sync-review', 'wf-adapter-access-review'],
    ruleText:
      'WHEN actor.role NOT IN ("Admin", "Operator") THEN DENY action.type = "write:external"',
    conditions: [
      { field: 'actor.role', operator: 'in', value: 'Admin,Operator' },
      { field: 'action.type', operator: 'eq', value: 'write:external' },
    ],
  },
  {
    policyId: 'pol-002',
    name: 'Data Minimization — Sensitive payload controls',
    description: 'Sensitive payload processing must use the minimum required fields.',
    status: 'Active',
    tier: 'Assisted',
    scope: 'data processing',
    ruleCount: 2,
    affectedWorkflowIds: ['wf-evidence-projection'],
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
    tier: 'HumanApprove',
    scope: 'session, access',
    ruleCount: 2,
    affectedWorkflowIds: ['wf-credential-rotation'],
    ruleText: 'WHEN session.mfaVerified = false THEN DENY action.sensitivity > "low"',
    conditions: [
      { field: 'session.mfaVerified', operator: 'eq', value: 'false' },
      { field: 'action.sensitivity', operator: 'gt', value: 'low' },
    ],
  },
  {
    policyId: 'pol-004',
    name: 'Change Safety — External system thresholds',
    description:
      'High-impact external changes must remain within configured safety thresholds.',
    status: 'Active',
    tier: 'ManualOnly',
    scope: 'external changes',
    ruleCount: 2,
    affectedWorkflowIds: ['wf-release-window'],
    ruleText: 'WHEN impact.score > 80 OR rollback.available = false THEN ALERT AND ESCALATE',
    conditions: [
      { field: 'impact.score', operator: 'gt', value: '80' },
      { field: 'rollback.available', operator: 'eq', value: 'false' },
    ],
  },
  {
    policyId: 'pol-005',
    name: 'Agent Execution Limit — Rate control',
    description: 'Prevents AI agents from exceeding execution rate limits.',
    status: 'Draft',
    tier: 'Auto',
    scope: 'agent execution',
    ruleCount: 1,
    affectedWorkflowIds: ['wf-adapter-sync-review'],
    ruleText: 'WHEN agent.execCount_1h > 100 THEN DENY AND NOTIFY admin',
    conditions: [{ field: 'agent.execCount_1h', operator: 'gt', value: '100' }],
  },
  {
    policyId: 'pol-006',
    name: 'Approval SLA — Response time',
    description: 'Approvals must be resolved within the configured SLA window.',
    status: 'Active',
    tier: 'Assisted',
    scope: 'approvals',
    ruleCount: 1,
    affectedWorkflowIds: ['wf-policy-exception-review'],
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
    rolePair: 'Approver / Initiator',
    forbiddenAction: 'Self-approval',
    scope: 'run.approval',
    relatedPolicyIds: ['pol-001', 'pol-003'],
  },
  {
    constraintId: 'sod-002',
    name: 'High-Impact Dual Control',
    description: 'High-impact changes require 2 approvers',
    status: 'Active',
    rolePair: 'Reviewer / Requestor',
    forbiddenAction: 'Single-actor high-impact approval',
    scope: 'critical.change',
    relatedPolicyIds: ['pol-001'],
  },
  {
    constraintId: 'sod-003',
    name: 'IAM Review Independence',
    description: 'IAM reviewer cannot be the owner of the target access group',
    status: 'Active',
    rolePair: 'IAM Reviewer / Access Owner',
    forbiddenAction: 'Cross-duty IAM approval',
    scope: 'iam.review',
    relatedPolicyIds: ['pol-003'],
  },
  {
    constraintId: 'sod-004',
    name: 'Override Segregation',
    description: 'Override actor must not be the original initiator',
    status: 'Active',
    rolePair: 'Override Actor / Initiator',
    forbiddenAction: 'Self-override',
    scope: 'policy.override',
    relatedPolicyIds: ['pol-004'],
  },
];
