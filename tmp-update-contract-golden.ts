import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

import { APP_ACTIONS } from './src/application/common/actions.js';
import {
  APPLICATION_CONTRACT_SPEC_PATH,
  APPLICATION_OPERATION_CONTRACTS,
  APPLICATION_SCHEMA_GOLDEN_PATH,
} from './src/application/contracts/application-command-query-contract.fixture.js';

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

const repoRoot = process.cwd();
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
    const inputType = aliases.get(operation.types.input);
    const outputType = aliases.get(operation.types.output);
    const errorType = aliases.get(operation.types.error);
    if (!inputType || !outputType || !errorType) {
      throw new Error(`Missing alias for ${operation.name} in ${operation.sourcePath}`);
    }

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

await writeFile(
  path.join(repoRoot, APPLICATION_SCHEMA_GOLDEN_PATH),
  `${JSON.stringify(currentSignature, null, 2)}\n`,
  'utf8',
);

console.log(`Updated ${APPLICATION_SCHEMA_GOLDEN_PATH}`);
