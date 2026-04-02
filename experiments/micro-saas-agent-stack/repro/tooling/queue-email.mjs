#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const workspaceDir = resolve(process.env['MICRO_SAAS_WORKSPACE_DIR'] ?? process.cwd());
const statePath = resolve(workspaceDir, args.state ?? 'stubs/email-state.json');
const crmPath = resolve(workspaceDir, args.crm ?? 'stubs/crm-state.json');
const draftPath = resolve(workspaceDir, args.draft ?? 'outputs/email-draft.md');
const prospectId = args['prospect-id'] ?? 'lead-001';

const state = readJson(statePath);
const crm = readJson(crmPath);
const draft = readFileSync(draftPath, 'utf8');
const subject = args.subject ?? inferSubject(draft);
const messageId = `email-${Date.now()}`;

state.outbox = Array.isArray(state.outbox) ? state.outbox : [];
state.outbox.push({
  messageId,
  prospectId,
  subject,
  status: 'queued',
  delivery: 'queue-only',
  queuedVia: 'queue-email.mjs',
  queuedAt: new Date().toISOString(),
  draftPath: normalizeWorkspacePath(workspaceDir, draftPath),
});

crm.prospects = Array.isArray(crm.prospects) ? crm.prospects : [];
crm.history = Array.isArray(crm.history) ? crm.history : [];

const prospect = crm.prospects.find((item) => String(item.prospectId) === prospectId);
if (prospect) {
  prospect.lastQueuedMessageId = messageId;
}

crm.history.push({
  type: 'email_queued',
  prospectId,
  messageId,
  at: new Date().toISOString(),
  queuedVia: 'queue-email.mjs',
});

writeJson(statePath, state);
writeJson(crmPath, crm);

console.log(
  [
    'MICRO_SAAS_TOOL queue-email',
    `messageId="${messageId}"`,
    `prospectId="${prospectId}"`,
    `subject="${subject}"`,
  ].join(' '),
);

function inferSubject(draft) {
  const lines = draft
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[0]?.replace(/^#+\s*/, '') ?? 'Prompt Review Copilot follow-up';
}

function normalizeWorkspacePath(workspaceDir, absolutePath) {
  const prefix = workspaceDir.endsWith('\\') ? workspaceDir : `${workspaceDir}\\`;
  return absolutePath.startsWith(prefix)
    ? absolutePath.slice(prefix.length).replace(/\\/g, '/')
    : absolutePath;
}

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
