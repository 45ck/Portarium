// ---------------------------------------------------------------------------
// Mock Robotics Gateways fixture
// ---------------------------------------------------------------------------

export type { GatewaySummary } from '@portarium/cockpit-types';
import type { GatewaySummary } from '@portarium/cockpit-types';

export const MOCK_GATEWAYS: GatewaySummary[] = [
  {
    gatewayId: 'gw-control-plane-1',
    url: 'wss://gateway-1.platform.example.test:8443',
    status: 'Online',
    connectedRobots: 8,
    lastHeartbeatIso: '2026-02-20T09:14:55Z',
    region: 'Control Plane A',
  },
  {
    gatewayId: 'gw-control-plane-2',
    url: 'wss://gateway-2.platform.example.test:8443',
    status: 'Online',
    connectedRobots: 5,
    lastHeartbeatIso: '2026-02-20T09:14:50Z',
    region: 'Control Plane B',
  },
  {
    gatewayId: 'gw-control-plane-3',
    url: 'wss://gateway-3.platform.example.test:8443',
    status: 'Degraded',
    connectedRobots: 3,
    lastHeartbeatIso: '2026-02-20T09:10:22Z',
    region: 'Control Plane C',
  },
  {
    gatewayId: 'gw-control-plane-4',
    url: 'wss://gateway-4.platform.example.test:8443',
    status: 'Offline',
    connectedRobots: 0,
    lastHeartbeatIso: '2026-02-19T22:45:00Z',
    region: 'Control Plane D',
  },
];
