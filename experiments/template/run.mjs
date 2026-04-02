/**
 * Experiment: <experiment-name>
 *
 * Copy this template to a new directory and implement the lifecycle phases.
 * Run with: node experiments/<experiment-name>/run.mjs
 */

import { runExperiment, assert } from '../shared/experiment-runner.js';

const outcome = await runExperiment({
  name: '<experiment-name>',

  hypothesis: 'Describe what you expect to happen.',

  async setup(ctx) {
    // Seed data, start services, configure environment.
  },

  async execute(ctx) {
    // Trigger the behaviour under test.
    // Store intermediate results in ctx.state for use in verify().
  },

  async verify(ctx) {
    // Return assertion results.
    return [assert('example assertion', true, 'Replace with real checks')];
  },

  async teardown(ctx) {
    // Clean up resources created during setup/execute.
  },
});

console.log(`Result: ${outcome.outcome} (${outcome.duration_ms}ms)`);
for (const a of outcome.assertions) {
  console.log(`  ${a.passed ? 'PASS' : 'FAIL'}: ${a.label}`);
}

process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
