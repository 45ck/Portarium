export const PORTARIUM_CORS_ALLOWED_ORIGINS = 'PORTARIUM_CORS_ALLOWED_ORIGINS';

export type CorsAllowedOrigins = readonly string[];

function isHttpOrigin(url: URL): boolean {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

export function isProductionLikeRuntime(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const deployment = env['PORTARIUM_ENVIRONMENT']?.trim().toLowerCase();
  if (deployment && ['prod', 'production', 'stage', 'staging', 'live'].includes(deployment)) {
    return true;
  }

  const nodeEnv = env['NODE_ENV']?.trim().toLowerCase();
  return nodeEnv !== 'development' && nodeEnv !== 'test';
}

export function normalizeCorsOrigin(
  value: string,
  envName = PORTARIUM_CORS_ALLOWED_ORIGINS,
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${envName} contains an empty origin entry.`);
  }
  if (trimmed === '*') {
    throw new Error(`${envName} must list exact origins; wildcard '*' is not allowed.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${envName} contains an invalid origin: ${trimmed}`);
  }

  if (!isHttpOrigin(parsed)) {
    throw new Error(`${envName} origins must use http or https: ${trimmed}`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${envName} origins must not include credentials, query, or fragment.`);
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error(`${envName} origins must not include a path: ${trimmed}`);
  }

  return parsed.origin;
}

export function parseCorsAllowedOrigins(
  raw: string | undefined,
  envName = PORTARIUM_CORS_ALLOWED_ORIGINS,
): CorsAllowedOrigins {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const origins: string[] = [];
  for (const entry of raw.split(',')) {
    const origin = normalizeCorsOrigin(entry, envName);
    if (seen.has(origin)) continue;
    seen.add(origin);
    origins.push(origin);
  }
  return origins;
}

export function isAllowedCorsOrigin(
  origin: string | undefined,
  allowedOrigins: CorsAllowedOrigins,
): boolean {
  if (!origin || allowedOrigins.length === 0) return false;
  try {
    return allowedOrigins.includes(normalizeCorsOrigin(origin, 'Origin'));
  } catch {
    return false;
  }
}
