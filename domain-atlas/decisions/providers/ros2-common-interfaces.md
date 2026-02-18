# ros2-common-interfaces

- Provider ID: `ros2-common-interfaces`
- Port Families: `RoboticsActuation`
- Upstream: `https://github.com/ros2/common_interfaces`
- Pinned commit: `b610accb10a25af0478a03f2cfc9aa52a403ff8c`
- License: Apache-2.0 (`safe_to_reuse`)

## What This Is

The `ros2/common_interfaces` repository defines the standard ROS 2 message types used across virtually all ROS 2 robot systems. These include:

- `geometry_msgs` — Pose, Twist, Vector3, Quaternion, Transform, Wrench
- `sensor_msgs` — BatteryState, LaserScan, Image, Imu, JointState, NavSatFix
- `nav_msgs` — Odometry, OccupancyGrid, Path, Goals
- `action_msgs` — GoalStatus, GoalInfo (action lifecycle)
- `std_msgs` — Header (timestamp + frame), primitive wrappers
- `diagnostic_msgs` — DiagnosticArray, DiagnosticStatus

## Why Selected

This is the foundational vocabulary for the entire robotics integration stack. Every other provider (nav2, rosbridge-suite, zenoh) ultimately publishes or consumes these message types. Without modelling these, Portarium cannot reason about robot telemetry types.

**Scoring**: Highest priority — 98 canonical message types extracted.

## Mapping Notes (Canonical)

- `sensor_msgs/JointState` → `Asset` (robot joint component with live position/velocity).
- `sensor_msgs/BatteryState` → `Asset` (battery unit with health and charge state).
- `action_msgs/GoalStatus` → `Task` lifecycle (ACCEPTED/EXECUTING/SUCCEEDED/CANCELED/ABORTED).
- `nav_msgs/Odometry`, `nav_msgs/Path`, `geometry_msgs/PoseStamped` → `ExternalObjectRef` (telemetry streams).
- `diagnostic_msgs/DiagnosticStatus` → `ExternalObjectRef` (hardware health events).

## Capability Matrix Notes

- All topic subscriptions are `Auto` tier (read-only telemetry).
- `geometry_msgs/Twist` publication (cmd_vel) is `HumanApprove` — direct velocity command.
- No idempotency key at the message layer.

## Open Questions

- Should `sensor_msgs/Image` and `sensor_msgs/PointCloud2` be surfaced in the cockpit? (Large payload; likely rendered in a separate viewer panel.)
- Multi-robot fleet: does each robot namespace independently or share a common message type registry?
