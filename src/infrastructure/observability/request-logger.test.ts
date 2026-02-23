import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger } from './logger.js';
import { createRequestLogger } from './request-logger.js';

describe('createRequestLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('injects correlationId into every log line', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const root = createLogger('control-plane');
    const reqLog = createRequestLogger(root, { correlationId: 'corr-42' });
    reqLog.info('test');
    const line = String((write.mock.calls[0] as unknown[])[0]);
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(entry['correlationId']).toBe('corr-42');
    expect(entry['msg']).toBe('test');
    expect(entry['name']).toBe('control-plane');
  });

  it('injects workspaceId and userId when provided', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const root = createLogger('control-plane');
    const reqLog = createRequestLogger(root, {
      correlationId: 'corr-1',
      workspaceId: 'ws-99',
      userId: 'u-7',
    });
    reqLog.info('authed');
    const line = String((write.mock.calls[0] as unknown[])[0]);
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(entry['workspaceId']).toBe('ws-99');
    expect(entry['userId']).toBe('u-7');
  });

  it('injects traceparent when provided', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const root = createLogger('control-plane');
    const tp = '00-abcdef1234567890abcdef1234567890-1234567890abcdef-01';
    const reqLog = createRequestLogger(root, { correlationId: 'corr-1', traceparent: tp });
    reqLog.info('traced');
    const line = String((write.mock.calls[0] as unknown[])[0]);
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(entry['traceparent']).toBe(tp);
  });

  it('omits optional fields when not provided', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const root = createLogger('control-plane');
    const reqLog = createRequestLogger(root, { correlationId: 'corr-1' });
    reqLog.info('minimal');
    const line = String((write.mock.calls[0] as unknown[])[0]);
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(entry['correlationId']).toBe('corr-1');
    expect(entry['workspaceId']).toBeUndefined();
    expect(entry['userId']).toBeUndefined();
    expect(entry['traceparent']).toBeUndefined();
  });

  it('includes method and path when provided', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const root = createLogger('control-plane');
    const reqLog = createRequestLogger(root, {
      correlationId: 'corr-1',
      method: 'GET',
      path: '/v1/workspaces',
    });
    reqLog.info('request');
    const line = String((write.mock.calls[0] as unknown[])[0]);
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(entry['method']).toBe('GET');
    expect(entry['path']).toBe('/v1/workspaces');
  });
});
