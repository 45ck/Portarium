/**
 * useServiceWorker — registers the Portarium service worker and reports
 * update/offline readiness state to the app.
 *
 * Usage:
 *   const { updateAvailable, applyUpdate } = useServiceWorker();
 *
 * Bead: bead-0719
 */

import { useCallback, useEffect, useState } from 'react';

export interface ServiceWorkerState {
  /** True when a new version of the SW has been installed and is waiting. */
  updateAvailable: boolean;
  /** True after the SW has confirmed that the app shell is cached (offline-ready). */
  offlineReady: boolean;
  /** Call to activate the waiting SW and reload. */
  applyUpdate: () => void;
}

const SW_URL = '/sw.js';

export function useServiceWorker(): ServiceWorkerState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    const onControllerChange = () => {
      window.location.reload();
    };

    const trackInstalling = (worker: ServiceWorker) => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          setUpdateAvailable(true);
          setWaitingWorker(worker);
        }
        if (worker.state === 'activated' && !navigator.serviceWorker.controller) {
          setOfflineReady(true);
        }
      });
    };

    navigator.serviceWorker
      .register(SW_URL, { scope: '/' })
      .then((reg) => {
        registration = reg;

        // Already waiting: new version installed since last page load
        if (reg.waiting) {
          setUpdateAvailable(true);
          setWaitingWorker(reg.waiting);
        }

        // Track future updates
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (installing) trackInstalling(installing);
        });
      })
      .catch((err) => {
        console.warn('[sw] Registration failed:', err);
      });

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      registration?.unregister().catch(() => {
        /* ignore */
      });
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [waitingWorker]);

  return { updateAvailable, offlineReady, applyUpdate };
}
