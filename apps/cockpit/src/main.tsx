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

async function bootstrap() {
  hydrateQueryCacheFromStorage();
  const stopPersist = startQueryCachePersistence();

  // Mock mode: dev/test only. Production must always hit live APIs.
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser');
    const { loadActiveDataset } = await import('./mocks/handlers');
    await loadActiveDataset();
    await Promise.race([
      worker.start({ onUnhandledRequest: 'bypass' }),
      new Promise<void>((resolve) => setTimeout(resolve, 8000)),
    ]);
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
