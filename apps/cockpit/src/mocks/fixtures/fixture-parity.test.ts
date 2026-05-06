import { describe, expect, it } from 'vitest';

import {
  ADAPTERS,
  AGENTS,
  APPROVALS,
  CREDENTIAL_GRANTS,
  DERIVED_ARTIFACTS,
  EVIDENCE,
  ESTOP_AUDIT_LOG,
  GRAPH_TRAVERSAL_RESULT,
  MACHINES,
  MISSIONS,
  PLANS,
  ROBOTS,
  APPROVAL_THRESHOLDS,
  RETRIEVAL_SEARCH_RESULT,
  RUNS,
  SAFETY_CONSTRAINTS,
  WORKFORCE_MEMBERS,
  WORKFORCE_QUEUES,
  WORK_ITEMS,
} from './demo';
import { MOCK_GATEWAYS } from './gateways';
import { buildMockHumanTasks } from './human-tasks';
import { MOCK_POLICIES, MOCK_SOD_CONSTRAINTS } from './policies';
import { GEOFENCES, ROBOT_LOCATIONS, SPATIAL_ALERTS } from './robot-locations';
import { MOCK_USERS } from './users';
import { buildMockWorkflows } from './workflows';

type RecordShape = Record<string, unknown>;

const RUN_STATUSES = [
  'Pending',
  'Running',
  'WaitingForApproval',
  'Paused',
  'Succeeded',
  'Failed',
  'Cancelled',
] as const;
const RUN_CONTROL_STATES = ['waiting', 'blocked', 'degraded', 'frozen', 'operator-owned'] as const;
const EXECUTION_TIERS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;
const WORK_ITEM_STATUSES = ['Open', 'InProgress', 'Blocked', 'Resolved', 'Closed'] as const;
const APPROVAL_STATUSES = [
  'Pending',
  'Approved',
  'Denied',
  'Executed',
  'Expired',
  'RequestChanges',
] as const;
const SOD_STATES = ['eligible', 'blocked-self', 'blocked-role', 'n-of-m'] as const;
const POLICY_IRREVERSIBILITY = ['full', 'partial', 'none'] as const;
const TOOL_CATEGORIES = ['ReadOnly', 'Mutation', 'Dangerous', 'Unknown'] as const;
const EVIDENCE_CATEGORIES = [
  'Plan',
  'Action',
  'Approval',
  'Policy',
  'PolicyViolation',
  'System',
] as const;
const EVIDENCE_ACTORS = ['User', 'Machine', 'Adapter', 'System'] as const;
const WORKFORCE_STATUSES = ['available', 'busy', 'offline'] as const;
const WORKFORCE_CAPABILITIES = [
  'operations.dispatch',
  'operations.approval',
  'operations.escalation',
  'robotics.supervision',
  'robotics.safety.override',
] as const;
const ROUTING_STRATEGIES = ['round-robin', 'least-busy', 'manual'] as const;
const MACHINE_STATUSES = ['Online', 'Degraded', 'Offline'] as const;
const AGENT_CAPABILITIES = [
  'read:external',
  'write:external',
  'classify',
  'generate',
  'analyze',
  'execute-code',
  'notify',
  'machine:invoke',
] as const;
const POLICY_STATUSES = ['Active', 'Draft', 'Archived'] as const;
const POLICY_CONDITION_OPERATORS = ['eq', 'neq', 'in', 'gt', 'lt'] as const;
const SOD_CONSTRAINT_STATUSES = ['Active', 'Inactive'] as const;
const ADAPTER_STATUSES = ['healthy', 'degraded', 'unhealthy'] as const;
const USER_ROLES = ['Operator', 'Approver', 'Auditor', 'Admin'] as const;
const USER_STATUSES = ['active', 'suspended'] as const;
const HUMAN_TASK_STATUSES = [
  'pending',
  'assigned',
  'in-progress',
  'completed',
  'escalated',
] as const;
const WORKFLOW_TRIGGER_KINDS = ['Manual', 'Cron', 'Webhook', 'DomainEvent'] as const;
const WORKFLOW_COMPENSATION_MODES = ['best-effort', 'strict', 'none'] as const;
const EFFECT_OPERATIONS = ['Create', 'Update', 'Delete', 'Upsert'] as const;
const RETRIEVAL_STRATEGIES = ['semantic', 'graph', 'hybrid'] as const;
const GRAPH_NODE_KINDS = [
  'run',
  'work-item',
  'approval',
  'evidence-entry',
  'agent-machine',
] as const;
const DERIVED_ARTIFACT_KINDS = ['embedding', 'graph-node', 'graph-edge', 'chunk-index'] as const;
const DERIVED_RETENTION_POLICIES = ['indefinite', 'run-lifetime', 'ttl'] as const;
const GATEWAY_STATUSES = ['Online', 'Offline', 'Degraded'] as const;
const ROBOT_CLASSES = ['AMR', 'AGV', 'Manipulator', 'UAV', 'PLC'] as const;
const ROBOT_STATUSES = ['Online', 'Degraded', 'E-Stopped', 'Offline'] as const;
const MISSION_STATUSES = ['Pending', 'Executing', 'Completed', 'Failed', 'Cancelled'] as const;
const MISSION_ACTION_TYPES = ['navigate_to', 'pick', 'place', 'dock', 'custom'] as const;
const MISSION_PRIORITIES = ['Low', 'Normal', 'High', 'Safety'] as const;
const ROBOTICS_EXECUTION_TIERS = ['Auto', 'HumanApprove'] as const;
const ENFORCEMENT_MODES = ['block', 'warn', 'log'] as const;
const ESTOP_EVENTS = ['Sent', 'Cleared'] as const;
const SPATIAL_ALERT_TYPES = ['geofence-violation', 'localization-drop', 'e-stop'] as const;
const SPATIAL_ALERT_SEVERITIES = ['warning', 'critical'] as const;

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function asRecord(value: unknown): RecordShape {
  expect(value !== null && typeof value === 'object' && !Array.isArray(value)).toBe(true);
  return value as RecordShape;
}

