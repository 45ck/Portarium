/**
 * Robot lifecycle CloudEvents type catalogue (bead-0511).
 */
export const PORTARIUM_ROBOT_EVENT_PREFIX = 'com.portarium.robot' as const;

export const ROBOT_CLOUD_EVENT_TYPES = {
  MissionDispatched: `${PORTARIUM_ROBOT_EVENT_PREFIX}.mission.Dispatched`,
  MissionSucceeded: `${PORTARIUM_ROBOT_EVENT_PREFIX}.mission.Succeeded`,
  MissionFailed: `${PORTARIUM_ROBOT_EVENT_PREFIX}.mission.Failed`,
  MissionPreempted: `${PORTARIUM_ROBOT_EVENT_PREFIX}.mission.Preempted`,
  ActionStarted: `${PORTARIUM_ROBOT_EVENT_PREFIX}.action.Started`,
  ActionFeedbackReceived: `${PORTARIUM_ROBOT_EVENT_PREFIX}.action.FeedbackReceived`,
  ActionCompleted: `${PORTARIUM_ROBOT_EVENT_PREFIX}.action.Completed`,
  ActionCancelled: `${PORTARIUM_ROBOT_EVENT_PREFIX}.action.Cancelled`,
  EstopTriggered: `${PORTARIUM_ROBOT_EVENT_PREFIX}.estop.Triggered`,
  EstopCleared: `${PORTARIUM_ROBOT_EVENT_PREFIX}.estop.Cleared`,
} as const;

export type RobotCloudEventType =
  (typeof ROBOT_CLOUD_EVENT_TYPES)[keyof typeof ROBOT_CLOUD_EVENT_TYPES];

export const ROBOT_CLOUD_EVENT_SOURCE = 'portarium.control-plane.robotics' as const;
