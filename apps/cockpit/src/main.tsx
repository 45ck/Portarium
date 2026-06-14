import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { hydrateQueryCacheFromStorage, startQueryCachePersistence } from './lib/query-client';
import { getCockpitDataRetentionPolicy } from './lib/cockpit-data-retention';
import { shouldEnableCockpitMocks } from './lib/cockpit-runtime';
import {
  applyWaitingPwaUpdate,
  registerCockpitPwa,
  rollbackCockpitPwa,
} from './lib/pwa-registration';
import { toast } from 'sonner';
import { installLiveFetchShim } from '@/lib/live-fetch-shim';
import './index.css';

type CockpitMockWorker = {
  start(options: { onUnhandledRequest: 'bypass' }): unknown;
};

function startCockpitMockWorker(worker: CockpitMockWorker, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      callback();
    };

    const timeoutId = window.setTimeout(() => {
      settle(resolve);
    }, timeoutMs);

    try {
      Promise.resolve(worker.start({ onUnhandledRequest: 'bypass' })).then(
        () => settle(resolve),
        (error: unknown) => settle(() => reject(error)),
      );
    } catch (error) {
      settle(() => reject(error));
    }
  });
}

async function bootstrap() {
  const retentionPolicy = getCockpitDataRetentionPolicy();
  hydrateQueryCacheFromStorage(undefined, undefined, retentionPolicy);
  const stopPersist = startQueryCachePersistence(undefined, undefined, retentionPolicy);

  // Mock mode: dev/test only. Production must always hit live APIs.
  if (shouldEnableCockpitMocks()) {
    const { worker } = await import('./mocks/browser');
    const { loadActiveDataset } = await import('./mocks/handlers');
    await loadActiveDataset();
    await startCockpitMockWorker(worker);
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
      allowTenantApiCache: retentionPolicy.serviceWorkerTenantApiCache,
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
