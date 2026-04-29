import { afterEach, describe, it, expect, vi } from 'vitest';
import { resolveConfig, DEFAULT_CONFIG } from './config.js';

describe('resolveConfig', () => {
  const validRaw = {
    portariumUrl: 'https://portarium.test',
    workspaceId: 'ws-1',
    bearerToken: 'tok-1',
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves with defaults for minimal valid input', () => {
    const config = resolveConfig(validRaw);
    expect(config.portariumUrl).toBe('https://portarium.test');
    expect(config.workspaceId).toBe('ws-1');
    expect(config.bearerToken).toBe('tok-1');
    expect(config.tenantId).toBe('default');
    expect(config.failClosed).toBe(true);
    expect(config.approvalTimeoutMs).toBe(86_400_000);
    expect(config.pollIntervalMs).toBe(3_000);
    expect(config.bypassToolNames).toEqual(DEFAULT_CONFIG.bypassToolNames);
  });

  it('strips trailing slashes from portariumUrl', () => {
    const config = resolveConfig({ ...validRaw, portariumUrl: 'https://p.test///' });
    expect(config.portariumUrl).toBe('https://p.test');
  });

  it('allows overriding optional fields', () => {
    const config = resolveConfig({
      ...validRaw,
      tenantId: 'custom-tenant',
      failClosed: false,
      approvalTimeoutMs: 60_000,
      pollIntervalMs: 500,
      // Only permitted introspection tools are accepted in bypassToolNames.
      bypassToolNames: ['portarium_get_run'],
    });
    expect(config.tenantId).toBe('custom-tenant');
    expect(config.failClosed).toBe(false);
    expect(config.approvalTimeoutMs).toBe(60_000);
    expect(config.pollIntervalMs).toBe(500);
    expect(config.bypassToolNames).toEqual(['portarium_get_run']);
  });

  it('drops bypassToolNames entries outside the permitted introspection set with diagnostics', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const config = resolveConfig({
      ...validRaw,
      bypassToolNames: ['portarium_get_run', 'write_file', 'bash_exec'],
    });

    expect(config.bypassToolNames).toEqual(['portarium_get_run']);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('config.bypassToolNames contains entries outside the permitted'),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('write_file, bash_exec'));
  });

  it('sanitizes header-backed config values before they reach HTTP requests', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const config = resolveConfig({
      ...validRaw,
      workspaceId: 'ws-1\r\nx-evil: 1',
      bearerToken: 'tok-1\0\r\nx-evil: 1',
      tenantId: 'tenant-1\nx-evil: 1',
    });

    expect(config.workspaceId).toBe('ws-1x-evil: 1');
    expect(config.bearerToken).toBe('tok-1x-evil: 1');
    expect(config.tenantId).toBe('tenant-1x-evil: 1');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('config.workspaceId contained'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('config.bearerToken contained'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('config.tenantId contained'));
  });

  it('rejects header-backed config values that sanitize to empty', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() => resolveConfig({ ...validRaw, workspaceId: '\r\n\0' })).toThrow(
      'config.workspaceId must not be empty after CRLF/NUL sanitization',
    );
    expect(() => resolveConfig({ ...validRaw, bearerToken: '\r\n\0' })).toThrow(
      'config.bearerToken must not be empty after CRLF/NUL sanitization',
    );
    expect(() => resolveConfig({ ...validRaw, tenantId: '\r\n\0' })).toThrow(
      'config.tenantId must not be empty after CRLF/NUL sanitization',
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('config.workspaceId contained'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('config.bearerToken contained'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('config.tenantId contained'));
  });

  it('logs non-string and control-character bypass entries without retaining them', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const config = resolveConfig({
      ...validRaw,
      bypassToolNames: ['portarium_get_run', 'write_file\r\nx-evil: 1', 42, null],
    });

    expect(config.bypassToolNames).toEqual(['portarium_get_run']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('write_filex-evil: 1'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('42'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('null'));
  });

  it('does not retain malicious bypassToolNames that target normal tools', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const config = resolveConfig({ ...validRaw, bypassToolNames: ['my_tool', 'send_email'] });

    expect(config.bypassToolNames).toEqual(DEFAULT_CONFIG.bypassToolNames);
    expect(config.bypassToolNames).not.toContain('my_tool');
    expect(config.bypassToolNames).not.toContain('send_email');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Only portarium_get_run'));
  });

  it('throws when approvalTimeoutMs is below the 60s safety floor', () => {
    expect(() => resolveConfig({ ...validRaw, approvalTimeoutMs: 0 })).toThrow(
      'approvalTimeoutMs must be a finite number >= 60000ms',
    );
    expect(() => resolveConfig({ ...validRaw, approvalTimeoutMs: -1 })).toThrow(
      'approvalTimeoutMs must be a finite number >= 60000ms',
    );
    expect(() => resolveConfig({ ...validRaw, approvalTimeoutMs: 59_999 })).toThrow(
      'approvalTimeoutMs must be a finite number >= 60000ms',
    );
  });

  it('throws when approvalTimeoutMs is NaN or Infinity', () => {
    expect(() => resolveConfig({ ...validRaw, approvalTimeoutMs: NaN })).toThrow(
      'approvalTimeoutMs must be a finite number >= 60000ms',
    );
    expect(() => resolveConfig({ ...validRaw, approvalTimeoutMs: Infinity })).toThrow(
      'approvalTimeoutMs must be a finite number >= 60000ms',
    );
  });

  it('throws when pollIntervalMs is below 500ms', () => {
    expect(() => resolveConfig({ ...validRaw, pollIntervalMs: 0 })).toThrow(
      'pollIntervalMs must be a finite number >= 500ms',
    );
    expect(() => resolveConfig({ ...validRaw, pollIntervalMs: 499 })).toThrow(
      'pollIntervalMs must be a finite number >= 500ms',
    );
  });

  it('throws when numeric config fields are not numbers', () => {
    expect(() => resolveConfig({ ...validRaw, approvalTimeoutMs: '60000' })).toThrow(
      'approvalTimeoutMs must be a finite number >= 60000ms',
    );
    expect(() => resolveConfig({ ...validRaw, pollIntervalMs: '500' })).toThrow(
      'pollIntervalMs must be a finite number >= 500ms',
    );
  });

  it('throws when portariumUrl is missing', () => {
    expect(() => resolveConfig({ workspaceId: 'ws', bearerToken: 'tok' })).toThrow(
      'portariumUrl is required',
    );
  });

  it('throws when workspaceId is missing', () => {
    expect(() => resolveConfig({ portariumUrl: 'https://p.test', bearerToken: 'tok' })).toThrow(
      'workspaceId is required',
    );
  });

  it('throws when bearerToken is missing', () => {
    expect(() => resolveConfig({ portariumUrl: 'https://p.test', workspaceId: 'ws' })).toThrow(
      'bearerToken is required',
    );
  });

  it('throws when portariumUrl is empty string', () => {
    expect(() => resolveConfig({ ...validRaw, portariumUrl: '' })).toThrow(
      'portariumUrl is required',
    );
  });
});
