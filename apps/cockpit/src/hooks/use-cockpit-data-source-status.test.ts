// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { queryBelongsToWorkspace } from '@/hooks/use-cockpit-data-source-status';

describe('cockpit data source query tracking', () => {
  it.each([
    ['agents'],
    ['approval-coverage-roster'],
    ['cockpit-extension-context'],
    ['credential-grants'],
    ['machines'],
    ['pack-ui-runtime'],
    ['plans'],
    ['policies'],
    ['projects'],
    ['run-evidence'],
    ['sod-constraints'],
    ['users'],
    ['workflows'],
  ])('tracks %s queries for the active workspace', (prefix) => {
    expect(queryBelongsToWorkspace([prefix, 'ws-live'], 'ws-live')).toBe(true);
  });

  it('does not track unscoped or different-workspace queries', () => {
    expect(queryBelongsToWorkspace(['runs', 'ws-other'], 'ws-live')).toBe(false);
    expect(queryBelongsToWorkspace(['theme-preference', 'ws-live'], 'ws-live')).toBe(false);
  });
});
