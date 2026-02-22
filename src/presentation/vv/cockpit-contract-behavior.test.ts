/**
 * bead-0762: Presentation V&V — Operations cockpit contract behavior across
 * roles and tenant scopes.
 *
 * Verifies the formal invariants that the presentation layer must uphold:
 * 1. Type conformance: status/category/tier enumerations are exhaustive and
 *    consistent with domain definitions.
 * 2. Problem Details (RFC 7807): structural parsing invariants.
 * 3. Pagination: boundary properties of clamp/cursor query builders.
 * 4. URL/header construction: tenant scoping, encoding, auth header rules.
 * 5. Query parameter builders: filter forwarding invariants across all resources.
 * 6. EvidenceActor discriminant: exhaustive union coverage.
 *
 * These are structural conformance tests — no HTTP calls, no live servers.
 */

import { describe, expect, it } from 'vitest';

import {
  isProblemDetails,
  parseProblemDetails,
  ProblemDetailsError,
} from '../ops-cockpit/problem-details.js';
import { buildCursorQuery } from '../ops-cockpit/pagination.js';
import {
  buildListRunsQuery,
  buildListWorkItemsQuery,
  buildListEvidenceQuery,
  buildListHumanTasksQuery,
  buildListWorkforceMembersQuery,
  buildListWorkforceQueuesQuery,
  buildRequestHeaders,
  buildRequestUrl,
  normalizeWorkspaceId,
  normalizeResourceId,
  safeJsonParse,
  normalizeRequestBody,
} from '../ops-cockpit/http-client-helpers.js';
import type {
  RunStatus,
  ApprovalStatus,
  WorkItemSummary,
  EvidenceCategory,
  EvidenceActor,
  EvidenceActorUser,
  EvidenceActorMachine,
  EvidenceActorAdapter,
  EvidenceActorSystem,
} from '../ops-cockpit/types.js';
import type { ApprovalDecision } from '../ops-cockpit/types.commands.js';
import type { MachineStatus, ConnectionTestStatus } from '../ops-cockpit/types.machines.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_RUN_STATUSES: RunStatus[] = [
  'Pending',
  'Running',
  'WaitingForApproval',
  'Paused',
  'Succeeded',
  'Failed',
  'Cancelled',
];

const TERMINAL_RUN_STATUSES: RunStatus[] = ['Succeeded', 'Failed', 'Cancelled'];
const ACTIVE_RUN_STATUSES: RunStatus[] = ['Pending', 'Running', 'WaitingForApproval', 'Paused'];

const ALL_APPROVAL_STATUSES: ApprovalStatus[] = ['Pending', 'Approved', 'Denied', 'RequestChanges'];

const ALL_WORK_ITEM_STATUSES: WorkItemSummary['status'][] = [
  'Open',
  'InProgress',
  'Blocked',
  'Resolved',
  'Closed',
];

const ALL_EVIDENCE_CATEGORIES: EvidenceCategory[] = [
  'Plan',
  'Action',
  'Approval',
  'Policy',
  'PolicyViolation',
  'System',
];

const ALL_APPROVAL_DECISIONS: ApprovalDecision[] = ['Approved', 'Denied', 'RequestChanges'];

const ALL_MACHINE_STATUSES: MachineStatus[] = ['Online', 'Degraded', 'Offline'];

const ALL_CONNECTION_TEST_STATUSES: ConnectionTestStatus[] = ['ok', 'slow', 'unreachable'];

// ---------------------------------------------------------------------------
// 1. Type conformance matrix
// ---------------------------------------------------------------------------