function asStringArray(value: unknown): string[] {
  expect(Array.isArray(value)).toBe(true);
  return value as string[];
}

function expectNonEmptyArray(name: string, value: readonly unknown[]): void {
  expect(Array.isArray(value), `${name} must be an array`).toBe(true);
  expect(value.length, `${name} must not be empty`).toBeGreaterThan(0);
}

function expectExactKeys(name: string, value: RecordShape, allowedKeys: readonly string[]): void {
  const extras = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  expect(extras, `${name} contains only declared DTO fields`).toEqual([]);
}

function expectRequiredKeys(
  name: string,
  value: RecordShape,
  requiredKeys: readonly string[],
): void {
  for (const key of requiredKeys) {
    expect(value, `${name} has required key ${key}`).toHaveProperty(key);
    expect(value[key], `${name}.${key} must be defined`).not.toBeUndefined();
  }
}

function expectEnum(name: string, value: unknown, allowed: readonly string[]): void {
  expect(allowed, `${name} has a declared enum value`).toContain(value);
}

function expectIso(name: string, value: unknown): void {
  expect(typeof value, `${name} must be an ISO string`).toBe('string');
  expect(value, `${name} must be UTC ISO-8601`).toMatch(ISO_PATTERN);
}

function expectUniqueIds(name: string, records: readonly unknown[], idKey: string): void {
  const ids = records.map((record) => asRecord(record)[idKey]);
  expect(new Set(ids).size, `${name} ${idKey} values must be unique`).toBe(ids.length);
}

function expectCapabilities(name: string, value: unknown): void {
  for (const capability of asStringArray(value)) {
    expectEnum(name, capability, AGENT_CAPABILITIES);
  }
}

function expectWorkforceCapabilities(name: string, value: unknown): void {
  for (const capability of asStringArray(value)) {
    expectEnum(name, capability, WORKFORCE_CAPABILITIES);
  }
}

function expectExternalObjectRef(name: string, value: unknown): void {
  const record = asRecord(value);
  expectExactKeys(name, record, [
    'sorName',
    'portFamily',
    'externalId',
    'externalType',
    'displayLabel',
    'deepLinkUrl',
  ]);
  expectRequiredKeys(name, record, ['sorName', 'portFamily', 'externalId', 'externalType']);
}

function expectSodEvaluation(name: string, value: unknown): void {
  const record = asRecord(value);
  expectExactKeys(name, record, [
    'state',
    'requestorId',
    'ruleId',
    'rolesRequired',
    'nRequired',
    'nTotal',
    'nSoFar',
  ]);
  expectRequiredKeys(name, record, ['state', 'requestorId', 'ruleId', 'rolesRequired']);
  expectEnum(`${name}.state`, record.state, SOD_STATES);
  asStringArray(record.rolesRequired);
}

function expectPolicyRule(name: string, value: unknown): void {
  const record = asRecord(value);
  expectExactKeys(name, record, ['ruleId', 'trigger', 'tier', 'blastRadius', 'irreversibility']);
  expectRequiredKeys(name, record, ['ruleId', 'trigger', 'tier', 'blastRadius', 'irreversibility']);
  asStringArray(record.blastRadius);
  expectEnum(`${name}.tier`, record.tier, EXECUTION_TIERS);
  expectEnum(`${name}.irreversibility`, record.irreversibility, POLICY_IRREVERSIBILITY);
}

function expectAgentActionProposal(name: string, value: unknown): void {
  const record = asRecord(value);
  expectExactKeys(name, record, [
    'proposalId',
    'agentId',
    'machineId',
    'toolName',
    'toolCategory',
    'blastRadiusTier',
    'rationale',
  ]);
  expectRequiredKeys(name, record, [
    'proposalId',
    'agentId',
    'toolName',
    'toolCategory',
    'blastRadiusTier',
    'rationale',
  ]);
  expectEnum(`${name}.toolCategory`, record.toolCategory, TOOL_CATEGORIES);
  expectEnum(`${name}.blastRadiusTier`, record.blastRadiusTier, EXECUTION_TIERS);
}

function expectPlanEffect(name: string, value: unknown): void {
  const record = asRecord(value);
  expectExactKeys(name, record, ['effectId', 'operation', 'target', 'summary', 'idempotencyKey']);
  expectRequiredKeys(name, record, ['effectId', 'operation', 'target', 'summary']);
  expectEnum(`${name}.operation`, record.operation, EFFECT_OPERATIONS);
  expectExternalObjectRef(`${name}.target`, record.target);
}

function expectRetrievalHit(name: string, value: unknown): void {
  const record = asRecord(value);
  expectExactKeys(name, record, ['artifactId', 'score', 'text', 'metadata', 'provenance']);
  expectRequiredKeys(name, record, ['artifactId', 'metadata', 'provenance']);
  asRecord(record.metadata);
  const provenance = asRecord(record.provenance);
  expectExactKeys(`${name}.provenance`, provenance, ['workspaceId', 'runId', 'evidenceId']);
  expectRequiredKeys(`${name}.provenance`, provenance, ['workspaceId', 'runId']);
}

