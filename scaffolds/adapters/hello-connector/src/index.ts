/**
 * hello-connector — Level 2 (bidirectional) adapter scaffold.
 *
 * This file uses a FakeProviderClient stub. Replace it with a real HTTP client
 * for your provider to graduate from L2 to L3.
 */

// ---------------------------------------------------------------------------
// Canonical types (mirroring Portarium domain shapes)
// ---------------------------------------------------------------------------

export interface CanonicalTask {
  id: string;
  title: string;
  status: 'open' | 'in_progress' | 'done';
  assigneeId?: string;
  dueIso?: string;
}

// ---------------------------------------------------------------------------
// Stub provider client — replace with real HTTP calls
// ---------------------------------------------------------------------------

interface ProviderItem {
  item_id: string;
  name: string;
  state: string;
  owner?: string;
  due_date?: string;
}

class FakeProviderClient {
  private readonly items: ProviderItem[] = [
    { item_id: 'item-001', name: 'Set up CI pipeline', state: 'done' },
    { item_id: 'item-002', name: 'Write integration tests', state: 'open' },
    { item_id: 'item-003', name: 'Deploy to staging', state: 'in_progress', owner: 'alice' },
  ];

  async list(): Promise<ProviderItem[]> {
    return [...this.items];
  }

  async get(id: string): Promise<ProviderItem | null> {
    return this.items.find((i) => i.item_id === id) ?? null;
  }

  async create(name: string): Promise<ProviderItem> {
    const item: ProviderItem = { item_id: `item-${Date.now()}`, name, state: 'open' };
    this.items.push(item);
    return item;
  }

  async update(id: string, patch: Partial<ProviderItem>): Promise<ProviderItem | null> {
    const item = this.items.find((i) => i.item_id === id);
    if (!item) return null;
    Object.assign(item, patch);
    return item;
  }
}

// ---------------------------------------------------------------------------
// Mapping: provider → canonical
// ---------------------------------------------------------------------------

function toCanonicalStatus(state: string): CanonicalTask['status'] {
  if (state === 'done') return 'done';
  if (state === 'in_progress') return 'in_progress';
  return 'open';
}

function toCanonicalTask(item: ProviderItem): CanonicalTask {
  return {
    id: item.item_id,
    title: item.name,
    status: toCanonicalStatus(item.state),
    ...(item.owner !== undefined ? { assigneeId: item.owner } : {}),
    ...(item.due_date !== undefined ? { dueIso: item.due_date } : {}),
  };
}

// ---------------------------------------------------------------------------
// Adapter public API
// ---------------------------------------------------------------------------

export interface AdapterInvocation {
  tenantId: string;
  capability: string;
  input: Record<string, unknown>;
}

export interface AdapterInvocationResult {
  ok: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

const client = new FakeProviderClient();

export async function invokeAdapter(request: AdapterInvocation): Promise<AdapterInvocationResult> {
  const { capability, input } = request;

  try {
    if (capability === 'task:read' && input['operation'] === 'listItems') {
      const items = await client.list();
      return { ok: true, output: { items: items.map(toCanonicalTask) } };
    }

    if (capability === 'task:read' && input['operation'] === 'getItem') {
      const id = String(input['id'] ?? '');
      const item = await client.get(id);
      if (!item) return { ok: false, error: `Item not found: ${id}` };
      return { ok: true, output: { item: toCanonicalTask(item) } };
    }

    if (capability === 'task:write' && input['operation'] === 'createItem') {
      const name = String(input['name'] ?? 'Untitled');
      const item = await client.create(name);
      return { ok: true, output: { item: toCanonicalTask(item) } };
    }

    if (capability === 'task:write' && input['operation'] === 'updateItem') {
      const id = String(input['id'] ?? '');
      const patch: Partial<ProviderItem> = {};
      if (typeof input['name'] === 'string') patch.name = input['name'];
      if (typeof input['state'] === 'string') patch.state = input['state'];
      const item = await client.update(id, patch);
      if (!item) return { ok: false, error: `Item not found: ${id}` };
      return { ok: true, output: { item: toCanonicalTask(item) } };
    }

    return {
      ok: false,
      error: `Unknown capability/operation: ${capability}/${String(input['operation'])}`,
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
