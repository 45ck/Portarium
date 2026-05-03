import { describe, expect, it } from 'vitest';

import { runExperimentToolPreflight } from '../../experiments/shared/toolchain-preflight.js';

const clipSpecPath =
  'docs/internal/ui/cockpit/demo-machine/clips/01-approval-gate-unblocks-run.demo.yaml';

describe('experiment toolchain preflight', () => {
  it('classifies required content-machine as runnable when the CLI probe succeeds', async () => {
    const result = await runExperimentToolPreflight({
      tool: 'content-machine',
      required: true,
      probeImpl: async (command, args) => ({
        exitCode: 0,
        stdout: `${command} ${args.join(' ')} usage`,
        stderr: '',
      }),
    });

    expect(result).toMatchObject({
      tool: 'content-machine',
      status: 'runnable',
      command: 'content-machine',
      probe: 'cli-help',
      required: true,
    });
  });

  it('fails early when required content-machine is unavailable', async () => {
    const result = await runExperimentToolPreflight({
      tool: 'content-machine',
      required: true,
      probeImpl: async () => {
        throw new Error('spawn content-machine ENOENT');
      },
    });

    expect(result.status).toBe('failed');
    expect(result.required).toBe(true);
    expect(result.rationale).toContain('required for this experiment');
  });

  it('classifies demo-machine as runnable when the CLI probe succeeds', async () => {
    const result = await runExperimentToolPreflight({
      tool: 'demo-machine',
      clipSpecPath,
      probeImpl: async (command, args) => ({
        exitCode: 0,
        stdout: `${command} ${args.join(' ')} usage`,
        stderr: '',
      }),
    });

    expect(result).toMatchObject({
      tool: 'demo-machine',
      status: 'runnable',
      command: 'demo-machine',
      probe: 'cli-help',
      clipSpecPath,
    });
  });

  it('classifies missing demo-machine CLI as intentionally skipped with a rationale', async () => {
    const result = await runExperimentToolPreflight({
      tool: 'demo-machine',
      clipSpecPath,
      probeImpl: async () => {
        throw new Error('spawn demo-machine ENOENT');
      },
    });

    expect(result.status).toBe('intentionally-skipped');
    expect(result.rationale).toContain('demo-machine CLI is not installed');
  });

  it('honors explicit workstation skip rationale before probing the CLI', async () => {
    let probed = false;
    const result = await runExperimentToolPreflight({
      tool: 'demo-machine',
      clipSpecPath,
      env: {
        PORTARIUM_DEMO_MACHINE_SKIP_REASON: 'AppLocker blocks the local demo-machine binary.',
      },
      probeImpl: async () => {
        probed = true;
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    });

    expect(probed).toBe(false);
    expect(result.status).toBe('intentionally-skipped');
    expect(result.rationale).toBe('AppLocker blocks the local demo-machine binary.');
  });

  it('fails when the curated demo-machine clip spec is missing', async () => {
    const result = await runExperimentToolPreflight({
      tool: 'demo-machine',
      clipSpecPath: 'docs/internal/ui/cockpit/demo-machine/clips/missing.demo.yaml',
      probeImpl: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    });

    expect(result.status).toBe('failed');
    expect(result.rationale).toContain('clip spec not found');
  });
});
