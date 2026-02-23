/**
 * Vitest config for cockpit component coverage gate (used in ci:pr).
 * Scoped to components/cockpit/ only — excludes routes (which have
 * @capacitor/preferences dynamic imports that require Capacitor runtime).
 *
 * Does NOT import vite.config.ts so it works from git worktrees where
 * the `.vite-temp` ESM cache cannot resolve @vitejs/plugin-react.
 */
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/components/**/*.test.ts', 'src/components/**/*.test.tsx'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      include: [
        'src/components/cockpit/run-status-badge.tsx',
        'src/components/cockpit/effects-list.tsx',
        'src/components/cockpit/evidence-timeline.tsx',
        'src/components/cockpit/error-boundary.tsx',
        'src/components/cockpit/evidence-category-badge.tsx',
        'src/components/cockpit/execution-tier-badge.tsx',
        'src/components/cockpit/human-task-status-badge.tsx',
        'src/components/cockpit/approval-gate-panel.tsx',
        'src/components/cockpit/human-task-drawer.tsx',
        'src/components/cockpit/provenance-journey.tsx',
        'src/components/cockpit/workflow-builder/action-node.tsx',
        'src/components/cockpit/workflow-builder/approval-gate-node.tsx',
        'src/components/cockpit/workflow-builder/start-node.tsx',
        'src/components/cockpit/workflow-builder/end-node.tsx',
        'src/components/cockpit/workflow-builder/condition-node.tsx',
      ],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.stories.{ts,tsx}'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
    alias: {
      '@': resolve(__dirname, 'src'),
      '@portarium/cockpit-types': resolve(__dirname, '../../src/presentation/ops-cockpit/types.ts'),
    },
  },
});
