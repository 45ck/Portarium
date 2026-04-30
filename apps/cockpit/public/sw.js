/**
 * Portarium Cockpit Service Worker — PWA offline shell + cache strategy.
 *
 * Cache strategy:
 *   - App shell (HTML, critical JS/CSS): Cache-first with network fallback.
 *   - Live tenant API reads: Network-only by default. The app must explicitly
 *     opt in before selected read endpoints are cached for offline demo/QA.
 *   - Other API calls (/api/**, /v1/**): Network-only.
 *   - Static assets (icons, fonts): Cache-first (long-lived).
 *
 * Mode rules:
 *   - Demo/MSW: app may enable selected synthetic API read caching.
 *   - Dev live QA: tenant API caching remains disabled unless explicitly enabled.
 *   - Production live: shell/static assets only by default; tenant API cache is opt-in.
 *
 * Update strategy:
 *   - New SW installs and waits (skipWaiting is NOT called automatically).
 *   - App calls postMessage({ type: 'SKIP_WAITING' }) to trigger the swap.
 *   - On controllerchange the app reloads to pick up the new version.
 *
 * Version: bead-1126
 */

const VERSION = 'portarium-cockpit-pwa-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const API_CACHE = `${VERSION}-api`;
const ASSETS_CACHE = `${VERSION}-assets`;
let tenantApiCacheEnabled = false;

// Regex matching API read endpoints we selectively cache for offline resilience
const SELECTED_READ_ENDPOINTS = /\/v1\/workspaces\/[^/]+\/(approvals|work-items|runs)(\/|$|\?)/;

// App shell — precached on install
const APP_SHELL_URLS = ['/', '/index.html'];

// ── Lifecycle: install ────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(APP_SHELL_URLS).catch((err) => {
        // Non-fatal: may fail in dev with hot-reload
        console.warn('[sw] Shell precache failed:', err);
      }),
    ),
    // Do NOT skipWaiting automatically — app drives the update via postMessage
  );
});

// ── Lifecycle: activate ───────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  const validCaches = new Set([SHELL_CACHE, ASSETS_CACHE]);
  if (tenantApiCacheEnabled) validCaches.add(API_CACHE);

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !validCaches.has(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Update via postMessage ────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'PORTARIUM_RETENTION_POLICY') {
    tenantApiCacheEnabled = event.data.allowTenantApiCache === true;
    if (!tenantApiCacheEnabled) {
      event.waitUntil(caches.delete(API_CACHE));
    }
  }
  if (event.data?.type === 'PURGE_TENANT_DATA') {
    event.waitUntil(caches.delete(API_CACHE));
  }
});

// ── Fetch strategy ────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Selected read API endpoints: opt-in network-first cache for demo/explicit live policy only.
  if (tenantApiCacheEnabled && SELECTED_READ_ENDPOINTS.test(url.pathname)) {
    event.respondWith(networkFirstWithTimeout(event.request, API_CACHE, 5000));
    return;
  }

  // Other API calls: network-only (no stale data for mutations)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/v1/')) {
    return; // Let the browser handle it
  }

  // Static assets: cache-first (long-lived)
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

  const targetUrl = resolveNotificationTargetUrl(event.notification.data);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const target = new URL(targetUrl, self.location.origin);
      if (target.origin !== self.location.origin) {
        return self.clients.openWindow('/');
      }
      const focused = windowClients.find((c) => {
        try {
          return new URL(c.url).origin === self.location.origin && 'focus' in c;
        } catch {
          return false;
        }
      });
      if (focused) {
        if ('navigate' in focused && focused.url !== target.href) {
          return focused.navigate(target.href).then((client) => client?.focus());
        }
        return focused.focus();
      }
      return self.clients.openWindow(`${target.pathname}${target.search}${target.hash}`);
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
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // SPA fallback: serve index.html for navigation requests
    const indexHtml = await cache.match('/index.html');
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

function resolveNotificationTargetUrl(data = {}) {
  if (typeof data.url === 'string' && data.url.startsWith('/') && !data.url.startsWith('//')) {
    return data.url;
  }

  if (typeof data.approvalId === 'string' && data.approvalId.trim()) {
    const search = new URLSearchParams({
      focus: data.approvalId.trim(),
      from: 'notification',
    });
    return `/approvals?${search.toString()}`;
  }

  return '/';
}
