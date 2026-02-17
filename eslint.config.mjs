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
      'package/**',
      '**/vendor/**',
      '**/.specify/**/generated/**',
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
  {
    files: ['**/*.test.ts'],
    rules: {
      'max-lines-per-function': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
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

  // UI wireframes/prototypes live in docs and legitimately use browser globals.
  {
    files: ['docs/ui/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  eslintConfigPrettier,
);
