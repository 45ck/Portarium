interface RegisterCockpitPwaOptions {
  onUpdateReady?: () => void;
  onUpdateApplied?: () => void;
  onRegistrationError?: (error: unknown) => void;
}

let waitingServiceWorker: ServiceWorker | null = null;

export function hasServiceWorkerSupport(): boolean {
  return typeof window !== 'undefined' && !!navigator.serviceWorker;
}

export function applyWaitingPwaUpdate(): boolean {
  if (!waitingServiceWorker) return false;
  waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

export async function rollbackCockpitPwa(): Promise<void> {
  if (!hasServiceWorkerSupport()) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if (typeof caches !== 'undefined') {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('portarium-cockpit-pwa-'))
        .map((key) => caches.delete(key)),
    );
  }
}

function markWaitingWorker(worker: ServiceWorker | null, onUpdateReady?: () => void): void {
  if (!worker) return;
  waitingServiceWorker = worker;
  onUpdateReady?.();
}

function wireUpdateSignals(
  registration: ServiceWorkerRegistration,
  options: RegisterCockpitPwaOptions,
): void {
  markWaitingWorker(registration.waiting ?? null, options.onUpdateReady);

  registration.addEventListener('updatefound', () => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener('statechange', () => {
      if (installingWorker.state !== 'installed') return;
      if (!navigator.serviceWorker.controller) return;
      markWaitingWorker(registration.waiting ?? installingWorker, options.onUpdateReady);
    });
  });
}

export async function registerCockpitPwa(options: RegisterCockpitPwaOptions = {}): Promise<void> {
  if (!hasServiceWorkerSupport()) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    wireUpdateSignals(registration, options);

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      waitingServiceWorker = null;
      options.onUpdateApplied?.();
    });
  } catch (error) {
    options.onRegistrationError?.(error);
  }
}
