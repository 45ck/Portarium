import { describe, expect, it } from 'vitest';

import { createPortariumCloudEvent } from '../../application/events/cloudevent.js';
import { parseAdapterRegistrationV1 } from '../../domain/adapters/adapter-registration-v1.js';
import { parseApprovalV1 } from '../../domain/approvals/approval-v1.js';
import { parsePolicyV1 } from '../../domain/policy/policy-v1.js';
import { ActionId, CorrelationId, RunId, TenantId } from '../../domain/primitives/index.js';
import { parseRunV1 } from '../../domain/runs/run-v1.js';
import { parseWorkItemV1 } from '../../domain/work-items/work-item-v1.js';
import { parseWorkflowV1 } from '../../domain/workflows/workflow-v1.js';
import { parseWorkspaceV1 } from '../../domain/workspaces/workspace-v1.js';
import { parseHumanTaskV1 } from '../../domain/workforce/human-task-v1.js';
import { parseWorkforceMemberV1 } from '../../domain/workforce/workforce-member-v1.js';
import { parseWorkforceQueueV1 } from '../../domain/workforce/workforce-queue-v1.js';
import { InMemorySqlClient } from './in-memory-sql-client.test-helpers.js';
import { SQL_JSON_DOC_UPSERT } from './postgres-json-document-store.js';
import {
  CryptoIdGenerator,
  PostgresEvidenceLog,
  PostgresOutboxEventPublisher,
  PostgresOutboxStore,
} from './postgres-eventing.js';
import {
  PostgresApprovalStore,
  PostgresAdapterRegistrationStore,
  PostgresIdempotencyStore,
  PostgresPolicyStore,
  PostgresRunStore,
  PostgresWorkflowStore,
  PostgresWorkspaceStore,
} from './postgres-store-adapters.js';
import {
  PostgresHumanTaskStore,
  PostgresWorkItemStore,
  PostgresWorkforceMemberStore,
  PostgresWorkforceQueueStore,
} from './postgres-workforce-store-adapters.js';

