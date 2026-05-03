/**
 * Iteration 2: micro-SaaS toolchain realism redo.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('micro-saas-toolchain-redo experiment', () => {
  it('records content-machine usage, demo-machine skip, and stubbed external effects', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-micro-saas-redo-'));
    tempDirs.push(resultsDir);

    const mod =
      // @ts-expect-error The experiment is a checked .mjs runtime script.
      await import('../../experiments/iteration-2/scenarios/micro-saas-toolchain-redo/run.mjs');
    const outcome = await mod.runMicroSaasToolchainRedo({
      resultsDir,
      log: () => {},
      toolPreflightImpl: async ({ tool, required }: { tool: string; required?: boolean }) => ({
        tool,
        status: tool === 'content-machine' ? 'runnable' : 'intentionally-skipped',
        checkedAt: '2026-04-29T03:00:00.000Z',
        command: tool,
        probe: 'cli-help',
        rationale:
          tool === 'content-machine'
            ? 'content-machine CLI responded to --help.'
            : 'AppLocker blocks the local demo-machine binary.',
        required: required ?? false,
        ...(tool === 'demo-machine'
          ? {
              clipSpecPath:
                'docs/internal/ui/cockpit/demo-machine/clips/01-approval-gate-unblocks-run.demo.yaml',
            }
          : {}),
      }),
    });

    expect(outcome.outcome).toBe('confirmed');
    expect(outcome.assertions.every((assertion: { passed: boolean }) => assertion.passed)).toBe(
      true,
    );

    const trace = outcome.trace as Record<string, any>;
    expect(trace['comparesTo']).toBe('micro-saas-agent-stack-v2');
    expect(trace['toolchainPreflight'].tools.contentMachine.status).toBe('runnable');
    expect(trace['toolchainPreflight'].tools.contentMachine.required).toBe(true);
    expect(trace['toolchainPreflight'].tools.demoMachine.status).toBe('intentionally-skipped');
    expect(trace['demoPathState']).toBe('unproven');
    expect(trace['toolUsageEvidence'].map((item: { status: string }) => item.status)).toEqual([
      'runnable',
      'intentionally-skipped',
      'stubbed',
      'stubbed',
    ]);
    expect(
      trace['externalEffectStubs'].every((item: { status: string }) => item.status === 'stubbed'),
    ).toBe(true);

    for (const artifactName of [
      'outcome.json',
      'queue-metrics.json',
      'evidence-summary.json',
      'report.md',
      'toolchain-preflight.json',
      'tool-usage-evidence.json',
      'content-machine-output.json',
      'external-effect-stubs.json',
    ]) {
      expect(existsSync(join(resultsDir, artifactName))).toBe(true);
    }

    const toolUsage = JSON.parse(
      readFileSync(join(resultsDir, 'tool-usage-evidence.json'), 'utf8'),
    ) as { evidence: { tool: string; status: string; evidenceSource: string }[] };
    expect(toolUsage.evidence).toContainEqual(
      expect.objectContaining({
        tool: 'content-machine',
        status: 'runnable',
        evidenceSource: 'toolchain-preflight.json',
      }),
    );
    expect(toolUsage.evidence).toContainEqual(
      expect.objectContaining({
        tool: 'publish-gateway',
        status: 'stubbed',
        evidenceSource: 'external-effect-stubs.json',
      }),
    );

    const report = readFileSync(join(resultsDir, 'report.md'), 'utf8');
    expect(report).toContain('Toolchain Preflight');
    expect(report).toContain('Tool Usage Evidence');
    expect(report).toContain('State: unproven');
  });

  it('records the full evidence bundle when required content-machine is unavailable', async () => {
    const resultsDir = mkdtempSync(join(tmpdir(), 'portarium-micro-saas-redo-fail-'));
    tempDirs.push(resultsDir);

    const mod =
      // @ts-expect-error The experiment is a checked .mjs runtime script.
      await import('../../experiments/iteration-2/scenarios/micro-saas-toolchain-redo/run.mjs');
    const outcome = await mod.runMicroSaasToolchainRedo({
      resultsDir,
      log: () => {},
      toolPreflightImpl: async ({ tool, required }: { tool: string; required?: boolean }) => ({
        tool,
        status: tool === 'content-machine' ? 'failed' : 'intentionally-skipped',
        checkedAt: '2026-04-29T03:00:00.000Z',
        command: tool,
        probe: 'cli-help',
        rationale:
          tool === 'content-machine'
            ? 'content-machine CLI is required for this experiment but is not installed or not on PATH.'
            : 'demo-machine skipped.',
        required: required ?? false,
      }),
    });

    expect(outcome.outcome).toBe('inconclusive');
    expect(outcome.error).toContain('Required content-machine preflight failed');
    const trace = outcome.trace as Record<string, any>;
    expect(trace['toolchainPreflight'].tools.contentMachine.status).toBe('failed');
    expect(trace['demoPathState']).toBe('unproven');
    expect(existsSync(join(resultsDir, 'outcome.json'))).toBe(true);
    expect(existsSync(join(resultsDir, 'queue-metrics.json'))).toBe(true);
    expect(existsSync(join(resultsDir, 'evidence-summary.json'))).toBe(true);
    expect(existsSync(join(resultsDir, 'report.md'))).toBe(true);
    expect(existsSync(join(resultsDir, 'toolchain-preflight.json'))).toBe(true);
    expect(existsSync(join(resultsDir, 'tool-usage-evidence.json'))).toBe(true);
    expect(existsSync(join(resultsDir, 'content-machine-output.json'))).toBe(true);
    expect(existsSync(join(resultsDir, 'external-effect-stubs.json'))).toBe(true);

    const contentMachineOutput = JSON.parse(
      readFileSync(join(resultsDir, 'content-machine-output.json'), 'utf8'),
    ) as { status: string; artifacts: unknown[] };
    expect(contentMachineOutput.status).toBe('unavailable');
    expect(contentMachineOutput.artifacts).toEqual([]);

    const report = readFileSync(join(resultsDir, 'report.md'), 'utf8');
    expect(report).toContain('State: unproven');
  });
});
