# ROS 2 Bridge Infrastructure

Configuration files and deployment templates for the Portarium ROS 2 bridge node.

## Contents

| File               | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `config.dev.yaml`  | Development mode config (rosbridge WebSocket)  |
| `config.prod.yaml` | Production mode config (DDS-Security / SROS 2) |
| `governance.xml`   | DDS governance policy template                 |

## Quick start (development)

1. Launch a ROS 2 environment with rosbridge:

   ```bash
   ros2 launch rosbridge_server rosbridge_websocket_launch.xml
   ```

2. Start the bridge node:

   ```bash
   PORTARIUM_TOKEN=<jwt> \
   PORTARIUM_BASE_URL=http://localhost:3100 \
     ros2 run portarium_bridge bridge_node --ros-args -p config:=config.dev.yaml
   ```

## Production deployment

See `docs/integration/ros2-bridge-architecture.md` for full SROS 2 PKI
provisioning and production deployment instructions.
