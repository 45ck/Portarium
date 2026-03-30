import { describe, it, expect } from 'vitest';
import { resolveConfig, DEFAULT_CONFIG } from './config.js';

describe('resolveConfig', () => {
  const validRaw = {
    portariumUrl: 'https://portarium.test',
    workspaceId: 'ws-1',
    bearerToken: 'tok-1',
  };

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
      approvalTimeoutMs: 1000,
      pollIntervalMs: 500,
      bypassToolNames: ['my_tool'],
    });
    expect(config.tenantId).toBe('custom-tenant');
    expect(config.failClosed).toBe(false);
    expect(config.approvalTimeoutMs).toBe(1000);
    expect(config.pollIntervalMs).toBe(500);
    expect(config.bypassToolNames).toEqual(['my_tool']);
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
