/**
 * Login page — shown when the user is unauthenticated.
 *
 * For native (Capacitor): launches the OIDC in-app browser.
 * For web: redirects to the OIDC provider.
 * For dev (no OIDC configured): shows a dev-mode notice.
 *
 * Bead: bead-0721
 */

import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { useAuthStore } from '@/stores/auth-store';
import { loadOidcConfig, isOidcConfigured } from '@/lib/oidc-client';
import { Button } from '@/components/ui/button';
import { ShieldCheck, LogIn, AlertCircle } from 'lucide-react';

function LoginPage() {
  const { status, error, login } = useAuthStore();
  const config = loadOidcConfig();
  const oidcEnabled = isOidcConfigured(config);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 text-center">
          <ShieldCheck className="h-12 w-12 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold">Portarium Cockpit</h1>
          <p className="text-sm text-muted-foreground">Sign in to manage your governed workflows</p>
        </div>

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Login button */}
        {oidcEnabled ? (
          <Button
            className="w-full"
            size="lg"
            onClick={() => void login()}
            disabled={status === 'authenticating'}
            aria-busy={status === 'authenticating'}
          >
            <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
            {status === 'authenticating' ? 'Opening login…' : 'Sign in'}
          </Button>
        ) : (
          <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Development mode</p>
            <p>
              OIDC is not configured. Set{' '}
              <code className="text-xs bg-muted rounded px-1">VITE_OIDC_ISSUER</code>,{' '}
              <code className="text-xs bg-muted rounded px-1">VITE_OIDC_CLIENT_ID</code>, and{' '}
              <code className="text-xs bg-muted rounded px-1">VITE_OIDC_REDIRECT_URI</code> to
              enable sign in.
            </p>
            <p>
              Alternatively, set{' '}
              <code className="text-xs bg-muted rounded px-1">VITE_PORTARIUM_API_BEARER_TOKEN</code>{' '}
              to bypass auth.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  component: LoginPage,
});
