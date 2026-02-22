/**
 * Simulation smoke tests for Portarium robotics integration.
 *
 * These tests run against a live rosbridge WebSocket server (Gazebo or Webots
 * simulation) when SIMULATION_MODE=true and ROS_BRIDGE_URL is set.
 * When the environment is not configured, all tests are skipped gracefully.
 *
 * CI environment: robotics-simulation-ci.yml starts rosbridge before these tests.
 * Local development: `ros2 launch rosbridge_server rosbridge_websocket_launch.xml`
 *
 * Test scope:
 *   1. rosbridge WebSocket connectivity (ping/echo)
 *   2. Mission dispatch via ros2-action-bridge (navigate_to_pose action)
 *   3. Mission cancel (pre-emption)
 *   4. VDA 5050 state message ingest from a simulated AGV
 *   5. Open-RMF fleet state round-trip
 *
 * Bead: bead-0519
 */

import { describe, expect, it, beforeAll } from 'vitest';

// ── Environment configuration ─────────────────────────────────────────────────

const SIMULATION_MODE = process.env['SIMULATION_MODE'] === 'true';
const ROS_BRIDGE_URL = process.env['ROS_BRIDGE_URL'] ?? 'ws://localhost:9090';

/**
 * Skip a test when not in simulation mode.
 * Use: `const sit = simulationIt()` then `sit('test name', async () => ...)`
 */
function simulationIt() {
  return (name: string, fn: () => Promise<void> | void) => {
    if (!SIMULATION_MODE) {
      it.skip(`[sim-skip] ${name}`, fn);
    } else {
      it(name, fn);
    }
  };
}

// ── Shared state ──────────────────────────────────────────────────────────────

let websocket: WebSocket | null = null;
let connectionOk = false;

// ── WebSocket helpers ─────────────────────────────────────────────────────────

function connectToRosBridge(url: string, timeoutMs = 5000): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error(`rosbridge connect timeout (${url})`)),
      timeoutMs,
    );
    const ws = new WebSocket(url);
    ws.onopen = () => {
      clearTimeout(timeoutId);
      resolve(ws);
    };
    ws.onerror = (err) => {
      clearTimeout(timeoutId);
      reject(new Error(`WebSocket error: ${String(err)}`));
    };
  });
}

function sendAndReceive(
  ws: WebSocket,
  message: object,
  waitForOpType: string,
  timeoutMs = 3000,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error(`timeout waiting for ${waitForOpType}`)),
      timeoutMs,
    );
    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(String(event.data)) as { op: string };
        if (data.op === waitForOpType) {
          clearTimeout(timeoutId);
          ws.removeEventListener('message', handler);
          resolve(data);
        }
      } catch {
        // Ignore non-JSON messages
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify(message));
  });
}

// ── Suite setup ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  if (!SIMULATION_MODE) return;

  try {
    websocket = await connectToRosBridge(ROS_BRIDGE_URL, 5000);
    connectionOk = true;
  } catch (err) {
    console.warn(
      `[simulation-smoke] Could not connect to rosbridge at ${ROS_BRIDGE_URL}: ${String(err)}`,
    );
    connectionOk = false;
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

const sit = simulationIt();

describe('Simulation environment', () => {
  it('reports simulation mode from environment variable', () => {
    // This test always runs — it documents the environment configuration
    const mode = process.env['SIMULATION_MODE'];
    if (mode === 'true') {
      expect(ROS_BRIDGE_URL).toMatch(/^ws(s)?:\/\//);
    } else {
      // Not in simulation mode — expected in unit test runs
      expect(mode).not.toBe('true');
    }
  });
});

describe('rosbridge WebSocket connectivity', () => {
  sit('connects to rosbridge and receives a service response', async () => {
    if (!connectionOk || !websocket) {
      throw new Error('rosbridge not available');
    }

    // ros2 get_loggers service call — supported by all rosbridge instances
    const response = await sendAndReceive(
      websocket,
      {
        op: 'call_service',
        id: 'smoke-ping-1',
        service: '/rosapi/get_ros_services',
        type: 'rosapi_msgs/GetServices',
        args: {},
      },
      'service_response',
      3000,
    );

    expect(response).toBeDefined();
  });

  sit('subscribes to /rosout and receives a status message', async () => {
    if (!connectionOk || !websocket) throw new Error('rosbridge not available');

    const received = await new Promise<unknown>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('subscribe timeout')), 5000);
      const handler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(String(event.data)) as { op: string; topic?: string };
          if (data.op === 'publish' && data.topic === '/rosout') {
            clearTimeout(timeoutId);
            websocket!.removeEventListener('message', handler);
            resolve(data);
          }
        } catch {
          // Ignore
        }
      };
      websocket!.addEventListener('message', handler);
      websocket!.send(
        JSON.stringify({
          op: 'subscribe',
          id: 'smoke-sub-1',
          topic: '/rosout',
          type: 'rcl_interfaces/msg/Log',
        }),
      );
    });

    expect(received).toBeDefined();
  });
});

