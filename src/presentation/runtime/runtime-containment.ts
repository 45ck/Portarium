export type RuntimeContainmentConfig = Readonly<{
  tenantIsolationMode: 'per-tenant-worker';
  egressAllowlist: readonly string[];
  sandboxAssertions: 'strict' | 'relaxed';
}>;

function parseEgressAllowlist(value: string | undefined): readonly string[] {
  const raw = value?.trim();
  if (!raw) return ['https://api.portarium.local'];

  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');

  if (entries.length === 0) {
    throw new Error('PORTARIUM_EGRESS_ALLOWLIST must contain at least one HTTPS URL.');
  }

  for (const entry of entries) {
    assertHttpsUrl(entry, 'PORTARIUM_EGRESS_ALLOWLIST');
  }

  return entries;
}

function assertHttpsUrl(value: string, fieldName: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${fieldName} entries must be valid URLs.`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${fieldName} entries must use https URLs.`);
  }
}

export function readRuntimeContainmentConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeContainmentConfig {
  const tenantIsolationMode = (env['PORTARIUM_TENANT_ISOLATION_MODE'] ?? 'per-tenant-worker')
    .trim()
    .toLowerCase();
  if (tenantIsolationMode !== 'per-tenant-worker') {
    throw new Error(
      'PORTARIUM_TENANT_ISOLATION_MODE must be "per-tenant-worker" for runtime execution.',
    );
  }

  const sandboxAssertions = (env['PORTARIUM_SANDBOX_ASSERTIONS'] ?? 'strict').trim().toLowerCase();
  if (sandboxAssertions !== 'strict' && sandboxAssertions !== 'relaxed') {
    throw new Error('PORTARIUM_SANDBOX_ASSERTIONS must be "strict" or "relaxed".');
  }

  const egressAllowlist = parseEgressAllowlist(env['PORTARIUM_EGRESS_ALLOWLIST']);

  return {
    tenantIsolationMode: 'per-tenant-worker',
    egressAllowlist,
    sandboxAssertions,
  };
}
