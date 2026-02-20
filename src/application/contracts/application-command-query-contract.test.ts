import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { APP_ACTIONS } from '../common/actions.js';
import {
  APPLICATION_CONTRACT_SPEC_PATH,
  APPLICATION_OPERATION_CONTRACTS,
  APPLICATION_SCHEMA_GOLDEN_PATH,
  type ActionKey,
  type OperationKind,
} from './application-command-query-contract.fixture.js';

function resolveRepoRoot(): string {
  const thisFilePath = fileURLToPath(import.meta.url);
  const thisDir = path.dirname(thisFilePath);
  return path.resolve(thisDir, '../../..');
}

function escapeRegExp(input: string): string {
  return input.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectMatches(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => match[1] ?? '');
}

function parseIndexModules(indexText: string): string[] {
  const modules = collectMatches(indexText, /export \* from '\.\/([^']+)\.js';/g);
  return modules.filter((entry) => entry !== 'bus').sort((a, b) => a.localeCompare(b));
}

function modulePathFromSourcePath(kind: OperationKind, sourcePath: string): string {
  const prefix = kind === 'command' ? 'src/application/commands/' : 'src/application/queries/';
  if (!sourcePath.startsWith(prefix) || !sourcePath.endsWith('.ts')) {
    throw new Error(`Unexpected source path: ${sourcePath}`);
  }
  return sourcePath.slice(prefix.length, -'.ts'.length);
}

function normalizeType(typeText: string): string {
  return typeText.replaceAll(/\s+/g, ' ').trim();
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function readTypeAliases(sourcePath: string, sourceText: string): ReadonlyMap<string, string> {
  const sourceFile = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true);
  const aliases = new Map<string, string>();

  sourceFile.forEachChild((node) => {
    if (ts.isTypeAliasDeclaration(node)) {
      aliases.set(node.name.text, normalizeType(node.type.getText(sourceFile)));
    }
  });

  return aliases;
}

function requireAlias(
  aliases: ReadonlyMap<string, string>,
  aliasName: string,
  sourcePath: string,
): string {
  const alias = aliases.get(aliasName);
  if (alias === undefined) {
    throw new Error(`Missing type alias ${aliasName} in ${sourcePath}`);
  }
  return alias;
}

describe('Application command/query contract surface', () => {
  it('keeps registry aligned with command/query index exports', async () => {
    const repoRoot = resolveRepoRoot();
    const commandIndex = parseIndexModules(
      await readFile(path.join(repoRoot, 'src/application/commands/index.ts'), 'utf8'),
    );
    const queryIndex = parseIndexModules(
      await readFile(path.join(repoRoot, 'src/application/queries/index.ts'), 'utf8'),
    );

    const commandModules = [
      ...new Set(
        APPLICATION_OPERATION_CONTRACTS.filter((entry) => entry.kind === 'command').map((entry) =>
          modulePathFromSourcePath('command', entry.sourcePath),
        ),
      ),
    ].sort((a, b) => a.localeCompare(b));
    const queryModules = [
      ...new Set(
        APPLICATION_OPERATION_CONTRACTS.filter((entry) => entry.kind === 'query').map((entry) =>
          modulePathFromSourcePath('query', entry.sourcePath),
        ),
      ),
    ].sort((a, b) => a.localeCompare(b));

    expect(commandModules).toEqual(commandIndex);
    expect(queryModules).toEqual(queryIndex);
  });

  it('enforces authorization action and Forbidden.action alignment per source file', async () => {
    const actionBySource = new Map<string, ActionKey>();
    for (const operation of APPLICATION_OPERATION_CONTRACTS) {
      const existing = actionBySource.get(operation.sourcePath);
      if (existing === undefined) {
        actionBySource.set(operation.sourcePath, operation.actionKey);
        continue;
      }
      expect(existing).toBe(operation.actionKey);
    }

    const repoRoot = resolveRepoRoot();
    for (const [sourcePath, actionKey] of actionBySource) {
      const sourceText = await readFile(path.join(repoRoot, sourcePath), 'utf8');
      const isAllowedActions = collectMatches(
        sourceText,
        /isAllowed\s*\(\s*ctx\s*,\s*APP_ACTIONS\.(\w+)\s*\)/g,
      );
      const forbiddenActions = collectMatches(sourceText, /action\s*:\s*APP_ACTIONS\.(\w+)/g);

      expect(isAllowedActions.length).toBeGreaterThan(0);
      expect(forbiddenActions.length).toBeGreaterThan(0);

      expect(new Set(isAllowedActions)).toEqual(new Set([actionKey]));
      expect(new Set(forbiddenActions)).toEqual(new Set([actionKey]));
    }
  });

  it('requires every operation row in .specify application contract spec', async () => {
    const repoRoot = resolveRepoRoot();
    const specText = await readFile(path.join(repoRoot, APPLICATION_CONTRACT_SPEC_PATH), 'utf8');

    for (const operation of APPLICATION_OPERATION_CONTRACTS) {
      const rowPattern = new RegExp(
        `\\|\\s*\`${operation.kind}\`\\s*\\|\\s*\`${operation.name}\`\\s*\\|\\s*\`${escapeRegExp(APP_ACTIONS[operation.actionKey])}\`\\s*\\|\\s*\`${escapeRegExp(operation.sourcePath)}\`\\s*\\|\\s*\`${operation.types.input}\`\\s*\\|\\s*\`${operation.types.output}\`\\s*\\|\\s*\`${operation.types.error}\`\\s*\\|`,
      );
      expect(specText).toMatch(rowPattern);
    }
  });

  it('matches schema signature golden for input/output/error type aliases', async () => {
    const repoRoot = resolveRepoRoot();

    const sourceCache = new Map<string, string>();
    const aliasCache = new Map<string, ReadonlyMap<string, string>>();
    for (const operation of APPLICATION_OPERATION_CONTRACTS) {
      if (!sourceCache.has(operation.sourcePath)) {
        sourceCache.set(
          operation.sourcePath,
          await readFile(path.join(repoRoot, operation.sourcePath), 'utf8'),
        );
      }
      if (!aliasCache.has(operation.sourcePath)) {
        aliasCache.set(
          operation.sourcePath,
          readTypeAliases(operation.sourcePath, sourceCache.get(operation.sourcePath)!),
        );
      }
    }

    const currentSignature = {
      schemaVersion: 1,
      specPath: APPLICATION_CONTRACT_SPEC_PATH,
      operationCount: APPLICATION_OPERATION_CONTRACTS.length,
      operations: APPLICATION_OPERATION_CONTRACTS.map((operation) => {
        const aliases = aliasCache.get(operation.sourcePath)!;
        const inputType = requireAlias(aliases, operation.types.input, operation.sourcePath);
        const outputType = requireAlias(aliases, operation.types.output, operation.sourcePath);
        const errorType = requireAlias(aliases, operation.types.error, operation.sourcePath);

        return {
          kind: operation.kind,
          name: operation.name,
          sourcePath: operation.sourcePath,
          action: APP_ACTIONS[operation.actionKey],
          types: {
            input: {
              name: operation.types.input,
              sha256: sha256(inputType),
            },
            output: {
              name: operation.types.output,
              sha256: sha256(outputType),
            },
            error: {
              name: operation.types.error,
              sha256: sha256(errorType),
            },
          },
        };
      }),
    } as const;

    const golden = JSON.parse(
      await readFile(path.join(repoRoot, APPLICATION_SCHEMA_GOLDEN_PATH), 'utf8'),
    ) as unknown;
    expect(golden).toEqual(currentSignature);
  });
});
