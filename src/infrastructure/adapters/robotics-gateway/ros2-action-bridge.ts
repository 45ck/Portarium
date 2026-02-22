/**
 * ROS 2 Action bridge implementing MissionPort via rosbridge_suite.
 *
 * Bridges Portarium MissionPort calls to ROS 2 Action calls using the
 * rosbridge v2.0 WebSocket protocol. The rosbridge_server node runs on the
 * robot or a companion gateway machine and exposes a WebSocket endpoint
 * (default: ws://robot:9090).
 *
 * Action invocation maps to the rosbridge `call_service` + `action_client`
 * operations. For the Nav2 NavigateToPose prototype, the action type is
 * `nav2_msgs/action/NavigateToPose`.
 *
 * Supported action types (actionName → ROS 2 action mapping):
 *   navigate_to      → /navigate_to_pose  (nav2_msgs/action/NavigateToPose)
 *   dock             → /dock              (nav2_msgs/action/Dock)
 *   undock           → /undock            (nav2_msgs/action/Undock)
 *   spin             → /spin              (nav2_msgs/action/Spin)
 *   follow_waypoints → /follow_waypoints  (nav2_msgs/action/FollowWaypoints)
 *
 * Protocol reference: https://github.com/RobotWebTools/rosbridge_suite
 *
 * Bead: bead-0517
 */

import { createRequire } from 'module';
import type {
  MissionCancelRequest,
  MissionCancelResult,
  MissionDispatchRequest,
  MissionDispatchResult,
  MissionPort,
  MissionStatusResult,
} from '../../../application/ports/mission-port.js';
import type { CorrelationId, MissionId } from '../../../domain/primitives/index.js';
import type { MissionStatus } from '../../../domain/robots/mission-v1.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const WebSocket = require('ws') as any;

// ── Config ────────────────────────────────────────────────────────────────────

export interface Ros2ActionBridgeConfig {
  /** rosbridge WebSocket URL, e.g. ws://robot.local:9090 */
  rosbridgeUrl: string;
  /** Per-action goal timeout in ms. Default: 30 000. */
  goalTimeoutMs?: number;
  /** WebSocket connection timeout in ms. Default: 5 000. */
  connectTimeoutMs?: number;
}

// ── ROS 2 action name mapping ─────────────────────────────────────────────────

const ACTION_MAP: Record<string, { name: string; type: string }> = {
  navigate_to: {
    name: '/navigate_to_pose',
    type: 'nav2_msgs/action/NavigateToPose',
  },
  dock: {
    name: '/dock',
    type: 'nav2_msgs/action/Dock',
  },
  undock: {
    name: '/undock',
    type: 'nav2_msgs/action/Undock',
  },
  spin: {
    name: '/spin',
    type: 'nav2_msgs/action/Spin',
  },
  follow_waypoints: {
    name: '/follow_waypoints',
    type: 'nav2_msgs/action/FollowWaypoints',
  },
};

// ── rosbridge message builders ────────────────────────────────────────────────

function makeSendGoalMsg(
  id: string,
  actionName: string,
  actionType: string,
  goal: Record<string, unknown>,
): Record<string, unknown> {
  return {
    op: 'send_action_goal',
    id,
    action: actionName,
    action_type: actionType,
    goal,
    feedback: true,
  };
}

function makeCancelGoalMsg(id: string, actionName: string): Record<string, unknown> {
  return {
    op: 'cancel_action_goal',
    id,
    action: actionName,
  };
}

function makeNavigateToPoseGoal(params: Record<string, unknown>): Record<string, unknown> {
  return {
    pose: {
      header: {
        frame_id: String(params['frame'] ?? 'map'),
      },
      pose: {
        position: {
          x: Number(params['x'] ?? 0),
          y: Number(params['y'] ?? 0),
          z: Number(params['z'] ?? 0),
        },
        orientation: {
          x: Number(params['qx'] ?? 0),
          y: Number(params['qy'] ?? 0),
          z: Number(params['qz'] ?? 0),
          w: Number(params['qw'] ?? 1),
        },
      },
    },
  };
}

function buildGoalForAction(
  actionName: string,
  params: Record<string, unknown>,
): Record<string, unknown> {
  if (actionName === '/navigate_to_pose') {
    return makeNavigateToPoseGoal(params);
  }
  // For other actions, pass parameters directly as the goal
  return params as Record<string, unknown>;
}

// ── In-memory mission status store ────────────────────────────────────────────