describe('PostgreSQL store adapters', () => {
  it('saves and loads workspace/run/workflow/adapter registration data', async () => {
    const client = new InMemorySqlClient();

    const workspaceStore = new PostgresWorkspaceStore(client);
    const runStore = new PostgresRunStore(client);
    const workflowStore = new PostgresWorkflowStore(client);
    const adapterStore = new PostgresAdapterRegistrationStore(client);

    const workspace = parseWorkspaceV1({
      workspaceId: 'ws-1',
      tenantId: 'tenant-1',
      name: 'Operations',
      createdAtIso: '2026-02-20T00:00:00.000Z',
    });
    const run = parseRunV1({
      schemaVersion: 1,
      runId: 'run-1',
      workspaceId: 'ws-1',
      workflowId: 'wf-1',
      correlationId: 'corr-1',
      executionTier: 'Auto',
      initiatedByUserId: 'user-1',
      status: 'Pending',
      createdAtIso: '2026-02-20T00:00:00.000Z',
    });
    const workflow = parseWorkflowV1({
      schemaVersion: 1,
      workflowId: 'wf-1',
      workspaceId: 'ws-1',
      name: 'OpsFlow',
      version: 1,
      active: true,
      executionTier: 'Auto',
      actions: [
        { actionId: 'act-1', order: 1, portFamily: 'ItsmItOps', operation: 'workflow:simulate' },
      ],
    });
    const registration = parseAdapterRegistrationV1({
      schemaVersion: 1,
      adapterId: 'adapter-1',
      workspaceId: 'ws-1',
      providerSlug: 'servicenow',
      portFamily: 'ItsmItOps',
      enabled: true,
      capabilityMatrix: [{ operation: 'workflow:simulate', requiresAuth: true }],
      executionPolicy: {
        tenantIsolationMode: 'PerTenantWorker',
        egressAllowlist: ['https://api.example.com'],
        credentialScope: 'capabilityMatrix',
        sandboxVerified: true,
        sandboxAvailable: true,
      },
    });

    await workspaceStore.saveWorkspace(workspace);
    await runStore.saveRun(TenantId('tenant-1'), run);
    await seed({
      client,
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      collection: 'workflows',
      documentId: 'wf-1',
      payload: workflow,
    });
    await seed({
      client,
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      collection: 'adapter-registrations',
      documentId: 'adapter-1',
      payload: registration,
    });

    const workspaceByName = await workspaceStore.getWorkspaceByName(
      TenantId('tenant-1'),
      'Operations',
    );
    const loadedRun = await runStore.getRunById(
      TenantId('tenant-1'),
      'ws-1' as never,
      'run-1' as never,
    );
    const workflowsByName = await workflowStore.listWorkflowsByName(
      TenantId('tenant-1'),
      'ws-1' as never,
      'OpsFlow',
    );
    const adapters = await adapterStore.listByWorkspace(TenantId('tenant-1'), 'ws-1' as never);

    expect(workspaceByName?.workspaceId).toBe('ws-1');
    expect(loadedRun?.runId).toBe('run-1');
    expect(workflowsByName).toHaveLength(1);
    expect(adapters).toHaveLength(1);
  });

  it('supports approval, policy, and idempotency storage', async () => {
    const client = new InMemorySqlClient();

    const approvals = new PostgresApprovalStore(client);
    const policies = new PostgresPolicyStore(client);
    const idempotency = new PostgresIdempotencyStore(client);

    const approval = parseApprovalV1({
      schemaVersion: 1,
      approvalId: 'approval-1',
      workspaceId: 'ws-1',
      runId: 'run-1',
      planId: 'plan-1',
      prompt: 'Approve deployment',
      status: 'Pending',
      requestedByUserId: 'user-1',
      requestedAtIso: '2026-02-20T00:00:00.000Z',
    });
    const policy = parsePolicyV1({
      schemaVersion: 1,
      policyId: 'policy-1',
      workspaceId: 'ws-1',
      name: 'Default policy',
      active: true,
      priority: 100,
      version: 1,
      createdAtIso: '2026-02-20T00:00:00.000Z',
      createdByUserId: 'user-1',
      rules: [{ ruleId: 'rule-1', condition: 'risk.score <= 20', effect: 'Allow' }],
    });

    await approvals.saveApproval(TenantId('tenant-1'), approval);
    await seed({
      client,
      tenantId: 'tenant-1',
      workspaceId: 'ws-1',
      collection: 'policies',
      documentId: 'policy-1',
      payload: policy,
    });
    await idempotency.set(
      { tenantId: TenantId('tenant-1'), commandName: 'StartWorkflow', requestKey: 'req-1' },
      { runId: 'run-1' },
    );

    const loadedApproval = await approvals.getApprovalById(
      TenantId('tenant-1'),
      'ws-1' as never,
      'approval-1' as never,
    );
    const loadedPolicy = await policies.getPolicyById(
      TenantId('tenant-1'),
      'ws-1' as never,
      'policy-1' as never,
    );
    const cached = await idempotency.get<{ runId: string }>({
      tenantId: TenantId('tenant-1'),
      commandName: 'StartWorkflow',
      requestKey: 'req-1',
    });

    expect(loadedApproval?.approvalId).toBe('approval-1');
    expect(loadedPolicy?.policyId).toBe('policy-1');
    expect(cached?.runId).toBe('run-1');
  });

  it('supports work-item and workforce stores', async () => {
    const client = new InMemorySqlClient();
    const workItems = new PostgresWorkItemStore(client);
    const workforceMembers = new PostgresWorkforceMemberStore(client);
    const humanTasks = new PostgresHumanTaskStore(client);
    const workforceQueues = new PostgresWorkforceQueueStore(client);

    const workItem = parseWorkItemV1({
      schemaVersion: 1,
      workItemId: 'wi-1',
      workspaceId: 'ws-1',
      createdAtIso: '2026-02-20T00:00:00.000Z',
      createdByUserId: 'user-1',
      title: 'Review policy',
      status: 'Open',
      links: { runIds: ['run-1'] },
    });
    const member = parseWorkforceMemberV1({
      schemaVersion: 1,
      workforceMemberId: 'wm-1',
      linkedUserId: 'user-1',
      displayName: 'Alice',
      capabilities: ['operations.approval'],
      availabilityStatus: 'available',
      queueMemberships: ['queue-1'],
      tenantId: 'tenant-1',
      createdAtIso: '2026-02-20T00:00:00.000Z',
    });
    const task = parseHumanTaskV1({
      schemaVersion: 1,
      humanTaskId: 'ht-1',
      workItemId: 'wi-1',
      runId: 'run-1',
      stepId: 'step-1',
      description: 'Approve change',
      requiredCapabilities: ['operations.approval'],
      status: 'pending',
    });
    const queue = parseWorkforceQueueV1({
      schemaVersion: 1,
      workforceQueueId: 'queue-1',
      name: 'Approvals',
      requiredCapabilities: ['operations.approval'],
      memberIds: ['wm-1'],
      routingStrategy: 'round-robin',
      tenantId: 'tenant-1',
    });

    await workItems.saveWorkItem(TenantId('tenant-1'), workItem);
    await seed({
      client,
      tenantId: 'tenant-1',
      collection: 'workforce-members',
      documentId: 'wm-1',
      payload: member,
    });
    await humanTasks.saveHumanTask(TenantId('tenant-1'), task);
    await seed({
      client,
      tenantId: 'tenant-1',
      collection: 'workforce-queues',
      documentId: 'queue-1',
      payload: queue,
    });

    const list = await workItems.listWorkItems(TenantId('tenant-1'), 'ws-1' as never, {
      runId: 'run-1' as never,
    });
    const loadedMember = await workforceMembers.getWorkforceMemberById(
      TenantId('tenant-1'),
      'wm-1' as never,
    );
    const loadedTask = await humanTasks.getHumanTaskById(TenantId('tenant-1'), 'ht-1' as never);
    const loadedQueue = await workforceQueues.getWorkforceQueueById(
      TenantId('tenant-1'),
      'queue-1' as never,
    );

    expect(list.items).toHaveLength(1);
    expect(loadedMember?.workforceMemberId).toBe('wm-1');
    expect(loadedTask?.humanTaskId).toBe('ht-1');
    expect(loadedQueue?.workforceQueueId).toBe('queue-1');
  });

  it('chains evidence and supports outbox publisher/id generation', async () => {
    const client = new InMemorySqlClient();
    const evidence = new PostgresEvidenceLog(client);
    const outbox = new PostgresOutboxStore(client);
    const publisher = new PostgresOutboxEventPublisher(outbox);
    const idGenerator = new CryptoIdGenerator();

    const first = await evidence.appendEntry(TenantId('tenant-1'), {
      schemaVersion: 1,
      evidenceId: 'ev-1' as never,
      workspaceId: 'ws-1' as never,
      correlationId: CorrelationId('corr-1'),
      occurredAtIso: '2026-02-20T00:00:00.000Z',
      category: 'System',
      summary: 'first',
      actor: { kind: 'System' },
    });
    const second = await evidence.appendEntry(TenantId('tenant-1'), {
      schemaVersion: 1,
      evidenceId: 'ev-2' as never,
      workspaceId: 'ws-1' as never,
      correlationId: CorrelationId('corr-1'),
      occurredAtIso: '2026-02-20T00:01:00.000Z',
      category: 'System',
      summary: 'second',
      actor: { kind: 'System' },
    });

    const event = createPortariumCloudEvent({
      eventId: 'evt-1',
      eventType: 'com.portarium.run.RunStarted',
      source: 'portarium.test',
      tenantId: TenantId('tenant-1'),
      correlationId: CorrelationId('corr-1'),
      subject: 'runs/run-1',
      runId: RunId('run-1'),
      actionId: ActionId('action-1'),
      data: { ok: true },
    });

    await publisher.publish(event);
    const pending = await outbox.fetchPending(10);
    const pendingEntryId = pending[0]?.entryId ?? '';
    await outbox.markFailed(
      pendingEntryId,
      'transient-network-error',
      '2099-01-01T00:00:00.000Z',
    );
    const afterFailed = await outbox.fetchPending(10);
    await outbox.markPublished(pendingEntryId);
    const generated = idGenerator.generateId();

    expect(first.previousHash).toBeUndefined();
    expect(second.previousHash).toBe(first.hashSha256);
    expect(pending).toHaveLength(1);
    expect(afterFailed).toHaveLength(0);
    expect(pending[0]?.status).toBe('Pending');
    expect(generated).toMatch(/[0-9a-f-]{8,}/i);
  });
});

function seed(
  params: Readonly<{
    client: InMemorySqlClient;
    tenantId: string;
    workspaceId?: string;
    collection: string;
    documentId: string;
    payload: unknown;
  }>,
): Promise<unknown> {
  return params.client.query(`${SQL_JSON_DOC_UPSERT}\nnoop`, [
    params.tenantId,
    params.workspaceId ?? null,
    params.collection,
    params.documentId,
    JSON.stringify(params.payload),
  ]);
}
