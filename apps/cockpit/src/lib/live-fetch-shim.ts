const FETCH_SHIM_KEY = '__portarium_live_fetch_shim_installed__';
const FETCH_SHIM_NATIVE_KEY = '__portarium_live_fetch_native__';
const WEB_SESSION_REQUEST_HEADER = 'X-Portarium-Request';

type WindowWithFetchShimFlag = Window & {
  [FETCH_SHIM_KEY]?: boolean;
  [FETCH_SHIM_NATIVE_KEY]?: typeof fetch;
};

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function resolveLiveApiBaseUrl(rawBaseUrl: string): string {
  const trimmed = rawBaseUrl.trim();
  if (!trimmed) return '';

  const withoutTrailingSlash = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  try {
    const url = new URL(withoutTrailingSlash);
    if (isLoopbackHostname(url.hostname) && isLoopbackHostname(window.location.hostname)) {
      url.hostname = window.location.hostname;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return withoutTrailingSlash;
  }
}

export function installLiveFetchShim(): void {
  if (typeof window === 'undefined') return;
  const fetchShimWindow = window as WindowWithFetchShimFlag;
  if (fetchShimWindow[FETCH_SHIM_KEY] === true) return;

  const rawBaseUrl = (import.meta.env.VITE_PORTARIUM_API_BASE_URL ?? '').trim();
  if (!rawBaseUrl) return;
  const baseUrl = resolveLiveApiBaseUrl(rawBaseUrl);
  const nativeFetch = window.fetch.bind(window);
  fetchShimWindow[FETCH_SHIM_NATIVE_KEY] = window.fetch;

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input !== 'string') {
      return nativeFetch(input, init);
    }

    const isApiPath = input.startsWith('/v1/') || input.startsWith('/auth/');
    const url = isApiPath ? `${baseUrl}${input}` : input;
    if (!isApiPath) {
      return nativeFetch(url, init);
    }

    const headers = new Headers(init?.headers);
    const method = (init?.method ?? 'GET').toUpperCase();
    const isUnsafeMethod = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
    if (isUnsafeMethod && !headers.has(WEB_SESSION_REQUEST_HEADER)) {
      headers.set(WEB_SESSION_REQUEST_HEADER, '1');
    }
    return nativeFetch(url, { ...init, credentials: init?.credentials ?? 'include', headers });
  };

  fetchShimWindow[FETCH_SHIM_KEY] = true;
}

export function resetLiveFetchShimForTest(): void {
  if (typeof window === 'undefined') return;
  const fetchShimWindow = window as WindowWithFetchShimFlag;
  if (fetchShimWindow[FETCH_SHIM_NATIVE_KEY]) {
    window.fetch = fetchShimWindow[FETCH_SHIM_NATIVE_KEY];
  }
  delete fetchShimWindow[FETCH_SHIM_KEY];
  delete fetchShimWindow[FETCH_SHIM_NATIVE_KEY];
}
