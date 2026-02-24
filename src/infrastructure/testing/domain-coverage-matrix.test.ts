import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PORT_FAMILIES } from '../../domain/primitives/index.js';

type OperationalDomainId =
  | 'marketing'
  | 'finance'
  | 'accounting'
  | 'it-support'
  | 'software-delivery';

type CoverageStatus = 'covered' | 'partial' | 'gap';

type DomainEntry = Readonly<{
  id: OperationalDomainId;
  name: string;
}>;

type PortFamilyCoverageEntry = Readonly<{
  portFamily: (typeof PORT_FAMILIES)[number];
  operationalDomains: readonly OperationalDomainId[];
  canonicalObjects: readonly string[];
  coverageStatus: CoverageStatus;
  coverageBeads: readonly string[];
  gapBeads: readonly string[];
  gaps: readonly string[];
}>;

type CoverageMatrix = Readonly<{
  version: number;
  review: Readonly<{
    cycleId: string;
    reviewedAt: string;
    reviewedBy: string;
    cadence: string;
  }>;
  operationalDomains: readonly DomainEntry[];
  families: readonly PortFamilyCoverageEntry[];
}>;

type BeadIssue = Readonly<{
  id: string;
  status: string;
}>;

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, '../../..');
const MATRIX_PATH = path.join(
  REPO_ROOT,
  'docs',
  'internal',
  'governance',
  'domain-coverage-matrix.json',
);
const ISSUES_PATH = path.join(REPO_ROOT, '.beads', 'issues.jsonl');

const OPERATIONAL_DOMAIN_IDS = new Set<OperationalDomainId>([
  'marketing',
  'finance',
  'accounting',
  'it-support',
  'software-delivery',
]);

const CANONICAL_OBJECT_NAMES = new Set([
  'Party',
  'Ticket',
  'Invoice',
  'Payment',
  'Task',
  'Campaign',
  'Asset',
  'Document',
  'Subscription',
  'Opportunity',
  'Product',
  'Order',
  'Account',
  'ExternalObjectRef',
]);

function readCoverageMatrix(): CoverageMatrix {
  const raw = fs.readFileSync(MATRIX_PATH, 'utf8');
  return JSON.parse(raw) as CoverageMatrix;
}

function readIssues(): Map<string, BeadIssue> {
  const raw = fs.readFileSync(ISSUES_PATH, 'utf8');
  const issues = raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as BeadIssue);

  return new Map(issues.map((issue) => [issue.id, issue]));
}

describe('domain coverage matrix governance guard', () => {
  it('covers every defined port family exactly once', () => {
    const matrix = readCoverageMatrix();
    const byFamily = new Map(matrix.families.map((entry) => [entry.portFamily, entry]));

    expect(matrix.families).toHaveLength(PORT_FAMILIES.length);
    expect(byFamily.size).toBe(PORT_FAMILIES.length);

    for (const family of PORT_FAMILIES) {
      expect(byFamily.has(family)).toBe(true);
    }
  });

  it('uses controlled domain and canonical vocabularies and links every family to beads', () => {
    const matrix = readCoverageMatrix();
    const issues = readIssues();
    const matrixDomainIds = new Set(matrix.operationalDomains.map((domain) => domain.id));

    for (const requiredDomain of OPERATIONAL_DOMAIN_IDS) {
      expect(matrixDomainIds.has(requiredDomain)).toBe(true);
    }

    for (const entry of matrix.families) {
      expect(entry.operationalDomains.length).toBeGreaterThan(0);

      for (const domainId of entry.operationalDomains) {
        expect(OPERATIONAL_DOMAIN_IDS.has(domainId)).toBe(true);
      }

      for (const canonicalObject of entry.canonicalObjects) {
        expect(CANONICAL_OBJECT_NAMES.has(canonicalObject)).toBe(true);
      }

      const linkedBeads = [...entry.coverageBeads, ...entry.gapBeads];
      expect(linkedBeads.length).toBeGreaterThan(0);

      for (const beadId of linkedBeads) {
        expect(issues.has(beadId)).toBe(true);
      }

      if (entry.gaps.length > 0) {
        expect(entry.gapBeads.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every gap bead open', () => {
    const matrix = readCoverageMatrix();
    const issues = readIssues();

    for (const entry of matrix.families) {
      for (const beadId of entry.gapBeads) {
        const bead = issues.get(beadId);
        expect(bead).toBeDefined();
        expect(bead?.status).toBe('open');
      }
    }
  });

  it('requires explicit review-cycle metadata', () => {
    const matrix = readCoverageMatrix();

    expect(matrix.review.cycleId.trim().length).toBeGreaterThan(0);
    expect(matrix.review.reviewedBy.trim().length).toBeGreaterThan(0);

    const reviewedAt = Date.parse(matrix.review.reviewedAt);
    expect(Number.isNaN(reviewedAt)).toBe(false);
  });
});
