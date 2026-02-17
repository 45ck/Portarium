# Alternative B: Activity-Stream / Timeline-Centred Prototype

## UX Thesis

"Everything is an event -- understand operations through their chronological story."

Inspired by GitHub activity feed, Slack threads, Notion timeline, and Linear activity log. This alternative replaces the traditional sidebar navigation with a narrow filter rail and a central reverse-chronological event stream. Every operation (run start, approval gate, evidence entry, policy violation) appears as an event card in the stream. Related events group into expandable threads.

## How to Run

Option A (simplest):

- Open `docs/ui/alt-b-stream/index.html` in a browser.

Option B (recommended if your browser is strict about local files):

```powershell
cd C:\Projects\Portarium
npx --yes http-server docs/ui/alt-b-stream -p 4175
```

Then open `http://localhost:4175`.

## View Tabs Reference

| Tab      | Purpose                                                               |
| -------- | --------------------------------------------------------------------- |
| Stream   | Default. Reverse-chronological event feed with filter rail.           |
| Entity   | Traditional list/table views for Work Items, Runs, etc.               |
| Evidence | Dedicated audit timeline with hash chain verification and scrub view. |
| Settings | Standard form page for RBAC, Credentials, Adapters, Policies.         |

## Stream Concepts

- **Event Card**: Individual event with icon, title, timestamp, entity context, and optional inline CTAs.
- **Thread**: Expandable group of related events (e.g., Work Item -> Run -> Approval -> Evidence).
- **Time Marker**: Horizontal divider separating events by day.
- **Filter Rail**: Narrow left panel (200px) with checkbox filters for scope, category, and actor.
- **Summary Strip**: Project-scoped metric bar shown when project scope is selected.
- **Inline Form**: Approval decision form embedded within an event card.

## Prototype Controls

- **Persona**: Operator / Approver / Auditor / Admin
- **Workspace**: Solo / Team
- **System State**: Normal / Empty / Misconfigured / Policy blocked / RBAC limited / Degraded

Settings persist in `localStorage` key `portarium_alt_b_v1`.

## Hash Routes

- `#stream` -- Event feed (default)
- `#entity` -- Work Items list
- `#evidence` -- Audit timeline
- `#settings` -- Workspace settings
- `#thread-wi-1099` -- Expanded thread for WI-1099
- `#thread-r-8920` -- Expanded thread for R-8920
