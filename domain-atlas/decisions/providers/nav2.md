# nav2

- Provider ID: `nav2`
- Port Families: `RoboticsActuation`
- Upstream: `https://github.com/ros-navigation/navigation2`
- Pinned commit: `8ae7103c89b842d01fcbb59a4112b5fdb0059202`
- License: Apache-2.0 (`safe_to_reuse`)

## What This Is

Nav2 is the standard autonomous navigation stack for ROS 2. It provides action servers for:

- `NavigateToPose` — navigate to a single 6-DOF goal pose with behaviour tree
- `NavigateThroughPoses` — navigate through an ordered list of poses
- `FollowWaypoints` — mission-level waypoint following with task executors
- `FollowPath` — execute a pre-computed path from the planner
- `DockRobot` / `UndockRobot` — precision docking manoeuvres
- `ComputePathToPose` / `ComputePathThroughPoses` — path planning without execution
- `Spin`, `BackUp`, `DriveOnHeading`, `Wait` — recovery and primitive behaviours

## Why Selected

Nav2 is the de-facto autonomous navigation framework for mobile robots running ROS 2 (AMR/AGV use cases). Portarium's mission execution engine maps directly to Nav2 action goals.

**Scoring**: Priority 1 — 19 action types extracted (57 entities: Goal + Result + Feedback × 19).

## Mapping Notes (Canonical)

- `NavigateToPose.Goal` → `Task` (primary mission execution task).
- `NavigateThroughPoses.Goal`, `FollowWaypoints.Goal`, `DockRobot.Goal` → `Task`.
- `NavigateToPose.Feedback` → `ExternalObjectRef` (streamed cockpit progress widget).
- `NavigateToPose.Result` → `ExternalObjectRef` (evidence linked to Task on completion).
- `ComputePathToPose.Goal` → `ExternalObjectRef` (planning-only, no physical action).
- `Spin.Goal`, `BackUp.Goal` → `ExternalObjectRef` (recovery primitives, sub-task refs).

## Capability Matrix Notes

- All navigation commands are `HumanApprove` tier — they cause physical robot motion.
- Rollback is supported via goal cancellation (`cancelGoal`).
- Idempotency: each goal has a UUID; resending the same pose creates a new goal (not idempotent by design).
- `ComputePathToPose` is `Auto` tier (read-only path computation).
- `Spin` is `Assisted` (lower-risk rotation primitive).

## Open Questions

- Should Portarium surface behaviour tree selection (`behavior_tree` field) as a Task parameter in the cockpit?
- Multi-robot fleets: Nav2 namespacing (robot_1/navigate_to_pose vs robot_2/navigate_to_pose) — should Portarium model each namespace as a separate Asset?
