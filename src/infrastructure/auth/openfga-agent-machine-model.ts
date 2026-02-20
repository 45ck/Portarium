/**
 * OpenFGA resource-level authorization checks for agents, machines, and runs.
 *
 * Extends the workspace-level OpenFGA authorization (openfga-authorization.ts)
 * with fine-grained resource-level tuple checks:
 *
 * - Agent registration: who can register agents in a workspace
 * - Run creation: who can start runs of specific workflow types
 * - Machine control: who can send commands to machines
 *
 * @see .specify/specs/jwt-claim-schema-v1.md (bead-0669)
 * @see bead-0670
 */

import type { AppContext } from '../../application/common/context.js';

// ---------------------------------------------------------------------------
// Resource types and relations
// ---------------------------------------------------------------------------

export const OPENFGA_RESOURCE_TYPES = [
  'agent',
  'machine',
  'run',
  'workflow',
  'workspace',
] as const;

export type OpenFgaResourceType = (typeof OPENFGA_RESOURCE_TYPES)[number];

export const OPENFGA_RESOURCE_RELATIONS = {
  agent: ['register', 'view', 'delete'] as const,
  machine: ['control', 'view', 'configure'] as const,
  run: ['start', 'view', 'cancel'] as const,
  workflow: ['execute', 'view', 'edit'] as const,
  workspace: ['admin', 'member'] as const,
} as const satisfies Record<OpenFgaResourceType, readonly string[]>;

export type OpenFgaResourceRelation<T extends OpenFgaResourceType> =
  (typeof OPENFGA_RESOURCE_RELATIONS)[T][number];

// ---------------------------------------------------------------------------
// Check input
// ---------------------------------------------------------------------------

export type ResourceCheckInput<T extends OpenFgaResourceType = OpenFgaResourceType> = Readonly<{
  resourceType: T;
  resourceId: string;
  relation: OpenFgaResourceRelation<T>;
}>;

// ---------------------------------------------------------------------------
// Authorization model definition (DSL representation for documentation)
// ---------------------------------------------------------------------------

/**
 * OpenFGA authorization model definition for Portarium resource-level checks.
 * This is the DSL representation meant for `openfga model write`.
 */
export const PORTARIUM_AUTHORIZATION_MODEL_DSL = `
model
  schema 1.1

type user

type workspace
  relations
    define admin: [user]
    define member: [user] or admin

type agent
  relations
    define workspace: [workspace]
    define register: admin from workspace
    define view: member from workspace
    define delete: admin from workspace

type machine
  relations
    define workspace: [workspace]
    define control: admin from workspace
    define view: member from workspace
    define configure: admin from workspace

type run
  relations
    define workspace: [workspace]
    define start: member from workspace
    define view: member from workspace
    define cancel: admin from workspace

type workflow
  relations
    define workspace: [workspace]
    define execute: member from workspace
    define view: member from workspace
    define edit: admin from workspace
` as const;

// ---------------------------------------------------------------------------
// Resource-level check port
// ---------------------------------------------------------------------------

export interface ResourceAuthorizationPort {
  isResourceAllowed<T extends OpenFgaResourceType>(
    ctx: AppContext,
    check: ResourceCheckInput<T>,
  ): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// OpenFGA resource-level check implementation
// ---------------------------------------------------------------------------

export type OpenFgaResourceCheckConfig = Readonly<{
  apiUrl: string;
  storeId: string;
  authorizationModelId?: string;
  apiToken?: string;
  fetchImpl?: typeof fetch;
}>;

type OpenFgaCheckResponse = Readonly<{ allowed?: boolean }>;

function normalizeBaseUrl(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, '');
}

function asAllowed(response: unknown): boolean {
  if (typeof response !== 'object' || response === null) return false;
  return (response as OpenFgaCheckResponse).allowed === true;
}

export class OpenFgaResourceAuthorization implements ResourceAuthorizationPort {
  readonly #apiUrl: string;
  readonly #storeId: string;
  readonly #authorizationModelId: string | undefined;
  readonly #apiToken: string | undefined;
  readonly #fetchImpl: typeof fetch;

  public constructor(config: OpenFgaResourceCheckConfig) {
    this.#apiUrl = normalizeBaseUrl(config.apiUrl);
    this.#storeId = config.storeId;
    this.#authorizationModelId = config.authorizationModelId;
    this.#apiToken = config.apiToken;
    this.#fetchImpl = config.fetchImpl ?? fetch;
  }

  public async isResourceAllowed<T extends OpenFgaResourceType>(
    ctx: AppContext,
    check: ResourceCheckInput<T>,
  ): Promise<boolean> {
    const endpoint = `${this.#apiUrl}/stores/${encodeURIComponent(this.#storeId)}/check`;

    const payload = {
      tuple_key: {
        user: `user:${ctx.principalId}`,
        relation: check.relation,
        object: `${check.resourceType}:${check.resourceId}`,
      },
      ...(this.#authorizationModelId
        ? { authorization_model_id: this.#authorizationModelId }
        : {}),
    };

    try {
      const response = await this.#fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.#apiToken ? { authorization: `Bearer ${this.#apiToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return false;
      const body = await response.json();
      return asAllowed(body);
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export function canRegisterAgent(
  authz: ResourceAuthorizationPort,
  ctx: AppContext,
  agentId: string,
): Promise<boolean> {
  return authz.isResourceAllowed(ctx, {
    resourceType: 'agent',
    resourceId: agentId,
    relation: 'register',
  });
}

export function canStartRun(
  authz: ResourceAuthorizationPort,
  ctx: AppContext,
  workflowId: string,
): Promise<boolean> {
  return authz.isResourceAllowed(ctx, {
    resourceType: 'workflow',
    resourceId: workflowId,
    relation: 'execute',
  });
}

export function canControlMachine(
  authz: ResourceAuthorizationPort,
  ctx: AppContext,
  machineId: string,
): Promise<boolean> {
  return authz.isResourceAllowed(ctx, {
    resourceType: 'machine',
    resourceId: machineId,
    relation: 'control',
  });
}
