# Alternative A: Command-Palette / Keyboard-First Prototype

## UX Thesis

"Speed through keyboard mastery -- the fastest path from intent to action."

Inspired by Linear, Raycast, Superhuman, and Arc browser. This alternative removes the persistent sidebar entirely and replaces it with a full-width content area, a persistent command bar in the topbar, a breadcrumb trail for context, and a command palette overlay (Ctrl+K / Cmd+K) for navigation and actions.

Every action reachable by keyboard shortcut also has a mouse-clickable equivalent.

## How to Run

```bash
cd docs/ui/alt-a-command
npx --yes http-server . -p 4174
```

Then open `http://localhost:4174`.

Or simply open `index.html` directly in a browser.

## Keyboard Shortcuts Reference

### Global

| Key            | Action                        |
| -------------- | ----------------------------- |
| Ctrl+K / Cmd+K | Open command palette          |
| Escape         | Close command palette / modal |
| g then i       | Go to Inbox                   |
| g then p       | Go to Project                 |
| g then w       | Go to Work Items              |
| g then a       | Go to Approvals               |
| g then e       | Go to Evidence                |
| g then s       | Go to Settings                |

### Inbox (Triage List)

| Key   | Action                      |
| ----- | --------------------------- |
| j / k | Move selection down / up    |
| Enter | Open selected item          |
| a     | Approve (on approval items) |
| r     | Retry (on failed items)     |
| f     | Toggle filter chips         |

### Work Items

| Key   | Action                         |
| ----- | ------------------------------ |
| j / k | Move selection down / up       |
| Enter | Expand/collapse inline preview |
| c     | Create new Work Item           |

### Work Item Detail

| Key | Action                     |
| --- | -------------------------- |
| 1   | Jump to ExternalObjectRefs |
| 2   | Jump to Timeline           |
| 3   | Jump to Runs               |
| 4   | Jump to Approvals          |
| 5   | Jump to Evidence           |
| s   | Start workflow             |
| e   | Open Evidence              |

### Run Detail

| Key        | Action              |
| ---------- | ------------------- |
| Tab        | Move between fields |
| Ctrl+Enter | Submit decision     |

### Approvals

| Key | Action            |
| --- | ----------------- |
| n   | Next approval     |
| p   | Previous approval |

### Evidence

| Key | Action              |
| --- | ------------------- |
| f   | Toggle filter panel |
| /   | Focus search bar    |

## Prototype Controls

- **Persona**: Operator / Approver / Auditor / Admin
- **Workspace**: Solo / Team
- **System State**: Normal / Empty / Misconfigured / Policy blocked / RBAC limited / Degraded

Settings persist in `localStorage` key `portarium_alt_a_v1`.
