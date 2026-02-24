# Cockpit Prototype — Nielsen Visual Heuristic Evaluation

**Date:** 2026-02-19
**Bead:** bead-0550
**Method:** Live Playwright screenshots (1440×900) + code inspection
**Scope:** Workforce integration + general surface audit

---

## Summary scorecard

| Heuristic                      | Workforce surfaces | General surface | Overall  |
| ------------------------------ | ------------------ | --------------- | -------- |
| H1 Visibility of system status | ★★★★☆              | ★★★★☆           | Good     |
| H2 Match real world            | ★★★★★              | ★★★★☆           | Good     |
| H3 User control & freedom      | ★★★☆☆              | ★★★★☆           | Adequate |
| H4 Consistency & standards     | ★★★★☆              | ★★★☆☆           | Mixed    |
| H5 Error prevention            | ★★★☆☆              | ★★★★☆           | Mixed    |
| H6 Recognition over recall     | ★★★★☆              | ★★★★☆           | Good     |
| H7 Flexibility & efficiency    | ★★★☆☆              | ★★★★☆           | Adequate |
| H8 Aesthetic & minimalist      | ★★★★☆              | ★★★★☆           | Good     |
| H9 Help users recover          | ★★★★☆              | ★★★☆☆           | Adequate |
| H10 Help & documentation       | ★★★☆☆              | ★★★☆☆           | Adequate |

---

## What works well (visually confirmed)

### Inbox — persona adaptation

Both Operator and Approver personas correctly surface the **Human tasks** chip as active on load (WF-1). The Approver inbox shows a two-column split: **Policy Violations** left, **Human Tasks** right — allowing the user to see both governance blocks and actionable tasks at a glance. The HumanTask card pattern (step context, due indicator, Complete/Escalate CTAs, assignee link) is clear and information-dense without being cluttered.

### Workforce directory — master-detail

The 4-card list with sidebar availability dots, capability chips, queue membership count, and open assignment count gives an excellent at-a-glance personnel state. The detail panel shows Overview/Capabilities/Queue Memberships/History tabs — good progressive disclosure. The **Toggle availability** control is contextually placed.

### Queues — operational clarity

"Human Task Queues" heading (more descriptive than just "Queues") combined with strategy badge (least-busy / round-robin / manual), pending task count badges, and the **Next in rotation** callout make the operational routing state transparent (H1). The Assign buttons per member flatten the task-assignment flow.

### Approvals table

Display names with availability dots, SLA urgency badges, SoD rule chips, and tier badges give approvers everything needed to triage without opening each item. The "Role conflict" warning on the Finance row is a strong H5 (error prevention) signal.

### Availability dot consistency

After WF-5 fix, the owner picker trigger button mirrors the selected member's availability state (amber for busy, grey for offline).

---

## Bugs found and fixed in this session

### B-1 · Workforce detail body did not update on card click _(Critical — H1)_

**Observed:** Clicking Bob Chen updated the header name and email but the avatar letter stayed "A" and the Overview grid still showed Alice Martinez's data (Display name, Email, Role).
**Root cause:** JS handler used `.avatar__letter` selector (does not exist); Overview grid values were raw text nodes with no targetable class/ID.
**Fix applied:** Corrected selector to `.workforce-detail__avatar`; added `id="wfDetailGridName/Email/Role"` spans in HTML; added `id="wfDetailDot/AvailText"` for the availability row; extended JS handler to update all fields including availability text label and Edit capabilities aria-label.
**Verified:** Bob Chen now shows "B" avatar, amber "Busy" dot, "operator" role, correct email in both header and grid.

### B-2 · Queue card click did not update detail panel _(Critical — H1)_

**Observed:** Clicking Legal Queue selected the card border but the detail panel still showed "Finance Queue" with least-busy strategy and finance-review capability.
**Root cause:** JS handler queried `.queue-detail` (no such class) and fell back to `.detail-panel` (also absent); the panel is `.workforce-detail` inside `[data-screen="queues"]`.
**Fix applied:** Changed query to `[data-screen="queues"] .workforce-detail`; added `QUEUE_DATA` map; handler now updates title, strategy/capability subtitle, and member/task count labels.
**Verified:** Legal Queue shows "round-robin | legal-review", Members (2), Pending HumanTasks (1).

### B-3 · Approvals row 2 "Unassigned" was plain text, not chip _(Major — H4)_

**Observed:** WF-7 fix had replaced email addresses with display names but left one Assignee cell as plain text "Unassigned" rather than a chip.
**Fix applied:** Wrapped in `<span class="chip chip--small">Unassigned</span>`.
**Verified:** Chip renders consistently with other assignment states.

### B-4 · WORKFORCE*DATA had wrong member names/emails *(Major — H1)\_

The hardcoded data had `alice@acme.com` (not `alice.martinez@acme.com`), `dave@acme.com` / "Dave Wilson" (not "Dan Park" as shown in HTML).
**Fix applied:** Updated WORKFORCE_DATA to match HTML member list: Alice Martinez, Bob Chen, Carol Davis, Dan Park with correct emails.

---

## New visual findings (not in original plan)

### V-1 · Queue detail member rows do not update _(Moderate — H1)_

