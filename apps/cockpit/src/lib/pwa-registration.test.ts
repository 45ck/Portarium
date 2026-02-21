// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyWaitingPwaUpdate,
  hasServiceWorkerSupport,
  registerCockpitPwa,
} from '@/lib/pwa-registration';

class FakeWorker extends EventTarget {
  public state: string = 'installing';
  public readonly postMessage = vi.fn();
}

class FakeRegistration extends EventTarget {
  public waiting: ServiceWorker | null = null;
  public installing: ServiceWorker | null = null;
}

function setServiceWorkerMock(mock: {
  register: (url: string) => Promise<ServiceWorkerRegistration>;
  controller?: ServiceWorker | null;
}) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: mock.register,
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
});
