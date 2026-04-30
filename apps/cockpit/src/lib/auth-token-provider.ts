import { isNative } from '@/lib/native-bridge';

const LEGACY_BROWSER_TOKEN_KEYS = [
  'portarium_cockpit_bearer_token',
  'portarium_cockpit_refresh_token',
  'portarium_bearer_token',
];

let nativeBearerToken: string | null = null;

export function setNativeBearerToken(token: string | null): void {
  nativeBearerToken = token && token.trim() !== '' ? token : null;
}

export function getBearerTokenForControlPlane(): string | undefined {
  if (!isNative()) return undefined;
  return nativeBearerToken ?? undefined;
}

export function clearLegacyBrowserBearerTokens(): void {
  const storages = browserTokenStores();
  if (storages.length === 0) return;
  for (const key of LEGACY_BROWSER_TOKEN_KEYS) {
    for (const storage of storages) {
      storage.removeItem(key);
    }
  }
}

function browserTokenStores(): Storage[] {
  const stores = new Set<Storage>();
  if (typeof window !== 'undefined') {
    try {
      stores.add(window.localStorage);
      stores.add(window.sessionStorage);
    } catch {
      // Ignore unavailable browser storage.
    }
  }
  try {
    if (globalThis.localStorage) stores.add(globalThis.localStorage);
    if (globalThis.sessionStorage) stores.add(globalThis.sessionStorage);
  } catch {
    // Ignore unavailable test/runtime storage.
  }
  return [...stores];
}
