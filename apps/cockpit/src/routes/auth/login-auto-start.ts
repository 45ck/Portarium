import type { AuthStatus } from '@/stores/auth-store';

export function shouldAutoStartDevelopmentSession(params: {
  native: boolean;
  oidcEnabled: boolean;
  status: AuthStatus;
}): boolean {
  return !params.native && !params.oidcEnabled && params.status === 'unauthenticated';
}
