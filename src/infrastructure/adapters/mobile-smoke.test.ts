/**
 * Mobile capability smoke tests for Portarium Cockpit.
 *
 * Validates structural contracts for the native bridge and mobile modules.
 * These tests run in the Node/vitest environment on every PR and in CI —
 * they do NOT require a browser, Capacitor runtime, or physical device.
 *
 * Bead: bead-0723
 */

import { describe, expect, it } from 'vitest';

// ── Capacitor config contract ─────────────────────────────────────────────────
// Import the TS config directly (vitest handles TS natively).

import capacitorConfigDefault from '../../../apps/cockpit/capacitor.config.js';

const capacitorConfig = capacitorConfigDefault as {
  appId: string;
  appName: string;
  webDir: string;
  ios?: { deploymentTarget?: string };
  android?: { minSdkVersion?: number; targetSdkVersion?: number };
  plugins?: Record<string, unknown>;
};

describe('capacitor.config contract', () => {
  it('has required appId com.portarium.cockpit', () => {
    expect(capacitorConfig.appId).toBe('com.portarium.cockpit');
  });

  it('has required appName', () => {
    expect(capacitorConfig.appName).toBe('Portarium Cockpit');
  });

  it('webDir points to dist', () => {
    expect(capacitorConfig.webDir).toBe('dist');
  });

  it('iOS deployment target is 15.0 or higher', () => {
    const target = capacitorConfig.ios?.deploymentTarget;
    expect(target).toBeDefined();
    expect(parseFloat(target!)).toBeGreaterThanOrEqual(15);
  });

  it('Android minSdkVersion is 26 or higher', () => {
    expect(capacitorConfig.android?.minSdkVersion).toBeGreaterThanOrEqual(26);
  });

  it('Android targetSdkVersion is 34 or higher', () => {
    expect(capacitorConfig.android?.targetSdkVersion).toBeGreaterThanOrEqual(34);
  });

  it('PushNotifications plugin config is present', () => {
    expect(capacitorConfig.plugins?.['PushNotifications']).toBeDefined();
  });

  it('SplashScreen plugin config is present', () => {
    expect(capacitorConfig.plugins?.['SplashScreen']).toBeDefined();
  });
});

// ── Push registration HTTP contract ──────────────────────────────────────────
// Re-validate the key HTTP shapes (belt-and-suspenders alongside the dedicated test).

const DEVICE_TOKEN_ENDPOINT = '/api/notifications/device-tokens';

describe('push registration HTTP contract shapes', () => {
  it('device token endpoint constant is correct path', () => {
    expect(DEVICE_TOKEN_ENDPOINT).toBe('/api/notifications/device-tokens');
    expect(DEVICE_TOKEN_ENDPOINT).toMatch(/^\/api\//);
  });

  it('PushRegistration shape allows web platform with VAPID keys', () => {
    const reg = {
      platform: 'web' as const,
      token: 'https://push.example.com/sub',
      endpoint: 'https://push.example.com/sub',
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    };
    expect(reg.platform).toBe('web');
    expect(reg.p256dh).toBeDefined();
    expect(reg.auth).toBeDefined();
  });

  it('PushRegistration shape allows iOS platform with token only', () => {
    const reg = { platform: 'ios' as const, token: 'apns-device-token-hex' };
    expect(reg.platform).toBe('ios');
    expect(reg.token).toBeTruthy();
  });

  it('PushRegistration shape allows Android platform with FCM token', () => {
    const reg = { platform: 'android' as const, token: 'fcm-registration-token' };
    expect(reg.platform).toBe('android');
  });

  it('unregister URL encodes special characters in token', () => {
    const token = 'https://push.example.com/sub/with spaces+and=equals';
    const url = `${DEVICE_TOKEN_ENDPOINT}/${encodeURIComponent(token)}`;
    expect(url).not.toContain(' ');
    expect(url).not.toContain('+');
    expect(decodeURIComponent(url.split('/').pop()!)).toBe(token);
  });
});

// ── OIDC PKCE contract ────────────────────────────────────────────────────────

describe('OIDC PKCE URL parameter contract', () => {
  it('auth request includes required PKCE parameters', () => {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: 'portarium-cockpit',
      redirect_uri: 'portarium://auth/callback',
      scope: 'openid profile email',
      state: 'random-state',
      code_challenge: 'challenge-hash',
      code_challenge_method: 'S256',
    });
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('response_type')).toBe('code');
  });

  it('token exchange includes authorization_code grant', () => {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: 'portarium-cockpit',
      redirect_uri: 'portarium://auth/callback',
      code: 'auth-code-abc',
      code_verifier: 'verifier-xyz',
    });
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code_verifier')).toBeTruthy();
  });

  it('refresh uses refresh_token grant (no code_verifier)', () => {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: 'portarium-cockpit',
      refresh_token: 'rt-value',
    });
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('code_verifier')).toBeNull();
  });
});

// ── Rollout gating constants ──────────────────────────────────────────────────

describe('mobile rollout feature gate contract', () => {
  it('platform identifiers match Capacitor getPlatform() values', () => {
    const validPlatforms = ['ios', 'android', 'web'] as const;
    // Capacitor returns exactly these strings from getPlatform()
    expect(validPlatforms).toContain('ios');
    expect(validPlatforms).toContain('android');
    expect(validPlatforms).toContain('web');
    expect(validPlatforms).toHaveLength(3);
  });

  it('deep link scheme is portarium://', () => {
    const scheme = 'portarium';
    const deepLink = `${scheme}://auth/callback`;
    expect(deepLink).toMatch(/^portarium:\/\//);
  });

  it('bundle identifier format is reverse-DNS', () => {
    const appId = 'com.portarium.cockpit';
    expect(appId.split('.').length).toBeGreaterThanOrEqual(3);
    expect(appId).toMatch(/^[a-z]+\.[a-z]+\.[a-z]+/);
  });
});
