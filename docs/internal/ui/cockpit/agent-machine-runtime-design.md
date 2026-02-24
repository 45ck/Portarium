# UX Design: Agent and Machine Runtime Screens

**Bead:** bead-0456
**Status:** Done
**Date:** 2026-02-18

## Problem

The Agents screen shows AI agents but lacks:

- **Machine runtime** visibility (registered physical/VM runners executing workflows)
- **Capability allowlist editing** (admin must be able to restrict what an agent can do)
- **Connection testing** (verify agent endpoint is live before deploying)
- **Used-by-workflows** traceability (which workflows depend on this agent?)

## Concepts

| Concept        | Description                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------ |
| **AI Agent**   | LLM/model endpoint that classifies, generates, or analyzes within a workflow step                |
| **Machine**    | Registered runtime host (VM, container, server) that executes workflow actions via adapter calls |
| **Capability** | Permitted action type (read, write, classify, execute-code, etc.) scoped per agent               |

## Screen Layout

```
Agents
  Tabs: [AI Agents ●3] [Machines ●2]

  AI Agents tab:
    [Agent list (left)] | [Agent detail (right)]
                           ├─ Identity (name, model, endpoint)
                           ├─ Capability Allowlist (editable checkboxes)
                           ├─ Connection Test [Test ↺] → result badge
                           └─ Used by workflows (expandable list)

  Machines tab:
    Grid of machine cards:
      [hostname] [OS] [last heartbeat] [status] [Test ↺] [Deregister]
    Machine detail drawer:
      └─ Adapter capability matrix for this machine
```

## Capability Allowlist

Per-agent editable list. Admin role required to edit.
Available capabilities:

- `read:external` — read from external adapter
- `write:external` — write to external adapter
- `classify` — classification/labelling tasks
- `generate` — text/document generation
- `analyze` — data analysis and scoring
- `execute-code` — run sandboxed code (requires elevated trust)
- `notify` — send notifications/webhooks

Rationale (SoD): restricting capabilities reduces blast radius if an agent is compromised.

## Connection Test

Clicking "Test ↺" sends a probe request to the agent endpoint.
Results:

- ✓ Connected — X ms (green)
- ⚠ Slow response — X ms > 5000 (yellow)
- ✗ Unreachable — error message (red with specific error)

## Machine Runtime

Machines represent the compute substrate. Each shows:

- Hostname + machine ID
- Registration date + last heartbeat
- OS / container image
- Adapter capabilities it's allowed to execute
- Active runs count

## Nielsen Review

| Heuristic                   | Assessment                                                   |
| --------------------------- | ------------------------------------------------------------ |
| Visibility of system status | ✓ Connection test result shown inline with latency           |
| User control and freedom    | ✓ Cancel at any capability change, confirm before deregister |
| Error prevention            | ✓ Capability changes require Admin role + confirmation       |
| Consistency                 | ✓ Reuses agent-card layout, status badges                    |
| Recognition over recall     | ✓ Capability checkboxes labelled with descriptions           |
| Help and documentation      | ✓ Used-by-workflows shows impact scope                       |

## Accessibility

- Capability checkboxes have visible labels + descriptions
- Connection test button aria-live region for result announcement
- Machine cards are `<article>` with `aria-label`
- Tabs use role=tablist/tab/tabpanel
