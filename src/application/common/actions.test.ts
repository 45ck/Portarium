import { describe, expect, expectTypeOf, it } from 'vitest';

import { APP_ACTIONS, type AppAction } from './actions.js';

describe('APP_ACTIONS contract', () => {
  it('contains the canonical action set used by application authorization', () => {
    const values = Object.values(APP_ACTIONS);

    expect(values).toEqual([
      'approval:read',
      'approval:submit',
      'run:read',
      'work-item:read',
      'run:start',
      'map-command:submit',
      'workforce:assign',
      'workforce:complete',
      'workspace:register',
      'workspace:read',
      'agent:heartbeat',
      'machine-agent:register',
      'machine-agent:read',
      'machine-agent:bridge-sync',
    ]);
  });

  it('has unique action values', () => {
    const values = Object.values(APP_ACTIONS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('keeps AppAction aligned to APP_ACTIONS values', () => {
    const action: AppAction = APP_ACTIONS.mapCommandSubmit;
    expect(action).toBe('map-command:submit');

    expectTypeOf<AppAction>().toEqualTypeOf<(typeof APP_ACTIONS)[keyof typeof APP_ACTIONS]>();
  });
});
