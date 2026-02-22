import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['src/test-setup.ts'],
    testTimeout: 30_000,
    include: ['src/**/*.test.ts', 'scaffolds/**/*.test.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts'],
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 90,
        lines: 86,
      },
    },
  },
});
