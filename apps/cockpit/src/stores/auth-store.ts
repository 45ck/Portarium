/**
 * Auth store — Zustand-backed authentication state for Portarium Cockpit.
 *
 * Manages the OIDC token lifecycle:
 *   - Initialization from secure storage on app start
 *   - Login redirect (opens OIDC PKCE flow)
 *   - Callback handling (deep link or redirect)
 *   - Logout (clears tokens from secure storage)
 *
 * Native builds use secure storage (Keychain on iOS,
 * EncryptedSharedPreferences on Android). Web builds use an HttpOnly
 * same-origin Cockpit session cookie; access and refresh tokens are not
 * stored in JS-readable browser storage.
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
import {
  parseApprovalNavigationTarget,
  type ApprovalNavigationTarget,
} from '@/lib/approval-navigation';
import { clearPersistedQueryCache, queryClient } from '@/lib/query-client';
import { clearLegacyBrowserBearerTokens, setNativeBearerToken } from '@/lib/auth-token-provider';
import {
  createDevelopmentWebSession,
  establishWebSession,
  fetchCurrentWebSession,
  logoutWebSession,
} from '@/lib/web-session-auth';

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
  personas: string[];
  capabilities: string[];
  apiScopes: string[];
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
    const personas = readStringClaims(payload, ['personas', 'extensionPersonas', 'persona']);
    const capabilities = readStringClaims(payload, ['capabilities', 'extensionCapabilities']);
    const apiScopes = readStringClaims(payload, ['apiScopes', 'scopes', 'scp', 'scope']);
    const displayName =
      typeof payload.name === 'string'
        ? payload.name
        : typeof payload.preferred_username === 'string'
          ? payload.preferred_username
          : undefined;

    if (!sub || !workspaceId || roles.length === 0) return null;
    return { sub, workspaceId, roles, personas, capabilities, apiScopes, displayName };
  } catch {
    return null;
  }
}

function readStringClaims(payload: Record<string, unknown>, keys: readonly string[]): string[] {
  return [
    ...new Set(
      keys.flatMap((key) => {
        const value = payload[key];
        if (Array.isArray(value)) {
          return value.filter((item): item is string => typeof item === 'string');
        }
        if (typeof value === 'string') {
          return value.split(/\s+/).filter(Boolean);
        }
        return [];
      }),
    ),
  ];
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
      if (!isNative()) {
        clearLegacyBrowserBearerTokens();
        const session = await fetchCurrentWebSession();
        if (session) {
          set({ status: 'authenticated', token: null, claims: session.claims, error: null });
          return;
        }
        clearPersistedQueryCache();
        queryClient.clear();
        set({ status: 'unauthenticated', token: null, claims: null, error: null });
        return;
      }

      setNativeBearerToken(null);
      const stored = await secureGet(TOKEN_KEY);
      if (stored) {
        const claims = extractClaims(stored);
        if (claims) {
          setNativeBearerToken(stored);
          set({ status: 'authenticated', token: stored, claims, error: null });
          return;
        }
        // Token present but claims invalid — clear stale token
        await secureRemove(TOKEN_KEY);
        await secureRemove(REFRESH_TOKEN_KEY);
        clearPersistedQueryCache();
        queryClient.clear();
      }
      setNativeBearerToken(null);
      set({ status: 'unauthenticated', token: null, claims: null, error: null });
    } catch {
      setNativeBearerToken(null);
      set({ status: 'unauthenticated', token: null, claims: null, error: null });
    }
  },

  async login() {
    const config = loadOidcConfig();
    if (!isOidcConfigured(config)) {
      if (!isNative()) {
        set({ status: 'authenticating', error: null });
        clearLegacyBrowserBearerTokens();
        clearPersistedQueryCache();
        queryClient.clear();
        try {
          const session = await createDevelopmentWebSession();
          set({ status: 'authenticated', token: null, claims: session.claims, error: null });
        } catch (err) {
          const message =
            err instanceof OidcError ? err.message : 'Development session is not configured';
          set({ status: 'unauthenticated', token: null, claims: null, error: message });
        }
        return;
      }
      set({ status: 'unauthenticated', token: null, claims: null, error: null });
      return;
    }

    set({ status: 'authenticating', error: null });
    if (!isNative()) clearLegacyBrowserBearerTokens();
    clearPersistedQueryCache();
    queryClient.clear();

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

      if (!isNative()) {
        const session = await establishWebSession(params);
        clearLegacyBrowserBearerTokens();
        clearPersistedQueryCache();
        queryClient.clear();
        set({ status: 'authenticated', token: null, claims: session.claims, error: null });
        return;
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
      setNativeBearerToken(token);

      clearPersistedQueryCache();
      queryClient.clear();
      set({ status: 'authenticated', token, claims, error: null });
    } catch (err) {
      const message = err instanceof OidcError ? err.message : 'Auth callback failed';
      set({ status: 'error', error: message });
    }
  },

  async logout() {
    if (isNative()) {
      await secureRemove(TOKEN_KEY);
      await secureRemove(REFRESH_TOKEN_KEY);
      setNativeBearerToken(null);
    } else {
      await logoutWebSession();
      clearLegacyBrowserBearerTokens();
    }
    clearPersistedQueryCache();
    queryClient.clear();
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
export async function setupDeepLinkAuthHandler(
  onApprovalLink?: (target: ApprovalNavigationTarget) => void,
): Promise<() => void> {
  const cleanup = await onDeepLink((url: string) => {
    const isCallback = OIDC_DEEP_LINK_PREFIXES.some((prefix) => url.startsWith(prefix));
    if (isCallback) {
      void useAuthStore.getState().handleCallback(url);
      return;
    }

    const approvalTarget = parseApprovalNavigationTarget(url);
    if (approvalTarget) {
      onApprovalLink?.(approvalTarget);
    }
  });
  return cleanup;
}
