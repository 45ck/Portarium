import { describe, expect, it } from 'vitest';

import { parseFleetV1, parseRobotV1 } from './robot-fleet-v1.js';

function baseRobot(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: 1,
    robotId: 'robot-1',
    fleetId: 'fleet-1',
    displayName: 'AMR-01',
    robotClass: 'AMR_AGV',
    capabilities: ['robot:execute_action', 'robot:get_state'],
    safetyProfile: {
      hazardClass: 'High',
      estopSupported: true,
      humanOverrideRequired: true,
    },
    softwareVersion: 'nav2-1.2.0',
    connectivityState: 'Online',
    ...overrides,
  };
}

function baseFleet(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: 1,
    fleetId: 'fleet-1',
    tenantId: 'ws-1',
    siteZone: 'warehouse-a/zone-1',
    sharedPolicies: ['policy:safety-tier-high', 'policy:sod-two-person'],
    ...overrides,
  };
}

describe('parseRobotV1', () => {
  it('parses a robot aggregate with robotics capabilities and safety profile', () => {
    const robot = parseRobotV1(baseRobot());
    expect(robot.robotClass).toBe('AMR_AGV');
    expect(robot.capabilities).toEqual(['robot:execute_action', 'robot:get_state']);
  });

  it('rejects unsupported robotClass values', () => {
    expect(() => parseRobotV1(baseRobot({ robotClass: 'Submarine' }))).toThrow(/robotClass/i);
  });

  it('rejects capabilities outside RoboticsActuation capability matrix', () => {
    expect(() => parseRobotV1(baseRobot({ capabilities: ['invoice:read'] }))).toThrow(
      /RoboticsActuation capability/i,
    );
  });
});

describe('parseFleetV1', () => {
  it('parses fleet value object with tenant and shared policies', () => {
    const fleet = parseFleetV1(baseFleet());
    expect(fleet.siteZone).toContain('warehouse');
    expect(fleet.sharedPolicies).toHaveLength(2);
  });

  it('rejects non-array sharedPolicies', () => {
    expect(() => parseFleetV1(baseFleet({ sharedPolicies: 'policy:one' }))).toThrow(
      /sharedPolicies must be an array/i,
    );
  });
});
