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

export interface RobotLocation {
  robotId: string;
  name: string;
  robotClass: RobotClass;
  status: RobotStatus;
  batteryPct: number;
  lat: number;
  lng: number;
  heading: number;
  speedMps: number;
  updatedAtIso: string;
  missionId?: string;
  trail: Array<{ lat: number; lng: number; timestampIso: string }>;
}

export interface Geofence {
  geofenceId: string;
  label: string;
  polygon: Array<[number, number]>;
  color: string;
}

export interface SpatialAlert {
  alertId: string;
  robotId: string;
  type: 'geofence-violation' | 'localization-drop' | 'e-stop';
  message: string;
  lat: number;
  lng: number;
  timestampIso: string;
  severity: 'warning' | 'critical';
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
