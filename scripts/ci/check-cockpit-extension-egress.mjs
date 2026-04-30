#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, '../..');
const extensionRoot = resolve(repoRoot, 'apps/cockpit/src/lib/extensions');
const sourceExtensions = new Set(['.ts', '.tsx']);
const ignoredPathParts = ['.test.', '.stories.', '.d.ts'];

const routeEgressPatterns = [
  ['raw fetch()', /\bfetch\s*\(/g],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/g],
  ['WebSocket', /\bWebSocket\b/g],
  ['EventSource', /\bEventSource\b/g],
  ['navigator.sendBeacon', /\bnavigator\s*\.\s*sendBeacon\s*\(/g],
  ['window.open', /\bwindow\s*\.\s*open\s*\(/g],
  ['window.location mutation', /\bwindow\s*\.\s*location\s*(?:=|\.assign\s*\(|\.replace\s*\()/g],
  ['URL.createObjectURL', /\bURL\s*\.\s*createObjectURL\s*\(/g],
  ['new URL()', /\bnew\s+URL\s*\(/g],
  ['new Worker()', /\bnew\s+Worker\s*\(/g],
  ['new SharedWorker()', /\bnew\s+SharedWorker\s*\(/g],
  ['service worker registration', /\bnavigator\s*\.\s*serviceWorker\s*\.\s*register\s*\(/g],
  ['new Image()', /\bnew\s+Image\s*\(/g],
  ['programmatic form creation', /\bdocument\s*\.\s*createElement\s*\(\s*['"]form['"]\s*\)/g],
];

const forbiddenHelperImportPattern =
  /from\s+['"](?:@\/lib\/fetch-json|@\/lib\/control-plane-client)['"]/g;
const externalUrlLiteralPattern = /['"`](?:https?:\/\/|wss?:\/\/)[^'"`]*['"`]/g;
const dynamicImportPattern = /import\s*\(\s*([^)]*)\)/g;
const staticStringPattern = /^(['"`])(.+)\1$/s;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      out.push(...walk(fullPath));
      continue;
    }
    if (sourceExtensions.has(extname(fullPath))) out.push(fullPath);
  }
  return out;
}

function toPosix(path) {
  return path.replaceAll('\\', '/');
}

function repoRelative(path) {
  return toPosix(relative(repoRoot, path));
}

function extensionRelative(path) {
  return toPosix(relative(extensionRoot, path));
}

function isScannedExtensionFile(path) {
  const rel = extensionRelative(path);
  if (ignoredPathParts.some((part) => rel.includes(part))) return false;

  return (
    /(^|\/)routes\/.+\.(ts|tsx)$/.test(rel) ||
    rel.endsWith('/route-loaders.ts') ||
    rel.endsWith('/manifest.ts')
  );
}

function isRouteModule(path) {
  return /(^|\/)routes\/.+\.(ts|tsx)$/.test(extensionRelative(path));
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function addPatternOffenders(offenders, filePath, content, pattern, reason) {
  pattern.lastIndex = 0;
  for (const match of content.matchAll(pattern)) {
    offenders.push({
      file: repoRelative(filePath),
      line: lineNumberAt(content, match.index ?? 0),
      reason,
      evidence: match[0].trim(),
    });
  }
}

function collectDynamicImportOffenders(offenders, filePath, content) {
  dynamicImportPattern.lastIndex = 0;
  for (const match of content.matchAll(dynamicImportPattern)) {
    const expression = (match[1] ?? '').trim();
    const staticMatch = expression.match(staticStringPattern);
    const importedPath = staticMatch?.[2];
    if (importedPath?.startsWith('./') || importedPath?.startsWith('../')) continue;

    offenders.push({
      file: repoRelative(filePath),
      line: lineNumberAt(content, match.index ?? 0),
      reason: 'non-relative or computed dynamic import',
      evidence: match[0].trim(),
    });
  }
}

const scannedFiles = walk(extensionRoot).filter(isScannedExtensionFile);
const offenders = [];

for (const filePath of scannedFiles) {
  const content = readFileSync(filePath, 'utf8');

  addPatternOffenders(
    offenders,
    filePath,
    content,
    externalUrlLiteralPattern,
    'absolute external URL literal in installed extension code',
  );
  collectDynamicImportOffenders(offenders, filePath, content);

  if (!isRouteModule(filePath)) continue;

  addPatternOffenders(
    offenders,
    filePath,
    content,
    forbiddenHelperImportPattern,
    'direct host network helper import; use a host-provided extension API facade',
  );

  for (const [reason, pattern] of routeEgressPatterns) {
    addPatternOffenders(offenders, filePath, content, pattern, reason);
  }
}

if (offenders.length > 0) {
  console.error(
    'Cockpit extension egress check failed: installed extension browser code must not declare direct external origins or unmanaged browser egress.',
  );
  for (const offender of offenders) {
    console.error(` - ${offender.file}:${offender.line} ${offender.reason} (${offender.evidence})`);
  }
  process.exit(1);
}

console.log(
  `[cockpit-extension-egress] PASS - scanned ${scannedFiles.length} installed extension source files.`,
);
