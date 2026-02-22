import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['src/test-setup.ts'],
    testTimeout: 30_000,
    include: ['src/**/*.test.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/index.ts',
        // CLI entry points are process-level wiring; exclude from unit coverage
        'src/infrastructure/migrations/cli.ts',
        'src/infrastructure/observability/otel-setup.ts',
      ],
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 90,
        lines: 86,
      },
    },
  },
});
