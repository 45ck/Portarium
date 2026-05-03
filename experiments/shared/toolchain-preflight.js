/**
 * Local tool preflight for experiment scenarios.
 *
 * This records whether optional workstation tools can run, or whether a run is
 * intentionally skipped with an explicit rationale.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const DEFAULT_DEMO_MACHINE_CLIP =
  'docs/internal/ui/cockpit/demo-machine/clips/01-approval-gate-unblocks-run.demo.yaml';

const DEMO_SKIP_REASON_ENV_KEYS = [
  'PORTARIUM_DEMO_MACHINE_SKIP_REASON',
  'PORTARIUM_EXPERIMENT_DEMO_MACHINE_SKIP_REASON',
];

const CONTENT_SKIP_REASON_ENV_KEYS = [
  'PORTARIUM_CONTENT_MACHINE_SKIP_REASON',
  'PORTARIUM_EXPERIMENT_CONTENT_MACHINE_SKIP_REASON',
];

export async function runExperimentToolPreflight(options = {}) {
  const tool = options.tool ?? 'demo-machine';
  const checkedAt = new Date().toISOString();
  const required = options.required ?? false;

  if (tool !== 'content-machine' && tool !== 'demo-machine') {
    return {
      tool,
      status: 'failed',
      checkedAt,
      command: tool,
      args: ['--help'],
      probe: 'cli-help',
      rationale: `Unsupported experiment tool "${tool}".`,
      required,
    };
  }

  const env = options.env ?? process.env;
  const command = options.command ?? tool;
  const args = options.args ?? ['--help'];
  const clipSpecPath = options.clipSpecPath ?? DEFAULT_DEMO_MACHINE_CLIP;
  const explicitSkipReason = readFirstEnv(
    env,
    tool === 'demo-machine' ? DEMO_SKIP_REASON_ENV_KEYS : CONTENT_SKIP_REASON_ENV_KEYS,
  );

  if (explicitSkipReason && !required) {
    return {
      tool,
      status: 'intentionally-skipped',
      checkedAt,
      command,
      args,
      probe: 'cli-help',
      rationale: explicitSkipReason,
      ...(tool === 'demo-machine' ? { clipSpecPath } : {}),
      required,
    };
  }

  if (explicitSkipReason && required) {
    return {
      tool,
      status: 'failed',
      checkedAt,
      command,
      args,
      probe: 'cli-help',
      rationale: `${tool} is required for this experiment and cannot be skipped: ${explicitSkipReason}`,
      ...(tool === 'demo-machine' ? { clipSpecPath } : {}),
      required,
    };
  }

  if (tool === 'demo-machine' && !existsSync(clipSpecPath)) {
    return {
      tool,
      status: 'failed',
      checkedAt,
      command,
      args,
      probe: 'cli-help',
      rationale: `Demo-machine clip spec not found: ${clipSpecPath}`,
      clipSpecPath,
      required,
    };
  }

  const probeImpl = options.probeImpl ?? runCliHelpProbe;
  const timeoutMs = options.timeoutMs ?? 5_000;

  try {
    const probe = await probeImpl(command, args, timeoutMs);
    const output = `${probe.stdout}\n${probe.stderr}`.toLowerCase();

    if (probe.exitCode === 0) {
      return {
        tool,
        status: 'runnable',
        checkedAt,
        command,
        args,
        probe: 'cli-help',
        rationale:
          options.runnableRationale ??
          (tool === 'demo-machine'
            ? 'demo-machine CLI responded to --help and clip spec is present.'
            : 'content-machine CLI responded to --help.'),
        ...(tool === 'demo-machine' ? { clipSpecPath } : {}),
        required,
      };
    }

    if (isCommandMissing(output)) {
      return {
        tool,
        status: required ? 'failed' : 'intentionally-skipped',
        checkedAt,
        command,
        args,
        probe: 'cli-help',
        rationale: missingToolRationale(tool, required),
        ...(tool === 'demo-machine' ? { clipSpecPath } : {}),
        required,
      };
    }

    return {
      tool,
      status: 'failed',
      checkedAt,
      command,
      args,
      probe: 'cli-help',
      rationale: truncateDetail(output.trim() || `${tool} exited with ${String(probe.exitCode)}`),
      ...(tool === 'demo-machine' ? { clipSpecPath } : {}),
      required,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const commandMissing = isCommandMissing(detail);
    return {
      tool,
      status: commandMissing && !required ? 'intentionally-skipped' : 'failed',
      checkedAt,
      command,
      args,
      probe: 'cli-help',
      rationale: commandMissing ? missingToolRationale(tool, required) : truncateDetail(detail),
      ...(tool === 'demo-machine' ? { clipSpecPath } : {}),
      required,
    };
  }
}

function readFirstEnv(env, keys) {
  for (const key of keys) {
    const value = env[key];
    if (value !== undefined && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

function isCommandMissing(value) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('enoent') ||
    normalized.includes('not recognized') ||
    normalized.includes('not found') ||
    normalized.includes('command not found')
  );
}

function truncateDetail(value) {
  return value.length <= 240 ? value : `${value.slice(0, 237)}...`;
}

function missingToolRationale(tool, required) {
  if (required) {
    return `${tool} CLI is required for this experiment but is not installed or not on PATH.`;
  }

  if (tool === 'demo-machine') {
    return 'demo-machine CLI is not installed on this workstation; Cockpit demo-machine playback is optional and skipped for this experiment run.';
  }

  return 'content-machine CLI is not installed on this workstation; optional content-machine playback is skipped for this experiment run.';
}

function runCliHelpProbe(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const stdout = [];
    const stderr = [];
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`${command} preflight timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
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
