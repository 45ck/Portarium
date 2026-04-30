import type { PlanQueryStore } from '../../application/ports/index.js';
import { parsePlanV1, type PlanV1 } from '../../domain/plan/index.js';
import { PostgresJsonDocumentStore } from './postgres-json-document-store.js';
import type { SqlClient } from './sql-client.js';

const COLLECTION_PLANS = 'plans';

export class PostgresPlanQueryStore implements PlanQueryStore {
  readonly #documents: PostgresJsonDocumentStore;

  public constructor(client: SqlClient) {
    this.#documents = new PostgresJsonDocumentStore(client);
  }

  public async getPlanById(
    tenantId: string,
    workspaceId: string,
    planId: string,
  ): Promise<PlanV1 | null> {
    const payload = await this.#documents.get(String(tenantId), COLLECTION_PLANS, String(planId));
    if (payload === null) {
      return null;
    }
    const parsed = parsePlanV1(payload);
    return String(parsed.workspaceId) === String(workspaceId) ? parsed : null;
  }
}
