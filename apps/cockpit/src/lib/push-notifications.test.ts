/**
 * Contract tests for the push notification pipeline.
 *
 * Tests the web fallback paths (no Capacitor). Native paths require a real
 * iOS/Android device and are exercised by integration tests in CI.
 *
 * Bead: bead-0722
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  requestPushPermission,
  registerDeviceToken,
  unregisterDeviceToken,
  onForegroundNotification,
  type PushRegistration,
} from './push-notifications';

// Ensure we always run in web (non-native) mode
beforeEach(() => {
  vi.stubGlobal('window', {
    Capacitor: undefined,
    matchMedia: () => ({ matches: false }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// requestPushPermission (web)
// ---------------------------------------------------------------------------

describe('requestPushPermission (web)', () => {
  it('returns "denied" when Notification API is absent', async () => {
    // window has no Notification
    const result = await requestPushPermission();
    expect(result).toBe('denied');
  });

  it('returns "granted" when Notification.permission is already granted', async () => {
    const Notification = {
      permission: 'granted',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    };
    vi.stubGlobal('window', {
      Capacitor: undefined,
      matchMedia: () => ({ matches: false }),
      Notification,
    });
    vi.stubGlobal('Notification', Notification);
    const result = await requestPushPermission();
    expect(result).toBe('granted');
  });

  it('returns "denied" when Notification.permission is denied', async () => {
    const Notification = {
      permission: 'denied',
      requestPermission: vi.fn().mockResolvedValue('denied'),
    };
    vi.stubGlobal('window', {
      Capacitor: undefined,
      matchMedia: () => ({ matches: false }),
      Notification,
    });
    vi.stubGlobal('Notification', Notification);
    const result = await requestPushPermission();
    expect(result).toBe('denied');
  });

  it('calls requestPermission and maps "granted" result', async () => {
    const Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    };
    vi.stubGlobal('window', {
      Capacitor: undefined,
      matchMedia: () => ({ matches: false }),
      Notification,
    });
    vi.stubGlobal('Notification', Notification);
    const result = await requestPushPermission();
    expect(result).toBe('granted');
  });

  it('calls requestPermission and maps "denied" result', async () => {
    const Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('denied'),
    };
    vi.stubGlobal('window', {
      Capacitor: undefined,
      matchMedia: () => ({ matches: false }),
      Notification,
    });
    vi.stubGlobal('Notification', Notification);
    const result = await requestPushPermission();
    expect(result).toBe('denied');
  });

  it('returns "prompt" for unexpected permission value', async () => {
    const Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('default'),
    };
    vi.stubGlobal('window', {
      Capacitor: undefined,
      matchMedia: () => ({ matches: false }),
      Notification,
    });
    vi.stubGlobal('Notification', Notification);
    const result = await requestPushPermission();
    expect(result).toBe('prompt');
  });
});

// ---------------------------------------------------------------------------
// registerDeviceToken
// ---------------------------------------------------------------------------

describe('registerDeviceToken', () => {
  const registration: PushRegistration = {
    platform: 'web',
    token: 'https://push.example.com/sub/abc123',
    endpoint: 'https://push.example.com/sub/abc123',
  };

  it('returns true on successful POST', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true }));
    const result = await registerDeviceToken(registration, 'test-token');
    expect(result).toBe(true);

    const [url, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/notifications/device-tokens');
    expect(options.method).toBe('POST');
    expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
  });

  it('returns false on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 422 }));
    const result = await registerDeviceToken(registration, 'test-token');
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network failure')));
    const result = await registerDeviceToken(registration, 'test-token');
    expect(result).toBe(false);
  });

  it('sends the registration payload as JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true }));
    await registerDeviceToken(registration, 'tok');
    const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as PushRegistration;
    expect(body.platform).toBe('web');
    expect(body.token).toBe(registration.token);
  });
});

// ---------------------------------------------------------------------------
// unregisterDeviceToken
// ---------------------------------------------------------------------------

describe('unregisterDeviceToken', () => {
  it('returns true on successful DELETE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, status: 204 }));
    const result = await unregisterDeviceToken('my-token', 'access-tok');
    expect(result).toBe(true);
    const [url, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('my-token');
    expect(options.method).toBe('DELETE');
  });

  it('returns true on 404 (idempotent delete)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 404 }));
    const result = await unregisterDeviceToken('gone-token', 'tok');
    expect(result).toBe(true);
  });

  it('returns false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')));
    const result = await unregisterDeviceToken('tok', 'tok');
    expect(result).toBe(false);
  });

  it('URL-encodes the token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, status: 204 }));
    await unregisterDeviceToken('https://push.example.com/sub/abc 123', 'tok');
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain(encodeURIComponent('https://push.example.com/sub/abc 123'));
  });
});

// ---------------------------------------------------------------------------
// onForegroundNotification (web — returns no-op cleanup)
// ---------------------------------------------------------------------------

describe('onForegroundNotification (web)', () => {
  it('returns a no-op cleanup function on web', async () => {
    const handler = vi.fn();
    const cleanup = await onForegroundNotification(handler);
    // Calling cleanup should not throw
    expect(() => cleanup()).not.toThrow();
    // Handler should NOT have been called
    expect(handler).not.toHaveBeenCalled();
  });
});
