# @portarium/openclaw-plugin

Native OpenClaw plugin that routes tool calls through Portarium governance.

The plugin is part of the core tested agent governance loop:

1. OpenClaw proposes a tool action.
2. Portarium checks policy and execution tier.
3. Safe actions can proceed.
4. Risky actions wait for approval.
5. Blocked actions do not run.
6. Evidence and results are recorded.

## Repository

Main project docs live at the repository root:

- [Portarium README](../../README.md)
- [Project scope](../../docs/project-scope.md)
- [Agent traffic controller](../../docs/explanation/agent-traffic-controller.md)

## License

MIT
