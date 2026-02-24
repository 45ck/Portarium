import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { hydrateQueryCacheFromStorage, startQueryCachePersistence } from './lib/query-client';
import {
  applyWaitingPwaUpdate,
  registerCockpitPwa,
  rollbackCockpitPwa,
} from './lib/pwa-registration';
import { toast } from 'sonner';
import './index.css';

const FETCH_SHIM_KEY = '__portarium_live_fetch_shim_installed__';

function shouldEnableMocks(): boolean {
  if (!import.meta.env.DEV) return false;
  const raw = (import.meta.env.VITE_PORTARIUM_ENABLE_MSW ?? 'true').trim().toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(raw);
}

function readBearerToken(): string | undefined {
  const fromEnv = (import.meta.env.VITE_PORTARIUM_API_BEARER_TOKEN ?? '').trim();
  if (fromEnv) return fromEnv;
  if (typeof window === 'undefined') return undefined;
  return (
    window.localStorage.getItem('portarium_cockpit_bearer_token') ??
    window.localStorage.getItem('portarium_bearer_token') ??
    undefined
  );
}

function installLiveFetchShim(): void {
  if (typeof window === 'undefined') return;
  if ((window as Record<string, unknown>)[FETCH_SHIM_KEY] === true) return;

  const rawBaseUrl = (import.meta.env.VITE_PORTARIUM_API_BASE_URL ?? '').trim();
  if (!rawBaseUrl) return;
  const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input !== 'string') {
      return nativeFetch(input, init);
    }

    const isApiPath = input.startsWith('/v1/');
    const url = isApiPath ? `${baseUrl}${input}` : input;
    const token = readBearerToken();
    if (!token || !isApiPath) {
      return nativeFetch(url, init);
    }

    const headers = new Headers(init?.headers);
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return nativeFetch(url, { ...init, headers });
  };

  (window as Record<string, unknown>)[FETCH_SHIM_KEY] = true;
}

async function bootstrap() {
  hydrateQueryCacheFromStorage();
  const stopPersist = startQueryCachePersistence();

  // Mock mode: dev/test only. Production must always hit live APIs.
  const mocksEnabled = shouldEnableMocks();
  if (mocksEnabled) {
    const { worker } = await import('./mocks/browser');
    const { loadActiveDataset } = await import('./mocks/handlers');
    await loadActiveDataset();
    await Promise.race([
      worker.start({ onUnhandledRequest: 'bypass' }),
      new Promise<void>((resolve) => setTimeout(resolve, 8000)),
    ]);
  } else {
    installLiveFetchShim();
  }

  const root = document.getElementById('root')!;
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );

  if (!import.meta.env.DEV) {
    await registerCockpitPwa({
      onUpdateReady: () => {
        toast.message('Cockpit update ready', {
          id: 'cockpit-pwa-update',
          description: 'Apply now to refresh cached assets for offline usage.',
          action: {
            label: 'Update',
            onClick: () => {
              if (!applyWaitingPwaUpdate()) {
                window.location.reload();
              }
            },
          },
          cancel: {
            label: 'Disable offline cache',
            onClick: () => {
              void rollbackCockpitPwa().finally(() => window.location.reload());
            },
          },
        });
      },
      onUpdateApplied: () => {
        window.location.reload();
      },
      onRegistrationError: (error) => {
        // Keep the app usable if SW registration fails.
        console.warn('[cockpit-pwa] service worker registration failed', error);
      },
    });
  }

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      stopPersist();
    });
  }
}

bootstrap().catch((err) => {
  console.error('[bootstrap] FATAL:', err);
  const root = document.getElementById('root');
  if (root) root.textContent = 'Bootstrap failed: ' + String(err);
});
