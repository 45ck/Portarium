#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const workspaceDir = resolve(process.env['MICRO_SAAS_WORKSPACE_DIR'] ?? process.cwd());
const statePath = resolve(workspaceDir, args.state ?? 'stubs/social-state.json');
const draftsPath = resolve(workspaceDir, args.drafts ?? 'outputs/social-drafts.json');
const state = readJson(statePath);
const drafts = readJson(draftsPath);

if (!Array.isArray(drafts)) {
  throw new Error('social drafts file must be a JSON array');
}

const channelIds = new Set(
  Array.isArray(state.channels) ? state.channels.map((channel) => String(channel.channelId)) : [],
);

state.queuedPosts = Array.isArray(state.queuedPosts) ? state.queuedPosts : [];

for (const [index, draft] of drafts.entries()) {
  const channelId = String(draft.channelId ?? '');
  if (!channelIds.has(channelId)) {
    throw new Error(`Unknown social channel: ${channelId}`);
  }
  state.queuedPosts.push({
    postId: `post-${Date.now()}-${index + 1}`,
    channelId,
    caption: String(draft.caption ?? ''),
    cta: String(draft.cta ?? ''),
    status: 'queued',
    queuedVia: 'queue-social.mjs',
    queuedAt: new Date().toISOString(),
  });
}

writeJson(statePath, state);

console.log(
  ['MICRO_SAAS_TOOL queue-social', `drafts=${String(drafts.length)}`, `state="${statePath}"`].join(
    ' ',
  ),
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
