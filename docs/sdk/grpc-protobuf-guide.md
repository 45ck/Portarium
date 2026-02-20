# gRPC / Protobuf Guide

**Beads:** bead-0644 (bead-0664 original reference)

Portarium uses gRPC for high-frequency robot telemetry and real-time control paths.
REST (OpenAPI) remains the primary API for all governance, workflow, and CRUD operations.

## When to Use gRPC vs REST

| Use case | Protocol | Reason |
|----------|----------|--------|
| Workflow lifecycle, approvals, CRUD | REST (OpenAPI) | Standard tooling, browser-friendly |
| Robot telemetry ingestion (10-100 Hz) | gRPC streaming | High throughput, binary encoding |
| Real-time command dispatch + feedback | gRPC bidirectional | Low latency, multiplexed |
| Edge gateway heartbeat | gRPC unary | Lightweight keep-alive |

## Service Definitions

Proto files live in `proto/portarium/`:

```
proto/portarium/
  telemetry/v1/telemetry.proto   # Telemetry ingestion, command acks, heartbeat
  control/v1/control.proto       # Command dispatch, feedback streaming, mission lifecycle
```

## Generating Stubs

### Go

```bash
protoc \
  --go_out=sdks/go --go_opt=paths=source_relative \
  --go-grpc_out=sdks/go --go-grpc_opt=paths=source_relative \
  proto/portarium/telemetry/v1/telemetry.proto \
  proto/portarium/control/v1/control.proto
```

### Python

```bash
python -m grpc_tools.protoc \
  -Iproto \
  --python_out=sdks/python/portarium-client/portarium_client/grpc \
  --grpc_python_out=sdks/python/portarium-client/portarium_client/grpc \
  --pyi_out=sdks/python/portarium-client/portarium_client/grpc \
  proto/portarium/telemetry/v1/telemetry.proto \
  proto/portarium/control/v1/control.proto
```

### TypeScript (ts-proto)

```bash
protoc \
  --plugin=protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=src/infrastructure/grpc/generated \
  --ts_proto_opt=outputServices=grpc-js \
  proto/portarium/telemetry/v1/telemetry.proto \
  proto/portarium/control/v1/control.proto
```

## Authentication

gRPC clients authenticate using workspace-scoped JWTs passed as metadata:

### Go

```go
import "google.golang.org/grpc/metadata"

md := metadata.Pairs(
    "authorization", "Bearer "+token,
    "x-workspace-id", workspaceId,
)
ctx := metadata.NewOutgoingContext(ctx, md)
```

### Python

```python
metadata = [
    ("authorization", f"Bearer {token}"),
    ("x-workspace-id", workspace_id),
]
response = stub.Heartbeat(request, metadata=metadata)
```

## Example: Streaming Telemetry (Go)

```go
stream, err := telemetryClient.IngestTelemetry(ctx)
if err != nil {
    log.Fatal(err)
}

for frame := range sensorFrames {
    err := stream.Send(&telemetryv1.TelemetryFrame{
        WorkspaceId:    "ws-acme",
        RobotId:        "robot-01",
        GatewayId:      "gw-floor-2",
        TelemetryType:  "pose",
        SourceTimestamp: timestamppb.Now(),
        Sequence:        frame.Seq,
        Payload:         structpb.NewStruct(frame.Data),
    })
    if err != nil {
        log.Fatal(err)
    }
}

resp, err := stream.CloseAndRecv()
fmt.Printf("Accepted: %d, Rejected: %d\n", resp.FramesAccepted, resp.FramesRejected)
```

## Example: Bidirectional Feedback (Python)

```python
import grpc
from portarium.control.v1 import control_pb2, control_pb2_grpc

channel = grpc.insecure_channel("localhost:50051")
stub = control_pb2_grpc.ControlServiceStub(channel)

def feedback_generator():
    while True:
        yield control_pb2.FeedbackMessage(
            workspace_id="ws-acme",
            gateway_id="gw-floor-2",
            robot_id="robot-01",
            mission_feedback=control_pb2.MissionFeedback(
                mission_id="mission-42",
                phase=control_pb2.MISSION_PHASE_NAVIGATING,
                progress_pct=0.65,
            ),
        )

for control_msg in stub.StreamFeedback(feedback_generator(), metadata=metadata):
    if control_msg.HasField("command"):
        handle_command(control_msg.command)
    elif control_msg.HasField("cancellation"):
        handle_cancellation(control_msg.cancellation)
```

## Safety Boundary

The gRPC control service dispatches high-level goals only. Safety-critical functions
(E-stop actuation, collision avoidance, speed limiting) remain at the edge gateway.
`SafetyEvent` messages are informational -- they flow from edge to control plane for
audit and alerting, but the control plane does not actuate safety functions.
