import { Redis } from 'ioredis';

import { err } from '../../application/common/result.js';
import { WorkspaceRbacAuthorization } from '../../application/iam/rbac/workspace-rbac-authorization.js';
import type {
  ApprovalQueryStore,
  ApprovalStore,
  AuthenticationPort,
  AuthorizationPort,
  QueryCache,
  RunQueryStore,
  RunStore,
  WorkspaceQueryStore,
  WorkspaceStore,
} from '../../application/ports/index.js';
import type { ActionRunnerPort } from '../../application/ports/action-runner.js';
import type { EvidenceLogPort } from '../../application/ports/evidence-log.js';
import type { EventPublisher } from '../../application/ports/event-publisher.js';
import type { UnitOfWork } from '../../application/ports/unit-of-work.js';
import { DevTokenAuthentication } from '../../infrastructure/auth/dev-token-authentication.js';
import { checkDevAuthEnvGate } from '../../infrastructure/auth/dev-token-env-gate.js';
import { JoseJwtAuthentication } from '../../infrastructure/auth/jose-jwt-authentication.js';
import { OpenFgaAuthorization } from '../../infrastructure/auth/openfga-authorization.js';
import { InMemoryQueryCache, RedisQueryCache } from '../../infrastructure/caching/index.js';
import { InMemoryEventStreamBroadcast } from '../../infrastructure/event-streaming/in-memory-event-stream-broadcast.js';
import { NodePostgresSqlClient } from '../../infrastructure/postgresql/node-postgres-sql-client.js';
import { PostgresAgentActionProposalStore } from '../../infrastructure/postgresql/postgres-agent-action-proposal-store.js';
import { PostgresEvidenceLog } from '../../infrastructure/postgresql/postgres-eventing.js';
import { PostgresMachineRegistryStore } from '../../infrastructure/postgresql/postgres-machine-registry-store.js';
import {
  PostgresApprovalStore,
  PostgresRunStore,
  PostgresWorkspaceStore,
} from '../../infrastructure/postgresql/postgres-store-adapters.js';
import {
  InMemoryRateLimitStore,
  RedisRateLimitStore,
} from '../../infrastructure/rate-limiting/index.js';
import { InMemoryAgentActionProposalStore } from '../../infrastructure/stores/in-memory-agent-action-proposal-store.js';
import { InMemoryEvidenceLog } from '../../infrastructure/stores/in-memory-evidence-log.js';
import { InMemoryMachineRegistryStore } from '../../infrastructure/stores/in-memory-machine-registry-store.js';
import { InMemoryPolicyStore } from '../../infrastructure/stores/in-memory-policy-store.js';
import { parsePolicyV1 } from '../../domain/policy/policy-v1.js';
import { TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type { ControlPlaneDeps } from './control-plane-handler.shared.js';
import { checkStoreBootstrapGate } from './store-bootstrap-gate.js';

/** Seed a default governance policy into the in-memory policy store. */
function seedDefaultPolicy(store: InMemoryPolicyStore, workspaceId: string): void {
  const policy = parsePolicyV1({
    schemaVersion: 1,
    policyId: 'default-governance',
    workspaceId,
    name: 'Default Governance Policy',
    description: 'Seed policy for local development — allows governed agent actions.',
    active: true,
    priority: 1,
    version: 1,
    createdAtIso: new Date().toISOString(),
    createdByUserId: 'system',
  });
  store.savePolicy(TenantId(workspaceId), WorkspaceId(workspaceId), policy);
}

/**
 * Returns any configuration warnings for the JWT authentication setup.
 * Exported for testing; the bootstrap calls this and writes warnings to stderr.
 */
export function getJoseAuthConfigWarnings(
  env: Record<string, string | undefined> = process.env,
): readonly string[] {
  const warnings: string[] = [];

  if (!env['PORTARIUM_JWT_ISSUER']?.trim()) {
    warnings.push(
      '[portarium] WARNING: PORTARIUM_JWT_ISSUER is not set. ' +
        'Without issuer validation, tokens from any issuer will be accepted. ' +
        'Set PORTARIUM_JWT_ISSUER to the expected token issuer URL.',
    );
  }
  if (!env['PORTARIUM_JWT_AUDIENCE']?.trim()) {
    warnings.push(
      '[portarium] WARNING: PORTARIUM_JWT_AUDIENCE is not set. ' +
        'Without audience validation, tokens intended for other services will be accepted. ' +
        "Set PORTARIUM_JWT_AUDIENCE to this service's expected audience value.",
    );
  }

  return warnings;
}

function tryBuildJoseAuthentication(): AuthenticationPort | null {
  const jwksUri = process.env['PORTARIUM_JWKS_URI']?.trim();
  if (!jwksUri) return null;

  const issuer = process.env['PORTARIUM_JWT_ISSUER']?.trim();
  const audience = process.env['PORTARIUM_JWT_AUDIENCE']?.trim();

  for (const warning of getJoseAuthConfigWarnings()) {
    process.stderr.write(warning + '\n');
  }

  return new JoseJwtAuthentication({
    jwksUri,
    ...(issuer ? { issuer } : {}),
    ...(audience ? { audience } : {}),
  });
}

function tryBuildDevAuthentication(): AuthenticationPort | null {
  const devToken = process.env['PORTARIUM_DEV_TOKEN']?.trim();
  const devWorkspaceId = process.env['PORTARIUM_DEV_WORKSPACE_ID']?.trim();
  if (!devToken || !devWorkspaceId) return null;

  // Hard env-gate: ENABLE_DEV_AUTH=true must be explicitly set.
  // Throws a fatal error if ENABLE_DEV_AUTH=true but NODE_ENV is not development/test.
  const gate = checkDevAuthEnvGate();
  if (!gate.allowed) {
    process.stderr.write(
      `[portarium] WARNING: PORTARIUM_DEV_TOKEN is set but dev token auth is NOT activated: ${gate.reason} ` +
        'Set ENABLE_DEV_AUTH=true (in a development or test environment) to enable.\n',
    );
    return null;
  }

  // Log a visible warning so operators know dev auth is active.
  process.stderr.write(
    '[portarium] WARNING: Dev token auth is enabled (PORTARIUM_DEV_TOKEN). ' +
      'This bypasses JWKS validation and must never be used in production.\n',
  );

  const devUserId = process.env['PORTARIUM_DEV_USER_ID']?.trim();
  const primary = new DevTokenAuthentication({
    token: devToken,
    workspaceId: devWorkspaceId,
    ...(devUserId ? { userId: devUserId } : {}),
  });

  // Optional second dev token for maker-checker QA (different user, same workspace).
  const devToken2 = process.env['PORTARIUM_DEV_TOKEN_2']?.trim();
  const devUserId2 = process.env['PORTARIUM_DEV_USER_ID_2']?.trim();
  if (!devToken2 || !devUserId2) return primary;

  const secondary = new DevTokenAuthentication({
    token: devToken2,
    workspaceId: devWorkspaceId,
    userId: devUserId2,
  });

  process.stderr.write(
    `[portarium] Dev auth: two users configured (${devUserId ?? 'dev-user'}, ${devUserId2}).\n`,
  );

  // Chain: try primary first, then secondary.
  return {
    authenticateBearerToken: async (input) => {
      const r1 = await primary.authenticateBearerToken(input);
      if (r1.ok) return r1;
      return secondary.authenticateBearerToken(input);
    },
  };
}

function buildAuthentication(): AuthenticationPort {
  return (
    tryBuildJoseAuthentication() ??
    tryBuildDevAuthentication() ?? {
      authenticateBearerToken: ({ correlationId }) =>
        Promise.resolve(
          err({
            kind: 'Unauthorized',
            message: `Authentication not configured. (${correlationId})`,
          }),
        ),
    }
  );
}

function buildAuthorization(): AuthorizationPort {
  const apiUrl = process.env['PORTARIUM_OPENFGA_API_URL']?.trim();
  const storeId = process.env['PORTARIUM_OPENFGA_STORE_ID']?.trim();
  const authorizationModelId = process.env['PORTARIUM_OPENFGA_AUTHORIZATION_MODEL_ID']?.trim();
  const apiToken = process.env['PORTARIUM_OPENFGA_API_TOKEN']?.trim();

  if (apiUrl && storeId) {
    return new OpenFgaAuthorization({
      apiUrl,
      storeId,
      ...(authorizationModelId ? { authorizationModelId } : {}),
      ...(apiToken ? { apiToken } : {}),
    });
  }

  return new WorkspaceRbacAuthorization();
}

/**
 * Build the rate-limit store from environment variables.
 *
 * Env vars:
 *   RATE_LIMIT_STORE=redis|memory   (default: memory)
 *   REDIS_URL                       (required when RATE_LIMIT_STORE=redis)
 */
function buildRateLimitStore(): InMemoryRateLimitStore | RedisRateLimitStore {
  const storeType = process.env['RATE_LIMIT_STORE']?.trim();
  const redisUrl = process.env['REDIS_URL']?.trim();

  if (storeType === 'redis') {
    if (!redisUrl) {
      process.stderr.write(
        '[portarium] WARNING: RATE_LIMIT_STORE=redis but REDIS_URL is not set. ' +
          'Falling back to in-memory rate-limit store.\n',
      );
      return new InMemoryRateLimitStore();
    }
    const redis = new Redis(redisUrl, { enableOfflineQueue: false, lazyConnect: true });
    const client = {
      get: (key: string) => redis.get(key),
      eval: (script: string, numkeys: number, ...args: (string | number)[]) =>
        redis.eval(script, numkeys, ...args),
      scan: (cursor: string, ...args: string[]) =>
        (
          redis as unknown as {
            scan: (cursor: string, ...a: string[]) => Promise<[string, string[]]>;
          }
        ).scan(cursor, ...args),
      del: (...keys: string[]) => redis.del(...keys),
    };
    process.stderr.write('[portarium] Rate-limit store: Redis (' + redisUrl + ')\n');
    return new RedisRateLimitStore(client);
  }

  return new InMemoryRateLimitStore();
}

/**
 * Build the query cache from environment variables.
 *
 * Env vars:
 *   QUERY_CACHE_STORE=redis|memory   (default: memory)
 *   REDIS_URL                        (required when QUERY_CACHE_STORE=redis)
 */
function buildQueryCache(): QueryCache {
  const storeType = process.env['QUERY_CACHE_STORE']?.trim();
  const redisUrl = process.env['REDIS_URL']?.trim();

  if (storeType === 'redis') {
    if (!redisUrl) {
      process.stderr.write(
        '[portarium] WARNING: QUERY_CACHE_STORE=redis but REDIS_URL is not set. ' +
          'Falling back to in-memory query cache.\n',
      );
      return new InMemoryQueryCache();
    }
    const redis = new Redis(redisUrl, { enableOfflineQueue: false, lazyConnect: true });
    const client = {
      get: (key: string) => redis.get(key),
      set: (key: string, value: string, expiry: 'EX', ttlSeconds: number) =>
        redis.set(key, value, expiry, ttlSeconds),
      del: (...keys: string[]) => redis.del(...keys),
      scan: (cursor: string, ...args: string[]) =>
        (
          redis as unknown as {
            scan: (cursor: string, ...a: string[]) => Promise<[string, string[]]>;
          }
        ).scan(cursor, ...args),
    };
    process.stderr.write('[portarium] Query cache store: Redis (' + redisUrl + ')\n');
    return new RedisQueryCache(client);
  }

  return new InMemoryQueryCache();
}

function buildInMemoryApprovalStore(): ApprovalStore & ApprovalQueryStore {
  const store = new Map<string, import('../../domain/approvals/index.js').ApprovalV1>();
  return {
    getApprovalById: async (_tenantId, _workspaceId, approvalId) =>
      store.get(String(approvalId)) ?? null,
    saveApproval: async (_tenantId, approval) => {
      store.set(String(approval.approvalId), approval);
    },
    listApprovals: async (_tenantId, _workspaceId, filter) => {
      let items = [...store.values()];
      if (filter.status) items = items.filter((a) => a.status === filter.status);
      if (filter.runId) items = items.filter((a) => String(a.runId) === String(filter.runId));
      if (filter.planId) items = items.filter((a) => String(a.planId) === String(filter.planId));
      if (filter.limit) items = items.slice(0, filter.limit);
      return { items };
    },
  };
}

function buildEventPublisher(): EventPublisher {
  return { publish: async () => {} };
}

function buildUnitOfWork(): UnitOfWork {
  return { execute: async (fn) => fn() };
}

/** Build a stub action runner that always succeeds. Actions are not actually dispatched. */
function buildActionRunner(): ActionRunnerPort {
  process.stderr.write(
    '[portarium] WARNING: Using stub action runner. ' +
      'Agent actions will appear to succeed but are not dispatched to an execution plane.\n',
  );
  return {
    dispatchAction: async (input) => ({
      ok: true as const,
      output: { status: 'completed', runId: String(input.runId) },
    }),
  };
}

export function buildControlPlaneDeps(): ControlPlaneDeps {
  const authentication = buildAuthentication();
  const authorization = buildAuthorization();
  const rateLimitStore = buildRateLimitStore();
  const queryCache = buildQueryCache();
  const eventStream = new InMemoryEventStreamBroadcast();
  const eventPublisher = buildEventPublisher();
  const unitOfWork = buildUnitOfWork();
  const actionRunner = buildActionRunner();

  const usePostgresStores = process.env['PORTARIUM_USE_POSTGRES_STORES']?.trim() === 'true';
  const connectionString = process.env['PORTARIUM_DATABASE_URL']?.trim();

  if (usePostgresStores && connectionString) {
    const sqlClient = new NodePostgresSqlClient({ connectionString });
    const workspaceStore = new PostgresWorkspaceStore(sqlClient);
    const runStore = new PostgresRunStore(sqlClient);
    const approvalStore = new PostgresApprovalStore(sqlClient);
    const agentActionProposalStore = new PostgresAgentActionProposalStore(sqlClient);
    const machineStore = new PostgresMachineRegistryStore(sqlClient);
    const evidenceLog: EvidenceLogPort = new PostgresEvidenceLog(sqlClient);
    // TODO: Replace with PostgresPolicyStore once policy CRUD API exists.
    const policyStore = new InMemoryPolicyStore();
    const devWsId = process.env['PORTARIUM_DEV_WORKSPACE_ID']?.trim() ?? 'ws-local-dev';
    seedDefaultPolicy(policyStore, devWsId);
    return {
      authentication,
      authorization,
      workspaceStore,
      runStore,
      workspaceQueryStore: workspaceStore,
      runQueryStore: runStore,
      rateLimitStore,
      queryCache,
      eventStream,
      approvalStore,
      approvalQueryStore: approvalStore,
      agentActionProposalStore,
      machineRegistryStore: machineStore,
      machineQueryStore: machineStore,
      evidenceLog,
      policyStore,
      eventPublisher,
      unitOfWork,
      actionRunner,
    };
  }

  const approvalStore = buildInMemoryApprovalStore();

  const gate = checkStoreBootstrapGate();
  if (!gate.allowed) {
    throw new Error(
      `[portarium] FATAL: No persistent store configured and DEV_STUB_STORES is not enabled. ` +
        `Set PORTARIUM_USE_POSTGRES_STORES=true and PORTARIUM_DATABASE_URL to use Postgres, ` +
        `or set DEV_STUB_STORES=true (in NODE_ENV=development or test) to allow in-memory stubs. ` +
        `(${gate.reason})`,
    );
  }

  process.stderr.write(
    '[portarium] WARNING: Using in-memory stub stores (DEV_STUB_STORES=true). ' +
      'Data will not persist across restarts. Do not use in production.\n',
  );

  const workspaceStore: WorkspaceStore & WorkspaceQueryStore = {
    getWorkspaceById: () => Promise.resolve(null),
    getWorkspaceByName: () => Promise.resolve(null),
    saveWorkspace: () => Promise.resolve(),
    listWorkspaces: () => Promise.resolve({ items: [] }),
  };
  const runStore: RunStore & RunQueryStore = {
    getRunById: () => Promise.resolve(null),
    saveRun: () => Promise.resolve(),
    listRuns: () => Promise.resolve({ items: [] }),
  };
  const agentActionProposalStore = new InMemoryAgentActionProposalStore();
  const machineRegistryStore = new InMemoryMachineRegistryStore();
  const policyStore = new InMemoryPolicyStore();
  const devWsId = process.env['PORTARIUM_DEV_WORKSPACE_ID']?.trim() ?? 'ws-local-dev';
  seedDefaultPolicy(policyStore, devWsId);
  const evidenceLog: EvidenceLogPort = new InMemoryEvidenceLog();

  return {
    authentication,
    authorization,
    workspaceStore,
    workspaceQueryStore: workspaceStore,
    runStore,
    runQueryStore: runStore,
    rateLimitStore,
    queryCache,
    eventStream,
    approvalStore,
    approvalQueryStore: approvalStore,
    agentActionProposalStore,
    machineRegistryStore,
    machineQueryStore: machineRegistryStore,
    policyStore,
    evidenceLog,
    eventPublisher,
    unitOfWork,
    actionRunner,
  };
}
