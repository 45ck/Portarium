#!/usr/bin/env node
/**
 * scripts/integration/harness.mjs
 *
 * Deterministic integration harness for local control-plane scenario execution.
 *
 * One command runs required services, verifies health with a machine-readable
 * readiness report, supports both auth profiles (dev-token and OIDC/JWKS), and
 * orchestrates seed data (baseline + Odoo-specific reseed) idempotently.
 *
 * Usage:
 *   node scripts/integration/harness.mjs                  # default: dev-token auth, baseline seed
 *   node scripts/integration/harness.mjs --auth oidc      # OIDC/JWKS auth profile
 *   node scripts/integration/harness.mjs --seed odoo      # baseline + Odoo reseed
 *   node scripts/integration/harness.mjs --check-only     # health check only, no compose up
 *   node scripts/integration/harness.mjs --json           # JSON readiness report to stdout
 *
 * npm script (via package.json):
 *   npm run integration:harness
 *   npm run integration:harness -- --auth oidc --seed odoo
 *
 * Environment:
 *   HARNESS_AUTH_PROFILE      — "dev-token" (default) or "oidc"
 *   HARNESS_SEED_MODE         — "baseline" (default) or "odoo"
 *   HARNESS_COMPOSE_TIMEOUT   — seconds to wait for compose up (default: 120)
 *   LOCAL_STACK_URL            — API base URL (default: http://localhost:8080)
 *   ODOO_URL                   — Odoo base URL (default: http://localhost:4000)
 *   KEYCLOAK_URL               — Keycloak base URL (default: http://localhost:8180)
 *
 * Exit codes:
 *   0 — all services healthy, seed applied, readiness report written
 *   1 — one or more services unhealthy or seed failure
 *
 * Bead: bead-0843
 */

import { execSync } from 'node:child_process';
import process from 'node:process';

// ── CLI args ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function argValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const AUTH_PROFILE = argValue('--auth') ?? process.env['HARNESS_AUTH_PROFILE'] ?? 'dev-token';
const SEED_MODE = argValue('--seed') ?? process.env['HARNESS_SEED_MODE'] ?? 'baseline';
const CHECK_ONLY = args.includes('--check-only');
const JSON_OUTPUT = args.includes('--json');
const COMPOSE_TIMEOUT = parseInt(process.env['HARNESS_COMPOSE_TIMEOUT'] ?? '120', 10);

const API_URL = process.env['LOCAL_STACK_URL'] ?? 'http://localhost:8080';
const ODOO_URL = process.env['ODOO_URL'] ?? 'http://localhost:4000';
const KEYCLOAK_URL = process.env['KEYCLOAK_URL'] ?? 'http://localhost:8180';

// ── Compose profiles ─────────────────────────────────────────────────────

function composeProfiles() {
  const profiles = ['baseline', 'runtime', 'auth'];

  if (AUTH_PROFILE === 'oidc') {
    profiles.push('idp'); // Keycloak
  }

  if (SEED_MODE === 'odoo') {
    profiles.push('erp'); // Odoo + Odoo DB
  }

  return profiles;
}

// ── Health checks ────────────────────────────────────────────────────────

/**
 * @typedef {{ service: string; url: string; status: 'healthy' | 'unhealthy' | 'skipped'; latencyMs: number; error?: string }} ServiceHealth
 */

