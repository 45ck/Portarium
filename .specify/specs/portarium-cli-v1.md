# Portarium CLI Contract v1

**Beads:** bead-0647 (bead-0684 original reference)

## Purpose

Define the command structure, auth flow, and output conventions for the `portarium` CLI,
providing developers and operators a terminal interface to the Portarium control plane.

## Scope

- CLI entry point and subcommand hierarchy
- Authentication and workspace context management
- Output formatting (JSON, table, human-readable)
- Error handling and exit codes

## Command Hierarchy

```
portarium
  login                          # Authenticate and store credentials
  logout                         # Clear stored credentials
  workspace
    list                         # List accessible workspaces
    select <id>                  # Set active workspace context
    current                      # Show active workspace
  agent
    register <name>              # Register an agent in the active workspace
    list                         # List registered agents
    heartbeat <agent-id>         # Send a heartbeat for an agent
  run
    start <workflow-id> [--input JSON]  # Start a workflow run
    status <run-id>              # Get run status
    cancel <run-id>              # Cancel a running workflow
    list [--status <status>]     # List runs
  approve
    list [--pending]             # List approvals
    decide <approval-id> <decision> [--reason TEXT]  # Approve/deny
  events
    tail [--run-id ID] [--type TYPE]  # Stream CloudEvents via SSE
```

## Authentication

- `portarium login` opens browser for OIDC flow or accepts `--token` for service accounts
- Credentials stored in `~/.portarium/credentials.json` (file permissions 0600)
- Active workspace stored in `~/.portarium/context.json`
- All commands read auth from stored credentials unless `--token` flag overrides
- `PORTARIUM_TOKEN` and `PORTARIUM_BASE_URL` environment variables override stored config

## Output Conventions

- Default: human-readable table/text output
- `--json` flag: machine-readable JSON output on all commands
- `--quiet` flag: minimal output (IDs only)
- Errors written to stderr; data written to stdout
- Exit code 0 = success, 1 = client error, 2 = server error, 3 = auth error

## Acceptance Criteria

1. CLI entry point parses subcommands without errors
2. Each subcommand has a stub implementation with `--help` text
3. `--json` flag available on all data-returning commands
4. Auth flow stores and reads credentials from `~/.portarium/`
5. Spec documents all commands with arguments and flags
