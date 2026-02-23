/**
 * Auth store — Zustand-backed authentication state for Portarium Cockpit.
 *
 * Manages the OIDC token lifecycle:
 *   - Initialization from secure storage on app start
 *   - Login redirect (opens OIDC PKCE flow)
 *   - Callback handling (deep link or redirect)
 *   - Logout (clears tokens from secure storage)
 *
 * Uses the native bridge for secure storage (Keychain on iOS,
 * EncryptedSharedPreferences on Android, sessionStorage on web).
 *
 * Bead: bead-0721
 */

import { create } from 'zustand';
import {
  secureGet,
  secureSet,
  secureRemove,
  openInAppBrowser,
  closeInAppBrowser,
  onDeepLink,
  isNative,
} from '@/lib/native-bridge';
import {
  loadOidcConfig,
  isOidcConfigured,
  prepareLoginSession,
  exchangeCode,
  parseCallbackUrl,
  decodeJwtPayload,
  OidcError,
} from '@/lib/oidc-client';

// ---------------------------------------------------------------------------
// Token storage keys
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'portarium_cockpit_bearer_token';
const REFRESH_TOKEN_KEY = 'portarium_cockpit_refresh_token';

// ---------------------------------------------------------------------------
// Auth state types
// ---------------------------------------------------------------------------

export type AuthStatus =
  | 'initializing' // Checking secure storage for existing token
  | 'unauthenticated' // No valid token; show login screen
  | 'authenticating' // OIDC flow in progress (browser open)
  | 'authenticated' // Token valid; app shell ready
  | 'error'; // Auth flow failed

export interface ParsedAuthClaims {
  sub: string;
  workspaceId: string;
  roles: string[];
  displayName?: string;
}

export interface AuthState {
  status: AuthStatus;
  token: string | null;
  claims: ParsedAuthClaims | null;
  error: string | null;

  /** Initialize auth — reads token from secure storage. Call on app start. */
  initialize(): Promise<void>;

  /** Start OIDC login flow — opens in-app browser. */
  login(): Promise<void>;

  /** Handle the OIDC callback URL (deep link or browser redirect). */
  handleCallback(callbackUrl: string): Promise<void>;

  /** Log out — clears tokens from secure storage. */
  logout(): Promise<void>;

  /** Read the current bearer token synchronously (for ControlPlaneClient). */
  getToken(): string | undefined;
}

// ---------------------------------------------------------------------------
// Claim extraction
// ---------------------------------------------------------------------------

function extractClaims(jwt: string): ParsedAuthClaims | null {
  try {
    const payload = decodeJwtPayload(jwt);
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    const workspaceId =
      typeof payload.workspaceId === 'string'
        ? payload.workspaceId
        : typeof payload.tenantId === 'string'
          ? payload.tenantId
          : '';
    const roles = Array.isArray(payload.roles)
      ? (payload.roles as unknown[]).filter((r): r is string => typeof r === 'string')
      : [];
    const displayName =
      typeof payload.name === 'string'
        ? payload.name
        : typeof payload.preferred_username === 'string'
          ? payload.preferred_username
          : undefined;

    if (!sub || !workspaceId || roles.length === 0) return null;
    return { sub, workspaceId, roles, displayName };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'initializing',
  token: null,
  claims: null,
  error: null,

  async initialize() {
    try {
      const stored = await secureGet(TOKEN_KEY);
      if (stored) {
        const claims = extractClaims(stored);
        if (claims) {
          set({ status: 'authenticated', token: stored, claims, error: null });
          return;
        }
        // Token present but claims invalid — clear stale token
        await secureRemove(TOKEN_KEY);
      }
      set({ status: 'unauthenticated', token: null, claims: null, error: null });
    } catch {
      set({ status: 'unauthenticated', token: null, claims: null, error: null });
    }
  },

  async login() {
    const config = loadOidcConfig();
    if (!isOidcConfigured(config)) {
      // OIDC not configured — skip to unauthenticated (dev/test mode)
      set({ status: 'unauthenticated', error: null });
      return;
    }

    set({ status: 'authenticating', error: null });

    try {
      const session = await prepareLoginSession({ config });

      if (isNative()) {
        // On native: use Capacitor in-app browser + deep link callback
        // The callback is handled when the OS returns the deep link
        // (registered listener in handleCallback via onDeepLink)
        await openInAppBrowser(session.authorizationUrl);
      } else {
        // On web: redirect the page to the OIDC provider
        // After login, the provider redirects back to redirectUri
        window.location.assign(session.authorizationUrl);
      }
    } catch (err) {
      const message = err instanceof OidcError ? err.message : 'Failed to start login';
      set({ status: 'error', error: message });
    }
  },

  async handleCallback(callbackUrl: string) {
    try {
      const params = parseCallbackUrl(callbackUrl);

      if (params.error) {
        throw new OidcError(
          `OIDC error: ${params.error} — ${params.errorDescription ?? 'no details'}`,
          'token_exchange_failed',
        );
      }

      // Close the in-app browser on native before exchanging the code
      if (isNative()) {
        await closeInAppBrowser();
      }

      const tokens = await exchangeCode({
        code: params.code,
        callbackState: params.state,
        fromSession: true,
      });

      const token = tokens.access_token;
      const claims = extractClaims(token);

      if (!claims) {
        throw new OidcError('Token does not contain required Portarium claims', 'invalid_jwt');
      }

      // Persist token to secure storage
      await secureSet(TOKEN_KEY, token);
      if (tokens.refresh_token) {
        await secureSet(REFRESH_TOKEN_KEY, tokens.refresh_token);
      }

      set({ status: 'authenticated', token, claims, error: null });
    } catch (err) {
      const message = err instanceof OidcError ? err.message : 'Auth callback failed';
      set({ status: 'error', error: message });
    }
  },

  async logout() {
    await secureRemove(TOKEN_KEY);
    await secureRemove(REFRESH_TOKEN_KEY);
    set({ status: 'unauthenticated', token: null, claims: null, error: null });
  },

  getToken(): string | undefined {
    return get().token ?? undefined;
  },
}));

// ---------------------------------------------------------------------------
// Deep link listener setup (call once in root layout)
// ---------------------------------------------------------------------------

const OIDC_DEEP_LINK_PREFIXES = ['portarium://auth/callback', 'https://portarium.io/app/auth'];

/**
 * Register a deep link listener that handles OIDC callbacks on native.
 * Returns a cleanup function — call it when unmounting the root layout.
 */
export async function setupDeepLinkAuthHandler(): Promise<() => void> {
  const cleanup = await onDeepLink((url: string) => {
    const isCallback = OIDC_DEEP_LINK_PREFIXES.some((prefix) => url.startsWith(prefix));
    if (!isCallback) return;
    void useAuthStore.getState().handleCallback(url);
  });
  return cleanup;
}