function expectGraphTraversal(name: string, value: unknown): void {
  const record = asRecord(value);
  expectExactKeys(name, record, ['nodes', 'edges']);
  expectRequiredKeys(name, record, ['nodes', 'edges']);
  expect(Array.isArray(record.nodes)).toBe(true);
  (record.nodes as unknown[]).forEach((node, index) => {
    const nodeRecord = asRecord(node);
    expectExactKeys(`${name}.nodes[${index}]`, nodeRecord, [
      'nodeId',
      'workspaceId',
      'kind',
      'label',
      'properties',
    ]);
    expectRequiredKeys(`${name}.nodes[${index}]`, nodeRecord, [
      'nodeId',
      'workspaceId',
      'kind',
      'label',
      'properties',
    ]);
    expectEnum(`${name}.nodes[${index}].kind`, nodeRecord.kind, GRAPH_NODE_KINDS);
    asRecord(nodeRecord.properties);
  });
  expect(Array.isArray(record.edges)).toBe(true);
  (record.edges as unknown[]).forEach((edge, index) => {
    const edgeRecord = asRecord(edge);
    expectExactKeys(`${name}.edges[${index}]`, edgeRecord, [
      'edgeId',
      'fromNodeId',
      'toNodeId',
      'relation',
      'workspaceId',
      'properties',
    ]);
    expectRequiredKeys(`${name}.edges[${index}]`, edgeRecord, [
      'edgeId',
      'fromNodeId',
      'toNodeId',
      'relation',
      'workspaceId',
    ]);
    if (edgeRecord.properties !== undefined) asRecord(edgeRecord.properties);
  });
}

function expectDerivedArtifact(name: string, value: unknown): void {
  const record = asRecord(value);
  expectExactKeys(name, record, [
    'schemaVersion',
    'artifactId',
    'workspaceId',
    'kind',
    'provenance',
    'retentionPolicy',
    'createdAtIso',
    'expiresAtIso',
  ]);
  expectRequiredKeys(name, record, [
    'schemaVersion',
    'artifactId',
    'workspaceId',
    'kind',
    'provenance',
    'retentionPolicy',
    'createdAtIso',
  ]);
  expect(record.schemaVersion).toBe(1);
  expectEnum(`${name}.kind`, record.kind, DERIVED_ARTIFACT_KINDS);
  expectEnum(`${name}.retentionPolicy`, record.retentionPolicy, DERIVED_RETENTION_POLICIES);
  expectIso(`${name}.createdAtIso`, record.createdAtIso);
  const provenance = asRecord(record.provenance);
  expectExactKeys(`${name}.provenance`, provenance, [
    'workspaceId',
    'runId',
    'evidenceId',
    'projectorVersion',
  ]);
  expectRequiredKeys(`${name}.provenance`, provenance, [
    'workspaceId',
    'runId',
    'projectorVersion',
  ]);
}

