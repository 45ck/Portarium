import type { TenantStorageTier } from './tenant-storage-tier.js';

/**
 * Reads the TENANCY_TIER environment variable and returns the tenant storage tier.
 *
 * When set to 'A' (default), all tenants use the shared database (Tier A).
 * When set to 'B', the system enables schema-per-tenant routing for provisioned tenants.
 *
 * This is used as an override in TenantConnectionRouter to force all tenants
 * to a specific tier, independent of what's stored in the tenant_storage_tiers table.
 */
export function readTenancyTierOverride(
  env: Record<string, string | undefined> = process.env,
): 'A' | 'B' | undefined {
  const raw = env['TENANCY_TIER']?.trim().toUpperCase();
  if (raw === 'A') return 'A';
  if (raw === 'B') return 'B';
  return undefined;
}

/**
 * Determine the default tier for new tenant provisioning based on env config.
 */
export function defaultTenancyTier(
  env: Record<string, string | undefined> = process.env,
): TenantStorageTier {
  const raw = env['TENANCY_TIER']?.trim().toUpperCase();
  if (raw === 'B') return 'TierB';
  if (raw === 'C') return 'TierC';
  return 'TierA';
}
