import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['src/test-setup.ts'],
    testTimeout: 30_000,
    include: ['src/**/*.test.ts', 'scaffolds/**/*.test.ts', 'scripts/**/*.test.ts', 'packages/**/*.test.ts'],
    reporters: process.env['CI'] ? ['verbose', 'junit'] : ['default'],
    outputFile: {
      junit: './test-results/junit.xml',
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'lcov', 'clover'],
      include: ['src/**/*.ts', 'packages/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/index.ts',
        'packages/**/*.test.ts',
        'packages/**/dist/**',
        // CLI entry points are process-level wiring; exclude from unit coverage
        'src/infrastructure/migrations/cli.ts',
        'src/infrastructure/observability/otel-setup.ts',
      ],
      thresholds: {
        // Global thresholds (all src/)
        statements: 83,
        branches: 73,
        functions: 88,
        lines: 85,
        // Per-layer gates enforcing ≥70% on every architectural layer
        'src/domain/**': {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70,
        },
        'src/application/**': {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70,
        },
        'src/infrastructure/**': {
          statements: 70,
          branches: 65,
          functions: 70,
          lines: 70,
        },
        'src/presentation/**': {
          statements: 70,
          branches: 65,
          functions: 70,
          lines: 70,
        },
        'packages/openclaw-plugin/src/**': {
          statements: 80,
          branches: 75,
          functions: 85,
          lines: 80,
        },
      },
    },
  },
});
