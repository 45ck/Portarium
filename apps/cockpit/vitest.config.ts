import { mergeConfig, type ConfigEnv, type UserConfig } from 'vite';
import { defineConfig } from 'vitest/config';

import viteConfig from './vite.config';

export default defineConfig((configEnv) =>
  mergeConfig(
    resolveViteConfig(configEnv),
    defineConfig({
      test: {
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
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
    }),
  ),
);

function resolveViteConfig(configEnv: ConfigEnv): UserConfig {
  return typeof viteConfig === 'function' ? viteConfig(configEnv) : viteConfig;
}