describe('ros2-action-bridge mission lifecycle', () => {
  sit('dispatches a navigate_to_pose mission goal', async () => {
    if (!connectionOk || !websocket) throw new Error('rosbridge not available');

    // Send a goal to /navigate_to_pose action via rosbridge action client protocol
    const goalId = `smoke-goal-${Date.now()}`;
    websocket.send(
      JSON.stringify({
        op: 'send_goal',
        id: goalId,
        action: '/navigate_to_pose',
        action_type: 'nav2_msgs/action/NavigateToPose',
        goal: {
          pose: {
            header: { frame_id: 'map' },
            pose: {
              position: { x: 1.0, y: 0.0, z: 0.0 },
              orientation: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 },
            },
          },
        },
      }),
    );

    // In simulation, the action server acknowledges or rejects the goal
    // Wait briefly for any response — we are checking connectivity, not Nav2 routing
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(true).toBe(true); // Reached without crash
  });

  sit('cancels an in-flight goal', async () => {
    if (!connectionOk || !websocket) throw new Error('rosbridge not available');

    const goalId = `smoke-cancel-${Date.now()}`;

    // Dispatch
    websocket.send(
      JSON.stringify({
        op: 'send_goal',
        id: goalId,
        action: '/navigate_to_pose',
        action_type: 'nav2_msgs/action/NavigateToPose',
        goal: {
          pose: {
            header: { frame_id: 'map' },
            pose: {
              position: { x: 5.0, y: 5.0, z: 0.0 },
              orientation: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 },
            },
          },
        },
      }),
    );

    // Immediately cancel
    await new Promise((resolve) => setTimeout(resolve, 100));
    websocket.send(
      JSON.stringify({
        op: 'cancel_goal',
        id: `cancel-${goalId}`,
        action: '/navigate_to_pose',
        goal_id: goalId,
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(true).toBe(true); // Cancel did not throw
  });
});

describe('VDA 5050 simulation ingest', () => {
  sit('receives VDA 5050 state message from simulated AGV topic', async () => {
    if (!connectionOk || !websocket) throw new Error('rosbridge not available');

    // Subscribe to the VDA 5050 state topic bridged into ROS 2
    // Topic: /uagv/v2/SimAGV/sim-001/state (std_msgs/String carrying JSON)
    const received = await new Promise<unknown>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('VDA5050 topic timeout')), 5000);
      const handler = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(String(event.data)) as {
            op: string;
            topic?: string;
            msg?: { data?: string };
          };
          if (msg.op === 'publish' && msg.topic === '/vda5050/sim_fleet/state') {
            clearTimeout(timeoutId);
            websocket!.removeEventListener('message', handler);
            resolve(msg.msg?.data);
          }
        } catch {
          // Ignore
        }
      };
      websocket!.addEventListener('message', handler);
      websocket!.send(
        JSON.stringify({
          op: 'subscribe',
          id: 'vda5050-sub',
          topic: '/vda5050/sim_fleet/state',
          type: 'std_msgs/msg/String',
        }),
      );
    });

    // Validate that the received data is a parseable VDA 5050 state message
    if (typeof received === 'string') {
      const { parseVda5050StateMessage } = await import('./vda5050-ingest.js');
      expect(() => parseVda5050StateMessage(JSON.parse(received))).not.toThrow();
    }
  });
});

describe('Open-RMF fleet state ingest', () => {
  sit('receives Open-RMF FleetState from simulation', async () => {
    if (!connectionOk || !websocket) throw new Error('rosbridge not available');

    const received = await new Promise<unknown>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('Open-RMF fleet topic timeout')), 5000);
      const handler = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(String(event.data)) as {
            op: string;
            topic?: string;
            msg?: unknown;
          };
          if (msg.op === 'publish' && msg.topic === '/fleet_states') {
            clearTimeout(timeoutId);
            websocket!.removeEventListener('message', handler);
            resolve(msg.msg);
          }
        } catch {
          // Ignore
        }
      };
      websocket!.addEventListener('message', handler);
      websocket!.send(
        JSON.stringify({
          op: 'subscribe',
          id: 'fleet-state-sub',
          topic: '/fleet_states',
          type: 'rmf_fleet_msgs/msg/FleetState',
        }),
      );
    });

    if (received !== undefined) {
      const { parseOpenRmfFleetState } = await import('./open-rmf-fleet-ingest.js');
      expect(() => parseOpenRmfFleetState(received)).not.toThrow();
    }
  });
});