interface MissionRecord {
  status: MissionStatus;
  actionExecutionId?: string;
  observedAt: string;
  rosbridgeId: string;
  ws: InstanceType<typeof WebSocket> | null;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class Ros2ActionBridge implements MissionPort {
  readonly #config: Ros2ActionBridgeConfig;
  readonly #missions = new Map<string, MissionRecord>();

  constructor(config: Ros2ActionBridgeConfig) {
    this.#config = config;
  }

  async dispatchMission(request: MissionDispatchRequest): Promise<MissionDispatchResult> {
    const actionEntry = ACTION_MAP[request.action.actionName];
    if (!actionEntry) {
      return {
        kind: 'Rejected',
        missionId: request.missionId,
        correlationId: request.correlationId,
        planEffectIdempotencyKey: request.planEffectIdempotencyKey,
        reason: 'UnsupportedAction',
        message:
          `Action '${request.action.actionName}' is not mapped to a ROS 2 action type. ` +
          `Known actions: ${Object.keys(ACTION_MAP).join(', ')}`,
      };
    }

    const rosbridgeId = `${request.missionId}-${Date.now()}`;
    const goal = buildGoalForAction(
      actionEntry.name,
      request.action.parameters as Record<string, unknown>,
    );

    let ws: InstanceType<typeof WebSocket>;
    try {
      ws = await this.#connect();
    } catch (err) {
      return {
        kind: 'GatewayUnreachable',
        missionId: request.missionId,
        correlationId: request.correlationId,
        planEffectIdempotencyKey: request.planEffectIdempotencyKey,
        message: `rosbridge connect failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Store mission record before sending so status listener can update it
    this.#missions.set(String(request.missionId), {
      status: 'Dispatched',
      actionExecutionId: rosbridgeId,
      observedAt: new Date().toISOString(),
      rosbridgeId,
      ws,
    });

    // Set up message listener to track action result/feedback
    ws.on('message', (rawData: Buffer | string) => {
      try {
        const msg = JSON.parse(
          typeof rawData === 'string' ? rawData : rawData.toString(),
        ) as Record<string, unknown>;
        this.#handleRosbridgeMessage(String(request.missionId), msg);
      } catch {
        // Ignore parse errors
      }
    });

    ws.on('close', () => {
      const record = this.#missions.get(String(request.missionId));
      if (record && record.status === 'Executing') {
        this.#missions.set(String(request.missionId), {
          ...record,
          status: 'Failed',
          observedAt: new Date().toISOString(),
          ws: null,
        });
      }
    });

    // Send the goal
    const goalMsg = makeSendGoalMsg(rosbridgeId, actionEntry.name, actionEntry.type, goal);
    try {
      ws.send(JSON.stringify(goalMsg));
    } catch (err) {
      ws.close();
      this.#missions.delete(String(request.missionId));
      return {
        kind: 'GatewayUnreachable',
        missionId: request.missionId,
        correlationId: request.correlationId,
        planEffectIdempotencyKey: request.planEffectIdempotencyKey,
        message: `rosbridge send failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    return {
      kind: 'Dispatched',
      missionId: request.missionId,
      correlationId: request.correlationId,
      planEffectIdempotencyKey: request.planEffectIdempotencyKey,
      gatewayRequestId: rosbridgeId,
      dispatchedAt: new Date().toISOString(),
    };
  }

  async cancelMission(request: MissionCancelRequest): Promise<MissionCancelResult> {
    const record = this.#missions.get(String(request.missionId));
    if (!record || !record.ws) {
      return { accepted: false, message: 'Mission not found or already completed.' };
    }

    const actionEntry = ACTION_MAP['navigate_to']; // Default; could be stored per mission
    const cancelMsg = makeCancelGoalMsg(
      record.rosbridgeId,
      actionEntry?.name ?? '/navigate_to_pose',
    );

    try {
      record.ws.send(JSON.stringify(cancelMsg));
      this.#missions.set(String(request.missionId), {
        ...record,
        status: 'Cancelled',
        observedAt: new Date().toISOString(),
      });
      return { accepted: true, cancelledAt: new Date().toISOString() };
    } catch (err) {
      return {
        accepted: false,
        message: `Cancel failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async getMissionStatus(
    missionId: MissionId,
    _correlationId: CorrelationId,
  ): Promise<MissionStatusResult> {
    const record = this.#missions.get(String(missionId));
    if (!record) {
      return { missionId, status: 'Pending', observedAt: new Date().toISOString() };
    }
    return {
      missionId,
      status: record.status,
      ...(record.actionExecutionId ? { actionExecutionId: record.actionExecutionId } : {}),
      observedAt: record.observedAt,
    };
  }

  // ── rosbridge message handler ─────────────────────────────────────────────

  #handleRosbridgeMessage(missionId: string, msg: Record<string, unknown>): void {
    const record = this.#missions.get(missionId);
    if (!record) return;

    const op = String(msg['op'] ?? '');
    const id = String(msg['id'] ?? '');

    if (id !== record.rosbridgeId && op !== 'action_feedback') return;

    switch (op) {
      case 'action_feedback':
        // Update to Executing when we receive feedback
        if (record.status === 'Dispatched') {
          this.#missions.set(missionId, {
            ...record,
            status: 'Executing',
            observedAt: new Date().toISOString(),
          });
        }
        break;
      case 'action_result': {
        const status = msg['status'] as number | undefined;
        const succeeded = status === 4; // SUCCEEDED in ROS 2 action status
        this.#missions.set(missionId, {
          ...record,
          status: succeeded ? 'Succeeded' : 'Failed',
          observedAt: new Date().toISOString(),
        });
        record.ws?.close();
        break;
      }
    }
  }

  // ── WebSocket helpers ─────────────────────────────────────────────────────

  #connect(): Promise<InstanceType<typeof WebSocket>> {
    return new Promise((resolve, reject) => {
      const connectTimeout = setTimeout(
        () => reject(new Error('rosbridge connection timeout')),
        this.#config.connectTimeoutMs ?? 5_000,
      );

      const ws = new WebSocket(this.#config.rosbridgeUrl) as InstanceType<typeof WebSocket>;

      ws.once('open', () => {
        clearTimeout(connectTimeout);
        resolve(ws);
      });

      ws.once('error', (err: Error) => {
        clearTimeout(connectTimeout);
        reject(err);
      });
    });
  }
}