**Screen:** Queues → Legal Queue
**Issue:** After clicking Legal Queue, the title/strategy/counts update but the member list rows and pending task rows still show Finance Queue's members (Alice Martinez, Carol Davis, Emma Wilson) and Finance Queue's tasks. The "Next in rotation" callout still says "Alice Martinez (least-busy)" which is factually wrong for round-robin Legal Queue.
**Heuristic:** H1 — system state is partially misrepresented.
**Recommendation:** For a production implementation, full member rows and task list must be data-driven. For prototype fidelity, add a `data-queue` HTML dataset and pre-render 3 sets of member rows, toggling visibility on click. This is a prototype-only scope gap.

### V-2 · "Toggle availability" uses raw checkbox, not a toggle switch _(Minor — H4)_

**Screen:** Workforce detail panel
**Issue:** The availability control renders as `<input type="checkbox"> Toggle availability` — a native checkbox. All other interactive controls in the prototype use styled components. The checkbox looks out of place and does not communicate a binary on/off toggle state as clearly as a toggle switch would.
**Heuristic:** H4 — inconsistency with the rest of the UI's visual language.
**Recommendation:** Replace with `<button role="switch" aria-checked="true" class="toggle">` styled as a pill toggle. Low priority for prototype; important for production.

### V-3 · Inbox "Default filters" chip is indistinguishable from toggleable chips _(Moderate — H4, H6)_

**Screen:** Inbox (both Operator and Approver personas)
**Issue:** The first chip reads "Default filters: failures + blocks" (Operator) or "Default filters: approvals assigned to me" (Approver). It has identical visual weight to the actual toggleable filter chips beside it. Users may attempt to click it to disable defaults, finding it does nothing, or may not understand that other chips modify the default view.
**Heuristic:** H4 consistency, H6 recognition over recall.
**Recommendation:** Differentiate the default-filters label: render it as a plain text label (no chip border), or use a `chip--secondary` style with a lock icon. Clearly separate it from the actionable filter chips with a visual divider or spacing.

### V-4 · Inbox layout shifts between personas create disorientation _(Minor — H4)_

**Screen:** Inbox — Operator vs Approver
**Issue:** Operator inbox stacks sections vertically (Run Failures → Approval Gates). Approver inbox uses a two-column split (Policy Violations | Human Tasks) which looks completely different. While persona adaptation is intentional, the structural layout change feels like a different product, not a different view.
**Recommendation:** Establish a consistent grid template (e.g. always two columns below the hero notification) and vary content per persona within that grid. This maintains layout continuity while adapting content.

### V-5 · Workforce detail has significant empty whitespace below 4 cards _(Minor — H8)_

**Screen:** Workforce → any member selected
**Issue:** Below the 4 workforce cards, there is ~300px of unused whitespace before the viewport ends. The content does not fill the screen.
**Heuristic:** H8 — aesthetic and minimalist; unused whitespace signals incompleteness.
**Recommendation:** Add a "Recent assignments" mini-feed or aggregate stats (total open tasks, SLA at-risk count) below the member list to fill the space meaningfully.

### V-6 · Approvals row 4 is missing an Approval Rule chip _(Minor — H1)_

**Screen:** Approvals table
**Issue:** "Approve Agent Action: Document Summarizer — write to Salesforce" row has an empty Approval Rule cell. It should either show a rule chip or an explicit "None" / "No rule" placeholder — otherwise users cannot distinguish "no rule applied" from "data not loaded."
**Recommendation:** Add `<span class="subtle" style="font-size:11px">No rule</span>` or `<span class="chip chip--small chip--muted">Auto-allow</span>` to the empty Approval Rule cell.

### V-7 · HumanTask assignee link in Inbox has no link affordance _(Minor — H6)_

**Screen:** Approver Inbox → Human Tasks section
**Issue:** "Alice Martinez" is a clickable link to the Workforce directory but renders as plain text — no underline, no blue colour. Users cannot discover it is a link without hovering.
**Recommendation:** Add `text-decoration: underline` or a `↗` icon suffix to assignee name links within task cards.

---

## Remaining prototype scope gaps

These are known gaps acceptable for a lo-fi prototype but must be addressed before production:

| Gap                                                                  | Screen           | Impact                                                              |
| -------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------- |
| Queue member rows hardcoded to Finance Queue                         | Queues detail    | Users evaluating Legal/General queue routing see wrong members      |
| Workforce tabs (Capabilities, Queue Memberships, History) are static | Workforce detail | Only Overview tab has meaningful content                            |
| Work Item detail drawer not accessible from Kanban card click        | Work Items       | Owner picker cannot be demonstrated without switching to Table view |
| Run detail timeline not reachable via Playwright headless navigation | Runs             | Screenshot capture fell back to list view                           |
| Settings → Workforce tab not wired to keyboard nav                   | Settings         | Tab click selector mismatch in headless browser                     |

---

## Top 5 priority fixes for next iteration

1. **Queue member rows dynamic** — pre-render 3 queue datasets, toggle visibility on card click (V-1)
2. **"Default filters" chip differentiation** — change to non-interactive label (V-3)
3. **Toggle availability → toggle switch** — replace checkbox with `role="switch"` (V-2)
4. **Assignee link affordance** — underline or icon on workforce links in task cards (V-7)
5. **Approvals Approval Rule empty cell** — add "No rule" placeholder (V-6)
