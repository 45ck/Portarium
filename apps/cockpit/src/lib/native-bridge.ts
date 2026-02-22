/**
 * Native bridge — runtime detection for Capacitor vs web environment.
 *
 * All Capacitor plugin calls in the app MUST go through this module.
 * Direct imports from `@capacitor/*` packages outside this file are forbidden.
 *
 * Bead: bead-0714
 */

// ── Runtime detection ─────────────────────────────────────────────────────────

/** Returns true when running inside a Capacitor native shell (iOS/Android). */
export function isNative(): boolean {
  return typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(window as any).Capacitor?.isNativePlatform?.();
}

/** Returns true when the app is installed as a PWA (display-mode: standalone). */
export function isInstalledPwa(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari adds navigator.standalone
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(navigator as any).standalone;
}

/** Returns 'native', 'pwa', or 'browser'. */
export type AppDeliveryMode = 'native' | 'pwa' | 'browser';

export function getDeliveryMode(): AppDeliveryMode {
  if (isNative()) return 'native';
  if (isInstalledPwa()) return 'pwa';
  return 'browser';
}

// ── Clipboard ─────────────────────────────────────────────────────────────────

export async function writeToClipboard(text: string): Promise<void> {
  if (isNative()) {
    // Will be implemented with @capacitor/clipboard in bead-0720
    await navigator.clipboard.writeText(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}

// ── Haptic feedback ───────────────────────────────────────────────────────────

/** Trigger a light haptic tap (no-op on web). */
export async function hapticTap(): Promise<void> {
  if (!isNative()) return;
  // Will be implemented with @capacitor/haptics in bead-0720
}

// ── Share ─────────────────────────────────────────────────────────────────────

export interface ShareOptions {
  title: string;
  text?: string;
  url?: string;
}

export async function share(options: ShareOptions): Promise<void> {
  if (isNative()) {
    // Will be implemented with @capacitor/share in bead-0720
    if (navigator.share) {
      await navigator.share(options);
    }
    return;
  }
  if (navigator.share) {
    await navigator.share(options);
  }
}

// ── App version ───────────────────────────────────────────────────────────────

export interface AppInfo {
  name: string;
  id: string;
  build: string;
  version: string;
}

export async function getAppInfo(): Promise<AppInfo | null> {
  if (!isNative()) return null;
  // Will be implemented with @capacitor/app in bead-0720
  return null;
}

// ── Status bar ────────────────────────────────────────────────────────────────

/** Set status bar style (light/dark). No-op on web. */
export async function setStatusBarStyle(_style: 'light' | 'dark'): Promise<void> {
  if (!isNative()) return;
  // Will be implemented with @capacitor/status-bar in bead-0720
}
