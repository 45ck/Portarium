import { describe, expect, it } from 'vitest';
import {
  PORTARIUM_ROBOT_EVENT_PREFIX,
  ROBOT_CLOUD_EVENT_SOURCE,
  ROBOT_CLOUD_EVENT_TYPES,
} from './robot-events-v1.js';

describe('ROBOT_CLOUD_EVENT_TYPES', () => {
  it('defines mission/action/estop lifecycle type strings', () => {
    expect(ROBOT_CLOUD_EVENT_TYPES.MissionDispatched).toBe(
      'com.portarium.robot.mission.Dispatched',
    );
    expect(ROBOT_CLOUD_EVENT_TYPES.MissionPreempted).toBe('com.portarium.robot.mission.Preempted');
    expect(ROBOT_CLOUD_EVENT_TYPES.ActionStarted).toBe('com.portarium.robot.action.Started');
    expect(ROBOT_CLOUD_EVENT_TYPES.ActionFeedbackReceived).toBe(
      'com.portarium.robot.action.FeedbackReceived',
    );
    expect(ROBOT_CLOUD_EVENT_TYPES.EstopTriggered).toBe('com.portarium.robot.estop.Triggered');
    expect(ROBOT_CLOUD_EVENT_TYPES.EstopCleared).toBe('com.portarium.robot.estop.Cleared');
  });

  it('uses canonical prefix and source', () => {
    expect(PORTARIUM_ROBOT_EVENT_PREFIX).toBe('com.portarium.robot');
    expect(ROBOT_CLOUD_EVENT_SOURCE).toBe('portarium.control-plane.robotics');
  });
});