describe('Cockpit fixture parity', () => {
  it('keeps core entity fixtures aligned with Cockpit DTO fields and enums', () => {
    expectNonEmptyArray('WORK_ITEMS', WORK_ITEMS);
    expectUniqueIds('WORK_ITEMS', WORK_ITEMS, 'workItemId');
    WORK_ITEMS.forEach((item, index) => {
      const record = asRecord(item);
      expectExactKeys(`WORK_ITEMS[${index}]`, record, [
        'schemaVersion',
        'workItemId',
        'workspaceId',
        'createdAtIso',
        'createdByUserId',
        'title',
        'status',
        'ownerUserId',
        'sla',
        'links',
      ]);
      expectRequiredKeys(`WORK_ITEMS[${index}]`, record, [
        'schemaVersion',
        'workItemId',
        'workspaceId',
        'createdAtIso',
        'createdByUserId',
        'title',
        'status',
      ]);
      expect(record.schemaVersion).toBe(1);
      expectEnum(`WORK_ITEMS[${index}].status`, record.status, WORK_ITEM_STATUSES);
      expectIso(`WORK_ITEMS[${index}].createdAtIso`, record.createdAtIso);
    });

    expectNonEmptyArray('RUNS', RUNS);
    expectUniqueIds('RUNS', RUNS, 'runId');
    RUNS.forEach((run, index) => {
      const record = asRecord(run);
      expectExactKeys(`RUNS[${index}]`, record, [
        'schemaVersion',
        'runId',
        'workspaceId',
        'workflowId',
        'correlationId',
        'executionTier',
        'initiatedByUserId',
        'status',
        'createdAtIso',
        'startedAtIso',
        'endedAtIso',
        'controlState',
        'operatorOwnerId',
        'agentIds',
        'robotIds',
        'workforceMemberIds',
      ]);
      expectRequiredKeys(`RUNS[${index}]`, record, [
        'schemaVersion',
        'runId',
        'workspaceId',
        'workflowId',
        'correlationId',
        'executionTier',
        'initiatedByUserId',
        'status',
        'createdAtIso',
      ]);
      expect(record.schemaVersion).toBe(1);
      expectEnum(`RUNS[${index}].status`, record.status, RUN_STATUSES);
      expectEnum(`RUNS[${index}].executionTier`, record.executionTier, EXECUTION_TIERS);
      if (record.controlState !== undefined) {
        expectEnum(`RUNS[${index}].controlState`, record.controlState, RUN_CONTROL_STATES);
      }
      expectIso(`RUNS[${index}].createdAtIso`, record.createdAtIso);
    });

    expectNonEmptyArray('APPROVALS', APPROVALS);
    expectUniqueIds('APPROVALS', APPROVALS, 'approvalId');
    APPROVALS.forEach((approval, index) => {
      const record = asRecord(approval);
      expectExactKeys(`APPROVALS[${index}]`, record, [
        'schemaVersion',
        'approvalId',
        'workspaceId',
        'runId',
        'planId',
        'workItemId',
        'prompt',
        'status',
        'requestedAtIso',
        'requestedByUserId',
        'assigneeUserId',
        'dueAtIso',
        'decidedAtIso',
        'decidedByUserId',
        'rationale',
        'sodEvaluation',
        'policyRule',
        'decisionHistory',
        'agentActionProposal',
      ]);
      expectRequiredKeys(`APPROVALS[${index}]`, record, [
        'schemaVersion',
        'approvalId',
        'workspaceId',
        'runId',
        'planId',
        'prompt',
        'status',
        'requestedAtIso',
        'requestedByUserId',
      ]);
      expect(record.schemaVersion).toBe(1);
      expectEnum(`APPROVALS[${index}].status`, record.status, APPROVAL_STATUSES);
      expectIso(`APPROVALS[${index}].requestedAtIso`, record.requestedAtIso);
      if (record.sodEvaluation !== undefined) {
        expectSodEvaluation(`APPROVALS[${index}].sodEvaluation`, record.sodEvaluation);
      }
      if (record.policyRule !== undefined) {
        expectPolicyRule(`APPROVALS[${index}].policyRule`, record.policyRule);
      }
      if (record.agentActionProposal !== undefined) {
        expectAgentActionProposal(
          `APPROVALS[${index}].agentActionProposal`,
          record.agentActionProposal,
        );
      }
    });
  });

  it('keeps evidence, plan, workflow, and artifact fixtures aligned with DTO fields', () => {
    expectNonEmptyArray('PLANS', PLANS);
    expectUniqueIds('PLANS', PLANS, 'planId');
    PLANS.forEach((plan, index) => {
      const record = asRecord(plan);
      expectExactKeys(`PLANS[${index}]`, record, [
        'schemaVersion',
        'planId',
        'workspaceId',
        'createdAtIso',
        'createdByUserId',
        'plannedEffects',
        'predictedEffects',
      ]);
      expectRequiredKeys(`PLANS[${index}]`, record, [
        'schemaVersion',
        'planId',
        'workspaceId',
        'createdAtIso',
        'createdByUserId',
        'plannedEffects',
      ]);
      expect(record.schemaVersion).toBe(1);
      expectIso(`PLANS[${index}].createdAtIso`, record.createdAtIso);
      expect(Array.isArray(record.plannedEffects)).toBe(true);
      (record.plannedEffects as unknown[]).forEach((effect, effectIndex) => {
        expectPlanEffect(`PLANS[${index}].plannedEffects[${effectIndex}]`, effect);
      });
      if (record.predictedEffects !== undefined) {
        expect(Array.isArray(record.predictedEffects)).toBe(true);
        (record.predictedEffects as unknown[]).forEach((effect, effectIndex) => {
          expectPlanEffect(`PLANS[${index}].predictedEffects[${effectIndex}]`, effect);
        });
      }
    });

    expectNonEmptyArray('EVIDENCE', EVIDENCE);
    expectUniqueIds('EVIDENCE', EVIDENCE, 'evidenceId');
    EVIDENCE.forEach((entry, index) => {
      const record = asRecord(entry);
      expectExactKeys(`EVIDENCE[${index}]`, record, [
        'schemaVersion',
        'evidenceId',
        'workspaceId',
        'occurredAtIso',
        'category',
        'summary',
        'actor',
        'links',
        'payloadRefs',
        'previousHash',
        'hashSha256',
      ]);
      expectRequiredKeys(`EVIDENCE[${index}]`, record, [
        'schemaVersion',
        'evidenceId',
        'workspaceId',
        'occurredAtIso',
        'category',
        'summary',
        'actor',
        'hashSha256',
      ]);
      expect(record.schemaVersion).toBe(1);
      expectEnum(`EVIDENCE[${index}].category`, record.category, EVIDENCE_CATEGORIES);
      expectEnum(`EVIDENCE[${index}].actor.kind`, asRecord(record.actor).kind, EVIDENCE_ACTORS);
      expectIso(`EVIDENCE[${index}].occurredAtIso`, record.occurredAtIso);
    });

    const workflows = buildMockWorkflows(RUNS, AGENTS);
    expectNonEmptyArray('workflows', workflows);
    expectUniqueIds('workflows', workflows, 'workflowId');
    workflows.forEach((workflow, index) => {
      const record = asRecord(workflow);
      expectExactKeys(`workflows[${index}]`, record, [
        'schemaVersion',
        'workflowId',
        'workspaceId',
        'name',
        'description',
        'version',
        'active',
        'executionTier',
        'actions',
        'triggerKind',
        'timeoutMs',
        'retryPolicy',
        'compensationMode',
      ]);
      expectRequiredKeys(`workflows[${index}]`, record, [
        'schemaVersion',
        'workflowId',
        'workspaceId',
        'name',
        'version',
        'active',
        'executionTier',
        'actions',
      ]);
      expect(record.schemaVersion).toBe(1);
      expectEnum(`workflows[${index}].executionTier`, record.executionTier, EXECUTION_TIERS);
      if (record.triggerKind !== undefined) {
        expectEnum(`workflows[${index}].triggerKind`, record.triggerKind, WORKFLOW_TRIGGER_KINDS);
      }
      if (record.compensationMode !== undefined) {
        expectEnum(
          `workflows[${index}].compensationMode`,
          record.compensationMode,
          WORKFLOW_COMPENSATION_MODES,
        );
      }
      expect(Array.isArray(record.actions)).toBe(true);
      (record.actions as unknown[]).forEach((action, actionIndex) => {
        const actionRecord = asRecord(action);
        expectExactKeys(`workflows[${index}].actions[${actionIndex}]`, actionRecord, [
          'actionId',
          'order',
          'portFamily',
          'operation',
          'executionTierOverride',
        ]);
      });
    });

    expectExactKeys('RETRIEVAL_SEARCH_RESULT', asRecord(RETRIEVAL_SEARCH_RESULT), [
      'strategy',
      'hits',
      'graph',
    ]);
    expectEnum(
      'RETRIEVAL_SEARCH_RESULT.strategy',
      RETRIEVAL_SEARCH_RESULT.strategy,
      RETRIEVAL_STRATEGIES,
    );
    expectNonEmptyArray('RETRIEVAL_SEARCH_RESULT.hits', RETRIEVAL_SEARCH_RESULT.hits);
    RETRIEVAL_SEARCH_RESULT.hits.forEach((hit, index) => {
      expectRetrievalHit(`RETRIEVAL_SEARCH_RESULT.hits[${index}]`, hit);
    });
    if (RETRIEVAL_SEARCH_RESULT.graph !== undefined) {
      expectGraphTraversal('RETRIEVAL_SEARCH_RESULT.graph', RETRIEVAL_SEARCH_RESULT.graph);
    }
    expectGraphTraversal('GRAPH_TRAVERSAL_RESULT', GRAPH_TRAVERSAL_RESULT);
    expectExactKeys('DERIVED_ARTIFACTS', asRecord(DERIVED_ARTIFACTS), ['total', 'items']);
    expect(DERIVED_ARTIFACTS.total).toBe(DERIVED_ARTIFACTS.items.length);
    DERIVED_ARTIFACTS.items.forEach((artifact, index) => {
      expectDerivedArtifact(`DERIVED_ARTIFACTS.items[${index}]`, artifact);
    });
  });

  it('keeps workforce, human task, machine, agent, and config fixtures aligned', () => {
    expectNonEmptyArray('WORKFORCE_MEMBERS', WORKFORCE_MEMBERS);
    expectUniqueIds('WORKFORCE_MEMBERS', WORKFORCE_MEMBERS, 'workforceMemberId');
    WORKFORCE_MEMBERS.forEach((member, index) => {
      const record = asRecord(member);
      expectExactKeys(`WORKFORCE_MEMBERS[${index}]`, record, [
        'schemaVersion',
        'workforceMemberId',
        'linkedUserId',
        'displayName',
        'capabilities',
        'availabilityStatus',
        'queueMemberships',
        'tenantId',
        'createdAtIso',
        'updatedAtIso',
      ]);
      expectRequiredKeys(`WORKFORCE_MEMBERS[${index}]`, record, [
        'schemaVersion',
        'workforceMemberId',
        'linkedUserId',
        'displayName',
        'capabilities',
        'availabilityStatus',
        'queueMemberships',
        'tenantId',
        'createdAtIso',
      ]);
      expect(record.schemaVersion).toBe(1);
      expectEnum(
        `WORKFORCE_MEMBERS[${index}].availabilityStatus`,
        record.availabilityStatus,
        WORKFORCE_STATUSES,
      );
      expectWorkforceCapabilities(`WORKFORCE_MEMBERS[${index}].capabilities`, record.capabilities);
      expectIso(`WORKFORCE_MEMBERS[${index}].createdAtIso`, record.createdAtIso);
    });

    expectNonEmptyArray('WORKFORCE_QUEUES', WORKFORCE_QUEUES);
    expectUniqueIds('WORKFORCE_QUEUES', WORKFORCE_QUEUES, 'workforceQueueId');
    WORKFORCE_QUEUES.forEach((queue, index) => {
      const record = asRecord(queue);
      expectExactKeys(`WORKFORCE_QUEUES[${index}]`, record, [
        'schemaVersion',
        'workforceQueueId',
        'name',
        'requiredCapabilities',
        'memberIds',
        'routingStrategy',
        'tenantId',
      ]);
      expectRequiredKeys(`WORKFORCE_QUEUES[${index}]`, record, [
        'schemaVersion',
        'workforceQueueId',
        'name',
        'requiredCapabilities',
        'memberIds',
        'routingStrategy',
        'tenantId',
      ]);
      expect(record.schemaVersion).toBe(1);
      expectEnum(
        `WORKFORCE_QUEUES[${index}].routingStrategy`,
        record.routingStrategy,
        ROUTING_STRATEGIES,
      );
      expectWorkforceCapabilities(
        `WORKFORCE_QUEUES[${index}].requiredCapabilities`,
        record.requiredCapabilities,
      );
    });

    const humanTasks = buildMockHumanTasks(RUNS, WORK_ITEMS, WORKFORCE_MEMBERS);
    expectNonEmptyArray('humanTasks', humanTasks);
    expectUniqueIds('humanTasks', humanTasks, 'humanTaskId');
    humanTasks.forEach((task, index) => {
      const record = asRecord(task);
      expectExactKeys(`humanTasks[${index}]`, record, [
        'schemaVersion',
        'humanTaskId',
        'workItemId',
        'runId',
        'stepId',
        'assigneeId',
        'groupId',
        'description',
        'requiredCapabilities',
        'status',
        'dueAt',
        'completedAt',
        'completedById',
        'evidenceAnchorId',
      ]);
      expectRequiredKeys(`humanTasks[${index}]`, record, [
        'schemaVersion',
        'humanTaskId',
        'workItemId',
        'runId',
        'stepId',
        'description',
        'requiredCapabilities',
        'status',
      ]);
      expect(record.schemaVersion).toBe(1);
      expectEnum(`humanTasks[${index}].status`, record.status, HUMAN_TASK_STATUSES);
      expectWorkforceCapabilities(
        `humanTasks[${index}].requiredCapabilities`,
        record.requiredCapabilities,
      );
    });

    expectNonEmptyArray('AGENTS', AGENTS);
    expectUniqueIds('AGENTS', AGENTS, 'agentId');
    AGENTS.forEach((agent, index) => {
      const record = asRecord(agent);
      expectExactKeys(`AGENTS[${index}]`, record, [
        'schemaVersion',
        'agentId',
        'workspaceId',
        'name',
        'modelId',
        'endpoint',
        'allowedCapabilities',
        'usedByWorkflowIds',
        'machineId',
        'policyTier',
      ]);
      expectRequiredKeys(`AGENTS[${index}]`, record, [
        'schemaVersion',
        'agentId',
        'workspaceId',
        'name',
        'endpoint',
        'allowedCapabilities',
      ]);
      expect(record.schemaVersion).toBe(1);
      expectCapabilities(`AGENTS[${index}].allowedCapabilities`, record.allowedCapabilities);
      if (record.policyTier !== undefined) {
        expectEnum(`AGENTS[${index}].policyTier`, record.policyTier, EXECUTION_TIERS);
      }
    });

    expectNonEmptyArray('MACHINES', MACHINES);
    expectUniqueIds('MACHINES', MACHINES, 'machineId');
    MACHINES.forEach((machine, index) => {
      const record = asRecord(machine);
      expectExactKeys(`MACHINES[${index}]`, record, [
        'schemaVersion',
        'machineId',
        'workspaceId',
        'hostname',
        'osImage',
        'registeredAtIso',
        'lastHeartbeatAtIso',
        'status',
        'activeRunCount',
        'allowedCapabilities',
      ]);
      expectRequiredKeys(`MACHINES[${index}]`, record, [
        'schemaVersion',
        'machineId',
        'workspaceId',
        'hostname',
        'registeredAtIso',
        'status',
      ]);
      expect(record.schemaVersion).toBe(1);
      expectEnum(`MACHINES[${index}].status`, record.status, MACHINE_STATUSES);
      expectIso(`MACHINES[${index}].registeredAtIso`, record.registeredAtIso);
      if (record.allowedCapabilities !== undefined) {
        expectCapabilities(`MACHINES[${index}].allowedCapabilities`, record.allowedCapabilities);
      }
    });

    expectNonEmptyArray('ADAPTERS', ADAPTERS);
    expectUniqueIds('ADAPTERS', ADAPTERS, 'adapterId');
    ADAPTERS.forEach((adapter, index) => {
      const record = asRecord(adapter);
      expectExactKeys(`ADAPTERS[${index}]`, record, [
        'adapterId',
        'name',
        'sorFamily',
        'status',
        'lastSyncIso',
      ]);
      expectRequiredKeys(`ADAPTERS[${index}]`, record, [
        'adapterId',
        'name',
        'sorFamily',
        'status',
        'lastSyncIso',
      ]);
      expectEnum(`ADAPTERS[${index}].status`, record.status, ADAPTER_STATUSES);
      expectIso(`ADAPTERS[${index}].lastSyncIso`, record.lastSyncIso);
    });

    expectNonEmptyArray('CREDENTIAL_GRANTS', CREDENTIAL_GRANTS);
    expectUniqueIds('CREDENTIAL_GRANTS', CREDENTIAL_GRANTS, 'credentialGrantId');
    CREDENTIAL_GRANTS.forEach((grant, index) => {
      const record = asRecord(grant);
      expectExactKeys(`CREDENTIAL_GRANTS[${index}]`, record, [
        'schemaVersion',
        'credentialGrantId',
        'workspaceId',
        'adapterId',
        'credentialsRef',
        'scope',
        'issuedAtIso',
        'expiresAtIso',
        'lastRotatedAtIso',
        'revokedAtIso',
      ]);
      expectRequiredKeys(`CREDENTIAL_GRANTS[${index}]`, record, [
        'schemaVersion',
        'credentialGrantId',
        'workspaceId',
        'adapterId',
        'credentialsRef',
        'scope',
        'issuedAtIso',
      ]);
      expect(record.schemaVersion).toBe(1);
      expectIso(`CREDENTIAL_GRANTS[${index}].issuedAtIso`, record.issuedAtIso);
    });
  });

  it('keeps user and policy fixtures aligned with config DTO fields and enums', () => {
    expectNonEmptyArray('MOCK_USERS', MOCK_USERS);
    expectUniqueIds('MOCK_USERS', MOCK_USERS, 'userId');
    MOCK_USERS.forEach((user, index) => {
      const record = asRecord(user);
      expectExactKeys(`MOCK_USERS[${index}]`, record, [
        'userId',
        'name',
        'email',
        'role',
        'status',
        'lastActiveIso',
      ]);
      expectRequiredKeys(`MOCK_USERS[${index}]`, record, [
        'userId',
        'name',
        'email',
        'role',
        'status',
        'lastActiveIso',
      ]);
      expectEnum(`MOCK_USERS[${index}].role`, record.role, USER_ROLES);
      expectEnum(`MOCK_USERS[${index}].status`, record.status, USER_STATUSES);
      expectIso(`MOCK_USERS[${index}].lastActiveIso`, record.lastActiveIso);
    });

    expectNonEmptyArray('MOCK_POLICIES', MOCK_POLICIES);
    expectUniqueIds('MOCK_POLICIES', MOCK_POLICIES, 'policyId');
    MOCK_POLICIES.forEach((policy, index) => {
      const record = asRecord(policy);
      expectExactKeys(`MOCK_POLICIES[${index}]`, record, [
        'policyId',
        'name',
        'description',
        'status',
        'tier',
        'scope',
        'ruleCount',
        'affectedWorkflowIds',
        'ruleText',
        'conditions',
      ]);
      expectRequiredKeys(`MOCK_POLICIES[${index}]`, record, [
        'policyId',
        'name',
        'description',
        'status',
        'ruleText',
        'conditions',
      ]);
      expectEnum(`MOCK_POLICIES[${index}].status`, record.status, POLICY_STATUSES);
      if (record.tier !== undefined) {
        expectEnum(`MOCK_POLICIES[${index}].tier`, record.tier, EXECUTION_TIERS);
      }
      expect(Array.isArray(record.conditions)).toBe(true);
      (record.conditions as unknown[]).forEach((condition, conditionIndex) => {
        const conditionRecord = asRecord(condition);
        expectExactKeys(`MOCK_POLICIES[${index}].conditions[${conditionIndex}]`, conditionRecord, [
          'field',
          'operator',
          'value',
        ]);
        expectEnum(
          `MOCK_POLICIES[${index}].conditions[${conditionIndex}].operator`,
          conditionRecord.operator,
          POLICY_CONDITION_OPERATORS,
        );
      });
    });

    expectNonEmptyArray('MOCK_SOD_CONSTRAINTS', MOCK_SOD_CONSTRAINTS);
    expectUniqueIds('MOCK_SOD_CONSTRAINTS', MOCK_SOD_CONSTRAINTS, 'constraintId');
    MOCK_SOD_CONSTRAINTS.forEach((constraint, index) => {
      const record = asRecord(constraint);
      expectExactKeys(`MOCK_SOD_CONSTRAINTS[${index}]`, record, [
        'constraintId',
        'name',
        'description',
        'status',
        'relatedPolicyIds',
        'rolePair',
        'forbiddenAction',
        'scope',
      ]);
      expectRequiredKeys(`MOCK_SOD_CONSTRAINTS[${index}]`, record, [
        'constraintId',
        'name',
        'description',
        'status',
        'relatedPolicyIds',
      ]);
      expectEnum(`MOCK_SOD_CONSTRAINTS[${index}].status`, record.status, SOD_CONSTRAINT_STATUSES);
    });
  });

  it('keeps robotics, map, and gateway fixtures aligned with prototype DTOs', () => {
    expectNonEmptyArray('MOCK_GATEWAYS', MOCK_GATEWAYS);
    expectUniqueIds('MOCK_GATEWAYS', MOCK_GATEWAYS, 'gatewayId');
    MOCK_GATEWAYS.forEach((gateway, index) => {
      const record = asRecord(gateway);
      expectExactKeys(`MOCK_GATEWAYS[${index}]`, record, [
        'gatewayId',
        'url',
        'status',
        'connectedRobots',
        'lastHeartbeatIso',
        'region',
      ]);
      expectRequiredKeys(`MOCK_GATEWAYS[${index}]`, record, [
        'gatewayId',
        'url',
        'status',
        'connectedRobots',
        'lastHeartbeatIso',
        'region',
      ]);
      expectEnum(`MOCK_GATEWAYS[${index}].status`, record.status, GATEWAY_STATUSES);
      expectIso(`MOCK_GATEWAYS[${index}].lastHeartbeatIso`, record.lastHeartbeatIso);
    });

    expectNonEmptyArray('ROBOTS', ROBOTS);
    expectUniqueIds('ROBOTS', ROBOTS, 'robotId');
    ROBOTS.forEach((robot, index) => {
      const record = asRecord(robot);
      expectExactKeys(`ROBOTS[${index}]`, record, [
        'robotId',
        'name',
        'robotClass',
        'status',
        'batteryPct',
        'lastHeartbeatSec',
        'missionId',
        'gatewayUrl',
        'spiffeSvid',
        'capabilities',
      ]);
      expectRequiredKeys(`ROBOTS[${index}]`, record, [
        'robotId',
        'name',
        'robotClass',
        'status',
        'batteryPct',
        'lastHeartbeatSec',
        'gatewayUrl',
        'spiffeSvid',
        'capabilities',
      ]);
      expectEnum(`ROBOTS[${index}].robotClass`, record.robotClass, ROBOT_CLASSES);
      expectEnum(`ROBOTS[${index}].status`, record.status, ROBOT_STATUSES);
      asStringArray(record.capabilities);
    });

    expectNonEmptyArray('MISSIONS', MISSIONS);
    expectUniqueIds('MISSIONS', MISSIONS, 'missionId');
    MISSIONS.forEach((mission, index) => {
      const record = asRecord(mission);
      expectExactKeys(`MISSIONS[${index}]`, record, [
        'missionId',
        'robotId',
        'goal',
        'actionType',
        'status',
        'priority',
        'dispatchedAtIso',
        'completedAtIso',
        'executionTier',
      ]);
      expectRequiredKeys(`MISSIONS[${index}]`, record, [
        'missionId',
        'robotId',
        'goal',
        'actionType',
        'status',
        'priority',
        'executionTier',
      ]);
      expectEnum(`MISSIONS[${index}].actionType`, record.actionType, MISSION_ACTION_TYPES);
      expectEnum(`MISSIONS[${index}].status`, record.status, MISSION_STATUSES);
      expectEnum(`MISSIONS[${index}].priority`, record.priority, MISSION_PRIORITIES);
      expectEnum(
        `MISSIONS[${index}].executionTier`,
        record.executionTier,
        ROBOTICS_EXECUTION_TIERS,
      );
    });

    expectNonEmptyArray('SAFETY_CONSTRAINTS', SAFETY_CONSTRAINTS);
    expectUniqueIds('SAFETY_CONSTRAINTS', SAFETY_CONSTRAINTS, 'constraintId');
    SAFETY_CONSTRAINTS.forEach((constraint, index) => {
      const record = asRecord(constraint);
      expectExactKeys(`SAFETY_CONSTRAINTS[${index}]`, record, [
        'constraintId',
        'site',
        'constraint',
        'enforcement',
        'robotCount',
      ]);
      expectRequiredKeys(`SAFETY_CONSTRAINTS[${index}]`, record, [
        'constraintId',
        'site',
        'constraint',
        'enforcement',
        'robotCount',
      ]);
      expectEnum(`SAFETY_CONSTRAINTS[${index}].enforcement`, record.enforcement, ENFORCEMENT_MODES);
    });

    expectNonEmptyArray('APPROVAL_THRESHOLDS', APPROVAL_THRESHOLDS);
    APPROVAL_THRESHOLDS.forEach((threshold, index) => {
      const record = asRecord(threshold);
      expectExactKeys(`APPROVAL_THRESHOLDS[${index}]`, record, ['actionClass', 'tier', 'notes']);
      expectRequiredKeys(`APPROVAL_THRESHOLDS[${index}]`, record, ['actionClass', 'tier', 'notes']);
      expectEnum(`APPROVAL_THRESHOLDS[${index}].tier`, record.tier, EXECUTION_TIERS);
    });

    expectNonEmptyArray('ESTOP_AUDIT_LOG', ESTOP_AUDIT_LOG);
    ESTOP_AUDIT_LOG.forEach((entry, index) => {
      const record = asRecord(entry);
      expectExactKeys(`ESTOP_AUDIT_LOG[${index}]`, record, [
        'timestamp',
        'actor',
        'robotId',
        'event',
        'detail',
      ]);
      expectRequiredKeys(`ESTOP_AUDIT_LOG[${index}]`, record, [
        'timestamp',
        'actor',
        'robotId',
        'event',
        'detail',
      ]);
      expectEnum(`ESTOP_AUDIT_LOG[${index}].event`, record.event, ESTOP_EVENTS);
      expectIso(`ESTOP_AUDIT_LOG[${index}].timestamp`, record.timestamp);
    });

    expectNonEmptyArray('ROBOT_LOCATIONS', ROBOT_LOCATIONS);
    expectUniqueIds('ROBOT_LOCATIONS', ROBOT_LOCATIONS, 'robotId');
    ROBOT_LOCATIONS.forEach((location, index) => {
      const record = asRecord(location);
      expectExactKeys(`ROBOT_LOCATIONS[${index}]`, record, [
        'robotId',
        'name',
        'robotClass',
        'status',
        'batteryPct',
        'lat',
        'lng',
        'heading',
        'speedMps',
        'updatedAtIso',
        'missionId',
        'trail',
      ]);
      expectRequiredKeys(`ROBOT_LOCATIONS[${index}]`, record, [
        'robotId',
        'name',
        'robotClass',
        'status',
        'batteryPct',
        'lat',
        'lng',
        'heading',
        'speedMps',
        'updatedAtIso',
        'trail',
      ]);
      expectEnum(`ROBOT_LOCATIONS[${index}].robotClass`, record.robotClass, ROBOT_CLASSES);
      expectEnum(`ROBOT_LOCATIONS[${index}].status`, record.status, ROBOT_STATUSES);
      expectIso(`ROBOT_LOCATIONS[${index}].updatedAtIso`, record.updatedAtIso);
      expect(Array.isArray(record.trail)).toBe(true);
      (record.trail as unknown[]).forEach((point, pointIndex) => {
        const pointRecord = asRecord(point);
        expectExactKeys(`ROBOT_LOCATIONS[${index}].trail[${pointIndex}]`, pointRecord, [
          'lat',
          'lng',
          'timestampIso',
        ]);
        expectRequiredKeys(`ROBOT_LOCATIONS[${index}].trail[${pointIndex}]`, pointRecord, [
          'lat',
          'lng',
          'timestampIso',
        ]);
        expectIso(
          `ROBOT_LOCATIONS[${index}].trail[${pointIndex}].timestampIso`,
          pointRecord.timestampIso,
        );
      });
    });

    expectNonEmptyArray('GEOFENCES', GEOFENCES);
    expectUniqueIds('GEOFENCES', GEOFENCES, 'geofenceId');
    GEOFENCES.forEach((geofence, index) => {
      const record = asRecord(geofence);
      expectExactKeys(`GEOFENCES[${index}]`, record, ['geofenceId', 'label', 'polygon', 'color']);
      expectRequiredKeys(`GEOFENCES[${index}]`, record, [
        'geofenceId',
        'label',
        'polygon',
        'color',
      ]);
      expect(Array.isArray(record.polygon)).toBe(true);
    });

    expectNonEmptyArray('SPATIAL_ALERTS', SPATIAL_ALERTS);
    expectUniqueIds('SPATIAL_ALERTS', SPATIAL_ALERTS, 'alertId');
    SPATIAL_ALERTS.forEach((alert, index) => {
      const record = asRecord(alert);
      expectExactKeys(`SPATIAL_ALERTS[${index}]`, record, [
        'alertId',
        'robotId',
        'type',
        'message',
        'lat',
        'lng',
        'timestampIso',
        'severity',
      ]);
      expectRequiredKeys(`SPATIAL_ALERTS[${index}]`, record, [
        'alertId',
        'robotId',
        'type',
        'message',
        'lat',
        'lng',
        'timestampIso',
        'severity',
      ]);
      expectEnum(`SPATIAL_ALERTS[${index}].type`, record.type, SPATIAL_ALERT_TYPES);
      expectEnum(`SPATIAL_ALERTS[${index}].severity`, record.severity, SPATIAL_ALERT_SEVERITIES);
      expectIso(`SPATIAL_ALERTS[${index}].timestampIso`, record.timestampIso);
    });
  });
});
