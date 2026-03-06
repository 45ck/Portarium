#!/usr/bin/env node
import {
  readCanonicalBarrelModules,
  readCanonicalParserModules,
  readSpecParserModules,
} from './canonical-parity-utils.mjs';

const wantsJson = process.argv.includes('--json');
const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');

if (wantsHelp) {
  console.log('check-canonical-spec-parity');
  console.log('Usage: node scripts/ci/check-canonical-spec-parity.mjs [--json] [--help]');
  console.log('Validates canonical parser inventory against the spec and canonical barrel.');
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
const specModules = [...readSpecParserModules()].sort();
const barrelModules = readCanonicalBarrelModules();
const expectedBarrelModules = [
  'external-object-ref',
  ...canonicalModules.map((filename) => filename.replace(/\.ts$/, '')),
].sort();

const missingFromSpec = canonicalModules.filter((name) => !specModules.includes(name));
const extraInSpec = specModules.filter((name) => !canonicalModules.includes(name));
const missingFromBarrel = expectedBarrelModules.filter((name) => !barrelModules.includes(name));
const extraInBarrel = barrelModules.filter((name) => !expectedBarrelModules.includes(name));

if (
  missingFromSpec.length > 0 ||
  extraInSpec.length > 0 ||
  missingFromBarrel.length > 0 ||
  extraInBarrel.length > 0
) {
  finish('fail', {
    status: 'fail',
    script: 'check-canonical-spec-parity',
    message: 'Canonical spec or barrel parity drift detected.',
    missingFromSpec,
    extraInSpec,
    missingFromBarrel,
    extraInBarrel,
  });
}

finish('ok', {
  status: 'ok',
  script: 'check-canonical-spec-parity',
  message: `Canonical spec parity OK: ${canonicalModules.length} parser module(s) and ${expectedBarrelModules.length} barrel export(s) aligned.`,
  canonicalModules,
  barrelModules,
});
