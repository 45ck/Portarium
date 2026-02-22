/**
 * Portarium Cockpit Service Worker — PWA offline shell + cache strategy.
 *
 * Cache strategy:
 *   - App shell (HTML, critical JS/CSS): Cache-first with network fallback.
 *   - API calls (/api/**): Network-first with 5s timeout, stale-while-revalidate.
 *   - Static assets (icons, fonts): Cache-first (long-lived).
 *
 * Version: 1.0.0 (bead-0719)
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `portarium-shell-${CACHE_VERSION}`;
const API_CACHE = `portarium-api-${CACHE_VERSION}`;
const ASSETS_CACHE = `portarium-assets-${CACHE_VERSION}`;

// App shell — precached on install
const APP_SHELL_URLS = [
  '/',
  '/index.html',
];

// ── Lifecycle: install ────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(APP_SHELL_URLS).catch((err) => {
        // Non-fatal: may fail in dev with hot-reload
        console.warn('[sw] Shell precache failed:', err);
      }),
    ).then(() => self.skipWaiting()),
  );
});

// ── Lifecycle: activate ───────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  const validCaches = new Set([SHELL_CACHE, API_CACHE, ASSETS_CACHE]);

  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !validCaches.has(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // API: network-first with 5s timeout
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithTimeout(event.request, API_CACHE, 5000));
    return;
  }

  // Static assets: cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(event.request, ASSETS_CACHE));
    return;
  }

  // Navigation / app shell: cache-first (serve shell for SPA routing)
  event.respondWith(shellFirst(event.request));
});

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Portarium', body: event.data.text() };
  }

  const title = payload.title ?? 'Portarium';
  const options = {
    body: payload.body ?? '',
    icon: '/icon-192.png',
    badge: '/favicon-32x32.png',
    tag: payload.tag ?? 'portarium-notification',
    data: payload.data ?? {},
    actions: payload.actions ?? [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const focused = windowClients.find((c) => c.url === targetUrl && 'focus' in c);
        if (focused) return focused.focus();
        return self.clients.openWindow(targetUrl);
      }),
  );
});

// ── Cache helpers ─────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  const cached = await caches.match(request);

  const networkPromise = fetch(request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), timeoutMs),
  );

  try {
    return await Promise.race([networkPromise, timeoutPromise]);
  } catch {
    return cached ?? Response.error();
  }
}

async function shellFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // SPA fallback: serve index.html for navigation requests
    const indexHtml = await caches.match('/index.html');
    return indexHtml ?? Response.error();
  }
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/fonts/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/icons/') ||
    /\.(png|jpg|jpeg|svg|ico|woff2?|ttf|otf)$/.test(pathname)
  );
}
