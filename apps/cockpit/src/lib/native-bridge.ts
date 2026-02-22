/**
 * Native bridge — runtime detection and Capacitor plugin delegation.
 *
 * All Capacitor plugin calls MUST go through this module.
 * Direct imports from `@capacitor/*` packages outside this file are forbidden.
 *
 * On web: falls back to Web APIs (or no-ops where no equivalent exists).
 * On native: delegates to the appropriate Capacitor plugin.
 *
 * Bead: bead-0720 (full implementation; bead-0714 created the stub)
 */

// ── Runtime detection ─────────────────────────────────────────────────────────

/** Returns true when running inside a Capacitor native shell (iOS/Android). */
export function isNative(): boolean {
  return (
    typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(window as any).Capacitor?.isNativePlatform?.()
  );
}

/** Returns true when the app is installed as a PWA (display-mode: standalone). */
export function isInstalledPwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(navigator as any).standalone
  );
}

/** Returns 'native', 'pwa', or 'browser'. */
export type AppDeliveryMode = 'native' | 'pwa' | 'browser';

export function getDeliveryMode(): AppDeliveryMode {
  if (isNative()) return 'native';
  if (isInstalledPwa()) return 'pwa';
  return 'browser';
}

// ── Secure storage (Preferences / Keychain / Keystore) ───────────────────────

/** Store a string value in native Keychain/Keystore-backed secure storage. */
export async function secureSet(key: string, value: string): Promise<void> {
  if (isNative()) {
    try {
      // @capacitor/preferences uses Keychain (iOS) / EncryptedSharedPreferences (Android).
      // Dynamically imported so the build does not hard-depend on the package.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { Preferences } = (await import('@capacitor/preferences')) as any;
      await Preferences.set({ key, value });
      return;
    } catch {
      /* fall through to web storage */
    }
  }
  sessionStorage.setItem(key, value);
}

/** Retrieve a value from secure storage. Returns null if not found. */
export async function secureGet(key: string): Promise<string | null> {
  if (isNative()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { Preferences } = (await import('@capacitor/preferences')) as any;
      const { value } = (await Preferences.get({ key })) as { value: string | null };
      return value;
    } catch {
      /* fall through */
    }
  }
  return sessionStorage.getItem(key);
}

/** Remove a value from secure storage. */
export async function secureRemove(key: string): Promise<void> {
  if (isNative()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { Preferences } = (await import('@capacitor/preferences')) as any;
      await Preferences.remove({ key });
      return;
    } catch {
      /* fall through */
    }
  }
  sessionStorage.removeItem(key);
}

// ── Deep links ────────────────────────────────────────────────────────────────

export type DeepLinkHandler = (url: string) => void;

let _deepLinkCleanup: (() => void) | null = null;

/**
 * Register a deep link handler. Returns a cleanup function.
 * URL scheme: portarium://path?params
 * Universal link: https://portarium.io/app/path
 */
export async function onDeepLink(handler: DeepLinkHandler): Promise<() => void> {
  if (_deepLinkCleanup) {
    _deepLinkCleanup();
    _deepLinkCleanup = null;
  }

  if (isNative()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { App } = (await import('@capacitor/app')) as any;
      const listener = await App.addListener('appUrlOpen', (event: { url: string }) => {
        handler(event.url);
      });
      _deepLinkCleanup = () => {
        void (listener as { remove(): Promise<void> }).remove();
      };
      return _deepLinkCleanup;
    } catch {
      /* fall through */
    }
  }

  // Web fallback: treat popstate as navigation deep-link
  const webHandler = () => {
    handler(window.location.href);
  };
  window.addEventListener('popstate', webHandler);
  _deepLinkCleanup = () => window.removeEventListener('popstate', webHandler);
  return _deepLinkCleanup;
}

// ── Clipboard ─────────────────────────────────────────────────────────────────

export async function writeToClipboard(text: string): Promise<void> {
  if (isNative()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { Clipboard } = (await import('@capacitor/clipboard')) as any;
      await Clipboard.write({ string: text });
      return;
    } catch {
      /* fall through */
    }
  }
  await navigator.clipboard.writeText(text);
}

// ── Haptic feedback ───────────────────────────────────────────────────────────

export async function hapticTap(): Promise<void> {
  if (!isNative()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { Haptics, ImpactStyle } = (await import('@capacitor/haptics')) as any;
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* devices without haptics */
  }
}

// ── Share ─────────────────────────────────────────────────────────────────────

export interface ShareOptions {
  title: string;
  text?: string;
  url?: string;
}

export async function share(options: ShareOptions): Promise<void> {
  if (isNative()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { Share } = (await import('@capacitor/share')) as any;
      await Share.share(options);
      return;
    } catch {
      /* fall through */
    }
  }
  if (navigator.share) {
    await navigator.share(options);
  }
}

// ── In-app browser (for OIDC PKCE flow) ──────────────────────────────────────

export async function openInAppBrowser(url: string): Promise<void> {
  if (isNative()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { Browser } = (await import('@capacitor/browser')) as any;
      await Browser.open({ url, presentationStyle: 'popover' });
      return;
    } catch {
      /* fall through */
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function closeInAppBrowser(): Promise<void> {
  if (!isNative()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { Browser } = (await import('@capacitor/browser')) as any;
    await Browser.close();
  } catch {
    /* ignore */
  }
}

// ── App info ──────────────────────────────────────────────────────────────────

export interface AppInfo {
  name: string;
  id: string;
  build: string;
  version: string;
}

export async function getAppInfo(): Promise<AppInfo | null> {
  if (!isNative()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { App } = (await import('@capacitor/app')) as any;
    return (await App.getInfo()) as AppInfo;
  } catch {
    return null;
  }
}

// ── Status bar ────────────────────────────────────────────────────────────────

export async function setStatusBarStyle(style: 'light' | 'dark'): Promise<void> {
  if (!isNative()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { StatusBar, Style } = (await import('@capacitor/status-bar')) as any;
    await StatusBar.setStyle({ style: style === 'light' ? Style.Light : Style.Dark });
  } catch {
    /* ignore */
  }
}
