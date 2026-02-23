/**
 * bead-0782: Contract tests for the Derived Artifacts + Retrieval release
 * readiness gate.
 *
 * These tests verify that all required governance documents, specs, source
 * artifacts, and test artifacts exist and contain the mandatory sections.
 * They act as a merge gate: CI fails if any artifact goes missing.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../');
const READINESS_DOC = path.join(ROOT, 'docs/governance/retrieval-release-readiness.md');
const READINESS_SPEC = path.join(ROOT, '.specify/specs/retrieval-release-readiness-v1.md');

function readDoc(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

// ---------------------------------------------------------------------------
// Release readiness document
// ---------------------------------------------------------------------------

describe('retrieval-release-readiness.md', () => {
  it('exists', () => {
    expect(fs.existsSync(READINESS_DOC)).toBe(true);
  });

  it('is tagged with bead-0782', () => {
    expect(readDoc(READINESS_DOC)).toContain('bead-0782');
  });

  it('contains projection lag SLA section', () => {
    const doc = readDoc(READINESS_DOC);
    expect(doc).toContain('Projection Lag');
    expect(doc).toContain('p50');
    expect(doc).toContain('p95');
    expect(doc).toContain('p99');
  });

  it('defines normal-operation lag targets', () => {
    const doc = readDoc(READINESS_DOC);
    expect(doc).toContain('Normal operation');
    expect(doc).toContain('500 ms');
    expect(doc).toContain('2 000 ms');
  });

  it('contains retrieval performance SLA section', () => {
    const doc = readDoc(READINESS_DOC);
    expect(doc).toContain('Retrieval Performance');
    expect(doc).toContain('semantic');
    expect(doc).toContain('graph');
    expect(doc).toContain('hybrid');
  });

  it('defines retrieval latency targets for all three strategies', () => {
    const doc = readDoc(READINESS_DOC);
    expect(doc).toContain('`semantic`');
    expect(doc).toContain('`graph`');
    expect(doc).toContain('`hybrid`');
  });

  it('contains cost guardrails section', () => {
    const doc = readDoc(READINESS_DOC);
    expect(doc).toContain('Cost Guardrail');
  });

  it('defines embedding cost ceiling', () => {
    const doc = readDoc(READINESS_DOC);
    expect(doc).toContain('embedding');
    expect(doc).toContain('Ceiling');
  });

  it('defines storage cost ceilings', () => {
    const doc = readDoc(READINESS_DOC);
    expect(doc).toContain('pgvector');
    expect(doc).toContain('entries');
  });

  it('contains rollback triggers section', () => {
    const doc = readDoc(READINESS_DOC);
    expect(doc).toContain('Rollback Trigger');
  });

  it('defines at least 5 rollback triggers', () => {
    const doc = readDoc(READINESS_DOC);
    expect(doc).toContain('R1');
    expect(doc).toContain('R2');
    expect(doc).toContain('R3');
    expect(doc).toContain('R4');
    expect(doc).toContain('R5');
  });

  it('defines L1 and L2 rollback procedures', () => {
    const doc = readDoc(READINESS_DOC);
    expect(doc).toContain('L1 rollback');
    expect(doc).toContain('L2 rollback');
  });

  it('contains release gate criteria checklist', () => {
    const doc = readDoc(READINESS_DOC);
    expect(doc).toContain('Release Gate Criteria');
    expect(doc).toContain('ci:pr');
  });

  it('contains required artifacts table', () => {
    const doc = readDoc(READINESS_DOC);
    expect(doc).toContain('Required Artifacts');
    expect(doc).toContain('retrieval-ports.ts');
    expect(doc).toContain('derived-artifact-projector.ts');
  });
});

// ---------------------------------------------------------------------------
// Release readiness spec
// ---------------------------------------------------------------------------

describe('retrieval-release-readiness-v1.md (spec)', () => {
  it('exists', () => {
    expect(fs.existsSync(READINESS_SPEC)).toBe(true);
  });

  it('is tagged with bead-0782', () => {
    expect(readDoc(READINESS_SPEC)).toContain('bead-0782');
  });

  it('defines acceptance criteria', () => {
    const spec = readDoc(READINESS_SPEC);
    expect(spec).toContain('Acceptance criteria');
    expect(spec).toContain('Projection lag');
    expect(spec).toContain('Retrieval latency');
    expect(spec).toContain('Cost guardrails');
  });

  it('lists required artifacts', () => {
    expect(readDoc(READINESS_SPEC)).toContain('Required artifacts');
  });
});

// ---------------------------------------------------------------------------
// Source artifact existence
// ---------------------------------------------------------------------------

describe('source artifacts', () => {
  const SOURCE_FILES = [
    'src/domain/derived-artifacts/retrieval-ports.ts',
    'src/domain/derived-artifacts/derived-artifact-v1.ts',
    'src/application/services/derived-artifact-projector.ts',
    'src/application/services/retrieval-query-router.ts',
    'src/infrastructure/eventing/jetstream-projection-worker.ts',
    'src/infrastructure/pgvector/pgvector-semantic-index-adapter.ts',
    'src/infrastructure/janusgraph/janusgraph-knowledge-graph-adapter.ts',
    'src/infrastructure/postgresql/postgres-derived-artifact-registry.ts',
  ];

  for (const file of SOURCE_FILES) {
    it(`${file} exists`, () => {
      expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Test artifact existence
// ---------------------------------------------------------------------------

describe('test artifacts', () => {
  const TEST_FILES = [
    'src/application/services/derived-artifact-projector.test.ts',
    'src/application/services/retrieval-query-router.test.ts',
    'src/application/services/derived-artifact-redactor.test.ts',
    'src/infrastructure/eventing/jetstream-projection-worker.test.ts',
    'src/infrastructure/pgvector/pgvector-semantic-index-adapter.test.ts',
    'src/infrastructure/janusgraph/janusgraph-knowledge-graph-adapter.test.ts',
    'src/infrastructure/postgresql/postgres-derived-artifact-registry.test.ts',
    'src/application/integration/retrieval-replay-idempotency-provenance.integration.test.ts',
    'src/domain/derived-artifacts/derived-artifact-v1.test.ts',
    'src/domain/derived-artifacts/retrieval-ports.test.ts',
  ];

  for (const file of TEST_FILES) {
    it(`${file} exists`, () => {
      expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Governance / docs artifact existence
// ---------------------------------------------------------------------------

describe('governance and docs artifacts', () => {
  const GOV_FILES = [
    'docs/adr/0079-derived-artifacts-retrieval-rag-vector-graph.md',
    'docs/how-to/derived-artifacts-retrieval-campaign.md',
    'docs/compliance/vector-graph-embedding-license-gate.md',
    'docs/governance/retrieval-release-readiness.md',
    '.specify/specs/retrieval-release-readiness-v1.md',
  ];

  for (const file of GOV_FILES) {
    it(`${file} exists`, () => {
      expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
    });
  }
});
