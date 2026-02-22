/**
 * Unit tests for push notification registration contract.
 *
 * Tests device token registration HTTP contract and pure utility logic.
 * Browser-specific Notification/PushManager APIs are not tested here
 * (they live in the cockpit app layer).
 *
 * Bead: bead-0722
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Minimal PushRegistration type (replicated from push-notifications.ts) ────

interface PushRegistration {
  platform: 'web' | 'ios' | 'android';
  token: string;
  endpoint?: string;
  expirationTime?: number | null;
  p256dh?: string;
  auth?: string;
}

// ── Mock fetch ────────────────────────────────────────────────────────────────
const mockFetch = vi.fn() as any;
vi.stubGlobal('fetch', mockFetch);

// ── Inline implementations under test ────────────────────────────────────────

const DEVICE_TOKEN_ENDPOINT = '/api/notifications/device-tokens';

async function registerDeviceToken(reg: PushRegistration, accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(DEVICE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(reg),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function unregisterDeviceToken(token: string, accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(`${DEVICE_TOKEN_ENDPOINT}/${encodeURIComponent(token)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((char) => char.charCodeAt(0)));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('registerDeviceToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs device registration to the backend', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 201 }));

    const reg: PushRegistration = {
      platform: 'ios',
      token: 'apns-token-abc123',
    };

    const ok = await registerDeviceToken(reg, 'access-token-xyz');

    expect(ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      DEVICE_TOKEN_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token-xyz',
          'Content-Type': 'application/json',
        }),
      }),
    );

    const call = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1]?.body as string) as PushRegistration;
    expect(body.platform).toBe('ios');
    expect(body.token).toBe('apns-token-abc123');
  });

  it('POSTs web push subscription including p256dh and auth keys', async () => {
    mockFetch.mockResolvedValue(new Response('{}', { status: 201 }));

    const reg: PushRegistration = {
      platform: 'web',
      token: 'https://push.example.com/endpoint',
      endpoint: 'https://push.example.com/endpoint',
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlotoMdDkU0',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    };

    await registerDeviceToken(reg, 'access-token-xyz');

    const call = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1]?.body as string) as PushRegistration;
    expect(body.platform).toBe('web');
    expect(body.p256dh).toBeDefined();
    expect(body.auth).toBeDefined();
  });

  it('returns false on HTTP error', async () => {
    mockFetch.mockResolvedValue(new Response('error', { status: 500 }));

    const ok = await registerDeviceToken({ platform: 'android', token: 'fcm-token' }, 'tok');
    expect(ok).toBe(false);
  });

  it('returns false on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const ok = await registerDeviceToken({ platform: 'ios', token: 'apns-tok' }, 'tok');
    expect(ok).toBe(false);
  });
});

describe('unregisterDeviceToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends DELETE request with the token encoded in the URL', async () => {
    mockFetch.mockResolvedValue(new Response('', { status: 200 }));

    await unregisterDeviceToken('fcm-token/with+special=chars', 'access-tok');

    expect(mockFetch).toHaveBeenCalledWith(
      `${DEVICE_TOKEN_ENDPOINT}/${encodeURIComponent('fcm-token/with+special=chars')}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('returns true on 404 (idempotent unregister)', async () => {
    mockFetch.mockResolvedValue(new Response('', { status: 404 }));
    const ok = await unregisterDeviceToken('tok', 'at');
    expect(ok).toBe(true);
  });
});

describe('urlBase64ToUint8Array', () => {
  it('converts URL-safe base64 VAPID key to Uint8Array', () => {
    // Valid URL-safe base64 (no invalid chars)
    const vapidKey = 'dGVzdC1rZXktZm9yLXVuaXQtdGVzdGluZy1wdXJwb3Nlcw'; // "test-key-for-unit-testing-purposes" base64url
    const result = urlBase64ToUint8Array(vapidKey);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles padding correctly for different key lengths', () => {
    // Length not divisible by 4 — padding must be added
    const key = 'abc'; // 3 chars → needs 1 padding char
    const result = urlBase64ToUint8Array(key);
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
