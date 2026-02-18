import { describe, expect, it } from 'vitest';

import {
  AGENT_CLOUD_EVENT_SOURCE,
  AGENT_CLOUD_EVENT_TYPES,
  PORTARIUM_AGENT_EVENT_PREFIX,
} from './agent-events-v1.js';

describe('PORTARIUM_AGENT_EVENT_PREFIX', () => {
  it('uses the com.portarium.agent namespace', () => {
    expect(PORTARIUM_AGENT_EVENT_PREFIX).toBe('com.portarium.agent');
  });
});

describe('AGENT_CLOUD_EVENT_TYPES', () => {
  it('ActionDispatched follows the catalogue convention', () => {
    expect(AGENT_CLOUD_EVENT_TYPES.ActionDispatched).toBe('com.portarium.agent.ActionDispatched');
  });

  it('ActionCompleted follows the catalogue convention', () => {
    expect(AGENT_CLOUD_EVENT_TYPES.ActionCompleted).toBe('com.portarium.agent.ActionCompleted');
  });

  it('ActionFailed follows the catalogue convention', () => {
    expect(AGENT_CLOUD_EVENT_TYPES.ActionFailed).toBe('com.portarium.agent.ActionFailed');
  });

  it('all types start with the shared prefix', () => {
    for (const type of Object.values(AGENT_CLOUD_EVENT_TYPES)) {
      expect(type).toMatch(new RegExp(`^${PORTARIUM_AGENT_EVENT_PREFIX}\\.`));
    }
  });
});

describe('AGENT_CLOUD_EVENT_SOURCE', () => {
  it('identifies the agent-runtime source', () => {
    expect(AGENT_CLOUD_EVENT_SOURCE).toBe('portarium.control-plane.agent-runtime');
  });
});
