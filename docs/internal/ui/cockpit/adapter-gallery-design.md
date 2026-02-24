# UX Design: Adapter Integration Gallery

**Bead:** bead-0454
**Status:** Done
**Date:** 2026-02-18

## Problem

Operators and admins need to discover, configure, and manage the 18 port-family adapter families that Portarium supports. Currently, adapters are only exposed as a sub-section inside Workspace Settings, with no browsability, discovery, or per-family detail.

## Goals

1. Allow quick discovery of available adapter families (browsable catalog).
2. Surface configuration status clearly (configured vs unconfigured vs degraded).
3. Provide a guided registration flow (credentials, scopes, test connection).
4. Enable admins to audit which workflows use a given adapter.

## Information Architecture

```
Sidebar: Configuration > Adapters
  → Adapters screen (catalog)
      → Adapter detail (drawer/panel)
          → Configure dialog (modal)
```

## Screen Layout

```
[Adapters]
  Header: "Adapter Gallery"  [Register new adapter ▸]

  Search: [____________________]   Filter: [All] [Finance] [CRM] [ITSM] [IT Ops] [HR] [Comms] ...

  Grid (3 cols):
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │ [icon] Finance   │  │ [icon] CRM/Sales│  │ [icon] ITSM     │
    │ Accounting       │  │                 │  │ IT Ops          │
    │ ● Configured (3) │  │ ○ Not configured│  │ ● Configured (1)│
    │ [View] [Test ↺]  │  │ [Configure]     │  │ [View] [Test ↺] │
    └─────────────────┘  └─────────────────┘  └─────────────────┘

  Unconfigured families shown at bottom, dimmed.
```

## Adapter Card States

| State                      | Visual                                |
| -------------------------- | ------------------------------------- |
| Configured                 | Green dot + count of active providers |
| Partial (credential error) | Yellow dot + "Action needed"          |
| Not configured             | Grey dot + "Configure" CTA            |
| Disabled                   | Muted card + toggle to re-enable      |

## Detail Drawer

When a card is clicked:

- Family name, description, capability list (read/write/classify/etc.)
- Configured providers list (e.g., "Salesforce", "HubSpot")
- **Used by workflows**: list of workflow names using this adapter
- [Add provider] button → opens Configure modal
- [Test connection ↺] per-provider
- [Remove] per-provider (with confirmation)

## Configure Modal

1. Select provider (dropdown of known providers in family)
2. Enter credentials (OAuth: [Connect] button; API key: masked input)
3. Required scopes checklist (auto-populated from provider manifest)
4. [Test connection] → shows latency + sample response
5. [Save] (disabled until connection test passes)

## Nielsen Heuristic Evaluation

| Heuristic                                | Assessment                                  | Issue                       |
| ---------------------------------------- | ------------------------------------------- | --------------------------- |
| Visibility of system status              | ✓ Status badges on every card               |                             |
| Match between system and real world      | ✓ Port-family names match business domains  |                             |
| User control and freedom                 | ✓ Cancel at every step                      |                             |
| Consistency and standards                | ✓ Reuses wireframe card pattern             |                             |
| Error prevention                         | ⚠ Need to disable Save until test passes    | Implement in modal          |
| Recognition over recall                  | ✓ Category chips + icons                    |                             |
| Flexibility and efficiency               | ⚠ No bulk-configure for multi-tenant        | Future                      |
| Aesthetic and minimalist design          | ✓ Card grid, not a wall of text             |                             |
| Help users recognize/recover from errors | ⚠ Credential errors need actionable message | Show specific scope missing |
| Help and documentation                   | ✓ "Used by workflows" gives context         |                             |

## Accessibility

- Cards are `<article>` with `aria-label`
- Status badges use `aria-label` (not colour alone)
- Configure button labelled per-family: "Configure Finance & Accounting adapter"
- Keyboard: Tab through cards, Enter to open detail
- Skip link to filter chips

## Empty State

"No adapters configured yet. Add your first adapter to start running workflows that interact with external systems."
CTA: [Browse adapter families]

## States / Variants

- **All unconfigured** (fresh workspace) → empty state + guided tour prompt
- **Partially configured** → "n of 18 families configured"
- **All healthy** → all green dots
- **Degraded** → banner "Realtime adapter health unavailable; last checked 5 min ago"
