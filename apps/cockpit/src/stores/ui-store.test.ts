// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { QUERY_CACHE_STORAGE_KEY, queryClient } from '@/lib/query-client';
import { useUIStore } from '@/stores/ui-store';

describe('useUIStore workspace cache isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    queryClient.clear();
    useUIStore.setState({
      activeWorkspaceId: 'ws-1',
      activeDataset: 'live',
      activePersona: 'Operator',
    });
  });

  it('purges tenant payload caches when the active workspace changes', async () => {
    localStorage.setItem(QUERY_CACHE_STORAGE_KEY, '{"cached":true}');
    localStorage.setItem('portarium:cockpit:offline:runs:ws-1', '{"items":[{"runId":"run-1"}]}');
    localStorage.setItem('portarium:cockpit:approval-outbox:v1:ws-1', '[{"approvalId":"ap-1"}]');
    localStorage.setItem('portarium-triage-view', 'briefing');
    queryClient.setQueryData(['runs', 'ws-1'], { items: [{ runId: 'run-1' }] });

    useUIStore.getState().setActiveWorkspaceId('ws-2');
    await Promise.resolve();

    expect(useUIStore.getState().activeWorkspaceId).toBe('ws-2');
    expect(localStorage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('portarium:cockpit:offline:runs:ws-1')).toBeNull();
    expect(localStorage.getItem('portarium:cockpit:approval-outbox:v1:ws-1')).toBeNull();
    expect(localStorage.getItem('portarium-triage-view')).toBe('briefing');
    expect(queryClient.getQueryData(['runs', 'ws-1'])).toBeUndefined();
  });
});