async function checkHealth(service, url, timeoutMs = 10_000) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const latencyMs = Date.now() - start;
    if (res.ok) {
      return { service, url, status: 'healthy', latencyMs };
    }
    return {
      service,
      url,
      status: 'unhealthy',
      latencyMs,
      error: `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      service,
      url,
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: e.message,
    };
  }
}

async function checkAllHealth() {
  /** @type {Array<{service: string; url: string; required: boolean; condition: boolean}>} */
  const checks = [
    {
      service: 'evidence-db',
      url: `${API_URL}/health`,
      required: true,
      condition: true,
    },
    {
      service: 'temporal',
      url: 'http://localhost:7233',
      required: true,
      condition: true,
    },
    {
      service: 'evidence-store',
      url: 'http://localhost:9000/minio/health/live',
      required: true,
      condition: true,
    },
    {
      service: 'vault',
      url: 'http://localhost:8200/v1/sys/health',
      required: true,
      condition: true,
    },
    {
      service: 'keycloak',
      url: `${KEYCLOAK_URL}/health/ready`,
      required: AUTH_PROFILE === 'oidc',
      condition: AUTH_PROFILE === 'oidc',
    },
    {
      service: 'odoo',
      url: `${ODOO_URL}/web/health`,
      required: SEED_MODE === 'odoo',
      condition: SEED_MODE === 'odoo',
    },
  ];

  const results = [];
  for (const c of checks) {
    if (!c.condition) {
      results.push({
        service: c.service,
        url: c.url,
        status: 'skipped',
        latencyMs: 0,
      });
      continue;
    }
    results.push(await checkHealth(c.service, c.url));
  }
  return results;
}

// ── Seed orchestration ───────────────────────────────────────────────────

async function runSeed() {
  log('Running baseline seed...');
  try {
    // Wait for API to be ready before seeding
    await waitForService('API', `${API_URL}/health`, 30);

    // Baseline seed via seed-all.mjs (calls API + seed-bundle.ts)
    execSync(`node scripts/seed/seed-all.mjs`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        LOCAL_STACK_URL: API_URL,
      },
    });
    log('Baseline seed complete.');
    return { baseline: 'ok' };
  } catch (e) {
    log(`Baseline seed FAILED: ${e.message}`);
    return { baseline: 'failed', error: e.message };
  }
}

async function runOdooReseed() {
  log('Running Odoo-specific reseed...');
  try {
    await waitForService('Odoo', `${ODOO_URL}/web/health`, 60);

    execSync(`node scripts/seed/seed-odoo.mjs`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ODOO_URL,
      },
    });
    log('Odoo reseed complete.');
    return { odoo: 'ok' };
  } catch (e) {
    log(`Odoo reseed FAILED: ${e.message}`);
    return { odoo: 'failed', error: e.message };
  }
}

// ── Utilities ────────────────────────────────────────────────────────────

function log(msg) {
  if (!JSON_OUTPUT) {
    process.stderr.write(`[harness] ${msg}\n`);
  }
}

async function waitForService(name, url, maxWaitSec) {
  const deadline = Date.now() + maxWaitSec * 1000;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        log(`${name} is ready.`);
        return;
      }
      lastError = `HTTP ${res.status}`;
    } catch (e) {
      lastError = e.message;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`${name} not ready after ${maxWaitSec}s at ${url}: ${lastError}`);
}

function composeUp(profiles) {
  const profileFlags = profiles.map((p) => `--profile ${p}`).join(' ');
  const cmd = `docker compose ${profileFlags} -f docker-compose.yml -f docker-compose.local.yml up -d --wait --wait-timeout ${COMPOSE_TIMEOUT}`;
  log(`Compose: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
}

// ── Readiness report ─────────────────────────────────────────────────────

/**
 * @typedef {{
 *   timestamp: string;
 *   authProfile: string;
 *   seedMode: string;
 *   services: ServiceHealth[];
 *   seed: Record<string, string>;
 *   ready: boolean;
 * }} ReadinessReport
 */

function buildReport(services, seedResults) {
  const allRequiredHealthy = services
    .filter((s) => s.status !== 'skipped')
    .every((s) => s.status === 'healthy');
  const allSeedsOk = Object.values(seedResults).every((v) => v === 'ok');

  return {
    timestamp: new Date().toISOString(),
    authProfile: AUTH_PROFILE,
    seedMode: SEED_MODE,
    services,
    seed: seedResults,
    ready: allRequiredHealthy && allSeedsOk,
  };
}

// ── Auth profile validation ──────────────────────────────────────────────

