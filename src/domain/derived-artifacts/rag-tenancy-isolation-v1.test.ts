/**
 * Tests for RAG tenancy isolation model.
 *
 * Verifies workspace-scoped retrieval policies, cross-workspace boundary
 * enforcement, result provenance validation, and workspace data lifecycle.
 *
 * Bead: bead-vuz4
 */

import { describe, expect, it } from 'vitest';
import { WorkspaceId } from '../primitives/index.js';
import {
  isVectorIsolationStrategy,
  isGraphIsolationStrategy,
  validateRagTenancyPolicy,
  validateRetrievalQueryScope,
  validateResultProvenance,
  validateWorkspaceDataAction,
  type RagTenancyPolicy,
  type ScopedRetrievalQuery,
  type RetrievalResultProvenance,
} from './rag-tenancy-isolation-v1.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

const WS_A = WorkspaceId('ws-alpha');
const WS_B = WorkspaceId('ws-beta');

const defaultPolicy: RagTenancyPolicy = {
  vectorIsolation: 'shared-collection-filtered',
  graphIsolation: 'shared-graph-filtered',
  allowCrossWorkspaceRetrieval: false,
  maxResultsPerQuery: 100,
  requireRetrievalAuditLog: true,
};

// ── isVectorIsolationStrategy ───────────────────────────────────────────────

describe('isVectorIsolationStrategy', () => {
  it.each(['collection-per-workspace', 'shared-collection-filtered'])(
    'accepts valid strategy "%s"',
    (s) => {
      expect(isVectorIsolationStrategy(s)).toBe(true);
    },
  );

  it.each(['shard-per-workspace', 'none', '', 'shared'])('rejects invalid strategy "%s"', (s) => {
    expect(isVectorIsolationStrategy(s)).toBe(false);
  });
});

// ── isGraphIsolationStrategy ────────────────────────────────────────────────

describe('isGraphIsolationStrategy', () => {
  it.each(['database-per-workspace', 'shared-graph-filtered'])(
    'accepts valid strategy "%s"',
    (s) => {
      expect(isGraphIsolationStrategy(s)).toBe(true);
    },
  );

  it.each(['graph-per-tenant', 'none', ''])('rejects invalid strategy "%s"', (s) => {
    expect(isGraphIsolationStrategy(s)).toBe(false);
  });
});

// ── validateRagTenancyPolicy ────────────────────────────────────────────────

