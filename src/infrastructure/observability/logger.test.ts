import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger } from './logger.js';

describe('createLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes info as JSON to stdout', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const log = createLogger('test-logger');
    log.info('hello');
    expect(write).toHaveBeenCalledOnce();
    const line = String((write.mock.calls[0] as unknown[])[0]);
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(entry['level']).toBe('info');
    expect(entry['name']).toBe('test-logger');
    expect(entry['msg']).toBe('hello');
    expect(typeof entry['time']).toBe('number');
  });

  it('writes error to stderr', () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const log = createLogger('test-logger');
    log.error('boom');
    expect(write).toHaveBeenCalledOnce();
    const line = String((write.mock.calls[0] as unknown[])[0]);
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(entry['level']).toBe('error');
  });

  it('writes warn to stderr', () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const log = createLogger('test-logger');
    log.warn('careful');
    expect(write).toHaveBeenCalledOnce();
  });

  it('includes extra fields in the JSON entry', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const log = createLogger('test-logger');
    log.info('ctx', { workspaceId: 'ws-1', userId: 'u-2' });
    const line = String((write.mock.calls[0] as unknown[])[0]);
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(entry['workspaceId']).toBe('ws-1');
    expect(entry['userId']).toBe('u-2');
  });

  it('child logger merges bindings', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const log = createLogger('test-logger').child({ workspaceId: 'ws-99' });
    log.info('child msg', { extra: 'x' });
    const line = String((write.mock.calls[0] as unknown[])[0]);
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(entry['workspaceId']).toBe('ws-99');
    expect(entry['extra']).toBe('x');
    expect(entry['msg']).toBe('child msg');
  });

  it('child fields override parent bindings', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const log = createLogger('test-logger', { workspaceId: 'ws-old' }).child({
      workspaceId: 'ws-new',
    });
    log.info('override');
    const line = String((write.mock.calls[0] as unknown[])[0]);
    const entry = JSON.parse(line) as Record<string, unknown>;
    expect(entry['workspaceId']).toBe('ws-new');
  });
});
