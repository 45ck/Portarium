/**
 * Contract tests for the native bridge (web fallback paths).
 *
 * Capacitor plugin paths (isNative=true) are not testable in jsdom/node;
 * we test the web fallback behaviour and the runtime detection helpers.
 *
 * Bead: bead-0720
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isNative,
  isInstalledPwa,
  getDeliveryMode,
  secureSet,
  secureGet,
  secureRemove,
  onDeepLink,
  openInAppBrowser,
} from './native-bridge';

// ---------------------------------------------------------------------------
// Runtime detection
// ---------------------------------------------------------------------------

describe('isNative', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when window.Capacitor is absent', () => {
    vi.stubGlobal('window', { Capacitor: undefined });
    expect(isNative()).toBe(false);
  });

  it('returns false when Capacitor.isNativePlatform returns false', () => {
    vi.stubGlobal('window', {
      Capacitor: { isNativePlatform: () => false },
    });
    expect(isNative()).toBe(false);
  });

  it('returns true when Capacitor.isNativePlatform returns true', () => {
    vi.stubGlobal('window', {
      Capacitor: { isNativePlatform: () => true },
    });
    expect(isNative()).toBe(true);
  });
});

describe('isInstalledPwa', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false in plain browser context', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    });
    expect(isInstalledPwa()).toBe(false);
  });

  it('returns true when display-mode: standalone matches', () => {
    vi.stubGlobal('window', {
      matchMedia: (query: string) => ({ matches: query.includes('standalone') }),
    });
    expect(isInstalledPwa()).toBe(true);
  });
});

describe('getDeliveryMode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns "browser" in plain browser context', () => {
    vi.stubGlobal('window', {
      Capacitor: undefined,
      matchMedia: () => ({ matches: false }),
    });
    expect(getDeliveryMode()).toBe('browser');
  });

  it('returns "pwa" in standalone mode', () => {
    vi.stubGlobal('window', {
      Capacitor: undefined,
      matchMedia: (query: string) => ({ matches: query.includes('standalone') }),
    });
    expect(getDeliveryMode()).toBe('pwa');
  });

  it('returns "native" when Capacitor is present', () => {
    vi.stubGlobal('window', {
      Capacitor: { isNativePlatform: () => true },
      matchMedia: () => ({ matches: false }),
    });
    expect(getDeliveryMode()).toBe('native');
  });
});

// ---------------------------------------------------------------------------
// Secure storage (web fallback path via sessionStorage)
// ---------------------------------------------------------------------------

describe('secureSet / secureGet / secureRemove (web)', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.stubGlobal('window', {
      Capacitor: undefined,
      matchMedia: () => ({ matches: false }),
    });
    vi.stubGlobal('sessionStorage', {
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  });

  it('stores and retrieves a value', async () => {
    await secureSet('testKey', 'testValue');
    const result = await secureGet('testKey');
    expect(result).toBe('testValue');
  });

  it('returns null for a key that was never set', async () => {
    const result = await secureGet('nonexistent');
    expect(result).toBeNull();
  });

  it('removes a key', async () => {
    await secureSet('deleteMe', 'value');
    await secureRemove('deleteMe');
    const result = await secureGet('deleteMe');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// onDeepLink (web popstate fallback)
// ---------------------------------------------------------------------------

describe('onDeepLink (web)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers a popstate listener and calls handler with current href', async () => {
    const handler = vi.fn();
    const listeners: Record<string, EventListener[]> = {};

    vi.stubGlobal('window', {
      Capacitor: undefined,
      matchMedia: () => ({ matches: false }),
      location: { href: 'https://app.portarium.io/dashboard' },
      addEventListener: vi.fn((event: string, cb: EventListener) => {
        listeners[event] = listeners[event] ?? [];
        listeners[event].push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: EventListener) => {
        listeners[event] = (listeners[event] ?? []).filter((l) => l !== cb);
      }),
    });

    const cleanup = await onDeepLink(handler);

    // Simulate a popstate event
    expect(listeners['popstate']).toHaveLength(1);
    listeners['popstate'][0](new Event('popstate'));

    expect(handler).toHaveBeenCalledWith('https://app.portarium.io/dashboard');

    // Cleanup removes the listener
    cleanup();
    expect(listeners['popstate']).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// openInAppBrowser (web fallback)
// ---------------------------------------------------------------------------

describe('openInAppBrowser (web)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls window.open with the URL on web', async () => {
    const openMock = vi.fn();
    vi.stubGlobal('window', {
      Capacitor: undefined,
      matchMedia: () => ({ matches: false }),
      open: openMock,
    });

    await openInAppBrowser('https://auth.example.com/authorize');
    expect(openMock).toHaveBeenCalledWith(
      'https://auth.example.com/authorize',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
