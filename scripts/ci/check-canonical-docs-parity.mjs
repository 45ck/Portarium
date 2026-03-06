#!/usr/bin/env node
import {
  readCanonicalParserModules,
  readDocsCanonicalRows,
  readDocsDeclaredCount,
} from './canonical-parity-utils.mjs';

const wantsJson = process.argv.includes('--json');
const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');

if (wantsHelp) {
  console.log('check-canonical-docs-parity');
  console.log('Usage: node scripts/ci/check-canonical-docs-parity.mjs [--json] [--help]');
  console.log('Validates canonical docs inventory against parser modules on disk.');
  process.exit(0);
}

function finish(status, payload) {
  if (wantsJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(payload.message);
  }
  process.exit(status === 'ok' ? 0 : 1);
}

const canonicalModules = readCanonicalParserModules();
const expectedRuntimeContracts = [...canonicalModules, 'external-object-ref.ts'].sort();
const docsRows = readDocsCanonicalRows();
const docsRuntimeContracts = docsRows.map((row) => row.runtimeContract).sort();
const declaredCount = readDocsDeclaredCount();

const missingFromDocs = expectedRuntimeContracts.filter(
  (name) => !docsRuntimeContracts.includes(name),
);
const extraInDocs = docsRuntimeContracts.filter((name) => !expectedRuntimeContracts.includes(name));

if (
  declaredCount !== expectedRuntimeContracts.length ||
  missingFromDocs.length > 0 ||
  extraInDocs.length > 0
) {
  finish('fail', {
    status: 'fail',
    script: 'check-canonical-docs-parity',
    message: 'Canonical docs parity drift detected.',
    declaredCount,
    expectedCount: expectedRuntimeContracts.length,
    missingFromDocs,
    extraInDocs,
  });
}

finish('ok', {
  status: 'ok',
  script: 'check-canonical-docs-parity',
  message: `Canonical docs parity OK: ${docsRuntimeContracts.length} runtime contract row(s) aligned with the declared ${declaredCount}-member set.`,
  runtimeContracts: docsRuntimeContracts,
});
