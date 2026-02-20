// ---------------------------------------------------------------------------
// Mock Robotics Gateways fixture
// ---------------------------------------------------------------------------

export type { GatewaySummary } from '@portarium/cockpit-types'
import type { GatewaySummary } from '@portarium/cockpit-types'

export const MOCK_GATEWAYS: GatewaySummary[] = [
  {
    gatewayId: 'gw-eu-west-1',
    url: 'wss://gw-eu-west-1.meridian.io:8443',
    status: 'Online',
    connectedRobots: 8,
    lastHeartbeatIso: '2026-02-20T09:14:55Z',
    region: 'EU West',
  },
  {
    gatewayId: 'gw-us-east-1',
    url: 'wss://gw-us-east-1.meridian.io:8443',
    status: 'Online',
    connectedRobots: 5,
    lastHeartbeatIso: '2026-02-20T09:14:50Z',
    region: 'US East',
  },
  {
    gatewayId: 'gw-ap-south-1',
    url: 'wss://gw-ap-south-1.meridian.io:8443',
    status: 'Degraded',
    connectedRobots: 3,
    lastHeartbeatIso: '2026-02-20T09:10:22Z',
    region: 'AP South',
  },
  {
    gatewayId: 'gw-eu-north-1',
    url: 'wss://gw-eu-north-1.meridian.io:8443',
    status: 'Offline',
    connectedRobots: 0,
    lastHeartbeatIso: '2026-02-19T22:45:00Z',
    region: 'EU North',
  },
];
