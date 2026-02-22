import { describe, expect, it } from 'vitest';

import { invokeAdapter } from './index.js';

describe('hello-connector adapter scaffold', () => {
  it('listItems returns shaped canonical tasks', async () => {
    const result = await invokeAdapter({
      tenantId: 'ws-demo',
      capability: 'task:read',
      input: { operation: 'listItems' },
    });

    expect(result.ok).toBe(true);
    const items = result.output?.['items'] as { id: string; title: string; status: string }[];
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      status: expect.any(String),
    });
  });

  it('getItem returns a single canonical task', async () => {
    const result = await invokeAdapter({
      tenantId: 'ws-demo',
      capability: 'task:read',
      input: { operation: 'getItem', id: 'item-001' },
    });

    expect(result.ok).toBe(true);
    expect(result.output?.['item']).toMatchObject({
      id: 'item-001',
      title: 'Set up CI pipeline',
      status: 'done',
    });
  });

  it('getItem returns error for unknown id', async () => {
    const result = await invokeAdapter({
      tenantId: 'ws-demo',
      capability: 'task:read',
      input: { operation: 'getItem', id: 'no-such-item' },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('createItem creates a new task and returns it', async () => {
    const result = await invokeAdapter({
      tenantId: 'ws-demo',
      capability: 'task:write',
      input: { operation: 'createItem', name: 'Hello from scaffold' },
    });

    expect(result.ok).toBe(true);
    const item = result.output?.['item'] as { title: string; status: string };
    expect(item.title).toBe('Hello from scaffold');
    expect(item.status).toBe('open');
  });

  it('updateItem changes the task state', async () => {
    const result = await invokeAdapter({
      tenantId: 'ws-demo',
      capability: 'task:write',
      input: { operation: 'updateItem', id: 'item-002', state: 'done' },
    });

    expect(result.ok).toBe(true);
    const item = result.output?.['item'] as { status: string };
    expect(item.status).toBe('done');
  });

  it('updateItem returns error for unknown id', async () => {
    const result = await invokeAdapter({
      tenantId: 'ws-demo',
      capability: 'task:write',
      input: { operation: 'updateItem', id: 'no-such-item', state: 'done' },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns error for unknown capability', async () => {
    const result = await invokeAdapter({
      tenantId: 'ws-demo',
      capability: 'unknown:op',
      input: { operation: 'doSomething' },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Unknown capability');
  });
});
