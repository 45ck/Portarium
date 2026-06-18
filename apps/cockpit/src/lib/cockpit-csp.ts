const PRODUCTION_CONNECT_SOURCES = [
  "'self'",
  'https://api.portarium.io',
  'wss://events.portarium.io',
] as const;

export const COCKPIT_CSP_CONNECT_MODES = ['production-defaults', 'local-only'] as const;

export type CockpitCspConnectMode = (typeof COCKPIT_CSP_CONNECT_MODES)[number];

const CSP_DIRECTIVES = {
  defaultSrc: "default-src 'self'",
  scriptSrc: "script-src 'self'",
  styleSrc: "style-src 'self' 'unsafe-inline'",
  fontSrc: "font-src 'self'",
} as const;

const DEFAULT_FRAME_SOURCES = ["'self'"] as const;
const CSP_META_PATTERN = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*(")/;

export function hasCockpitContentSecurityPolicy(html: string): boolean {
  return CSP_META_PATTERN.test(html);
}

export function normalizeCockpitCspConnectMode(rawMode?: string): CockpitCspConnectMode {
  const mode = rawMode?.trim();
  if (!mode) return 'production-defaults';
  if (mode === 'production-defaults' || mode === 'local-only') return mode;

  throw new Error(
    `Unsupported Cockpit CSP connect mode "${mode}". Expected "production-defaults" or "local-only".`,
  );
}

export function buildCockpitContentSecurityPolicy(
  options: {
    apiBaseUrl?: string;
    connectMode?: CockpitCspConnectMode;
    imageOrigins?: readonly string[];
    operatorFrameOrigins?: readonly string[];
  } = {},
): string {
  const connectSources = new Set<string>(
    options.connectMode === 'local-only' ? ["'self'"] : PRODUCTION_CONNECT_SOURCES,
  );
  for (const localApiOrigin of localHttpApiOriginsFromUrl(options.apiBaseUrl)) {
    connectSources.add(localApiOrigin);
  }

  const frameSources = new Set<string>(DEFAULT_FRAME_SOURCES);
  for (const origin of options.operatorFrameOrigins ?? []) {
    const safeOrigin = safeCockpitFrameOriginFromUrl(origin);
    if (safeOrigin) frameSources.add(safeOrigin);
  }

  const imageSources = new Set<string>(["'self'", 'data:']);
  for (const origin of options.imageOrigins ?? []) {
    const safeOrigins = safeCockpitImageOriginsFromUrl(origin);
    for (const safeOrigin of safeOrigins) {
      imageSources.add(safeOrigin);
    }
  }

  return [
    CSP_DIRECTIVES.defaultSrc,
    CSP_DIRECTIVES.scriptSrc,
    CSP_DIRECTIVES.styleSrc,
    `connect-src ${[...connectSources].join(' ')}`,
    `frame-src ${[...frameSources].join(' ')}`,
    `img-src ${[...imageSources].join(' ')}`,
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

export function localHttpApiOriginsFromUrl(rawUrl?: string): string[] {
  const origin = localHttpApiOriginFromUrl(rawUrl);
  if (!origin) return [];

  return expandLoopbackOriginAliases(origin);
}

export function parseCockpitOperatorFrameOrigins(rawValue?: string): string[] {
  return [
    ...new Set(
      (rawValue ?? '')
        .split(/[;,\n]/)
        .map((entry) => safeCockpitFrameOriginFromUrl(entry))
        .filter((origin): origin is string => Boolean(origin)),
    ),
  ];
}

export function parseCockpitImageOrigins(rawValue?: string): string[] {
  return [
    ...new Set(
      (rawValue ?? '')
        .split(/[;,\n]/)
        .flatMap((entry) => safeCockpitImageOriginsFromUrl(entry)),
    ),
  ];
}

export function safeCockpitFrameOriginFromUrl(rawUrl?: string): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.username || parsed.password) return null;
  if (parsed.protocol === 'https:') return parsed.origin;
  if (parsed.protocol !== 'http:') return null;

  return localHttpApiOriginFromUrl(parsed.origin);
}

function safeCockpitImageOriginsFromUrl(rawUrl?: string): string[] {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return [];

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return [];
  }

  if (parsed.username || parsed.password) return [];
  if (parsed.protocol === 'https:') return [parsed.origin];
  if (parsed.protocol !== 'http:') return [];

  return localHttpApiOriginsFromUrl(parsed.origin);
}

function expandLoopbackOriginAliases(origin: string): string[] {
  const parsed = new URL(origin);
  const port = parsed.port ? `:${parsed.port}` : '';
  const hostname = parsed.hostname.toLowerCase();

  if (hostname === '127.0.0.1') {
    return [origin, `http://localhost${port}`];
  }
  if (hostname === 'localhost') {
    return [origin, `http://127.0.0.1${port}`];
  }

  return [origin];
}

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}
