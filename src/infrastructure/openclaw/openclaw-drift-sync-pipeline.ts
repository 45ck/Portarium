import type {
  AgentGatewayStatus,
  BridgeOperationResult,
  OpenClawManagementBridgePort,
} from '../../application/ports/openclaw-management-bridge-port.js';
import type { MachineQueryStore } from '../../application/ports/machine-query-store.js';
import type { AgentConfigV1 } from '../../domain/machines/machine-registration-v1.js';
import type { TenantId, WorkspaceId } from '../../domain/primitives/index.js';

/**
 * Summary of a single drift-sync pass over a workspace's agent fleet.
 */
export type DriftSyncReport = Readonly<{
  tenantId: string;
  workspaceId: string;
  /** Total number of active agents evaluated. */
  agentsChecked: number;
  /** Agents found in Portarium registry but absent on the gateway. */
  driftDetected: number;
  /** Agents successfully re-registered on the gateway during this pass. */
  synced: number;
  /** Gateway sync attempts that returned a failure (soft). */
  syncFailures: number;
  /** ISO timestamp when this sync pass completed. */
  completedAtIso: string;
}>;

export type DriftSyncPipelineConfig = Readonly<{
  /**
   * Maximum number of agents to process per workspace per sync pass.
   * Default: 100.  Prevents runaway scans on large fleets.
   */
  maxAgentsPerPass?: number;
  /**
   * Clock function — injected for testing (default: Date.now).
   */
  now?: () => number;
}>;

const DEFAULT_MAX_AGENTS_PER_PASS = 100;

/**
 * Infrastructure service that reconciles agent presence between the
 * Portarium registry and the OpenClaw gateway.
 *
 * Lifecycle:
 * 1. Lists active agents for the workspace from the read store.
 * 2. For each agent, queries the gateway registration status.
 * 3. If the agent is absent (drift), calls syncAgentRegistration.
 * 4. Returns a DriftSyncReport summarising the pass.
 *
 * All gateway failures are soft — the pipeline always resolves (never throws).
 * Designed to be called from a scheduler (e.g. every 5 minutes).
 */
export class OpenClawDriftSyncPipeline {
  readonly #queryStore: MachineQueryStore;
  readonly #bridge: OpenClawManagementBridgePort;
  readonly #maxAgentsPerPass: number;
  readonly #now: () => number;

  public constructor(
    queryStore: MachineQueryStore,
    bridge: OpenClawManagementBridgePort,
    config: DriftSyncPipelineConfig = {},
  ) {
    this.#queryStore = queryStore;
    this.#bridge = bridge;
    this.#maxAgentsPerPass = config.maxAgentsPerPass ?? DEFAULT_MAX_AGENTS_PER_PASS;
    this.#now = config.now ?? (() => Date.now());
  }

  /**
   * Runs one drift-sync pass for the given workspace.
   * Always resolves — errors are captured in the report.
   */
  public async syncWorkspace(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
  ): Promise<DriftSyncReport> {
    const agents = await this.#loadAgents(tenantId, workspaceId);

    let driftDetected = 0;
    let synced = 0;
    let syncFailures = 0;

    for (const agent of agents) {
      let status: AgentGatewayStatus;
      try {
        status = await this.#bridge.getAgentGatewayStatus(tenantId, agent.machineId, agent.agentId);
      } catch {
        // getAgentGatewayStatus should never throw, but guard defensively.
        status = 'unknown';
      }

      // Only remediate clear absence; leave 'unknown' (gateway unreachable) alone.
      if (status !== 'unregistered') continue;

      driftDetected += 1;

      let result: BridgeOperationResult;
      try {
        result = await this.#bridge.syncAgentRegistration(
          tenantId,
          agent.machineId,
          agent.agentId,
          agent.capabilities.map((d) => {
            const raw = d as unknown;
            return typeof raw === 'string'
              ? raw
              : String((raw as { capability: unknown }).capability);
          }),
        );
      } catch {
        result = { ok: false, reason: 'Unexpected error during syncAgentRegistration.' };
      }

      if (result.ok) {
        synced += 1;
      } else {
        syncFailures += 1;
      }
    }

    return {
      tenantId: String(tenantId),
      workspaceId: String(workspaceId),
      agentsChecked: agents.length,
      driftDetected,
      synced,
      syncFailures,
      completedAtIso: new Date(this.#now()).toISOString(),
    };
  }

  async #loadAgents(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
  ): Promise<readonly AgentConfigV1[]> {
    try {
      const page = await this.#queryStore.listAgentConfigs(tenantId, {
        workspaceId,
        pagination: { limit: this.#maxAgentsPerPass },
      });
      return page.items;
    } catch {
      // If the store is unavailable, return empty — nothing to reconcile.
      return [];
    }
  }
}
