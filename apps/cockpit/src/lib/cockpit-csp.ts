const DEFAULT_CONNECT_SOURCES = [
  "'self'",
  'https://api.portarium.io',
  'wss://events.portarium.io',
] as const;

const CSP_DIRECTIVES = {
  defaultSrc: "default-src 'self'",
  scriptSrc: "script-src 'self'",
  styleSrc: "style-src 'self' 'unsafe-inline'",
  imgSrc: "img-src 'self' data:",
  fontSrc: "font-src 'self'",
} as const;

const CSP_META_PATTERN = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*(")/;

export function buildCockpitContentSecurityPolicy(options: { apiBaseUrl?: string } = {}): string {
  const connectSources = new Set<string>(DEFAULT_CONNECT_SOURCES);
  const localApiOrigin = localHttpApiOriginFromUrl(options.apiBaseUrl);
  if (localApiOrigin) connectSources.add(localApiOrigin);

  return [
    CSP_DIRECTIVES.defaultSrc,
    CSP_DIRECTIVES.scriptSrc,
    CSP_DIRECTIVES.styleSrc,
    `connect-src ${[...connectSources].join(' ')}`,
    CSP_DIRECTIVES.imgSrc,
    CSP_DIRECTIVES.fontSrc,
  ].join('; ');
}

export function replaceCockpitContentSecurityPolicy(
  html: string,
  policy: string = buildCockpitContentSecurityPolicy(),
): string {
  if (!CSP_META_PATTERN.test(html)) {
    throw new Error('Cockpit index.html is missing its Content-Security-Policy meta tag.');
  }

  return html.replace(CSP_META_PATTERN, `$1${escapeHtmlAttribute(policy)}$2`);
}

export function localHttpApiOriginFromUrl(rawUrl?: string): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:') return null;
  if (parsed.username || parsed.password) return null;

  const hostname = parsed.hostname.toLowerCase();
  const host =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (
    host !== 'localhost' &&
    host !== '127.0.0.1' &&
    host !== '::1' &&
    !host.endsWith('.localhost')
  ) {
    return null;
  }

  return parsed.origin;
}

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}
