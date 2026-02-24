/**
 * Contract tests for the OpenClaw full integration release gate (bead-0803).
 *
 * Validates:
 *  - Release gate document exists and covers all 6 mandatory controls
 *  - Rollback runbook exists and documents all 5 rollback triggers
 *  - Release gate spec exists
 *  - All source artifacts referenced by the gate document exist
 *  - All spec artifacts referenced by the gate document exist
 *  - All governance artifacts referenced by the gate document exist
 *  - ADR-0072 and ADR-0099 are referenced
 *
 * Bead: bead-0803
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../');

const RELEASE_GATE_DOC = path.join(ROOT, 'docs/internal/governance/openclaw-release-gate.md');
const ROLLBACK_RUNBOOK = path.join(ROOT, 'docs/internal/governance/openclaw-rollback-runbook.md');
const RELEASE_GATE_SPEC = path.join(ROOT, '.specify/specs/openclaw-release-gate-v1.md');

function readGate(): string {
  return fs.readFileSync(RELEASE_GATE_DOC, 'utf8');
}

function readRollback(): string {
  return fs.readFileSync(ROLLBACK_RUNBOOK, 'utf8');
}

// ── Gate document existence and tagging ───────────────────────────────────────

describe('openclaw-release-gate.md', () => {
  it('document exists at docs/internal/governance/openclaw-release-gate.md', () => {
    expect(fs.existsSync(RELEASE_GATE_DOC)).toBe(true);
  });

  it('is tagged with bead-0803', () => {
    expect(readGate()).toContain('bead-0803');
  });

  // ── Control 1: Multi-tenant isolation ──────────────────────────────────────

  it('control 1: references multi-tenant isolation and ADR-0072', () => {
    const doc = readGate();
    expect(doc).toMatch(/[Mm]ulti-[Tt]enant [Ii]solation/);
    expect(doc).toMatch(/ADR-0072/);
  });

  it('control 1: references workspace isolation spec', () => {
    expect(readGate()).toMatch(/openclaw-gateway-workspace-isolation-v1/);
  });

  // ── Control 2: Tool blast-radius policy gating ────────────────────────────

  it('control 2: references tool blast-radius policy gating', () => {
    const doc = readGate();
    expect(doc).toMatch(/[Bb]last-[Rr]adius/);
    expect(doc).toMatch(/PolicyBlocked|policy.*block/i);
  });

  it('control 2: references blast-radius classifier source file', () => {
    expect(readGate()).toMatch(/openclaw-tool-blast-radius-v1/);
  });

  // ── Control 3: Credential and token handling ──────────────────────────────

  it('control 3: references credential/token handling and ADR-0099', () => {
    const doc = readGate();
    expect(doc).toMatch(/[Cc]redential.*[Tt]oken|[Tt]oken.*[Hh]andling/i);
    expect(doc).toMatch(/ADR-0099/);
  });

  it('control 3: references toMachineApiView authConfig stripping', () => {
    const doc = readGate();
    expect(doc).toMatch(/toMachineApiView|authConfig/);
  });

  // ── Control 4: Contract test coverage ────────────────────────────────────

  it('control 4: references contract test coverage', () => {
    const doc = readGate();
    expect(doc).toMatch(/[Cc]ontract [Tt]est/);
    expect(doc).toMatch(/openclaw-gateway-machine-invoker\.test/);
  });

  it('control 4: lists management bridge and drift sync test files', () => {
    const doc = readGate();
    expect(doc).toMatch(/openclaw-management-bridge\.test/);
    expect(doc).toMatch(/openclaw-drift-sync-pipeline\.test/);
  });

  // ── Control 5: Rollback procedure ────────────────────────────────────────

  it('control 5: references rollback runbook', () => {
    const doc = readGate();
    expect(doc).toMatch(/[Rr]ollback [Rr]unbook|rollback-runbook/);
    expect(doc).toMatch(/openclaw-rollback-runbook/);
  });

  it('control 5: lists rollback triggers', () => {
    const doc = readGate();
    expect(doc).toMatch(/[Rr]ollback [Tt]rigger/);
    expect(doc).toMatch(/token.*exposure|exposure.*token/i);
    expect(doc).toMatch(/cross-workspace|cross.workspace/i);
  });

  // ── Control 6: Monitoring and observability ───────────────────────────────

  it('control 6: references monitoring and observability', () => {
    const doc = readGate();
    expect(doc).toMatch(/[Mm]onitoring|[Oo]bservability/);
    expect(doc).toMatch(/correlationId|correlation.id/i);
  });

  it('control 6: references drift sync pipeline', () => {
    expect(readGate()).toMatch(/drift.sync|openclaw-drift-sync/i);
  });

  // ── Release gate criteria section ─────────────────────────────────────────

  it('contains a Release Gate Criteria section', () => {
    expect(readGate()).toContain('Release Gate Criteria');
  });

  it('release gate criteria references ci:pr', () => {
    expect(readGate()).toMatch(/ci:pr/);
  });

  it('release gate criteria references audit:high', () => {
    expect(readGate()).toMatch(/audit:high/);
  });

  // ── Required artifacts table ──────────────────────────────────────────────

  it('lists Required Artifacts section', () => {
    expect(readGate()).toContain('Required Artifacts');
  });

  it('required artifacts reference the gateway machine invoker', () => {
    expect(readGate()).toMatch(/openclaw-gateway-machine-invoker\.ts/);
  });

  it('required artifacts reference the rollback runbook', () => {
    expect(readGate()).toMatch(/openclaw-rollback-runbook\.md/);
  });
});

// ── Rollback runbook ──────────────────────────────────────────────────────────

describe('openclaw-rollback-runbook.md', () => {
  it('document exists at docs/internal/governance/openclaw-rollback-runbook.md', () => {
    expect(fs.existsSync(ROLLBACK_RUNBOOK)).toBe(true);
  });

  it('is tagged with bead-0803', () => {
    expect(readRollback()).toContain('bead-0803');
  });

  it('defines rollback scope levels (L1, L2, L3)', () => {
    const doc = readRollback();
    expect(doc).toMatch(/L1/);
    expect(doc).toMatch(/L2/);
    expect(doc).toMatch(/L3/);
  });

  it('trigger 1: documents token exposure rollback', () => {
    const doc = readRollback();
    expect(doc).toMatch(/[Tt]oken [Ee]xposure|token.*exposure/i);
    expect(doc).toMatch(/ADR-0099|toMachineApiView/);
  });

  it('trigger 2: documents cross-workspace data access rollback', () => {
    const doc = readRollback();
    expect(doc).toMatch(/[Cc]ross-[Ww]orkspace|cross.workspace/i);
    expect(doc).toMatch(/tenantId/);
  });

  it('trigger 3: documents PolicyBlocked bypass rollback', () => {
    const doc = readRollback();
    expect(doc).toMatch(/PolicyBlocked|policy.*bypass/i);
    expect(doc).toMatch(/ManualOnly|Dangerous/);
  });

  it('trigger 4: documents release gate contract test failure rollback', () => {
    const doc = readRollback();
    expect(doc).toMatch(/[Rr]elease [Gg]ate|openclaw-release-gate/);
    expect(doc).toMatch(/contract.*test|test.*fail/i);
  });

  it('trigger 5: documents drift sync failure rollback', () => {
    const doc = readRollback();
    expect(doc).toMatch(/[Dd]rift [Ss]ync/);
    expect(doc).toMatch(/BridgeOperationResult/);
  });

  it('defines acceptance criteria for rollback completion', () => {
    expect(readRollback()).toMatch(/[Aa]cceptance/);
  });

  it('references provisioning runbook for re-provisioning', () => {
    expect(readRollback()).toMatch(/provisioning.runbook|openclaw-workspace-gateway-provisioning/i);
  });
});

// ── Release gate spec ─────────────────────────────────────────────────────────

describe('openclaw-release-gate-v1.md spec', () => {
  it('spec exists at .specify/specs/openclaw-release-gate-v1.md', () => {
    expect(fs.existsSync(RELEASE_GATE_SPEC)).toBe(true);
  });

  it('spec is tagged with bead-0803', () => {
    const spec = fs.readFileSync(RELEASE_GATE_SPEC, 'utf8');
    expect(spec).toContain('bead-0803');
  });
});

// ── Source artifact existence ─────────────────────────────────────────────────

describe('OpenClaw source artifact existence', () => {
  const OPENCLAW_INFRA = path.join(ROOT, 'src/infrastructure/openclaw');
  const OPENCLAW_DOMAIN = path.join(ROOT, 'src/domain/machines');

  it('openclaw-gateway-machine-invoker.ts exists', () => {
    expect(fs.existsSync(path.join(OPENCLAW_INFRA, 'openclaw-gateway-machine-invoker.ts'))).toBe(
      true,
    );
  });

  it('openclaw-management-bridge.ts exists', () => {
    expect(fs.existsSync(path.join(OPENCLAW_INFRA, 'openclaw-management-bridge.ts'))).toBe(true);
  });

  it('openclaw-drift-sync-pipeline.ts exists', () => {
    expect(fs.existsSync(path.join(OPENCLAW_INFRA, 'openclaw-drift-sync-pipeline.ts'))).toBe(true);
  });

  it('openclaw-http-error-policy.ts exists', () => {
    expect(fs.existsSync(path.join(OPENCLAW_INFRA, 'openclaw-http-error-policy.ts'))).toBe(true);
  });

  it('openclaw-operator-management-bridge.ts exists', () => {
    expect(fs.existsSync(path.join(OPENCLAW_INFRA, 'openclaw-operator-management-bridge.ts'))).toBe(
      true,
    );
  });

  it('openclaw-tool-blast-radius-v1.ts exists', () => {
    expect(fs.existsSync(path.join(OPENCLAW_DOMAIN, 'openclaw-tool-blast-radius-v1.ts'))).toBe(
      true,
    );
  });

  it('openclaw-agent-binding-v1.ts exists', () => {
    expect(fs.existsSync(path.join(OPENCLAW_DOMAIN, 'openclaw-agent-binding-v1.ts'))).toBe(true);
  });
});

// ── Test artifact existence ───────────────────────────────────────────────────

describe('OpenClaw test artifact existence', () => {
  const OPENCLAW_INFRA = path.join(ROOT, 'src/infrastructure/openclaw');
  const OPENCLAW_DOMAIN = path.join(ROOT, 'src/domain/machines');

  it('openclaw-gateway-machine-invoker.test.ts exists', () => {
    expect(
      fs.existsSync(path.join(OPENCLAW_INFRA, 'openclaw-gateway-machine-invoker.test.ts')),
    ).toBe(true);
  });

  it('openclaw-gateway-machine-invoker.integration.test.ts exists', () => {
    expect(
      fs.existsSync(
        path.join(OPENCLAW_INFRA, 'openclaw-gateway-machine-invoker.integration.test.ts'),
      ),
    ).toBe(true);
  });

  it('openclaw-http-error-policy.contract.test.ts exists', () => {
    expect(
      fs.existsSync(path.join(OPENCLAW_INFRA, 'openclaw-http-error-policy.contract.test.ts')),
    ).toBe(true);
  });

  it('openclaw-management-bridge.test.ts exists', () => {
    expect(fs.existsSync(path.join(OPENCLAW_INFRA, 'openclaw-management-bridge.test.ts'))).toBe(
      true,
    );
  });

  it('openclaw-drift-sync-pipeline.test.ts exists', () => {
    expect(fs.existsSync(path.join(OPENCLAW_INFRA, 'openclaw-drift-sync-pipeline.test.ts'))).toBe(
      true,
    );
  });

  it('openclaw-tool-blast-radius-v1.test.ts exists', () => {
    expect(fs.existsSync(path.join(OPENCLAW_DOMAIN, 'openclaw-tool-blast-radius-v1.test.ts'))).toBe(
      true,
    );
  });

  it('openclaw-agent-binding-v1.test.ts exists', () => {
    expect(fs.existsSync(path.join(OPENCLAW_DOMAIN, 'openclaw-agent-binding-v1.test.ts'))).toBe(
      true,
    );
  });
});

// ── Governance and spec artifact existence ────────────────────────────────────

describe('OpenClaw governance artifact existence', () => {
  it('ADR-0072 exists', () => {
    expect(
      fs.existsSync(
        path.join(ROOT, 'docs/internal/adr/0072-openclaw-gateway-multi-tenant-isolation.md'),
      ),
    ).toBe(true);
  });

  it('ADR-0099 exists', () => {
    expect(
      fs.existsSync(
        path.join(
          ROOT,
          'docs/internal/adr/ADR-0099-openclaw-gateway-token-browser-exposure-prevention.md',
        ),
      ),
    ).toBe(true);
  });

  it('openclaw-workspace-gateway-provisioning-runbook.md exists', () => {
    expect(
      fs.existsSync(
        path.join(
          ROOT,
          'docs/internal/governance/openclaw-workspace-gateway-provisioning-runbook.md',
        ),
      ),
    ).toBe(true);
  });

  it('openclaw-tool-blast-radius-policy.md exists', () => {
    expect(
      fs.existsSync(
        path.join(ROOT, 'docs/internal/governance/openclaw-tool-blast-radius-policy.md'),
      ),
    ).toBe(true);
  });

  it('openclaw-gateway-workspace-isolation-v1.md spec exists', () => {
    expect(
      fs.existsSync(path.join(ROOT, '.specify/specs/openclaw-gateway-workspace-isolation-v1.md')),
    ).toBe(true);
  });

  it('openclaw-gateway-machine-invoker-v1.md spec exists', () => {
    expect(
      fs.existsSync(path.join(ROOT, '.specify/specs/openclaw-gateway-machine-invoker-v1.md')),
    ).toBe(true);
  });

  it('openclaw-tools-invoke-client-v1.md spec exists', () => {
    expect(
      fs.existsSync(path.join(ROOT, '.specify/specs/openclaw-tools-invoke-client-v1.md')),
    ).toBe(true);
  });
});
