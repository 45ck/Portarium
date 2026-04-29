# Experiment B: fail-closed governance

## Hypothesis

When Portarium governance is unreachable, the OpenClaw plugin fails closed and no agent tool executes.

## Expected Result

- The `before_tool_call` hook runs before the tool body.
- The Portarium client reports a governance error because the control-plane URL is unreachable.
- The hook returns a terminal block result.
- The OpenClaw harness records `status=error`.
- The attempted tool body is not passed through.
- The logs include `Portarium governance unavailable — failing closed`.