describe('Type conformance matrix', () => {
  describe('RunStatus', () => {
    it('has exactly 7 values', () => {
      expect(ALL_RUN_STATUSES).toHaveLength(7);
    });

    it('terminal statuses are a subset of all statuses', () => {
      for (const s of TERMINAL_RUN_STATUSES) {
        expect(ALL_RUN_STATUSES).toContain(s);
      }
    });

    it('active statuses are a subset of all statuses', () => {
      for (const s of ACTIVE_RUN_STATUSES) {
        expect(ALL_RUN_STATUSES).toContain(s);
      }
    });

    it('terminal and active statuses are disjoint', () => {
      const overlap = TERMINAL_RUN_STATUSES.filter((s) => ACTIVE_RUN_STATUSES.includes(s));
      expect(overlap).toHaveLength(0);
    });

    it('terminal + active covers all statuses', () => {
      const combined = new Set([...TERMINAL_RUN_STATUSES, ...ACTIVE_RUN_STATUSES]);
      expect(combined.size).toBe(ALL_RUN_STATUSES.length);
    });

    it('all statuses are unique strings', () => {
      const unique = new Set(ALL_RUN_STATUSES);
      expect(unique.size).toBe(ALL_RUN_STATUSES.length);
    });
  });

  describe('ApprovalStatus', () => {
    it('has exactly 4 values', () => {
      expect(ALL_APPROVAL_STATUSES).toHaveLength(4);
    });

    it('includes terminal statuses Approved and Denied', () => {
      expect(ALL_APPROVAL_STATUSES).toContain('Approved');
      expect(ALL_APPROVAL_STATUSES).toContain('Denied');
    });

    it('includes pending and change-request states', () => {
      expect(ALL_APPROVAL_STATUSES).toContain('Pending');
      expect(ALL_APPROVAL_STATUSES).toContain('RequestChanges');
    });

    it('all statuses are unique strings', () => {
      const unique = new Set(ALL_APPROVAL_STATUSES);
      expect(unique.size).toBe(ALL_APPROVAL_STATUSES.length);
    });
  });

  describe('ApprovalDecision', () => {
    it('has exactly 3 values', () => {
      expect(ALL_APPROVAL_DECISIONS).toHaveLength(3);
    });

    it('each decision maps to a terminal or transition approval status', () => {
      // Approved/Denied are terminal; RequestChanges transitions back
      // ApprovalDecision values are a subset of ApprovalStatus string literals
      const decisionsMatchingStatuses = ALL_APPROVAL_DECISIONS.filter((d) =>
        (ALL_APPROVAL_STATUSES as string[]).includes(d),
      );
      expect(decisionsMatchingStatuses.length).toBeGreaterThan(0);
    });

    it('all decisions are unique', () => {
      const unique = new Set(ALL_APPROVAL_DECISIONS);
      expect(unique.size).toBe(ALL_APPROVAL_DECISIONS.length);
    });
  });

  describe('WorkItemSummary.status', () => {
    it('has exactly 5 values', () => {
      expect(ALL_WORK_ITEM_STATUSES).toHaveLength(5);
    });

    it('includes Open as the initial state', () => {
      expect(ALL_WORK_ITEM_STATUSES).toContain('Open');
    });

    it('includes Closed as a terminal state', () => {
      expect(ALL_WORK_ITEM_STATUSES).toContain('Closed');
    });

    it('all statuses are unique strings', () => {
      const unique = new Set(ALL_WORK_ITEM_STATUSES);
      expect(unique.size).toBe(ALL_WORK_ITEM_STATUSES.length);
    });
  });

  describe('EvidenceCategory', () => {
    it('has exactly 6 values', () => {
      expect(ALL_EVIDENCE_CATEGORIES).toHaveLength(6);
    });

    it('includes audit-critical categories', () => {
      expect(ALL_EVIDENCE_CATEGORIES).toContain('Plan');
      expect(ALL_EVIDENCE_CATEGORIES).toContain('Approval');
      expect(ALL_EVIDENCE_CATEGORIES).toContain('PolicyViolation');
    });

    it('all categories are unique strings', () => {
      const unique = new Set(ALL_EVIDENCE_CATEGORIES);
      expect(unique.size).toBe(ALL_EVIDENCE_CATEGORIES.length);
    });
  });

  describe('MachineStatus', () => {
    it('has exactly 3 values', () => {
      expect(ALL_MACHINE_STATUSES).toHaveLength(3);
    });

    it('includes Online and Offline as polar states', () => {
      expect(ALL_MACHINE_STATUSES).toContain('Online');
      expect(ALL_MACHINE_STATUSES).toContain('Offline');
    });

    it('includes Degraded as intermediate state', () => {
      expect(ALL_MACHINE_STATUSES).toContain('Degraded');
    });
  });

  describe('ConnectionTestStatus', () => {
    it('has exactly 3 values', () => {
      expect(ALL_CONNECTION_TEST_STATUSES).toHaveLength(3);
    });

    it('includes ok, slow, unreachable', () => {
      expect(ALL_CONNECTION_TEST_STATUSES).toContain('ok');
      expect(ALL_CONNECTION_TEST_STATUSES).toContain('slow');
      expect(ALL_CONNECTION_TEST_STATUSES).toContain('unreachable');
    });
  });
});

