# Alternative C: Spatial / Board-First Prototype

## UX Thesis

"See the whole picture -- spatial arrangement reveals bottlenecks and status at a glance."

Inspired by Trello, Notion boards, GitHub Projects, and information radiators. This alternative replaces sidebar navigation with a horizontally scrollable board of columns representing entity states/stages. Cards are compact entity summaries. Clicking a card opens a slide-in detail panel (40% width) on the right -- no full-page navigation required.

## How to Run

Option A (simplest):

- Open `docs/ui/alt-c-board/index.html` in a browser.

Option B (recommended if your browser is strict about local files):

```powershell
cd C:\Projects\Portarium
npx --yes http-server docs/ui/alt-c-board -p 4176
```

Then open `http://localhost:4176`.

## Board Configurations

| Board      | Columns                                                     | Card entities       |
| ---------- | ----------------------------------------------------------- | ------------------- |
| Triage     | Needs Approval, Failed/Blocked, Policy Violations, Resolved | Mixed (WI, Run, AG) |
| Work Items | Open, In Progress, Needs Approval, Closed                   | Work Items only     |
| Runs       | Queued, Running, Awaiting Approval, Succeeded, Failed       | Runs only           |
| Approvals  | Pending, Approved, Denied, Changes Requested                | Approval Gates only |

Plus an **Evidence** view (list/log, not a board) and **Settings** stub.

## Hash Routes

- `#triage` -- Triage Board (default)
- `#work-items` -- Work Items Board
- `#runs` -- Runs Board
- `#approvals` -- Approvals Board
- `#evidence` -- Evidence view
- `#settings` -- Workspace settings

## Keyboard Navigation

| Key         | Action                                 |
| ----------- | -------------------------------------- |
| Arrow Up    | Move to previous card in column        |
| Arrow Down  | Move to next card in column            |
| Arrow Left  | Move to same-index card in prev column |
| Arrow Right | Move to same-index card in next column |
| Enter       | Open detail panel for focused card     |
| Escape      | Close detail panel                     |

## Prototype Controls

- **Persona**: Operator / Approver / Auditor / Admin
- **Workspace**: Solo / Team
- **System State**: Normal / Empty / Misconfigured / Policy blocked / RBAC limited / Degraded

Settings persist in `localStorage` key `portarium_alt_c_v1`.
