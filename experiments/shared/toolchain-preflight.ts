/**
 * Local tool preflight for experiment scenarios.
 *
 * This records whether optional workstation tools can run, or whether a run is
 * intentionally skipped with an explicit rationale.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

export type ExperimentToolName = 'demo-machine';

export type ExperimentToolPreflightStatus = 'runnable' | 'intentionally-skipped' | 'failed';

export interface ToolProbeResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export type ToolProbe = (
  command: string,
  args: readonly string[],
  timeoutMs: number,
) => Promise<ToolProbeResult>;

export interface ExperimentToolPreflightOptions {
  readonly tool?: ExperimentToolName;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly probeImpl?: ToolProbe;
  readonly timeoutMs?: number;
  readonly clipSpecPath?: string;
}

export interface ExperimentToolPreflightResult {
  readonly tool: ExperimentToolName;
  readonly status: ExperimentToolPreflightStatus;
  readonly checkedAt: string;
  readonly command: string;
  readonly probe: 'cli-help';
  readonly rationale?: string;
  readonly clipSpecPath?: string;
}

const DEFAULT_DEMO_MACHINE_CLIP =
  'docs/internal/ui/cockpit/demo-machine/clips/01-approval-gate-unblocks-run.demo.yaml';

const SKIP_REASON_ENV_KEYS = [
  'PORTARIUM_DEMO_MACHINE_SKIP_REASON',
  'PORTARIUM_EXPERIMENT_DEMO_MACHINE_SKIP_REASON',
];

export async function runExperimentToolPreflight(
  options: ExperimentToolPreflightOptions = {},
): Promise<ExperimentToolPreflightResult> {
  const tool = options.tool ?? 'demo-machine';
  const checkedAt = new Date().toISOString();

  if (tool !== 'demo-machine') {
    return {
      tool,
      status: 'failed',
      checkedAt,
      command: tool,
      probe: 'cli-help',
      rationale: `Unsupported experiment tool "${tool}".`,
    };
  }

  const env = options.env ?? process.env;
  const command = 'demo-machine';
  const clipSpecPath = options.clipSpecPath ?? DEFAULT_DEMO_MACHINE_CLIP;
  const explicitSkipReason = readFirstEnv(env, SKIP_REASON_ENV_KEYS);

  if (explicitSkipReason) {
    return {
      tool,
      status: 'intentionally-skipped',
      checkedAt,
      command,
      probe: 'cli-help',
      rationale: explicitSkipReason,
      clipSpecPath,
    };
  }

  if (!existsSync(clipSpecPath)) {
    return {
      tool,
      status: 'failed',
      checkedAt,
      command,
      probe: 'cli-help',
      rationale: `Demo-machine clip spec not found: ${clipSpecPath}`,
      clipSpecPath,
    };
  }

  const probeImpl = options.probeImpl ?? runCliHelpProbe;
  const timeoutMs = options.timeoutMs ?? 5_000;

  try {
    const probe = await probeImpl(command, ['--help'], timeoutMs);
    const output = `${probe.stdout}\n${probe.stderr}`.toLowerCase();

    if (probe.exitCode === 0) {
      return {
        tool,
        status: 'runnable',
        checkedAt,
        command,
        probe: 'cli-help',
        rationale: 'demo-machine CLI responded to --help and clip spec is present.',
        clipSpecPath,
      };
    }

    if (isCommandMissing(output)) {
      return {
        tool,
        status: 'intentionally-skipped',
        checkedAt,
        command,
        probe: 'cli-help',
        rationale:
          'demo-machine CLI is not installed on this workstation; Cockpit demo-machine playback is optional and skipped for this experiment run.',
        clipSpecPath,
      };
    }

    return {
      tool,
      status: 'failed',
      checkedAt,
      command,
      probe: 'cli-help',
      rationale: truncateDetail(
        output.trim() || `demo-machine exited with ${String(probe.exitCode)}`,
      ),
      clipSpecPath,
    };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      tool,
      status: isCommandMissing(detail) ? 'intentionally-skipped' : 'failed',
      checkedAt,
      command,
      probe: 'cli-help',
      rationale: isCommandMissing(detail)
        ? 'demo-machine CLI is not installed on this workstation; Cockpit demo-machine playback is optional and skipped for this experiment run.'
        : truncateDetail(detail),
      clipSpecPath,
    };
  }
}

function readFirstEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (value !== undefined && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

function isCommandMissing(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('enoent') ||
    normalized.includes('not recognized') ||
    normalized.includes('not found') ||
    normalized.includes('command not found')
  );
}

function truncateDetail(value: string): string {
  return value.length <= 240 ? value : `${value.slice(0, 237)}...`;
}

function runCliHelpProbe(
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<ToolProbeResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`${command} preflight timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(Buffer.from(chunk)));
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timeout);
      resolve({
        exitCode,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}