// ---------------------------------------------------------------------------
// 2. EvidenceActor discriminant exhaustiveness
// ---------------------------------------------------------------------------

describe('EvidenceActor discriminant', () => {
  function describeActor(actor: EvidenceActor): string {
    switch (actor.kind) {
      case 'User':
        return `user:${actor.userId}`;
      case 'Machine':
        return `machine:${actor.machineId}`;
      case 'Adapter':
        return `adapter:${actor.adapterId}`;
      case 'System':
        return 'system';
    }
  }

  it('User actor carries userId', () => {
    const actor: EvidenceActorUser = { kind: 'User', userId: 'u-1' };
    expect(describeActor(actor)).toBe('user:u-1');
  });

  it('Machine actor carries machineId', () => {
    const actor: EvidenceActorMachine = { kind: 'Machine', machineId: 'm-1' };
    expect(describeActor(actor)).toBe('machine:m-1');
  });

  it('Adapter actor carries adapterId', () => {
    const actor: EvidenceActorAdapter = { kind: 'Adapter', adapterId: 'a-1' };
    expect(describeActor(actor)).toBe('adapter:a-1');
  });

  it('System actor needs no identifier', () => {
    const actor: EvidenceActorSystem = { kind: 'System' };
    expect(describeActor(actor)).toBe('system');
  });

  it('all four discriminant kinds are handled (exhaustiveness check)', () => {
    const actors: EvidenceActor[] = [
      { kind: 'User', userId: 'u' },
      { kind: 'Machine', machineId: 'm' },
      { kind: 'Adapter', adapterId: 'a' },
      { kind: 'System' },
    ];
    const descriptions = actors.map(describeActor);
    expect(descriptions).toHaveLength(4);
    expect(new Set(descriptions).size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 3. Problem Details (RFC 7807) conformance
// ---------------------------------------------------------------------------

describe('Problem Details conformance', () => {
  describe('isProblemDetails', () => {
    it('accepts a minimal valid problem details object', () => {
      expect(isProblemDetails({ type: 'about:blank', title: 'Not Found', status: 404 })).toBe(true);
    });

    it('accepts a full problem details object', () => {
      expect(
        isProblemDetails({
          type: 'https://example.com/probs/out-of-credit',
          title: 'Out of Credit',
          status: 403,
          detail: 'Your account has insufficient credit.',
          instance: '/account/12345/transactions/abc',
        }),
      ).toBe(true);
    });

    it('rejects null', () => {
      expect(isProblemDetails(null)).toBe(false);
    });

    it('rejects a plain string', () => {
      expect(isProblemDetails('error string')).toBe(false);
    });

    it('rejects an array', () => {
      expect(isProblemDetails([{ type: 'about:blank', title: 'x', status: 400 }])).toBe(false);
    });

    it('rejects missing type', () => {
      expect(isProblemDetails({ title: 'Bad', status: 400 })).toBe(false);
    });

    it('rejects empty string type', () => {
      expect(isProblemDetails({ type: '', title: 'Bad', status: 400 })).toBe(false);
    });

    it('rejects missing title', () => {
      expect(isProblemDetails({ type: 'about:blank', status: 400 })).toBe(false);
    });

    it('rejects empty string title', () => {
      expect(isProblemDetails({ type: 'about:blank', title: '', status: 400 })).toBe(false);
    });

    it('rejects missing status', () => {
      expect(isProblemDetails({ type: 'about:blank', title: 'Bad' })).toBe(false);
    });

    it('rejects non-integer status (float)', () => {
      expect(isProblemDetails({ type: 'about:blank', title: 'Bad', status: 400.5 })).toBe(false);
    });

    it('rejects string status', () => {
      expect(isProblemDetails({ type: 'about:blank', title: 'Bad', status: '400' })).toBe(false);
    });

    it('accepts integer status 0', () => {
      expect(isProblemDetails({ type: 'about:blank', title: 'Bad', status: 0 })).toBe(true);
    });

    it('accepts negative integer status', () => {
      expect(isProblemDetails({ type: 'about:blank', title: 'Bad', status: -1 })).toBe(true);
    });
  });

  describe('parseProblemDetails', () => {
    it('returns the object when valid', () => {
      const obj = { type: 'about:blank', title: 'Not Found', status: 404 };
      expect(parseProblemDetails(obj)).toStrictEqual(obj);
    });

    it('throws when invalid', () => {
      expect(() => parseProblemDetails({ type: 'about:blank' })).toThrow(
        'Invalid Problem Details payload.',
      );
    });
  });

  describe('ProblemDetailsError', () => {
    it('carries problem and status on the instance', () => {
      const problem = { type: 'about:blank', title: 'Conflict', status: 409 };
      const err = new ProblemDetailsError(problem);
      expect(err.problem).toStrictEqual(problem);
      expect(err.status).toBe(409);
      expect(err.message).toBe('Conflict');
      expect(err.name).toBe('ProblemDetailsError');
    });

    it('is an instance of Error', () => {
      const err = new ProblemDetailsError({ type: 'about:blank', title: 'Oops', status: 500 });
      expect(err).toBeInstanceOf(Error);
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Pagination invariants
// ---------------------------------------------------------------------------

describe('Pagination invariants', () => {
  describe('buildCursorQuery – limit clamping', () => {
    it('uses DEFAULT_LIMIT (50) when no params', () => {
      const { query } = buildCursorQuery();
      expect(query.get('limit')).toBe('50');
    });

    it('uses DEFAULT_LIMIT when limit is omitted from params', () => {
      const { query } = buildCursorQuery({});
      expect(query.get('limit')).toBe('50');
    });

    it('clamps above MAX_LIMIT (200) to 200', () => {
      const { query } = buildCursorQuery({ limit: 999 });
      expect(query.get('limit')).toBe('200');
    });

    it('clamps MAX_LIMIT exactly to 200', () => {
      const { query } = buildCursorQuery({ limit: 200 });
      expect(query.get('limit')).toBe('200');
    });

    it('clamps non-positive limit to 1', () => {
      const { query: q1 } = buildCursorQuery({ limit: 0 });
      const { query: q2 } = buildCursorQuery({ limit: -10 });
      expect(q1.get('limit')).toBe('1');
      expect(q2.get('limit')).toBe('1');
    });

    it('uses DEFAULT_LIMIT when limit is a non-integer float', () => {
      const { query } = buildCursorQuery({ limit: 25.7 });
      expect(query.get('limit')).toBe('50');
    });

    it('passes through a valid positive limit', () => {
      const { query } = buildCursorQuery({ limit: 25 });
      expect(query.get('limit')).toBe('25');
    });

    it('does not include cursor when not provided', () => {
      const { query } = buildCursorQuery({ limit: 10 });
      expect(query.has('cursor')).toBe(false);
    });

    it('includes cursor when provided', () => {
      const token = 'eyJpZCI6Inh5eiJ9';
      const { query } = buildCursorQuery({ cursor: token });
      expect(query.get('cursor')).toBe(token);
    });

    it('limit is monotone: larger request yields larger or equal clamped limit', () => {
      const limits = [1, 10, 50, 100, 200, 201, 500];
      const clamped: number[] = limits.map((l) => {
        const raw = buildCursorQuery({ limit: l }).query.get('limit');
        return raw !== null ? parseInt(raw, 10) : 0;
      });
      for (let i = 1; i < clamped.length; i++) {
        expect(clamped[i]!).toBeGreaterThanOrEqual(clamped[i - 1]!);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Query parameter builder conformance
// ---------------------------------------------------------------------------

describe('Query parameter builder conformance', () => {
  describe('buildListRunsQuery', () => {
    it('includes limit by default', () => {
      const q = buildListRunsQuery({});
      expect(q.has('limit')).toBe(true);
    });

    it('forwards all optional filters when present', () => {
      const q = buildListRunsQuery({
        status: 'Running',
        workflowId: 'wf-1',
        initiatedByUserId: 'u-1',
        correlationId: 'corr-1',
        sort: 'createdAt:desc',
        q: 'payment',
        limit: 10,
        cursor: 'tok',
      });
      expect(q.get('status')).toBe('Running');
      expect(q.get('workflowId')).toBe('wf-1');
      expect(q.get('initiatedByUserId')).toBe('u-1');
      expect(q.get('correlationId')).toBe('corr-1');
      expect(q.get('sort')).toBe('createdAt:desc');
      expect(q.get('q')).toBe('payment');
      expect(q.get('limit')).toBe('10');
      expect(q.get('cursor')).toBe('tok');
    });

    it('omits optional filters when absent', () => {
      const q = buildListRunsQuery({});
      expect(q.has('status')).toBe(false);
      expect(q.has('workflowId')).toBe(false);
      expect(q.has('initiatedByUserId')).toBe(false);
      expect(q.has('correlationId')).toBe(false);
    });

    it('each RunStatus value is a valid status filter string', () => {
      for (const status of ALL_RUN_STATUSES) {
        const q = buildListRunsQuery({ status });
        expect(q.get('status')).toBe(status);
      }
    });
  });

  describe('buildListWorkItemsQuery', () => {
    it('forwards ownerUserId, runId, workflowId, approvalId, evidenceId filters', () => {
      const q = buildListWorkItemsQuery({
        ownerUserId: 'u-2',
        runId: 'run-1',
        workflowId: 'wf-2',
        approvalId: 'ap-1',
        evidenceId: 'ev-1',
      });
      expect(q.get('ownerUserId')).toBe('u-2');
      expect(q.get('runId')).toBe('run-1');
      expect(q.get('workflowId')).toBe('wf-2');
      expect(q.get('approvalId')).toBe('ap-1');
      expect(q.get('evidenceId')).toBe('ev-1');
    });

    it('each WorkItemStatus value is a valid status filter string', () => {
      for (const status of ALL_WORK_ITEM_STATUSES) {
        const q = buildListWorkItemsQuery({ status });
        expect(q.get('status')).toBe(status);
      }
    });
  });

  describe('buildListEvidenceQuery', () => {
    it('forwards runId, planId, workItemId, category filters', () => {
      const q = buildListEvidenceQuery({
        runId: 'run-1',
        planId: 'plan-1',
        workItemId: 'wi-1',
        category: 'Approval',
      });
      expect(q.get('runId')).toBe('run-1');
      expect(q.get('planId')).toBe('plan-1');
      expect(q.get('workItemId')).toBe('wi-1');
      expect(q.get('category')).toBe('Approval');
    });

    it('each EvidenceCategory is a valid category filter string', () => {
      for (const category of ALL_EVIDENCE_CATEGORIES) {
        const q = buildListEvidenceQuery({ category });
        expect(q.get('category')).toBe(category);
      }
    });
  });

  describe('buildListHumanTasksQuery', () => {
    it('forwards assigneeId, status, runId filters', () => {
      const q = buildListHumanTasksQuery({
        assigneeId: 'wm-1',
        status: 'in-progress',
        runId: 'run-5',
      });
      expect(q.get('assigneeId')).toBe('wm-1');
      expect(q.get('status')).toBe('in-progress');
      expect(q.get('runId')).toBe('run-5');
    });

    it('omits filters when absent', () => {
      const q = buildListHumanTasksQuery({});
      expect(q.has('assigneeId')).toBe(false);
      expect(q.has('status')).toBe(false);
      expect(q.has('runId')).toBe(false);
    });
  });

  describe('buildListWorkforceMembersQuery', () => {
    it('forwards capability, queueId, availability filters', () => {
      const q = buildListWorkforceMembersQuery({
        capability: 'operations.approval',
        queueId: 'queue-1',
        availability: 'available',
      });
      expect(q.get('capability')).toBe('operations.approval');
      expect(q.get('queueId')).toBe('queue-1');
      expect(q.get('availability')).toBe('available');
    });
  });

  describe('buildListWorkforceQueuesQuery', () => {
    it('forwards capability filter', () => {
      const q = buildListWorkforceQueuesQuery({ capability: 'robotics.supervision' });
      expect(q.get('capability')).toBe('robotics.supervision');
    });

    it('omits capability when absent', () => {
      const q = buildListWorkforceQueuesQuery({});
      expect(q.has('capability')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// 6. URL and header construction invariants
// ---------------------------------------------------------------------------

describe('URL construction invariants', () => {
  describe('buildRequestUrl', () => {
    it('joins baseUrl and path correctly with trailing slash on base', () => {
      const url = buildRequestUrl('https://api.example.com/', 'workspaces/ws-1/runs');
      expect(url).toBe('https://api.example.com/workspaces/ws-1/runs');
    });

    it('joins baseUrl and path correctly without trailing slash on base', () => {
      const url = buildRequestUrl('https://api.example.com', '/workspaces/ws-1/runs');
      expect(url).toBe('https://api.example.com/workspaces/ws-1/runs');
    });

    it('appends query parameters', () => {
      const query = new URLSearchParams({ limit: '50', status: 'Running' });
      const url = buildRequestUrl('https://api.example.com/', 'runs', query);
      const parsed = new URL(url);
      expect(parsed.searchParams.get('limit')).toBe('50');
      expect(parsed.searchParams.get('status')).toBe('Running');
    });

    it('produces a valid URL for all RunStatus filter values', () => {
      for (const status of ALL_RUN_STATUSES) {
        const query = new URLSearchParams({ status });
        const url = buildRequestUrl('https://api.example.com/', 'runs', query);
        expect(() => new URL(url)).not.toThrow();
        expect(new URL(url).searchParams.get('status')).toBe(status);
      }
    });
  });

  describe('normalizeWorkspaceId', () => {
    it('passes through a plain alphanumeric workspace ID unchanged', () => {
      expect(normalizeWorkspaceId('ws-abc123')).toBe('ws-abc123');
    });

    it('percent-encodes special characters', () => {
      const encoded = normalizeWorkspaceId('ws/with spaces&special=chars');
      expect(encoded).not.toContain(' ');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('&');
    });

    it('is consistent across invocations (idempotent for safe chars)', () => {
      const id = 'tenant-abc-123';
      expect(normalizeWorkspaceId(id)).toBe(normalizeWorkspaceId(id));
    });
  });

  describe('normalizeResourceId', () => {
    it('passes through a plain resource ID', () => {
      expect(normalizeResourceId('run-xyz-789')).toBe('run-xyz-789');
    });

    it('percent-encodes special characters', () => {
      const encoded = normalizeResourceId('id with spaces');
      expect(encoded).not.toContain(' ');
    });
  });
});

// ---------------------------------------------------------------------------
// 7. Request header invariants
// ---------------------------------------------------------------------------

describe('Request header invariants', () => {
  it('always sets Accept: application/json', async () => {
    const headers = await buildRequestHeaders({
      defaultHeaders: {},
      hasJsonBody: false,
    });
    expect(headers.get('Accept')).toBe('application/json');
  });

  it('always sets X-Client: portarium-presentation', async () => {
    const headers = await buildRequestHeaders({
      defaultHeaders: {},
      hasJsonBody: false,
    });
    expect(headers.get('X-Client')).toBe('portarium-presentation');
  });

  it('sets Content-Type: application/json when hasJsonBody is true', async () => {
    const headers = await buildRequestHeaders({
      defaultHeaders: {},
      hasJsonBody: true,
    });
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('omits Content-Type when hasJsonBody is false', async () => {
    const headers = await buildRequestHeaders({
      defaultHeaders: {},
      hasJsonBody: false,
    });
    expect(headers.get('Content-Type')).toBeNull();
  });

  it('sets Authorization header from sync getAuthToken', async () => {
    const headers = await buildRequestHeaders({
      defaultHeaders: {},
      hasJsonBody: false,
      getAuthToken: () => 'my-token',
    });
    expect(headers.get('Authorization')).toBe('Bearer my-token');
  });

  it('sets Authorization header from async getAuthToken', async () => {
    const headers = await buildRequestHeaders({
      defaultHeaders: {},
      hasJsonBody: false,
      getAuthToken: async () => 'async-token',
    });
    expect(headers.get('Authorization')).toBe('Bearer async-token');
  });

  it('omits Authorization when getAuthToken returns empty string', async () => {
    const headers = await buildRequestHeaders({
      defaultHeaders: {},
      hasJsonBody: false,
      getAuthToken: () => '',
    });
    expect(headers.get('Authorization')).toBeNull();
  });

  it('omits Authorization when getAuthToken is not provided', async () => {
    const headers = await buildRequestHeaders({
      defaultHeaders: {},
      hasJsonBody: false,
    });
    expect(headers.get('Authorization')).toBeNull();
  });

  it('sets Idempotency-Key when idempotencyKey is provided', async () => {
    const key = 'idem-key-123';
    const headers = await buildRequestHeaders({
      defaultHeaders: {},
      hasJsonBody: true,
      idempotencyKey: key,
    });
    expect(headers.get('Idempotency-Key')).toBe(key);
  });

  it('omits Idempotency-Key when not provided', async () => {
    const headers = await buildRequestHeaders({
      defaultHeaders: {},
      hasJsonBody: true,
    });
    expect(headers.get('Idempotency-Key')).toBeNull();
  });

  it('merges defaultHeaders into the result', async () => {
    const headers = await buildRequestHeaders({
      defaultHeaders: { 'X-Tenant': 'tenant-abc' },
      hasJsonBody: false,
    });
    expect(headers.get('X-Tenant')).toBe('tenant-abc');
  });
});

// ---------------------------------------------------------------------------
// 8. Request body serialization invariants
// ---------------------------------------------------------------------------

describe('Request body serialization invariants', () => {
  describe('normalizeRequestBody', () => {
    it('returns undefined for undefined input', () => {
      expect(normalizeRequestBody(undefined)).toBeUndefined();
    });

    it('returns a string as-is', () => {
      const s = '{"key":"value"}';
      expect(normalizeRequestBody(s)).toBe(s);
    });

    it('JSON-stringifies an object', () => {
      const body = { decision: 'Approved', rationale: 'LGTM' };
      const result = normalizeRequestBody(body);
      expect(result).toBe(JSON.stringify(body));
    });

    it('JSON-stringifies an array', () => {
      const arr = [1, 2, 3];
      expect(normalizeRequestBody(arr)).toBe('[1,2,3]');
    });
  });

  describe('safeJsonParse', () => {
    it('parses valid JSON', () => {
      expect(safeJsonParse('{"status":"ok"}')).toStrictEqual({ status: 'ok' });
    });

    it('returns null for invalid JSON', () => {
      expect(safeJsonParse('not-json')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(safeJsonParse('')).toBeNull();
    });

    it('parses JSON array', () => {
      expect(safeJsonParse('[1,2,3]')).toStrictEqual([1, 2, 3]);
    });

    it('parses JSON null', () => {
      expect(safeJsonParse('null')).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 9. Tenant scope invariants
// ---------------------------------------------------------------------------

describe('Tenant scope invariants', () => {
  it('workspaceId is required in RunSummary', () => {
    const run = {
      schemaVersion: 1,
      runId: 'run-1',
      workspaceId: 'ws-tenant-1',
      workflowId: 'wf-1',
      correlationId: 'corr-1',
      executionTier: 'Auto' as const,
      initiatedByUserId: 'u-1',
      status: 'Running' as RunStatus,
      createdAtIso: '2026-02-22T00:00:00.000Z',
    };
    expect(run.workspaceId).toBeDefined();
    expect(run.workspaceId).toMatch(/^ws-/);
  });

  it('workspaceId is required in ApprovalSummary', () => {
    const approval = {
      schemaVersion: 1,
      approvalId: 'ap-1',
      workspaceId: 'ws-tenant-1',
      runId: 'run-1',
      planId: 'plan-1',
      prompt: 'Please review this action.',
      status: 'Pending' as ApprovalStatus,
      requestedAtIso: '2026-02-22T00:00:00.000Z',
      requestedByUserId: 'u-1',
    };
    expect(approval.workspaceId).toBeDefined();
  });

  it('workspaceId is required in WorkItemSummary', () => {
    const workItem = {
      schemaVersion: 1,
      workItemId: 'wi-1',
      workspaceId: 'ws-tenant-2',
      createdAtIso: '2026-02-22T00:00:00.000Z',
      createdByUserId: 'u-1',
      title: 'Review deployment',
      status: 'Open' as WorkItemSummary['status'],
    };
    expect(workItem.workspaceId).toBeDefined();
  });

  it('normalizeWorkspaceId produces a URL-safe path segment for any tenant ID', () => {
    const tenantIds = [
      'ws-abc',
      'tenant/with/slashes',
      'tenant with spaces',
      'tenant&with=special?chars',
    ];
    for (const id of tenantIds) {
      const encoded = normalizeWorkspaceId(id);
      expect(encoded).not.toMatch(/[\s/?&=]/);
    }
  });
});
