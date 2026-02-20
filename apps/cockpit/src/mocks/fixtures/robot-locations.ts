// ---------------------------------------------------------------------------
// Mock robot location data for the operations map.
// Positions are around the Seattle area for demo purposes.
// ---------------------------------------------------------------------------

import type { RobotStatus, RobotClass } from '@/types/robotics';

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

// Seattle warehouse district area
const BASE_LAT = 47.6062;
const BASE_LNG = -122.3321;

function trail(baseLat: number, baseLng: number, count: number): RobotLocation['trail'] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    lat: baseLat + Math.sin(i * 0.4) * 0.002,
    lng: baseLng + i * 0.0004,
    timestampIso: new Date(now - (count - i) * 30_000).toISOString(),
  }));
}

export const ROBOT_LOCATIONS: RobotLocation[] = [
  {
    robotId: 'robot-001',
    name: 'Rover Alpha',
    robotClass: 'AMR',
    status: 'Online',
    batteryPct: 87,
    lat: BASE_LAT + 0.003,
    lng: BASE_LNG + 0.005,
    heading: 45,
    speedMps: 1.2,
    updatedAtIso: new Date().toISOString(),
    missionId: 'mis-0094',
    trail: trail(BASE_LAT + 0.003, BASE_LNG + 0.005, 8),
  },
  {
    robotId: 'robot-002',
    name: 'Carrier Beta',
    robotClass: 'AGV',
    status: 'Online',
    batteryPct: 94,
    lat: BASE_LAT - 0.002,
    lng: BASE_LNG + 0.008,
    heading: 180,
    speedMps: 0.8,
    updatedAtIso: new Date().toISOString(),
    missionId: 'mis-0087',
    trail: trail(BASE_LAT - 0.002, BASE_LNG + 0.008, 6),
  },
  {
    robotId: 'robot-003',
    name: 'Arm Gamma',
    robotClass: 'Manipulator',
    status: 'Online',
    batteryPct: 72,
    lat: BASE_LAT + 0.001,
    lng: BASE_LNG - 0.003,
    heading: 0,
    speedMps: 0,
    updatedAtIso: new Date().toISOString(),
    missionId: 'mis-0095',
    trail: trail(BASE_LAT + 0.001, BASE_LNG - 0.003, 3),
  },
  {
    robotId: 'robot-004',
    name: 'Drone Delta',
    robotClass: 'UAV',
    status: 'Degraded',
    batteryPct: 12,
    lat: BASE_LAT + 0.006,
    lng: BASE_LNG - 0.006,
    heading: 270,
    speedMps: 0,
    updatedAtIso: new Date().toISOString(),
    trail: trail(BASE_LAT + 0.006, BASE_LNG - 0.006, 12),
  },
  {
    robotId: 'robot-005',
    name: 'Rover Epsilon',
    robotClass: 'AMR',
    status: 'E-Stopped',
    batteryPct: 56,
    lat: BASE_LAT - 0.004,
    lng: BASE_LNG + 0.002,
    heading: 90,
    speedMps: 0,
    updatedAtIso: new Date().toISOString(),
    trail: trail(BASE_LAT - 0.004, BASE_LNG + 0.002, 5),
  },
  {
    robotId: 'robot-006',
    name: 'Conveyor Zeta',
    robotClass: 'PLC',
    status: 'Online',
    batteryPct: 100,
    lat: BASE_LAT + 0.0005,
    lng: BASE_LNG + 0.001,
    heading: 0,
    speedMps: 0,
    updatedAtIso: new Date().toISOString(),
    missionId: 'mis-0096',
    trail: [],
  },
  {
    robotId: 'robot-007',
    name: 'Carrier Eta',
    robotClass: 'AGV',
    status: 'Offline',
    batteryPct: 31,
    lat: BASE_LAT - 0.001,
    lng: BASE_LNG - 0.004,
    heading: 135,
    speedMps: 0,
    updatedAtIso: new Date().toISOString(),
    trail: trail(BASE_LAT - 0.001, BASE_LNG - 0.004, 4),
  },
];

export const GEOFENCES: Geofence[] = [
  {
    geofenceId: 'gf-warehouse-a',
    label: 'Warehouse A',
    polygon: [
      [BASE_LAT + 0.005, BASE_LNG + 0.002],
      [BASE_LAT + 0.005, BASE_LNG + 0.009],
      [BASE_LAT + 0.001, BASE_LNG + 0.009],
      [BASE_LAT + 0.001, BASE_LNG + 0.002],
    ],
    color: '#3b82f6',
  },
  {
    geofenceId: 'gf-warehouse-b',
    label: 'Warehouse B',
    polygon: [
      [BASE_LAT + 0.002, BASE_LNG - 0.005],
      [BASE_LAT + 0.002, BASE_LNG - 0.001],
      [BASE_LAT - 0.001, BASE_LNG - 0.001],
      [BASE_LAT - 0.001, BASE_LNG - 0.005],
    ],
    color: '#8b5cf6',
  },
  {
    geofenceId: 'gf-loading-yard',
    label: 'Loading Yard',
    polygon: [
      [BASE_LAT - 0.002, BASE_LNG + 0.0],
      [BASE_LAT - 0.002, BASE_LNG + 0.006],
      [BASE_LAT - 0.005, BASE_LNG + 0.006],
      [BASE_LAT - 0.005, BASE_LNG + 0.0],
    ],
    color: '#f59e0b',
  },
];

export const SPATIAL_ALERTS: SpatialAlert[] = [
  {
    alertId: 'sa-001',
    robotId: 'robot-005',
    type: 'e-stop',
    message: 'Emergency stop triggered on Rover Epsilon',
    lat: BASE_LAT - 0.004,
    lng: BASE_LNG + 0.002,
    timestampIso: '2026-02-20T14:15:32Z',
    severity: 'critical',
  },
  {
    alertId: 'sa-002',
    robotId: 'robot-004',
    type: 'localization-drop',
    message: 'Localization quality below threshold on Drone Delta',
    lat: BASE_LAT + 0.006,
    lng: BASE_LNG - 0.006,
    timestampIso: '2026-02-20T14:10:05Z',
    severity: 'warning',
  },
  {
    alertId: 'sa-003',
    robotId: 'robot-001',
    type: 'geofence-violation',
    message: 'Rover Alpha exited Warehouse A boundary',
    lat: BASE_LAT + 0.003,
    lng: BASE_LNG + 0.005,
    timestampIso: '2026-02-20T13:45:18Z',
    severity: 'warning',
  },
];
