// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyWaitingPwaUpdate,
  hasServiceWorkerSupport,
  registerCockpitPwa,
  rollbackCockpitPwa,
} from '@/lib/pwa-registration';

class FakeWorker extends EventTarget {
  public state: string = 'installing';
  public readonly postMessage = vi.fn();
}

class FakeRegistration extends EventTarget {
  public active: ServiceWorker | null = null;
  public waiting: ServiceWorker | null = null;
  public installing: ServiceWorker | null = null;
  public readonly unregister = vi.fn(async () => true);
}

function setServiceWorkerMock(mock: {
  register: (url: string) => Promise<ServiceWorkerRegistration>;
  getRegistrations?: () => Promise<ServiceWorkerRegistration[]>;
  controller?: ServiceWorker | null;
}) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: mock.register,
      getRegistrations: mock.getRegistrations ?? vi.fn(async () => []),
      controller: mock.controller ?? null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}

beforeEach(() => {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: undefined,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pwa-registration', () => {
  it('detects service worker support availability', () => {
    expect(hasServiceWorkerSupport()).toBe(false);
    setServiceWorkerMock({
      register: vi.fn(async () => new FakeRegistration() as unknown as ServiceWorkerRegistration),
    });
    expect(hasServiceWorkerSupport()).toBe(true);
  });

  it('marks waiting worker and requests skip waiting update', async () => {
    const registration = new FakeRegistration();
    const waitingWorker = new FakeWorker() as unknown as ServiceWorker;
    registration.waiting = waitingWorker;

    setServiceWorkerMock({
      register: vi.fn(async () => registration as unknown as ServiceWorkerRegistration),
    });

    const onUpdateReady = vi.fn();
    await registerCockpitPwa({ onUpdateReady });

    expect(onUpdateReady).toHaveBeenCalledTimes(1);
    expect(applyWaitingPwaUpdate()).toBe(true);
    expect((waitingWorker as unknown as FakeWorker).postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
    });
  });

  it('emits update-ready signal when installing worker reaches installed with active controller', async () => {
    const registration = new FakeRegistration();
    const installingWorker = new FakeWorker() as unknown as ServiceWorker;
    registration.installing = installingWorker;

    setServiceWorkerMock({
      register: vi.fn(async () => registration as unknown as ServiceWorkerRegistration),
      controller: new FakeWorker() as unknown as ServiceWorker,
    });

    const onUpdateReady = vi.fn();
    await registerCockpitPwa({ onUpdateReady });

    registration.dispatchEvent(new Event('updatefound'));
    (installingWorker as unknown as FakeWorker).state = 'installed';
    installingWorker.dispatchEvent(new Event('statechange'));

    expect(onUpdateReady).toHaveBeenCalledTimes(1);
  });

  it('sends the tenant API cache policy to the service worker', async () => {
    const registration = new FakeRegistration();
    const activeWorker = new FakeWorker() as unknown as ServiceWorker;
    registration.active = activeWorker;

    setServiceWorkerMock({
      register: vi.fn(async () => registration as unknown as ServiceWorkerRegistration),
    });

    await registerCockpitPwa({ allowTenantApiCache: true });

    expect((activeWorker as unknown as FakeWorker).postMessage).toHaveBeenCalledWith({
      type: 'PORTARIUM_RETENTION_POLICY',
      allowTenantApiCache: true,
    });
  });

  it('rolls back service workers and deletes only Cockpit PWA caches', async () => {
    const registration = new FakeRegistration();
    const cacheKeys = new Set(['portarium-cockpit-pwa-v2-api', 'other-cache']);
    vi.stubGlobal('caches', {
      keys: vi.fn(async () => [...cacheKeys]),
      delete: vi.fn(async (key: string) => cacheKeys.delete(key)),
    });
    setServiceWorkerMock({
      register: vi.fn(async () => registration as unknown as ServiceWorkerRegistration),
      getRegistrations: vi.fn(async () => [registration as unknown as ServiceWorkerRegistration]),
    });

    await rollbackCockpitPwa();

    expect(registration.unregister).toHaveBeenCalledTimes(1);
    expect(cacheKeys.has('portarium-cockpit-pwa-v2-api')).toBe(false);
    expect(cacheKeys.has('other-cache')).toBe(true);
  });
});
