import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const CHECK_CANONICAL_SPEC_PARITY = fileURLToPath(
  new URL('../../../scripts/ci/check-canonical-spec-parity.mjs', import.meta.url),
);
const CHECK_CANONICAL_DOCS_PARITY = fileURLToPath(
  new URL('../../../scripts/ci/check-canonical-docs-parity.mjs', import.meta.url),
);
const CHECK_CANONICAL_PARITY = fileURLToPath(
  new URL('../../../scripts/ci/check-canonical-parity.mjs', import.meta.url),
);

const tempRepos: string[] = [];

function createTempRepo(overrides?: {
  spec?: string;
  docs?: string;
  canonicalFiles?: string[];
  index?: string;
}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'portarium-canonical-parity-'));
  tempRepos.push(repo);

  fs.mkdirSync(path.join(repo, '.specify', 'specs'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'docs', 'domain'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'src', 'domain', 'canonical'), { recursive: true });

  const canonicalFiles = overrides?.canonicalFiles ?? [
    'party-v1.ts',
    'consent-v1.ts',
    'privacy-policy-v1.ts',
  ];
  for (const filename of canonicalFiles) {
    fs.writeFileSync(
      path.join(repo, 'src', 'domain', 'canonical', filename),
      'export const stub = true;\n',
    );
  }
  fs.writeFileSync(
    path.join(repo, 'src', 'domain', 'canonical', 'index.ts'),
    overrides?.index ??
      [
        "export * from './external-object-ref.js';",
        "export * from './consent-v1.js';",
        "export * from './party-v1.js';",
        "export * from './privacy-policy-v1.js';",
        '',
      ].join('\n'),
  );

  fs.writeFileSync(
    path.join(repo, '.specify', 'specs', 'canonical-objects-v1.md'),
    overrides?.spec ??
      [
        '- `src/domain/canonical/consent-v1.ts`',
        '- `src/domain/canonical/party-v1.ts`',
        '- `src/domain/canonical/privacy-policy-v1.ts`',
        '',
      ].join('\n'),
  );

  fs.writeFileSync(
    path.join(repo, 'docs', 'domain', 'canonical-objects.md'),
    overrides?.docs ??
      [
        '> The 4-member canonical object set with rationale.',
        '',
        '## The Canonical Set',
        '',
        '| Canonical Object | Runtime Contract (`src/domain/canonical`) | Key Runtime Fields |',
        '| --- | --- | --- |',
        '| **Party** | `party-v1.ts` (`PartyV1`) | `partyId` |',
        '| **Consent** | `consent-v1.ts` (`ConsentV1`) | `consentId` |',
        '| **Privacy Policy** | `privacy-policy-v1.ts` (`PrivacyPolicyV1`) | `privacyPolicyId` |',
        '| **ExternalObjectRef** | `external-object-ref.ts` (`ExternalObjectRef`) | `externalId` |',
        '',
      ].join('\n'),
  );

  return repo;
}

function run(script: string, repo: string) {
  return spawnSync(process.execPath, [script, '--json'], {
    cwd: repo,
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const repo of tempRepos.splice(0)) {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

describe('canonical parity scripts', () => {
  it('passes when the spec, barrel, docs, and parser files are aligned', () => {
    const repo = createTempRepo();

    const specParity = run(CHECK_CANONICAL_SPEC_PARITY, repo);
    const docsParity = run(CHECK_CANONICAL_DOCS_PARITY, repo);
    const parity = run(CHECK_CANONICAL_PARITY, repo);

    expect(specParity.status).toBe(0);
    expect(docsParity.status).toBe(0);
    expect(parity.status).toBe(0);
  });

  it('fails spec parity when the canonical barrel omits a parser module', () => {
    const repo = createTempRepo({
      index: [
        "export * from './external-object-ref.js';",
        "export * from './party-v1.js';",
        "export * from './privacy-policy-v1.js';",
        '',
      ].join('\n'),
    });

    const result = run(CHECK_CANONICAL_SPEC_PARITY, repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"missingFromBarrel"');
    expect(result.stdout).toContain('consent-v1');
  });

  it('fails docs parity when the declared set count drifts from runtime contracts', () => {
    const repo = createTempRepo({
      docs: [
        '> The 3-member canonical object set with rationale.',
        '',
        '## The Canonical Set',
        '',
        '| Canonical Object | Runtime Contract (`src/domain/canonical`) | Key Runtime Fields |',
        '| --- | --- | --- |',
        '| **Party** | `party-v1.ts` (`PartyV1`) | `partyId` |',
        '| **Consent** | `consent-v1.ts` (`ConsentV1`) | `consentId` |',
        '| **Privacy Policy** | `privacy-policy-v1.ts` (`PrivacyPolicyV1`) | `privacyPolicyId` |',
        '| **ExternalObjectRef** | `external-object-ref.ts` (`ExternalObjectRef`) | `externalId` |',
        '',
      ].join('\n'),
    });

    const result = run(CHECK_CANONICAL_DOCS_PARITY, repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"declaredCount": 3');
    expect(result.stdout).toContain('"expectedCount": 4');
  });
});
