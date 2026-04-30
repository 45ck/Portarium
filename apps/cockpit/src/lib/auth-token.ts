import { getBearerTokenForControlPlane } from '@/lib/auth-token-provider';

export const AUTH_TOKEN_KEY = 'portarium_cockpit_bearer_token';
export const AUTH_REFRESH_TOKEN_KEY = 'portarium_cockpit_refresh_token';

export function readStoredBearerToken(): string | undefined {
  return getBearerTokenForControlPlane();
}

export function readBearerToken(): string | undefined {
  return readStoredBearerToken();
}

export function shouldBlockUnauthenticatedApiAccess(): boolean {
  return false;
}
