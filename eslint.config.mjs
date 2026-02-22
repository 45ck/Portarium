import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import sonarjs from 'eslint-plugin-sonarjs';
import eslintComments from 'eslint-plugin-eslint-comments';
import unicorn from 'eslint-plugin-unicorn';
import unusedImports from 'eslint-plugin-unused-imports';
import nPlugin from 'eslint-plugin-n';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.tsbuildinfo/**',
      '**/reports/**',
      '**/research/sources/**',
      '**/domain-atlas/upstreams/**',
      '**/_tmp_bd/**',
      // Git worktrees for parallel bead agents — not production code
      '.trees/**',
      'package/**',
      '**/vendor/**',
      '**/.specify/**/generated/**',
      // apps/ workspaces have their own tsconfig and lint setup
      'apps/**',
      // Templates, examples, and scaffolds are developer-facing starter code, not production
      'templates/**',
      'examples/**',
      'scaffolds/**',
      // QA automation scripts — not production code
      'qa/**',
      // Asset generation scripts use optional native deps (sharp) not in devDependencies
      'scripts/assets/**',
      // UI capture scripts — not production
      'docs/ui/cockpit/screenshots/**',
      // Scratch/generator scripts left from interactive sessions
      'tmp_*.{js,cjs,mjs,py,ts}',
      'tmp-*.{js,cjs,mjs,py,ts}',
      'gen*.{js,cjs,mjs,py}',
      'gb*.{js,cjs,mjs}',
      'build_gen*.{js,cjs,mjs}',
    ],
  },

  js.configs.recommended,

  ...tseslint.configs.recommendedTypeChecked.map((c) => ({
    ...c,
    files: ['**/*.{ts,tsx,mts,cts}'],
  })),
  ...tseslint.configs.stylisticTypeChecked.map((c) => ({
    ...c,
    files: ['**/*.{ts,tsx,mts,cts}'],
  })),

  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      import: importPlugin,
      sonarjs,
      'eslint-comments': eslintComments,
      unicorn,
      'unused-imports': unusedImports,
      n: nPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.json'],
        },
        // node fallback: resolves packages that the TypeScript resolver misses
        // (e.g. when node_modules is a junction/symlink on Windows in worktrees)
        node: true,
      },
    },
    rules: {
      // Complexity & size caps
      complexity: ['error', 10],
      'max-depth': ['error', 4],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 350, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', 4],

      // Cognitive complexity
      'sonarjs/cognitive-complexity': ['error', 15],

      // Import hygiene
      'import/no-cycle': ['error', { maxDepth: 1 }],
      'import/no-unresolved': 'error',

      // Dead imports
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],
      // Disallow inline suppression. If a rule is wrong, fix the code or change the rule with an ADR.
      'eslint-comments/no-use': 'error',
    },
  },

  // TypeScript-only rules that require type information.
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],

      // Maintainability: ban unsafe escape hatches
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 5,
        },
      ],
    },
  },

  // Tests can be longer/more verbose; keep production caps strict.
  // Mock port implementations idiomatically use async without await, unbound method
  // references (expect(obj.method)), and type-unsafe mocks — all standard Vitest patterns.
  {
    files: ['**/*.test.ts'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // Scripts are production-critical, but allow more complexity and length than core code.
  {
    files: ['scripts/**/*.mjs'],
    rules: {
      complexity: 'off',
      'max-depth': 'off',
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      'max-params': 'off',
      'sonarjs/cognitive-complexity': 'off',
    },
  },

  // In-memory adapter implementations are test doubles for external services.
  // They route many operations through a single switch and legitimately need
  // higher complexity/size budgets. require-await is off because they fulfil
  // async port contracts without real I/O.
  {
    files: ['src/infrastructure/adapters/**/in-memory-*.ts'],
    rules: {
      complexity: 'off',
      'max-depth': 'off',
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      'max-params': 'off',
      'sonarjs/cognitive-complexity': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },

  // Reference adapter implementations talk to real external services.
  // They dispatch across many operations through a single execute() method and
  // legitimately need higher complexity/size budgets.
  // String coercion via String() on Record<string, unknown> API responses is
  // intentional; no-base-to-string is suppressed for these files.
  {
    files: [
      'src/infrastructure/adapters/**/*.ts',
      '!src/infrastructure/adapters/**/in-memory-*.ts',
    ],
    rules: {
      complexity: 'off',
      'max-depth': 'off',
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      'max-params': 'off',
      'sonarjs/cognitive-complexity': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/require-await': 'off',
      // Dynamic require() of untyped external packages (grpc-js, node-opcua, ws, spiffe-js)
      // legitimately produces `any` values; unsafe rules suppressed for adapter layer.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
    },
  },

  // QA scripts that use browser/puppeteer APIs — allow browser globals.
  // unused-imports/no-unused-vars handles unused detection with argsIgnorePattern;
  // turn off the base rule to avoid duplicate/conflicting errors for .mjs files.
  {
    files: ['scripts/qa/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },

  // UI wireframes/prototypes live in docs and legitimately use browser globals.
  // Relax complexity/size caps — these are standalone lo-fi prototypes, not production code.
  {
    files: ['docs/ui/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      complexity: 'off',
      'max-depth': 'off',
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      'max-params': 'off',
      'sonarjs/cognitive-complexity': 'off',
    },
  },

  eslintConfigPrettier,
);
