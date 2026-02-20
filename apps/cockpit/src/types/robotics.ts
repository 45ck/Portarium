// Local types for the robotics prototype UI.
// These are not yet in @portarium/cockpit-types as robotics is prototype-stage.

export type RobotClass = 'AMR' | 'AGV' | 'Manipulator' | 'UAV' | 'PLC';
export type RobotStatus = 'Online' | 'Degraded' | 'E-Stopped' | 'Offline';

export interface RobotSummary {
  robotId: string;
  name: string;
  robotClass: RobotClass;
  status: RobotStatus;
  batteryPct: number;
  lastHeartbeatSec: number;
  missionId?: string;
  gatewayUrl: string;
  spiffeSvid: string;
  capabilities: string[];
}

export type MissionStatus = 'Pending' | 'Executing' | 'Completed' | 'Failed' | 'Cancelled';
export type MissionActionType = 'navigate_to' | 'pick' | 'place' | 'dock' | 'custom';

export interface MissionSummary {
  missionId: string;
  robotId: string;
  goal: string;
  actionType: MissionActionType;
  status: MissionStatus;
  priority: 'Low' | 'Normal' | 'High' | 'Safety';
  dispatchedAtIso?: string;
  completedAtIso?: string;
  executionTier: 'Auto' | 'HumanApprove';
}

export type EnforcementMode = 'block' | 'warn' | 'log';

export interface SafetyConstraint {
  constraintId: string;
  site: string;
  constraint: string;
  enforcement: EnforcementMode;
  robotCount: number;
}

export interface ApprovalThreshold {
  actionClass: string;
  tier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
  notes: string;
}

export interface EStopAuditEntry {
  timestamp: string;
  actor: string;
  robotId: string;
  event: 'Sent' | 'Cleared';
  detail: string;
}
