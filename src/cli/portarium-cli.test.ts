import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { generateAdapterScaffold, generateAgentWrapperScaffold, parseArgs } from './portarium-cli.js';

describe('Portarium CLI argument parsing', () => {
  it('parses a bare command', () => {
    const result = parseArgs(['node', 'portarium', 'login']);
    expect(result.command).toBe('login');
    expect(result.subcommand).toBeUndefined();
    expect(result.flags).toEqual({});
    expect(result.positional).toEqual([]);
  });

  it('parses command + subcommand', () => {
    const result = parseArgs(['node', 'portarium', 'run', 'start']);
    expect(result.command).toBe('run');
    expect(result.subcommand).toBe('start');
  });

  it('parses --flag value pairs', () => {
    const result = parseArgs([
      'node',
      'portarium',
      'run',
      'start',
      '--workflow-id',
      'wf-123',
      '--workspace',
      'ws-abc',
    ]);
    expect(result.command).toBe('run');
    expect(result.subcommand).toBe('start');
    expect(result.flags['workflow-id']).toBe('wf-123');
    expect(result.flags['workspace']).toBe('ws-abc');
  });

  it('parses --flag=value syntax', () => {
    const result = parseArgs([
      'node',
      'portarium',
      'approve',
      '--approval-id=apr-1',
      '--decision=Approved',
    ]);
    expect(result.command).toBe('approve');
    expect(result.flags['approval-id']).toBe('apr-1');
    expect(result.flags['decision']).toBe('Approved');
  });

  it('parses boolean flags', () => {
    const result = parseArgs(['node', 'portarium', 'events', '--follow']);
    expect(result.command).toBe('events');
    expect(result.flags['follow']).toBe(true);
  });

  it('defaults to help when no command is given', () => {
    const result = parseArgs(['node', 'portarium']);
    expect(result.command).toBe('help');
  });

  it('handles agent register with name flag', () => {
    const result = parseArgs([
      'node',
      'portarium',
      'agent',
      'register',
      '--name',
      'my-agent',
      '--token',
      'jwt-xyz',
    ]);
    expect(result.command).toBe('agent');
    expect(result.subcommand).toBe('register');
    expect(result.flags['name']).toBe('my-agent');
    expect(result.flags['token']).toBe('jwt-xyz');
  });

  it('handles mixed flags and positional args after subcommand', () => {
    const result = parseArgs([
      'node',
      'portarium',
      'workspace',
      'select',
      '--base-url',
      'http://localhost:9000',
    ]);
    expect(result.command).toBe('workspace');
    expect(result.subcommand).toBe('select');
    expect(result.flags['base-url']).toBe('http://localhost:9000');
  });

  it('parses generate adapter flags', () => {
    const result = parseArgs([
      'node',
      'portarium',
      'generate',
      'adapter',
      '--name',
      'hubspot-adapter',
      '--port-family',
      'CrmSales',
      '--force',
    ]);
    expect(result.command).toBe('generate');
    expect(result.subcommand).toBe('adapter');
    expect(result.flags['name']).toBe('hubspot-adapter');
    expect(result.flags['port-family']).toBe('CrmSales');
    expect(result.flags['force']).toBe(true);
  });
});

describe('Portarium CLI scaffolding generators', () => {
  it('creates adapter scaffold files', () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), 'portarium-adapter-'));
    const outputDir = join(tmpRoot, 'adapter');

    try {
      generateAdapterScaffold({
        outputDir,
        adapterName: 'HubSpotAdapter',
        providerSlug: 'hubspot',
        portFamily: 'CrmSales',
      });

      expect(existsSync(join(outputDir, 'adapter.manifest.json'))).toBe(true);
      expect(existsSync(join(outputDir, 'src/index.ts'))).toBe(true);
      expect(existsSync(join(outputDir, 'src/index.test.ts'))).toBe(true);

      const manifest = JSON.parse(readFileSync(join(outputDir, 'adapter.manifest.json'), 'utf8')) as {
        adapterName: string;
        providerSlug: string;
      };
      expect(manifest.adapterName).toBe('HubSpotAdapter');
      expect(manifest.providerSlug).toBe('hubspot');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('supports force overwrite for agent-wrapper scaffolds', () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), 'portarium-agent-wrapper-'));
    const outputDir = join(tmpRoot, 'wrapper');

    try {
      generateAgentWrapperScaffold({
        outputDir,
        wrapperName: 'openclaw-wrapper',
        runtimeSlug: 'openclaw',
      });

      expect(() =>
        generateAgentWrapperScaffold({
          outputDir,
          wrapperName: 'openclaw-wrapper',
          runtimeSlug: 'openclaw',
        }),
      ).toThrow(/already exists and is not empty/);

      generateAgentWrapperScaffold({
        outputDir,
        wrapperName: 'openclaw-wrapper',
        runtimeSlug: 'openclaw',
        force: true,
      });

      expect(existsSync(join(outputDir, 'agent-wrapper.manifest.json'))).toBe(true);
      expect(existsSync(join(outputDir, 'src/server.ts'))).toBe(true);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