describe('validateRagTenancyPolicy', () => {
  it('accepts a valid default policy', () => {
    expect(validateRagTenancyPolicy(defaultPolicy)).toEqual({ valid: true });
  });

  it('accepts collection-per-workspace with cross-workspace retrieval', () => {
    const policy: RagTenancyPolicy = {
      ...defaultPolicy,
      vectorIsolation: 'collection-per-workspace',
      allowCrossWorkspaceRetrieval: true,
      requireRetrievalAuditLog: true,
    };
    expect(validateRagTenancyPolicy(policy)).toEqual({ valid: true });
  });

  it('rejects maxResultsPerQuery <= 0', () => {
    const result = validateRagTenancyPolicy({ ...defaultPolicy, maxResultsPerQuery: 0 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('maxResultsPerQuery');
  });

  it('rejects maxResultsPerQuery > 1000', () => {
    const result = validateRagTenancyPolicy({ ...defaultPolicy, maxResultsPerQuery: 1001 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('1000');
  });

  it('rejects cross-workspace retrieval with shared-collection-filtered', () => {
    const policy: RagTenancyPolicy = {
      ...defaultPolicy,
      vectorIsolation: 'shared-collection-filtered',
      allowCrossWorkspaceRetrieval: true,
    };
    const result = validateRagTenancyPolicy(policy);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('shared-collection-filtered');
  });

  it('rejects cross-workspace retrieval without audit logging', () => {
    const policy: RagTenancyPolicy = {
      ...defaultPolicy,
      vectorIsolation: 'collection-per-workspace',
      allowCrossWorkspaceRetrieval: true,
      requireRetrievalAuditLog: false,
    };
    const result = validateRagTenancyPolicy(policy);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('audit logging');
  });
});

// ── validateRetrievalQueryScope ─────────────────────────────────────────────

describe('validateRetrievalQueryScope', () => {
  it('accepts a same-workspace query', () => {
    const query: ScopedRetrievalQuery = {
      callerWorkspaceId: WS_A,
      targetWorkspaceId: WS_A,
      queryText: 'find deployment evidence',
      topK: 10,
    };
    expect(validateRetrievalQueryScope(query, defaultPolicy)).toEqual({ valid: true });
  });

  it('rejects cross-workspace query when not allowed', () => {
    const query: ScopedRetrievalQuery = {
      callerWorkspaceId: WS_A,
      targetWorkspaceId: WS_B,
      queryText: 'find deployment evidence',
      topK: 10,
    };
    const result = validateRetrievalQueryScope(query, defaultPolicy);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('Cross-workspace');
      expect(result.reason).toContain('ws-alpha');
      expect(result.reason).toContain('ws-beta');
    }
  });

  it('allows cross-workspace query when policy permits', () => {
    const crossPolicy: RagTenancyPolicy = {
      ...defaultPolicy,
      vectorIsolation: 'collection-per-workspace',
      allowCrossWorkspaceRetrieval: true,
    };
    const query: ScopedRetrievalQuery = {
      callerWorkspaceId: WS_A,
      targetWorkspaceId: WS_B,
      queryText: 'find deployment evidence',
      topK: 10,
    };
    expect(validateRetrievalQueryScope(query, crossPolicy)).toEqual({ valid: true });
  });

  it('rejects empty queryText', () => {
    const query: ScopedRetrievalQuery = {
      callerWorkspaceId: WS_A,
      targetWorkspaceId: WS_A,
      queryText: '',
      topK: 10,
    };
    const result = validateRetrievalQueryScope(query, defaultPolicy);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('queryText');
  });

  it('rejects whitespace-only queryText', () => {
    const query: ScopedRetrievalQuery = {
      callerWorkspaceId: WS_A,
      targetWorkspaceId: WS_A,
      queryText: '   ',
      topK: 10,
    };
    const result = validateRetrievalQueryScope(query, defaultPolicy);
    expect(result.valid).toBe(false);
  });

  it('rejects topK <= 0', () => {
    const query: ScopedRetrievalQuery = {
      callerWorkspaceId: WS_A,
      targetWorkspaceId: WS_A,
      queryText: 'test',
      topK: 0,
    };
    const result = validateRetrievalQueryScope(query, defaultPolicy);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('topK');
  });

  it('rejects topK exceeding policy max', () => {
    const query: ScopedRetrievalQuery = {
      callerWorkspaceId: WS_A,
      targetWorkspaceId: WS_A,
      queryText: 'test',
      topK: 200,
    };
    const result = validateRetrievalQueryScope(query, defaultPolicy);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('100');
  });
});

// ── validateResultProvenance ────────────────────────────────────────────────

describe('validateResultProvenance', () => {
  it('accepts results from the same workspace', () => {
    const results: RetrievalResultProvenance[] = [
      { resultWorkspaceId: WS_A, queryWorkspaceId: WS_A },
      { resultWorkspaceId: WS_A, queryWorkspaceId: WS_A },
    ];
    expect(validateResultProvenance(results, defaultPolicy)).toEqual({ valid: true });
  });

  it('rejects results from a different workspace (data leakage)', () => {
    const results: RetrievalResultProvenance[] = [
      { resultWorkspaceId: WS_A, queryWorkspaceId: WS_A },
      { resultWorkspaceId: WS_B, queryWorkspaceId: WS_A }, // leaked
    ];
    const result = validateResultProvenance(results, defaultPolicy);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('index 1');
      expect(result.reason).toContain('ws-beta');
      expect(result.reason).toContain('data leakage');
    }
  });

  it('allows cross-workspace results when policy permits', () => {
    const crossPolicy: RagTenancyPolicy = {
      ...defaultPolicy,
      vectorIsolation: 'collection-per-workspace',
      allowCrossWorkspaceRetrieval: true,
    };
    const results: RetrievalResultProvenance[] = [
      { resultWorkspaceId: WS_B, queryWorkspaceId: WS_A },
    ];
    expect(validateResultProvenance(results, crossPolicy)).toEqual({ valid: true });
  });

  it('accepts empty results', () => {
    expect(validateResultProvenance([], defaultPolicy)).toEqual({ valid: true });
  });
});

// ── validateWorkspaceDataAction ─────────────────────────────────────────────

describe('validateWorkspaceDataAction', () => {
  it('accepts provision action', () => {
    expect(validateWorkspaceDataAction('provision', WS_A)).toEqual({ valid: true });
  });

  it('accepts deprovision action with specific workspace', () => {
    expect(validateWorkspaceDataAction('deprovision', WS_A)).toEqual({ valid: true });
  });

  it('accepts export action', () => {
    expect(validateWorkspaceDataAction('export', WS_A)).toEqual({ valid: true });
  });

  it('accepts purge action with specific workspace', () => {
    expect(validateWorkspaceDataAction('purge', WS_A)).toEqual({ valid: true });
  });

  it('rejects wildcard workspace for purge', () => {
    const result = validateWorkspaceDataAction('purge', WorkspaceId('*'));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('Wildcard');
  });

  it('rejects wildcard workspace for deprovision', () => {
    const result = validateWorkspaceDataAction('deprovision', WorkspaceId('%'));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('Wildcard');
  });

  it('rejects empty workspace ID', () => {
    const result = validateWorkspaceDataAction('provision', WorkspaceId(''));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('non-empty');
  });

  it('rejects whitespace-only workspace ID', () => {
    const result = validateWorkspaceDataAction('provision', WorkspaceId('   '));
    expect(result.valid).toBe(false);
  });
});
