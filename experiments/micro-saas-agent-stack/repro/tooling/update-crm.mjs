#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const workspaceDir = resolve(process.env['MICRO_SAAS_WORKSPACE_DIR'] ?? process.cwd());
const statePath = resolve(workspaceDir, args.state ?? 'stubs/crm-state.json');
const prospectId = args['prospect-id'] ?? 'lead-001';
const status = args.status ?? 'outreach_queued';

const state = readJson(statePath);
state.prospects = Array.isArray(state.prospects) ? state.prospects : [];
state.history = Array.isArray(state.history) ? state.history : [];

const prospect = state.prospects.find((item) => String(item.prospectId) === prospectId);
if (!prospect) {
  throw new Error(`Unknown prospect: ${prospectId}`);
}

prospect.status = status;
prospect.updatedAt = new Date().toISOString();

state.history.push({
  type: 'crm_status_updated',
  prospectId,
  status,
  updatedVia: 'update-crm.mjs',
  at: new Date().toISOString(),
});

writeJson(statePath, state);

console.log(
  ['MICRO_SAAS_TOOL update-crm', `prospectId="${prospectId}"`, `status="${status}"`].join(' '),
);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = 'true';
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