async function validateAuthProfile() {
  if (AUTH_PROFILE === 'dev-token') {
    log('Auth profile: dev-token — verifying API accepts dev token...');
    try {
      const devToken = process.env['PORTARIUM_DEV_TOKEN'] ?? 'portarium-dev-token';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(`${API_URL}/health`, {
        headers: { Authorization: `Bearer ${devToken}` },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        log('Dev-token auth: OK');
        return { devToken: 'ok' };
      }
      log(`Dev-token auth: API returned ${res.status}`);
      return { devToken: 'degraded', note: `HTTP ${res.status}` };
    } catch (e) {
      log(`Dev-token auth check failed: ${e.message}`);
      return { devToken: 'failed', error: e.message };
    }
  }

  if (AUTH_PROFILE === 'oidc') {
    log('Auth profile: oidc — verifying Keycloak JWKS endpoint...');
    try {
      const jwksUrl = `${KEYCLOAK_URL}/realms/portarium/protocol/openid-connect/certs`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(jwksUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const body = await res.json();
        const keyCount = body?.keys?.length ?? 0;
        log(`OIDC JWKS: OK (${keyCount} keys)`);
        return { oidc: 'ok', keyCount };
      }
      log(`OIDC JWKS: HTTP ${res.status}`);
      return { oidc: 'failed', error: `HTTP ${res.status}` };
    } catch (e) {
      log(`OIDC JWKS check failed: ${e.message}`);
      return { oidc: 'failed', error: e.message };
    }
  }

  log(`Unknown auth profile: ${AUTH_PROFILE}`);
  return { unknown: 'failed', error: `Unsupported auth profile: ${AUTH_PROFILE}` };
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  log(`Integration harness — auth=${AUTH_PROFILE} seed=${SEED_MODE}`);

  // 1. Bring up services (unless --check-only)
  if (!CHECK_ONLY) {
    const profiles = composeProfiles();
    log(`Starting profiles: ${profiles.join(', ')}`);
    try {
      composeUp(profiles);
    } catch (e) {
      log(`Compose up failed: ${e.message}`);
      log('');
      log('=== TROUBLESHOOTING ===');
      log('1. Is Docker running?  docker info');
      log('2. Are ports in use?   netstat -an | grep -E "5432|7233|9000|8200"');
      log('3. Stale volumes?      docker compose down -v && retry');
      log('4. Disk space?         docker system df  (prune with: docker system prune -f)');
      process.exit(1);
    }
  }

  // 2. Health checks
  log('Checking service health...');
  const services = await checkAllHealth();

  const unhealthy = services.filter((s) => s.status === 'unhealthy');
  if (unhealthy.length > 0) {
    log('');
    log('=== UNHEALTHY SERVICES ===');
    for (const s of unhealthy) {
      log(`  ${s.service}: ${s.error ?? 'unknown'} (${s.url})`);
    }
    log('');
    log('=== TROUBLESHOOTING ===');
    log('1. Check container logs:  docker compose logs <service-name>');
    log('2. Restart single service:  docker compose restart <service-name>');
    log('3. Full reset:  docker compose down -v && npm run integration:harness');
    if (unhealthy.some((s) => s.service === 'temporal')) {
      log('4. Temporal specific: check infra/temporal/development.yaml config');
    }
    if (unhealthy.some((s) => s.service === 'keycloak')) {
      log('4. Keycloak specific: check infra/keycloak/realm-portarium.json');
      log('   Keycloak takes 60-90s to start — retry after waiting');
    }
    if (unhealthy.some((s) => s.service === 'odoo')) {
      log('4. Odoo specific: Odoo takes 60-120s to initialize on first start');
      log('   Check: docker compose logs portarium-odoo');
    }
  }

  // 3. Auth profile validation
  const authResult = await validateAuthProfile();

  // 4. Seed orchestration
  let seedResults = {};
  if (!CHECK_ONLY) {
    seedResults = await runSeed();
    if (SEED_MODE === 'odoo') {
      const odooResult = await runOdooReseed();
      seedResults = { ...seedResults, ...odooResult };
    }
  }

  // 5. Build and output readiness report
  const report = buildReport(services, seedResults);
  report.auth = authResult;

  if (JSON_OUTPUT) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    log('');
    log('=== READINESS REPORT ===');
    log(`  Timestamp:    ${report.timestamp}`);
    log(`  Auth profile: ${report.authProfile}`);
    log(`  Seed mode:    ${report.seedMode}`);
    log(`  Ready:        ${report.ready ? 'YES' : 'NO'}`);
    log('');
    log('  Services:');
    for (const s of report.services) {
      const icon = s.status === 'healthy' ? 'OK' : s.status === 'skipped' ? 'SKIP' : 'FAIL';
      log(`    [${icon}] ${s.service} (${s.latencyMs}ms)${s.error ? ' — ' + s.error : ''}`);
    }
    if (Object.keys(seedResults).length > 0) {
      log('');
      log('  Seed:');
      for (const [k, v] of Object.entries(seedResults)) {
        log(`    ${k}: ${v}`);
      }
    }
    log('');
    log('  Auth:');
    for (const [k, v] of Object.entries(authResult)) {
      log(`    ${k}: ${v}`);
    }
  }

  process.exit(report.ready ? 0 : 1);
}

main().catch((e) => {
  log(`Fatal: ${e.message}`);
  process.exit(1);
});
