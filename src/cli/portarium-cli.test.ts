import { describe, expect, it } from 'vitest';

import { parseArgs } from './portarium-cli.js';

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
    const result = parseArgs(['node', 'portarium', 'approve', '--approval-id=apr-1', '--decision=Approved']);
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
});
