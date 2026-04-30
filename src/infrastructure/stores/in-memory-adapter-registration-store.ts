import type { AdapterRegistrationStore } from '../../application/ports/adapter-registration-store.js';
import type { AdapterRegistrationV1 } from '../../domain/adapters/index.js';
import type { TenantId, WorkspaceId } from '../../domain/primitives/index.js';

export class InMemoryAdapterRegistrationStore implements AdapterRegistrationStore {
  readonly #store = new Map<string, AdapterRegistrationV1>();

  public async listByWorkspace(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
  ): Promise<readonly AdapterRegistrationV1[]> {
    const prefix = `${String(tenantId)}::${String(workspaceId)}::`;
    return [...this.#store.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, registration]) => registration)
      .sort((left, right) => String(left.adapterId).localeCompare(String(right.adapterId)));
  }

  public async saveRegistration(
    tenantId: TenantId,
    registration: AdapterRegistrationV1,
  ): Promise<void> {
    this.#store.set(
      `${String(tenantId)}::${String(registration.workspaceId)}::${String(registration.adapterId)}`,
      registration,
    );
  }
}
