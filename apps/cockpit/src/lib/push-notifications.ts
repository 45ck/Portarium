/**
 * Push notification registration and handling for Portarium Cockpit mobile.
 *
 * Implements a unified push pipeline for:
 *   - Web: Push API + VAPID (service worker receives push events)
 *   - Native iOS/Android: @capacitor/push-notifications → APNs/FCM
 *
 * Device token registration flow:
 *   1. Request permission via requestPushPermission()
 *   2. Obtain device token / web push subscription
 *   3. POST token to /api/notifications/device-tokens
 *   4. Service worker (sw.js) handles web push events; native plugins
 *      surface them as foreground notifications.
 *
 * Notification routing (server-side triggers):
 *   - MissionFailed      → operator who dispatched the mission
 *   - ApprovalRequested  → approvers with matching role + tenant
 *   - ApprovalDecision   → run owner
 *
 * Bead: bead-0722
 */

import { isNative } from './native-bridge.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PushPermissionStatus = 'granted' | 'denied' | 'prompt';

export interface PushRegistration {
  platform: 'web' | 'ios' | 'android';
  token: string;
  endpoint?: string; // Web push subscription endpoint
  expirationTime?: number | null;
  p256dh?: string;   // Web push auth key
  auth?: string;     // Web push auth secret
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  tag?: string;
  actions?: Array<{ action: string; title: string }>;
}

// ── VAPID public key (must be set per environment) ────────────────────────────

const VAPID_PUBLIC_KEY = import.meta.env['VITE_VAPID_PUBLIC_KEY'] as string | undefined;

// ── Device token registration endpoint ───────────────────────────────────────

const DEVICE_TOKEN_ENDPOINT = '/api/notifications/device-tokens';

// ── Permission request ────────────────────────────────────────────────────────

/**
 * Request push notification permission.
 * Returns the resulting permission status.
 */
export async function requestPushPermission(): Promise<PushPermissionStatus> {
  if (isNative()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { PushNotifications } = await import('@capacitor/push-notifications') as any;
      const result = await PushNotifications.requestPermissions() as { receive: string };
      return result.receive === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  if (!('Notification' in window)) return 'denied';

  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  const result = await Notification.requestPermission();
  return result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'prompt';
}

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Register for push notifications and return the device registration.
 * Caller should POST this to the backend via registerDeviceToken().
 */
export async function getPushRegistration(): Promise<PushRegistration | null> {
  if (isNative()) {
    return getNativePushRegistration();
  }
  return getWebPushRegistration();
}

async function getNativePushRegistration(): Promise<PushRegistration | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { PushNotifications } = await import('@capacitor/push-notifications') as any;
    await PushNotifications.register();

    return await new Promise<PushRegistration | null>((resolve) => {
      const timeoutId = setTimeout(() => resolve(null), 10_000);

      void PushNotifications.addListener('registration', (token: { value: string }) => {
        clearTimeout(timeoutId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const platform = (window as any).Capacitor?.getPlatform?.() === 'android' ? 'android' : 'ios';
        resolve({ platform, token: token.value });
      });

      void PushNotifications.addListener('registrationError', () => {
        clearTimeout(timeoutId);
        resolve(null);
      });
    });
  } catch {
    return null;
  }
}

async function getWebPushRegistration(): Promise<PushRegistration | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] VITE_VAPID_PUBLIC_KEY is not set — web push disabled');
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const json = subscription.toJSON();
  return {
    platform: 'web',
    token: subscription.endpoint,
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    p256dh: json.keys?.['p256dh'],
    auth: json.keys?.['auth'],
  };
}

// ── Backend registration ──────────────────────────────────────────────────────

/**
 * Send device registration to the Portarium backend.
 * Should be called after login (access token available).
 */
export async function registerDeviceToken(
  registration: PushRegistration,
  accessToken: string,
): Promise<boolean> {
  try {
    const response = await fetch(DEVICE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(registration),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Remove device registration from the backend (on logout).
 */
export async function unregisterDeviceToken(
  token: string,
  accessToken: string,
): Promise<boolean> {
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

// ── Foreground notification handler (native only) ─────────────────────────────

export type NotificationReceivedHandler = (notification: PushNotificationPayload) => void;

/**
 * Register a handler for foreground push notifications on native.
 * On web, foreground handling is done via the service worker's push event.
 * Returns a cleanup function.
 */
export async function onForegroundNotification(
  handler: NotificationReceivedHandler,
): Promise<() => void> {
  if (!isNative()) return () => { /* no-op */ };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { PushNotifications } = await import('@capacitor/push-notifications') as any;
    const listener = await PushNotifications.addListener(
      'pushNotificationReceived',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (notification: any) => {
        handler({
          title: String(notification.title ?? 'Portarium'),
          body: String(notification.body ?? ''),
          data: notification.data as Record<string, string> | undefined,
          tag: notification.id as string | undefined,
        });
      },
    );
    return () => { void (listener as { remove(): Promise<void> }).remove(); };
  } catch {
    return () => { /* no-op */ };
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((char) => char.charCodeAt(0)));
}
