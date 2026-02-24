# New Interaction Concepts for Portarium Cockpit

> **Date:** 2026-02-17
> **Status:** Design proposal
> **Scope:** Three new screens/interactions for the cockpit prototype

---

## Concept 1: Approval Swipe UX (Tinder-style Triage)

### Interaction Description

The current Approvals screen is a table that forces users to scan rows, click through to a Run Detail page, review context, then come back. This breaks flow. The Approval Swipe UX replaces the table with a single-card-at-a-time triage experience that brings all decision context to the user.

**User flow:**

1. User navigates to "Approval Triage" (new sidebar entry, or toggle on existing Approvals screen).
2. A single approval card fills the center of the screen. The card shows: plan summary, effects list, policy context, requester info, SoR refs.
3. The card has a "collapsed" front face (summary) and can be expanded/flipped to show full plan details, evidence, and effects diff.
4. User takes one of four actions:
   - **Approve** (swipe right gesture, green button, or press `A`) -- rationale is optional but encouraged.
   - **Deny** (swipe left gesture, red button, or press `D`) -- rationale is **required** before submission.
   - **Request Changes** (swipe up gesture, yellow button, or press `R`) -- rationale is **required** before submission.
   - **Skip/Defer** (swipe down gesture, grey button, or press `S`) -- card moves to end of queue.
5. After acting, the card animates out and the next card slides in. A progress indicator updates: "3 of 12 pending".
6. When the queue is empty, a completion summary is shown: "All caught up. 8 approved, 2 denied, 1 changes requested, 1 skipped."

**Power user mode:** Keyboard shortcuts `A`, `D`, `R`, `S` allow rapid triage without mousing. `Space` or `Enter` expands/collapses the card detail. `Escape` closes any open rationale input.

**Careful user mode:** The card defaults to collapsed (summary). Users can click "Show full details" to see the complete effects diff, evidence entries, and policy evaluation before deciding.

### HTML Structure

```html
<!-- Inside #screen-approvals, after the existing table -->
<!-- Toggle between table and triage modes -->
<div class="triage-toggle">
  <button class="btn btn--small js-triage-mode" type="button" data-mode="table">Table view</button>
  <button class="btn btn--small btn--primary js-triage-mode" type="button" data-mode="triage">
    Triage view
  </button>
</div>

<!-- TRIAGE VIEW -->
<div class="triage" id="triage" hidden>
  <!-- Progress bar -->
  <div class="triage__progress">
    <div class="triage__progress-bar">
      <div class="triage__progress-fill" style="width: 25%"></div>
    </div>
    <div class="triage__progress-text">
      <span class="triage__current">3</span> of <span class="triage__total">12</span> pending
    </div>
  </div>

  <!-- Card stack area -->
  <div class="triage__stack">
    <!-- Active card -->
    <article class="triage-card" id="triageCard">
      <!-- Front face (summary) -->
      <div class="triage-card__front">
        <div class="triage-card__header">
          <div class="triage-card__id">AG-442</div>
          <span class="tier-badge tier-badge--human">Human-approve</span>
          <span class="sod-badge">SoD: maker-checker</span>
        </div>

        <h2 class="triage-card__title">Approve Plan: Create Invoice in NetSuite</h2>

        <div class="triage-card__meta">
          <div class="triage-card__meta-item">
            <span class="triage-card__label">Work Item</span>
            <span>WI-1099 Invoice correction for ACME</span>
          </div>
          <div class="triage-card__meta-item">
            <span class="triage-card__label">Run</span>
            <span>R-8920 (paused)</span>
          </div>
          <div class="triage-card__meta-item">
            <span class="triage-card__label">Requester</span>
            <span>operator@acme.com</span>
          </div>
          <div class="triage-card__meta-item">
            <span class="triage-card__label">Requested</span>
            <span>12 minutes ago</span>
          </div>
        </div>

        <!-- Effects summary (compact) -->
        <div class="triage-card__effects-summary">
          <div class="triage-card__label">Planned Effects (2)</div>
          <div class="triage-card__effect-row">
            <span class="pill">Update</span>
            <span>NetSuite | Invoice | INV-22318</span>
            <span class="idem-badge idem-badge--safe">retry-safe</span>
          </div>
          <div class="triage-card__effect-row">
            <span class="pill">Create</span>
            <span>Drive | Document | Receipt bundle</span>
            <span class="idem-badge idem-badge--safe">retry-safe</span>
          </div>
        </div>

        <!-- Policy callout -->
        <div class="callout callout--policy">
          Tier: <strong>Human-approve</strong> | Rule: Invoice writes &gt; $10,000 | Required
          approvers: 2 | Scopes: netsuite.write, drive.write
        </div>

        <button class="btn btn--small triage-card__expand-btn js-triage-expand" type="button">
          Show full details (Space)
        </button>
      </div>

      <!-- Back face (full details, hidden by default) -->
      <div class="triage-card__back" hidden>
        <button class="btn btn--small triage-card__collapse-btn js-triage-collapse" type="button">
          Collapse details (Space)
        </button>

        <div class="effects">
          <div class="effects__section">
            <div class="effects__title">Planned Effects</div>
            <div class="effects__hint subtle">Portarium intends to...</div>
            <div class="effects__list">
              <div class="effect">
                <div class="effect__main">
                  <span class="pill">Update</span>
                  <span class="effect__target">NetSuite | Invoice | INV-22318</span>
                  <span class="idem-badge idem-badge--safe">retry-safe</span>
                </div>
                <div class="effect__subtle">Update memo and line item classification.</div>
              </div>
              <div class="effect">
                <div class="effect__main">
                  <span class="pill">Create</span>
                  <span class="effect__target">Drive | Document | Receipt bundle</span>
                  <span class="idem-badge idem-badge--safe">retry-safe</span>
                </div>
                <div class="effect__subtle">Create evidence artifact for audit trail.</div>
              </div>
            </div>
          </div>
        </div>

        <!-- SoR Refs -->
        <div style="margin-top: 12px">
          <div class="triage-card__label">Linked External Records</div>
          <div class="chips" style="margin-top: 6px">
            <span class="chip"
              ><span class="port-icon">FA</span> NetSuite | Invoice | INV-22318</span
            >
            <span class="chip"><span class="port-icon">PB</span> Stripe | Charge | ch_9d2a</span>
          </div>
        </div>

        <!-- Evidence preview -->
        <div style="margin-top: 12px">
          <div class="triage-card__label">Recent Evidence (2 entries)</div>
          <div class="list" style="margin-top: 6px">
            <div class="row row--static">
              <div class="row__main">
                <div class="row__title">Plan recorded (hash chained)</div>
                <div class="row__subtle">Category: Plan | Actor: User</div>
              </div>
            </div>
            <div class="row row--static">
              <div class="row__main">
                <div class="row__title">Approval Gate opened</div>
                <div class="row__subtle">Category: Approval | Actor: System</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>

    <!-- Next card preview (visual depth cue) -->
    <div class="triage__next-preview">
      <div class="triage__next-title">Next: Approve Plan: Update Ticket priority in Zendesk</div>
    </div>
  </div>

  <!-- Rationale input (appears when needed) -->
  <div class="triage__rationale" id="triageRationale" hidden>
    <label class="field">
      <span class="field__label" id="triageRationaleLabel">Rationale (required for deny)</span>
      <textarea
        class="field__input"
        id="triageRationaleInput"
        rows="3"
        placeholder="Explain your decision..."
      ></textarea>
    </label>
    <div class="triage__rationale-actions">
      <button class="btn btn--primary btn--small" id="triageRationaleSubmit" type="button">
        Confirm decision
      </button>
      <button class="btn btn--small" id="triageRationaleCancel" type="button">Cancel</button>
    </div>
  </div>

  <!-- Action buttons -->
  <div class="triage__actions">
    <button
      class="triage__action triage__action--deny"
      type="button"
      data-action="deny"
      aria-label="Deny (D)"
    >
      <span class="triage__action-icon">&#10005;</span>
      <span class="triage__action-label">Deny</span>
      <kbd class="triage__kbd">D</kbd>
    </button>
    <button
      class="triage__action triage__action--changes"
      type="button"
      data-action="changes"
      aria-label="Request Changes (R)"
    >
      <span class="triage__action-icon">&#8634;</span>
      <span class="triage__action-label">Changes</span>
      <kbd class="triage__kbd">R</kbd>
    </button>
    <button
      class="triage__action triage__action--skip"
      type="button"
      data-action="skip"
      aria-label="Skip (S)"
    >
      <span class="triage__action-icon">&#8628;</span>
      <span class="triage__action-label">Skip</span>
      <kbd class="triage__kbd">S</kbd>
    </button>
    <button
      class="triage__action triage__action--approve"
      type="button"
      data-action="approve"
      aria-label="Approve (A)"
    >
      <span class="triage__action-icon">&#10003;</span>
      <span class="triage__action-label">Approve</span>
      <kbd class="triage__kbd">A</kbd>
    </button>
  </div>

  <!-- Keyboard hint -->
  <div class="triage__hint subtle">
    Keyboard: A = Approve, D = Deny, R = Request Changes, S = Skip, Space = Toggle details
  </div>
</div>

<!-- Completion state -->
<div class="triage__complete" id="triageComplete" hidden>
  <div class="empty">
    <div class="empty__title">All caught up</div>
    <div class="empty__body">You have reviewed all pending approval gates.</div>
    <div class="triage__complete-stats">
      <span class="status status--ok">8 approved</span>
      <span class="status status--danger">2 denied</span>
      <span class="status status--warn">1 changes requested</span>
      <span class="status">1 skipped</span>
    </div>
    <div class="empty__actions" style="margin-top: 12px">
      <a class="btn btn--primary" href="#inbox">Back to Inbox</a>
    </div>
  </div>
</div>
```

### CSS Additions

```css
/* ============================================================
   APPROVAL TRIAGE (Swipe UX)
   ============================================================ */

/* Toggle */
.triage-toggle {
  display: flex;
  gap: 6px;
  margin: 12px 0;
}

/* Container */
.triage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
}

/* Progress */
.triage__progress {
  width: 100%;
  max-width: 600px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.triage__progress-bar {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  border: 2px solid var(--line);
  background: rgba(27, 27, 27, 0.04);
  overflow: hidden;
}
.triage__progress-fill {
  height: 100%;
  background: var(--ok);
  border-radius: 999px;
  transition: width 0.3s ease;
}
.triage__progress-text {
  font-size: 13px;
  font-weight: 800;
  color: var(--muted);
  white-space: nowrap;
}
.triage__current {
  font-size: 18px;
  font-weight: 950;
  color: var(--ink);
}

/* Card stack */
.triage__stack {
  position: relative;
  width: 100%;
  max-width: 600px;
}

/* Next preview (depth cue behind active card) */
.triage__next-preview {
  position: absolute;
  bottom: -8px;
  left: 12px;
  right: 12px;
  padding: 10px 12px;
  border-radius: var(--r-md);
  border: 2px solid var(--line-soft);
  background: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  color: var(--muted);
  z-index: 0;
  pointer-events: none;
}
.triage__next-title {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Active card */
.triage-card {
  position: relative;
  z-index: 1;
  padding: 16px;
  border-radius: var(--r-md);
  border: 2px solid var(--line);
  background: var(--panel);
  box-shadow: 0 4px 0 rgba(27, 27, 27, 0.18);
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

/* Card exit animations */
.triage-card--exit-right {
  transform: translateX(120%) rotate(8deg);
  opacity: 0;
}
.triage-card--exit-left {
  transform: translateX(-120%) rotate(-8deg);
  opacity: 0;
}
.triage-card--exit-up {
  transform: translateY(-100%) scale(0.95);
  opacity: 0;
}
.triage-card--exit-down {
  transform: translateY(60%) scale(0.95);
  opacity: 0;
}

/* Card header */
.triage-card__header {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.triage-card__id {
  font-weight: 950;
  font-size: 12px;
  color: var(--muted);
}
.triage-card__title {
  font-size: 18px;
  font-weight: 950;
  margin: 0 0 12px 0;
  line-height: 1.3;
}

/* Card meta grid */
.triage-card__meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px;
  border-radius: var(--r-sm);
  background: rgba(27, 27, 27, 0.03);
  border: 1px solid var(--line-soft);
}
.triage-card__meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}
.triage-card__label {
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--muted);
}

/* Compact effects list */
.triage-card__effects-summary {
  margin-bottom: 12px;
}
.triage-card__effect-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  padding: 6px 0;
  font-size: 13px;
  font-weight: 700;
}
.triage-card__effect-row + .triage-card__effect-row {
  border-top: 1px solid var(--line-soft);
}

/* Expand/collapse buttons */
.triage-card__expand-btn,
.triage-card__collapse-btn {
  width: 100%;
  justify-content: center;
  margin-top: 8px;
}

/* Rationale input */
.triage__rationale {
  width: 100%;
  max-width: 600px;
  padding: 12px;
  border-radius: var(--r-md);
  border: 2px solid var(--line);
  background: var(--panel);
  box-shadow: var(--shadow);
}
.triage__rationale-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* Action buttons row */
.triage__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.triage__action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 20px;
  border-radius: var(--r-md);
  border: 2px solid var(--line);
  background: var(--panel);
  box-shadow: var(--shadow);
  cursor: pointer;
  font-family: inherit;
  min-width: 80px;
  transition:
    transform 0.1s ease,
    box-shadow 0.1s ease;
}
.triage__action:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 0 rgba(27, 27, 27, 0.2);
}
.triage__action:active {
  transform: translateY(1px);
  box-shadow: 0 1px 0 rgba(27, 27, 27, 0.15);
}
.triage__action-icon {
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
}
.triage__action-label {
  font-size: 12px;
  font-weight: 800;
}
.triage__kbd {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--line-soft);
  background: rgba(27, 27, 27, 0.04);
  font-size: 10px;
  font-weight: 900;
  font-family: inherit;
  color: var(--muted);
}

/* Action button color accents */
.triage__action--approve {
  border-color: var(--ok);
}
.triage__action--approve .triage__action-icon {
  color: var(--ok);
}
.triage__action--deny {
  border-color: var(--danger);
}
.triage__action--deny .triage__action-icon {
  color: var(--danger);
}
.triage__action--changes {
  border-color: var(--warn);
}
.triage__action--changes .triage__action-icon {
  color: var(--warn);
}
.triage__action--skip {
  border-color: var(--line-soft);
}
.triage__action--skip .triage__action-icon {
  color: var(--muted);
}

/* Keyboard hint */
.triage__hint {
  text-align: center;
  font-size: 12px;
}

/* Completion stats */
.triage__complete-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}
```

### JS Behavior

```javascript
/* ============================================================
   APPROVAL TRIAGE
   ============================================================ */

// Sample data (in production, fetched from API)
const TRIAGE_QUEUE = [
  {
    id: 'AG-442',
    title: 'Approve Plan: Create Invoice in NetSuite',
    workItem: 'WI-1099 Invoice correction for ACME',
    run: 'R-8920',
    requester: 'operator@acme.com',
    requested: '12m ago',
    tier: 'human',
    sod: 'maker-checker',
    effects: [
      { op: 'Update', target: 'NetSuite | Invoice | INV-22318', idem: 'retry-safe' },
      { op: 'Create', target: 'Drive | Document | Receipt bundle', idem: 'retry-safe' },
    ],
    policy: 'Invoice writes > $10,000 | Required approvers: 2',
  },
  {
    id: 'AG-443',
    title: 'Approve Plan: Update Ticket priority in Zendesk',
    workItem: 'WI-1042 Dispute: investigate payment failure',
    run: 'R-8892',
    requester: 'operator@acme.com',
    requested: '1h ago',
    tier: 'human',
    sod: null,
    effects: [{ op: 'Update', target: 'Zendesk | Ticket | 4831', idem: 'retry-safe' }],
    policy: 'Default workflow tier: Assisted',
  },
];

let triageIndex = 0;
const triageResults = { approved: 0, denied: 0, changes: 0, skipped: 0 };

function renderTriageCard(index) {
  if (index >= TRIAGE_QUEUE.length) {
    document.getElementById('triage').hidden = true;
    document.getElementById('triageComplete').hidden = false;
    return;
  }
  // Update progress
  const fill = (index / TRIAGE_QUEUE.length) * 100;
  qs('.triage__progress-fill').style.width = fill + '%';
  qs('.triage__current').textContent = index + 1;
  qs('.triage__total').textContent = TRIAGE_QUEUE.length;

  // Populate card from TRIAGE_QUEUE[index]
  // (In the static prototype, the HTML is pre-filled with the first item)
}

function triageAction(action) {
  const requiresRationale = action === 'deny' || action === 'changes';
  const rationaleEl = document.getElementById('triageRationale');
  const rationaleInput = document.getElementById('triageRationaleInput');

  if (requiresRationale) {
    rationaleEl.hidden = false;
    const label =
      action === 'deny'
        ? 'Rationale (required for deny)'
        : 'Rationale (required for request changes)';
    document.getElementById('triageRationaleLabel').textContent = label;
    rationaleInput.focus();
    // Store pending action
    rationaleEl.dataset.pendingAction = action;
    return;
  }

  // Animate card exit
  const card = document.getElementById('triageCard');
  const exitClass = {
    approve: 'triage-card--exit-right',
    deny: 'triage-card--exit-left',
    changes: 'triage-card--exit-up',
    skip: 'triage-card--exit-down',
  }[action];

  card.classList.add(exitClass);

  // Track result
  const resultKey = { approve: 'approved', deny: 'denied', changes: 'changes', skip: 'skipped' }[
    action
  ];
  triageResults[resultKey]++;

  // After animation, load next card
  setTimeout(() => {
    card.classList.remove(exitClass);
    triageIndex++;
    renderTriageCard(triageIndex);
  }, 350);
}

// Keyboard shortcuts for triage
document.addEventListener('keydown', (e) => {
  // Only when triage view is visible and rationale is not open
  const triageEl = document.getElementById('triage');
  const rationaleEl = document.getElementById('triageRationale');
  if (!triageEl || triageEl.hidden) return;
  if (rationaleEl && !rationaleEl.hidden) return;

  const key = e.key.toLowerCase();
  if (key === 'a') triageAction('approve');
  else if (key === 'd') triageAction('deny');
  else if (key === 'r') triageAction('changes');
  else if (key === 's') triageAction('skip');
  else if (key === ' ') {
    e.preventDefault();
    // Toggle card detail expansion
    const front = qs('.triage-card__front');
    const back = qs('.triage-card__back');
    if (back.hidden) {
      back.hidden = false;
    } else {
      back.hidden = true;
    }
  }
});

// Triage action button clicks
document.addEventListener('click', (e) => {
  const actionBtn = e.target.closest('.triage__action');
  if (actionBtn) {
    triageAction(actionBtn.dataset.action);
  }
});

// Rationale submit/cancel
document.addEventListener('click', (e) => {
  if (e.target.id === 'triageRationaleSubmit') {
    const rationaleEl = document.getElementById('triageRationale');
    const action = rationaleEl.dataset.pendingAction;
    rationaleEl.hidden = true;
    document.getElementById('triageRationaleInput').value = '';
    triageAction(action === 'deny' ? 'skip' : action); // Re-trigger as skip to animate
    // In production, the deny/changes action + rationale would be submitted to API
  }
  if (e.target.id === 'triageRationaleCancel') {
    document.getElementById('triageRationale').hidden = true;
    document.getElementById('triageRationaleInput').value = '';
  }
});

// Expand/collapse handlers
document.addEventListener('click', (e) => {
  if (e.target.closest('.js-triage-expand')) {
    qs('.triage-card__back').hidden = false;
  }
  if (e.target.closest('.js-triage-collapse')) {
    qs('.triage-card__back').hidden = true;
  }
});

// Triage mode toggle
document.addEventListener('click', (e) => {
  const modeBtn = e.target.closest('.js-triage-mode');
  if (!modeBtn) return;
  const mode = modeBtn.dataset.mode;
  // Toggle table vs triage visibility
  const tableWrap = document.querySelector('#screen-approvals .table-wrap');
  const triageEl = document.getElementById('triage');
  if (mode === 'triage') {
    if (tableWrap) tableWrap.hidden = true;
    if (triageEl) triageEl.hidden = false;
  } else {
    if (tableWrap) tableWrap.hidden = false;
    if (triageEl) triageEl.hidden = true;
  }
  // Toggle active button style
  for (const btn of qsa('.js-triage-mode')) {
    btn.classList.toggle('btn--primary', btn.dataset.mode === mode);
  }
});
```

### Navigation Integration

- Add `<a class="nav__item" href="#approvals">Approval Triage</a>` to the sidebar (or keep the existing Approvals link and add the toggle within the screen).
- The triage view lives inside `#screen-approvals` alongside the table, toggled by the view-mode buttons.
- The `parentMap` in the router does not need changes since it reuses the existing approvals screen.

### HCI Rationale

1. **Reduced cognitive load (Hick's Law):** Presenting one item at a time eliminates the need to scan, compare, and select from a list. The user's only job is to evaluate the current card and decide.

2. **Speed-accuracy tradeoff, handled:** Approve allows optional rationale (fast path for power users), while Deny and Request Changes require mandatory rationale (forces deliberation for consequential actions). This prevents reckless denials while allowing fast approvals of obviously-correct plans.

3. **Progressive disclosure:** The card summary shows just enough context (effects, policy, requester) for a quick decision. Full details are one click/keystroke away. This serves both the power user who decides in 3 seconds and the careful reviewer who reads every detail.

4. **Motor memory (Fitts's Law):** The four action buttons are large, clearly separated, and color-coded. Keyboard shortcuts eliminate pointer travel entirely for power users.

5. **Feedback and progress:** The progress bar and counter create a "making progress" feel. Card exit animations provide clear feedback that the action registered. The completion summary provides a session review.

6. **Reversibility safety:** The "Skip" action lets users defer without deciding. The rationale requirement on destructive actions (deny) creates a speed bump that prevents mis-taps.

---

## Concept 2: Workflow Builder (N8N-style Visual Editor)

### Interaction Description

The workflow builder provides a visual canvas where users construct and review workflow step sequences. In the lo-fi prototype this is a CSS-based node graph (no drag-and-drop library needed). Users see connected nodes representing workflow steps, with connectors showing flow direction and conditional branches.

**User flow:**

1. User navigates to "Workflow Builder" (new sidebar entry).
2. The screen shows a toolbar at the top, a sidebar panel on the left with available step types, and a canvas area in the center.
3. The canvas displays nodes laid out in a left-to-right flow. Each node shows: step name, type icon, and a status indicator.
4. Connectors (CSS arrows) show flow direction. Conditional branches fork into parallel paths.
5. Clicking a node selects it (highlighted border) and opens a configuration panel in the right area.
6. The sidebar lists draggable step types: Action, Approval Gate, Condition, Notification, Agent Task.
7. The toolbar provides: zoom controls, fit-to-view, undo, save, and run.

**Step types:**

| Type          | Icon    | Description                                                    |
| ------------- | ------- | -------------------------------------------------------------- |
| Action        | Bolt    | Execute an adapter write (e.g., create invoice, update ticket) |
| Approval Gate | Shield  | Pause for human decision with policy evaluation                |
| Condition     | Diamond | Branch logic (if/else based on data or policy)                 |
| Notification  | Bell    | Send alert to user, team, or external channel                  |
| Agent Task    | Brain   | Delegate to an AI agent for analysis or generation             |

### HTML Structure

```html
<!-- New screen: Workflow Builder -->
<section
  id="screen-workflow-builder"
  class="screen"
  data-screen="workflow-builder"
  aria-labelledby="h-workflow-builder"
>
  <div class="screen__header">
    <div>
      <h1 id="h-workflow-builder" class="h1">Workflow Builder</h1>
      <div class="subtle">Invoice Correction Workflow (draft)</div>
    </div>
    <div class="screen__actions">
      <button class="btn btn--small" type="button">Undo</button>
      <button class="btn btn--small" type="button">Redo</button>
      <button class="btn" type="button">Save draft</button>
      <button class="btn btn--primary" type="button">Run workflow</button>
    </div>
  </div>

  <div class="wf-layout">
    <!-- Step palette (left sidebar) -->
    <aside class="wf-palette">
      <div class="wf-palette__title">Step Types</div>
      <div class="wf-palette__hint subtle">Click to add to canvas</div>
      <div class="wf-palette__list">
        <button class="wf-palette__item" type="button" data-step-type="action">
          <span class="wf-node-icon wf-node-icon--action">&#9889;</span>
          <div>
            <div class="wf-palette__item-name">Action</div>
            <div class="wf-palette__item-desc">Execute adapter write</div>
          </div>
        </button>
        <button class="wf-palette__item" type="button" data-step-type="approval">
          <span class="wf-node-icon wf-node-icon--approval">&#9730;</span>
          <div>
            <div class="wf-palette__item-name">Approval Gate</div>
            <div class="wf-palette__item-desc">Pause for human decision</div>
          </div>
        </button>
        <button class="wf-palette__item" type="button" data-step-type="condition">
          <span class="wf-node-icon wf-node-icon--condition">&#9670;</span>
          <div>
            <div class="wf-palette__item-name">Condition</div>
            <div class="wf-palette__item-desc">Branch logic (if/else)</div>
          </div>
        </button>
        <button class="wf-palette__item" type="button" data-step-type="notification">
          <span class="wf-node-icon wf-node-icon--notification">&#128276;</span>
          <div>
            <div class="wf-palette__item-name">Notification</div>
            <div class="wf-palette__item-desc">Send alert or message</div>
          </div>
        </button>
        <button class="wf-palette__item" type="button" data-step-type="agent">
          <span class="wf-node-icon wf-node-icon--agent">&#129504;</span>
          <div>
            <div class="wf-palette__item-name">Agent Task</div>
            <div class="wf-palette__item-desc">Delegate to AI agent</div>
          </div>
        </button>
      </div>
    </aside>

    <!-- Canvas -->
    <div class="wf-canvas" id="wfCanvas">
      <!-- Zoom controls -->
      <div class="wf-canvas__controls">
        <button class="btn btn--small" type="button" title="Zoom in">+</button>
        <button class="btn btn--small" type="button" title="Zoom out">&minus;</button>
        <button class="btn btn--small" type="button" title="Fit to view">Fit</button>
      </div>

      <!-- Node graph (CSS-based layout) -->
      <div class="wf-graph" id="wfGraph">
        <!-- Row 1: Main flow -->
        <div class="wf-graph__row">
          <!-- Start node -->
          <div class="wf-node wf-node--start" data-node-id="start">
            <div class="wf-node__header">
              <span class="wf-node-icon wf-node-icon--start">&#9654;</span>
              <span class="wf-node__name">Start</span>
            </div>
            <div class="wf-node__status">
              <span class="status status--ok" style="font-size:10px; padding:2px 6px"
                >Trigger: Manual</span
              >
            </div>
          </div>

          <div class="wf-connector">
            <div class="wf-connector__line"></div>
            <div class="wf-connector__arrow">&#8250;</div>
          </div>

          <!-- Action node: Fetch invoice -->
          <div class="wf-node wf-node--action" data-node-id="fetch">
            <div class="wf-node__header">
              <span class="wf-node-icon wf-node-icon--action">&#9889;</span>
              <span class="wf-node__name">Fetch Invoice</span>
            </div>
            <div class="wf-node__meta subtle">
              <span class="port-icon" style="font-size:9px">FA</span> NetSuite | Read
            </div>
            <div class="wf-node__status">
              <span class="status status--info" style="font-size:10px; padding:2px 6px"
                >Action</span
              >
            </div>
          </div>

          <div class="wf-connector">
            <div class="wf-connector__line"></div>
            <div class="wf-connector__arrow">&#8250;</div>
          </div>

          <!-- Condition node -->
          <div class="wf-node wf-node--condition" data-node-id="check-amount">
            <div class="wf-node__header">
              <span class="wf-node-icon wf-node-icon--condition">&#9670;</span>
              <span class="wf-node__name">Amount > $10k?</span>
            </div>
            <div class="wf-node__status">
              <span class="status" style="font-size:10px; padding:2px 6px">Condition</span>
            </div>
            <div class="wf-node__branches">
              <span class="wf-branch-label wf-branch-label--yes">Yes</span>
              <span class="wf-branch-label wf-branch-label--no">No</span>
            </div>
          </div>
        </div>

        <!-- Branch connectors -->
        <div class="wf-graph__branches">
          <!-- Yes branch (top path) -->
          <div class="wf-graph__branch wf-graph__branch--yes">
            <div class="wf-connector wf-connector--vertical">
              <div class="wf-connector__line wf-connector__line--vertical"></div>
            </div>

            <div class="wf-graph__row">
              <!-- Approval Gate node -->
              <div class="wf-node wf-node--approval wf-node--selected" data-node-id="approve">
                <div class="wf-node__header">
                  <span class="wf-node-icon wf-node-icon--approval">&#9730;</span>
                  <span class="wf-node__name">Approval Gate</span>
                </div>
                <div class="wf-node__meta subtle">
                  <span class="tier-badge tier-badge--human" style="font-size:9px; padding:1px 5px"
                    >Human-approve</span
                  >
                  <span class="sod-badge" style="font-size:9px; padding:1px 5px">SoD</span>
                </div>
                <div class="wf-node__status">
                  <span class="status status--warn" style="font-size:10px; padding:2px 6px"
                    >Gate</span
                  >
                </div>
              </div>

              <div class="wf-connector">
                <div class="wf-connector__line"></div>
                <div class="wf-connector__arrow">&#8250;</div>
              </div>

              <!-- Agent task node -->
              <div class="wf-node wf-node--agent" data-node-id="classify">
                <div class="wf-node__header">
                  <span class="wf-node-icon wf-node-icon--agent">&#129504;</span>
                  <span class="wf-node__name">Classify Line Items</span>
                </div>
                <div class="wf-node__meta subtle">Agent: Claude | Prompt: classify</div>
                <div class="wf-node__status">
                  <span class="status status--info" style="font-size:10px; padding:2px 6px"
                    >Agent</span
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- No branch (bottom path) -->
          <div class="wf-graph__branch wf-graph__branch--no">
            <div class="wf-connector wf-connector--vertical">
              <div class="wf-connector__line wf-connector__line--vertical"></div>
            </div>

            <div class="wf-graph__row">
              <!-- Notification node -->
              <div class="wf-node wf-node--notification" data-node-id="notify-skip">
                <div class="wf-node__header">
                  <span class="wf-node-icon wf-node-icon--notification">&#128276;</span>
                  <span class="wf-node__name">Notify: Auto-approved</span>
                </div>
                <div class="wf-node__meta subtle">Channel: Slack | #billing-ops</div>
                <div class="wf-node__status">
                  <span class="status" style="font-size:10px; padding:2px 6px">Notify</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Merge and continue -->
        <div class="wf-graph__row">
          <div class="wf-connector">
            <div class="wf-connector__line"></div>
            <div class="wf-connector__arrow">&#8250;</div>
          </div>

          <!-- Action node: Update invoice -->
          <div class="wf-node wf-node--action" data-node-id="update-invoice">
            <div class="wf-node__header">
              <span class="wf-node-icon wf-node-icon--action">&#9889;</span>
              <span class="wf-node__name">Update Invoice</span>
            </div>
            <div class="wf-node__meta subtle">
              <span class="port-icon" style="font-size:9px">FA</span> NetSuite | Write
              <span class="idem-badge idem-badge--safe" style="font-size:8px; padding:1px 4px"
                >retry-safe</span
              >
            </div>
            <div class="wf-node__status">
              <span class="status status--info" style="font-size:10px; padding:2px 6px"
                >Action</span
              >
            </div>
          </div>

          <div class="wf-connector">
            <div class="wf-connector__line"></div>
            <div class="wf-connector__arrow">&#8250;</div>
          </div>

          <!-- Action node: Create evidence -->
          <div class="wf-node wf-node--action" data-node-id="evidence">
            <div class="wf-node__header">
              <span class="wf-node-icon wf-node-icon--action">&#9889;</span>
              <span class="wf-node__name">Create Evidence Bundle</span>
            </div>
            <div class="wf-node__meta subtle">
              <span class="port-icon" style="font-size:9px">DM</span> Drive | Write
            </div>
            <div class="wf-node__status">
              <span class="status status--info" style="font-size:10px; padding:2px 6px"
                >Action</span
              >
            </div>
          </div>

          <div class="wf-connector">
            <div class="wf-connector__line"></div>
            <div class="wf-connector__arrow">&#8250;</div>
          </div>

          <!-- End node -->
          <div class="wf-node wf-node--end" data-node-id="end">
            <div class="wf-node__header">
              <span class="wf-node-icon wf-node-icon--end">&#9632;</span>
              <span class="wf-node__name">End</span>
            </div>
            <div class="wf-node__status">
              <span class="status status--ok" style="font-size:10px; padding:2px 6px"
                >Complete</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Step configuration panel (right side, shown when a node is selected) -->
    <aside class="wf-config" id="wfConfig">
      <div class="wf-config__title">Approval Gate</div>
      <div class="wf-config__subtitle subtle">Configure step: approve</div>

      <div class="form" style="margin-top: 12px">
        <label class="field">
          <span class="field__label">Step Name</span>
          <input class="field__input" type="text" value="Approval Gate" />
        </label>
        <label class="field">
          <span class="field__label">Execution Tier</span>
          <select class="field__input">
            <option>Auto</option>
            <option>Assisted</option>
            <option selected>Human-approve</option>
            <option>Manual-only</option>
          </select>
        </label>
        <label class="field">
          <span class="field__label">Required Approvers</span>
          <input class="field__input" type="number" value="2" min="1" max="10" />
        </label>
        <label class="field">
          <span class="field__label">SoD Constraint</span>
          <select class="field__input">
            <option selected>Maker-checker</option>
            <option>None</option>
            <option>N-of-M</option>
          </select>
        </label>
        <label class="field">
          <span class="field__label">Timeout</span>
          <select class="field__input">
            <option>No timeout</option>
            <option>1 hour</option>
            <option selected>24 hours</option>
            <option>7 days</option>
          </select>
        </label>
        <label class="field">
          <span class="field__label">On Timeout</span>
          <select class="field__input">
            <option selected>Escalate</option>
            <option>Auto-deny</option>
            <option>Auto-approve</option>
          </select>
        </label>
      </div>

      <div class="callout" style="margin-top: 12px">
        This step will pause the run and require
        <strong>2 approvers</strong> before continuing. SoD constraint prevents self-approval.
      </div>
    </aside>
  </div>
</section>
```

### CSS Additions

```css
/* ============================================================
   WORKFLOW BUILDER
   ============================================================ */

/* Layout: palette | canvas | config */
.wf-layout {
  display: grid;
  grid-template-columns: 200px 1fr 280px;
  gap: 0;
  border: 2px solid var(--line);
  border-radius: var(--r-md);
  background: var(--panel);
  box-shadow: var(--shadow);
  min-height: 500px;
  overflow: hidden;
}

/* Step palette */
.wf-palette {
  padding: 12px;
  border-right: 2px solid var(--line);
  background: rgba(255, 255, 255, 0.8);
  overflow-y: auto;
}
.wf-palette__title {
  font-weight: 900;
  font-size: 13px;
  margin-bottom: 2px;
}
.wf-palette__hint {
  margin-bottom: 10px;
}
.wf-palette__list {
  display: grid;
  gap: 6px;
}
.wf-palette__item {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border: 2px solid var(--line-soft);
  border-radius: var(--r-sm);
  background: var(--panel);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: border-color 0.15s;
}
.wf-palette__item:hover {
  border-color: var(--line);
  box-shadow: var(--shadow);
}
.wf-palette__item-name {
  font-weight: 800;
  font-size: 12px;
}
.wf-palette__item-desc {
  font-size: 11px;
  color: var(--muted);
}

/* Node type icons */
.wf-node-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--r-sm);
  border: 2px solid var(--line);
  font-size: 14px;
  flex-shrink: 0;
  background: #fff;
}
.wf-node-icon--action {
  border-color: var(--info);
}
.wf-node-icon--approval {
  border-color: var(--warn);
}
.wf-node-icon--condition {
  border-color: var(--muted);
  background: rgba(27, 27, 27, 0.04);
}
.wf-node-icon--notification {
  border-color: var(--info);
}
.wf-node-icon--agent {
  border-color: #7c3aed;
}
.wf-node-icon--start {
  border-color: var(--ok);
}
.wf-node-icon--end {
  border-color: var(--ok);
}

/* Canvas */
.wf-canvas {
  position: relative;
  padding: 24px;
  overflow: auto;
  background-image: radial-gradient(circle, rgba(27, 27, 27, 0.08) 1px, transparent 1px);
  background-size: 20px 20px;
}
.wf-canvas__controls {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 4px;
  z-index: 2;
}

/* Graph layout */
.wf-graph {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: max-content;
}
.wf-graph__row {
  display: flex;
  align-items: center;
  gap: 0;
}

/* Nodes */
.wf-node {
  flex-shrink: 0;
  min-width: 160px;
  max-width: 220px;
  padding: 10px;
  border-radius: var(--r-md);
  border: 2px solid var(--line);
  background: var(--panel);
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: outline 0.15s;
}
.wf-node:hover {
  outline: 2px solid rgba(10, 102, 255, 0.2);
  outline-offset: 2px;
}
.wf-node--selected {
  outline: 3px solid rgba(10, 102, 255, 0.35);
  outline-offset: 2px;
}
.wf-node__header {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 4px;
}
.wf-node__name {
  font-weight: 800;
  font-size: 12px;
}
.wf-node__meta {
  font-size: 11px;
  margin-bottom: 4px;
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
}
.wf-node__status {
  margin-top: 4px;
}

/* Node type borders */
.wf-node--action {
  border-left: 4px solid var(--info);
}
.wf-node--approval {
  border-left: 4px solid var(--warn);
}
.wf-node--condition {
  border-left: 4px solid var(--muted);
  border-radius: 2px;
  /* Subtle diamond shape hint with background */
  background: linear-gradient(135deg, var(--panel) 0%, rgba(27, 27, 27, 0.02) 100%);
}
.wf-node--notification {
  border-left: 4px solid var(--info);
}
.wf-node--agent {
  border-left: 4px solid #7c3aed;
}
.wf-node--start {
  border-left: 4px solid var(--ok);
}
.wf-node--end {
  border-left: 4px solid var(--ok);
}

/* Branch labels on condition nodes */
.wf-node__branches {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 10px;
  font-weight: 900;
}
.wf-branch-label {
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid var(--line-soft);
}
.wf-branch-label--yes {
  color: var(--ok);
  border-color: var(--ok);
}
.wf-branch-label--no {
  color: var(--muted);
}

/* Connectors */
.wf-connector {
  display: flex;
  align-items: center;
  min-width: 40px;
  flex-shrink: 0;
}
.wf-connector__line {
  flex: 1;
  height: 2px;
  background: var(--line);
  min-width: 20px;
}
.wf-connector__arrow {
  font-size: 16px;
  font-weight: 900;
  color: var(--line);
  line-height: 1;
  margin-left: -4px;
}

/* Vertical connectors for branches */
.wf-connector--vertical {
  flex-direction: column;
  min-width: auto;
  min-height: 20px;
  width: 2px;
  margin-left: 40px;
}
.wf-connector__line--vertical {
  width: 2px;
  height: 20px;
  min-width: 2px;
  min-height: 20px;
  background: var(--line);
}

/* Branch layout */
.wf-graph__branches {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: 40px;
}
.wf-graph__branch {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wf-graph__branch--yes {
  border-left: 2px solid var(--ok);
  padding-left: 12px;
  margin-left: 20px;
}
.wf-graph__branch--no {
  border-left: 2px dashed var(--muted);
  padding-left: 12px;
  margin-left: 20px;
}

/* Config panel */
.wf-config {
  padding: 14px;
  border-left: 2px solid var(--line);
  background: rgba(255, 255, 255, 0.9);
  overflow-y: auto;
}
.wf-config__title {
  font-weight: 950;
  font-size: 15px;
}
.wf-config__subtitle {
  font-size: 12px;
}

/* Responsive: collapse palette and config on small screens */
@media (max-width: 980px) {
  .wf-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
  .wf-palette {
    border-right: none;
    border-bottom: 2px solid var(--line);
  }
  .wf-palette__list {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
  .wf-config {
    border-left: none;
    border-top: 2px solid var(--line);
  }
}
```

### JS Behavior

```javascript
/* ============================================================
   WORKFLOW BUILDER
   ============================================================ */

// Node selection
document.addEventListener('click', (e) => {
  const node = e.target.closest('.wf-node');
  if (!node) return;

  // Deselect all
  for (const n of qsa('.wf-node')) {
    n.classList.remove('wf-node--selected');
  }
  // Select clicked
  node.classList.add('wf-node--selected');

  // Show config panel for the selected node
  const configPanel = document.getElementById('wfConfig');
  if (configPanel) {
    const nodeName = node.querySelector('.wf-node__name')?.textContent || 'Step';
    const configTitle = configPanel.querySelector('.wf-config__title');
    const configSubtitle = configPanel.querySelector('.wf-config__subtitle');
    if (configTitle) configTitle.textContent = nodeName;
    if (configSubtitle)
      configSubtitle.textContent = 'Configure step: ' + (node.dataset.nodeId || '');
  }
});

// Register the new screen in the SCREENS array and parentMap
// SCREENS.push('workflow-builder');
// (In the static prototype, add 'workflow-builder' to the SCREENS constant)
```

### Navigation Integration

- Add to SCREENS array: `'workflow-builder'`
- Add sidebar nav item: `<a class="nav__item" href="#workflow-builder">Workflow Builder</a>` (positioned after "Runs" in the nav)
- No parentMap entry needed (it is a top-level screen)
- Add to Quick Actions for Operator persona: could replace or supplement "Start workflow"

### HCI Rationale

1. **Spatial cognition:** Node graphs leverage our spatial reasoning to understand sequence, branching, and parallelism at a glance. This is far superior to a flat list of steps for understanding workflow structure.

2. **Direct manipulation (Shneiderman):** Clicking nodes to select and configure them provides the feel of directly manipulating the workflow, even in a lo-fi prototype without drag-and-drop.

3. **Overview + detail:** The canvas provides the overview (full workflow structure), while the config panel provides detail for the selected node. This split prevents modal dialogs and keeps context visible.

4. **Consistency with domain primitives:** Each node type maps to a Portarium concept (Action, Approval Gate, Condition, Notification, Agent Task) and uses the same badges (tier, SoD, idem) as other screens. Users build vocabulary once.

5. **Color-coded left borders:** The 4px left border per node type creates rapid visual scanning without requiring users to read every label. Approval Gates (amber) stand out as friction points; Actions (blue) read as execution; Conditions (grey) read as decision points.

6. **Progressive complexity:** The canvas starts simple (linear flow) and only introduces branches when a Condition node exists. This prevents overwhelming new users while supporting complex workflows.

---

## Concept 3: Agent Configuration Panel

### Interaction Description

The Agent Configuration panel provides a dedicated area for managing AI agents that participate in Portarium workflows. Agents can classify data, generate documents, analyze patterns, or perform other tasks delegated by workflow steps.

**User flow:**

1. User navigates to "Agents" (new sidebar entry under Settings, or top-level screen).
2. The screen shows a list of configured agents as cards. Each card shows: agent name, model/provider, status, and last activity.
3. Clicking an agent opens its configuration in a detail panel.
4. Configuration includes: model selection, capability toggles, permissions, prompt templates, and connection testing.
5. A "Usage" tab shows recent runs, success rate, and average response time.
6. An "Integrations" tab shows which workflows reference this agent and which steps use it.

### HTML Structure

```html
<!-- New screen: Agents -->
<section id="screen-agents" class="screen" data-screen="agents" aria-labelledby="h-agents">
  <div class="screen__header">
    <div>
      <h1 id="h-agents" class="h1">Agents</h1>
      <div class="subtle">AI agents participating in workflows</div>
    </div>
    <div class="screen__actions">
      <button class="btn btn--primary" type="button">Add agent</button>
    </div>
  </div>

  <div class="agent-layout">
    <!-- Agent list (left) -->
    <div class="agent-list">
      <!-- Agent card: active -->
      <article class="agent-card agent-card--selected" data-agent-id="claude-classify">
        <div class="agent-card__header">
          <span class="agent-card__provider agent-card__provider--claude">C</span>
          <div>
            <div class="agent-card__name">Invoice Classifier</div>
            <div class="agent-card__model subtle">Claude Sonnet 4.5</div>
          </div>
          <span class="status status--ok" style="font-size:10px; padding:2px 6px">Active</span>
        </div>
        <div class="agent-card__stats">
          <div class="agent-card__stat">
            <span class="agent-card__stat-value">142</span>
            <span class="agent-card__stat-label">runs (7d)</span>
          </div>
          <div class="agent-card__stat">
            <span class="agent-card__stat-value">96%</span>
            <span class="agent-card__stat-label">success</span>
          </div>
          <div class="agent-card__stat">
            <span class="agent-card__stat-value">1.2s</span>
            <span class="agent-card__stat-label">avg time</span>
          </div>
        </div>
      </article>

      <!-- Agent card: active -->
      <article class="agent-card" data-agent-id="openai-summarize">
        <div class="agent-card__header">
          <span class="agent-card__provider agent-card__provider--openai">O</span>
          <div>
            <div class="agent-card__name">Document Summarizer</div>
            <div class="agent-card__model subtle">GPT-4o</div>
          </div>
          <span class="status status--ok" style="font-size:10px; padding:2px 6px">Active</span>
        </div>
        <div class="agent-card__stats">
          <div class="agent-card__stat">
            <span class="agent-card__stat-value">58</span>
            <span class="agent-card__stat-label">runs (7d)</span>
          </div>
          <div class="agent-card__stat">
            <span class="agent-card__stat-value">91%</span>
            <span class="agent-card__stat-label">success</span>
          </div>
          <div class="agent-card__stat">
            <span class="agent-card__stat-value">3.4s</span>
            <span class="agent-card__stat-label">avg time</span>
          </div>
        </div>
      </article>

      <!-- Agent card: error -->
      <article class="agent-card" data-agent-id="custom-validator">
        <div class="agent-card__header">
          <span class="agent-card__provider agent-card__provider--custom">X</span>
          <div>
            <div class="agent-card__name">Policy Validator</div>
            <div class="agent-card__model subtle">Custom endpoint</div>
          </div>
          <span class="status status--danger" style="font-size:10px; padding:2px 6px">Error</span>
        </div>
        <div class="agent-card__stats">
          <div class="agent-card__stat">
            <span class="agent-card__stat-value">0</span>
            <span class="agent-card__stat-label">runs (7d)</span>
          </div>
          <div class="agent-card__stat">
            <span class="agent-card__stat-value">--</span>
            <span class="agent-card__stat-label">success</span>
          </div>
          <div class="agent-card__stat">
            <span class="agent-card__stat-value">--</span>
            <span class="agent-card__stat-label">avg time</span>
          </div>
        </div>
        <div class="agent-card__error">
          Connection failed: endpoint returned 502. Last checked 5m ago.
        </div>
      </article>

      <!-- Agent card: inactive -->
      <article class="agent-card" data-agent-id="claude-draft">
        <div class="agent-card__header">
          <span class="agent-card__provider agent-card__provider--claude">C</span>
          <div>
            <div class="agent-card__name">Draft Generator</div>
            <div class="agent-card__model subtle">Claude Haiku 4.5</div>
          </div>
          <span class="status" style="font-size:10px; padding:2px 6px">Inactive</span>
        </div>
        <div class="agent-card__stats">
          <div class="agent-card__stat">
            <span class="agent-card__stat-value">0</span>
            <span class="agent-card__stat-label">runs (7d)</span>
          </div>
          <div class="agent-card__stat">
            <span class="agent-card__stat-value">--</span>
            <span class="agent-card__stat-label">success</span>
          </div>
          <div class="agent-card__stat">
            <span class="agent-card__stat-value">--</span>
            <span class="agent-card__stat-label">avg time</span>
          </div>
        </div>
      </article>
    </div>

    <!-- Agent detail panel (right) -->
    <div class="agent-detail" id="agentDetail">
      <div class="agent-detail__header">
        <div>
          <h2 class="agent-detail__name">Invoice Classifier</h2>
          <div class="subtle">Agent: claude-classify</div>
        </div>
        <div style="display:flex; gap:6px">
          <button class="btn btn--small" type="button">Test connection</button>
          <button class="btn btn--small" type="button">Deactivate</button>
        </div>
      </div>

      <!-- Connection status banner -->
      <div class="integrity-banner integrity-banner--ok" style="margin:12px 0">
        Connection healthy. Last test: 2m ago (latency: 180ms).
      </div>

      <!-- Tabs -->
      <div class="tabs" role="tablist" aria-label="Agent tabs">
        <button class="tab tab--active" type="button" data-tab="agent-config">Configuration</button>
        <button class="tab" type="button" data-tab="agent-usage">Usage</button>
        <button class="tab" type="button" data-tab="agent-integrations">Integrations</button>
      </div>

      <div class="tabpanes" style="margin-top:10px">
        <!-- Config tab -->
        <div class="tabpane tabpane--active" data-pane="agent-config">
          <div class="form">
            <label class="field">
              <span class="field__label">Agent Name</span>
              <input class="field__input" type="text" value="Invoice Classifier" />
            </label>
            <label class="field">
              <span class="field__label">Provider</span>
              <select class="field__input">
                <option selected>Anthropic (Claude)</option>
                <option>OpenAI</option>
                <option>Custom endpoint</option>
              </select>
            </label>
            <label class="field">
              <span class="field__label">Model</span>
              <select class="field__input">
                <option>Claude Opus 4.6</option>
                <option selected>Claude Sonnet 4.5</option>
                <option>Claude Haiku 4.5</option>
              </select>
            </label>
            <label class="field">
              <span class="field__label">Temperature</span>
              <input class="field__input" type="number" value="0.1" min="0" max="2" step="0.1" />
            </label>
            <label class="field">
              <span class="field__label">Max Tokens</span>
              <input class="field__input" type="number" value="4096" min="1" max="200000" />
            </label>
          </div>

          <!-- Capabilities -->
          <div style="margin-top:16px">
            <div class="agent-section-title">Capabilities</div>
            <div class="agent-capabilities">
              <label class="agent-capability">
                <input type="checkbox" checked /> Read external records
              </label>
              <label class="agent-capability">
                <input type="checkbox" checked /> Classify / categorize
              </label>
              <label class="agent-capability">
                <input type="checkbox" /> Write external records
              </label>
              <label class="agent-capability"> <input type="checkbox" /> Generate documents </label>
              <label class="agent-capability">
                <input type="checkbox" checked /> Analyze data
              </label>
              <label class="agent-capability"> <input type="checkbox" /> Execute code </label>
            </div>
          </div>

          <!-- Permissions -->
          <div style="margin-top:16px">
            <div class="agent-section-title">Permissions</div>
            <div class="callout" style="margin-top:6px">
              This agent can access data from:
              <strong>FinanceAccounting</strong>, <strong>PaymentsBilling</strong>. It cannot write
              to any external system directly (writes require a workflow Action step).
            </div>
            <div class="chips" style="margin-top:8px">
              <span class="chip"><span class="port-icon">FA</span> FinanceAccounting (read)</span>
              <span class="chip"><span class="port-icon">PB</span> PaymentsBilling (read)</span>
            </div>
          </div>

          <!-- Prompt Template -->
          <div style="margin-top:16px">
            <div class="agent-section-title">Prompt Template</div>
            <label class="field" style="margin-top:6px">
              <span class="field__label">System prompt</span>
              <textarea class="field__input" rows="5">
You are an invoice classification agent for Portarium. Given an invoice record, classify each line item into the correct accounting category. Return a JSON array of {lineItemId, category, confidence}.</textarea
              >
            </label>
          </div>

          <div class="form__actions" style="margin-top:16px">
            <button class="btn btn--primary" type="button">Save changes</button>
            <button class="btn" type="button">Discard</button>
          </div>
        </div>

        <!-- Usage tab -->
        <div class="tabpane" data-pane="agent-usage">
          <div class="grid grid--3" style="margin-top:0">
            <div class="metric">
              <div class="metric__label">Total runs (7d)</div>
              <div class="metric__value">142</div>
            </div>
            <div class="metric">
              <div class="metric__label">Success rate</div>
              <div class="metric__value">96%</div>
            </div>
            <div class="metric">
              <div class="metric__label">Avg response time</div>
              <div class="metric__value">1.2s</div>
            </div>
          </div>

          <article class="card" style="margin-top:12px">
            <div class="card__title">Recent Runs</div>
            <div class="list">
              <div class="row row--static">
                <div class="row__main">
                  <div class="row__title">Classify: INV-22318 (12 line items)</div>
                  <div class="row__subtle">Run R-8920 | WI-1099 | 12m ago | 0.9s</div>
                </div>
                <div class="row__right">
                  <span class="status status--ok" style="font-size:10px; padding:2px 6px"
                    >Success</span
                  >
                </div>
              </div>
              <div class="row row--static">
                <div class="row__main">
                  <div class="row__title">Classify: INV-22305 (8 line items)</div>
                  <div class="row__subtle">Run R-8901 | WI-1088 | 2h ago | 1.1s</div>
                </div>
                <div class="row__right">
                  <span class="status status--ok" style="font-size:10px; padding:2px 6px"
                    >Success</span
                  >
                </div>
              </div>
              <div class="row row--static">
                <div class="row__main">
                  <div class="row__title">Classify: INV-22291 (3 line items)</div>
                  <div class="row__subtle">Run R-8889 | WI-1072 | 6h ago | 0.8s</div>
                </div>
                <div class="row__right">
                  <span class="status status--danger" style="font-size:10px; padding:2px 6px"
                    >Failed</span
                  >
                </div>
              </div>
            </div>
          </article>

          <article class="card" style="margin-top:12px">
            <div class="card__title">Performance (7-day trend)</div>
            <div class="card__meta subtle">Response time distribution</div>
            <!-- Lo-fi bar chart -->
            <div class="bars">
              <div class="bar">
                <span class="bar__label">Mon</span>
                <span class="bar__fill" style="width: 35%"></span>
              </div>
              <div class="bar">
                <span class="bar__label">Tue</span>
                <span class="bar__fill" style="width: 40%"></span>
              </div>
              <div class="bar">
                <span class="bar__label">Wed</span>
                <span class="bar__fill" style="width: 30%"></span>
              </div>
              <div class="bar">
                <span class="bar__label">Thu</span>
                <span class="bar__fill" style="width: 55%"></span>
              </div>
              <div class="bar">
                <span class="bar__label">Fri</span>
                <span class="bar__fill" style="width: 45%"></span>
              </div>
              <div class="bar">
                <span class="bar__label">Sat</span>
                <span class="bar__fill" style="width: 20%"></span>
              </div>
              <div class="bar">
                <span class="bar__label">Sun</span>
                <span class="bar__fill" style="width: 15%"></span>
              </div>
            </div>
          </article>
        </div>

        <!-- Integrations tab -->
        <div class="tabpane" data-pane="agent-integrations">
          <article class="card">
            <div class="card__title">Workflows using this agent</div>
            <div class="card__meta subtle">Steps that reference Invoice Classifier</div>
            <div class="list">
              <a class="row" href="#workflow-builder" style="text-decoration:none">
                <div class="row__main">
                  <div class="row__title">Invoice Correction Workflow</div>
                  <div class="row__subtle">Step: "Classify Line Items" (position 4 of 7)</div>
                </div>
                <div class="row__right">
                  <span class="status status--info" style="font-size:10px; padding:2px 6px"
                    >Active</span
                  >
                </div>
              </a>
              <a class="row" href="#workflow-builder" style="text-decoration:none">
                <div class="row__main">
                  <div class="row__title">Quarterly Audit Preparation</div>
                  <div class="row__subtle">Step: "Categorize Entries" (position 2 of 5)</div>
                </div>
                <div class="row__right">
                  <span class="status status--info" style="font-size:10px; padding:2px 6px"
                    >Active</span
                  >
                </div>
              </a>
              <div class="row row--static">
                <div class="row__main">
                  <div class="row__title">Vendor Payment Reconciliation</div>
                  <div class="row__subtle">Step: "Match Line Items" (position 3 of 6)</div>
                </div>
                <div class="row__right">
                  <span class="status" style="font-size:10px; padding:2px 6px">Draft</span>
                </div>
              </div>
            </div>
          </article>

          <div class="callout" style="margin-top:12px">
            Deactivating this agent will pause 2 active workflows at their next Agent Task step.
            Draft workflows will show a configuration warning.
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
```

### CSS Additions

```css
/* ============================================================
   AGENT CONFIGURATION PANEL
   ============================================================ */

/* Layout: list | detail */
.agent-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 0;
  border: 2px solid var(--line);
  border-radius: var(--r-md);
  background: var(--panel);
  box-shadow: var(--shadow);
  min-height: 500px;
  overflow: hidden;
}

/* Agent list */
.agent-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-right: 2px solid var(--line);
  background: rgba(255, 255, 255, 0.6);
  overflow-y: auto;
}

/* Agent card */
.agent-card {
  padding: 12px;
  border-bottom: 2px solid var(--line-soft);
  cursor: pointer;
  transition: background 0.15s;
}
.agent-card:hover {
  background: rgba(27, 27, 27, 0.03);
}
.agent-card--selected {
  background: rgba(10, 102, 255, 0.04);
  border-left: 4px solid var(--focus);
}

.agent-card__header {
  display: flex;
  gap: 8px;
  align-items: center;
}
.agent-card__provider {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--r-sm);
  border: 2px solid var(--line);
  font-weight: 950;
  font-size: 14px;
  flex-shrink: 0;
  background: #fff;
}
.agent-card__provider--claude {
  border-color: #d97706;
  color: #d97706;
}
.agent-card__provider--openai {
  border-color: #059669;
  color: #059669;
}
.agent-card__provider--custom {
  border-color: var(--muted);
  color: var(--muted);
}
.agent-card__name {
  font-weight: 800;
  font-size: 13px;
}
.agent-card__model {
  font-size: 11px;
}

/* Inline stats */
.agent-card__stats {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--line-soft);
}
.agent-card__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.agent-card__stat-value {
  font-weight: 950;
  font-size: 14px;
}
.agent-card__stat-label {
  font-size: 10px;
  color: var(--muted);
  font-weight: 700;
}

/* Error state */
.agent-card__error {
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: var(--r-sm);
  border: 1px solid var(--danger);
  background: rgba(179, 38, 30, 0.04);
  font-size: 11px;
  color: var(--danger);
  font-weight: 700;
}

/* Detail panel */
.agent-detail {
  padding: 16px;
  overflow-y: auto;
}
.agent-detail__header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 12px;
}
.agent-detail__name {
  font-size: 18px;
  font-weight: 950;
  margin: 0;
}

/* Section titles within agent config */
.agent-section-title {
  font-weight: 900;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--muted);
  padding-bottom: 4px;
  border-bottom: 1px solid var(--line-soft);
}

/* Capability toggles */
.agent-capabilities {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 8px;
}
.agent-capability {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  border-radius: var(--r-sm);
  border: 1px solid var(--line-soft);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.agent-capability:hover {
  background: rgba(27, 27, 27, 0.03);
}
.agent-capability input[type='checkbox'] {
  accent-color: var(--ok);
}

/* Responsive: stack list and detail */
@media (max-width: 980px) {
  .agent-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  .agent-list {
    border-right: none;
    border-bottom: 2px solid var(--line);
    flex-direction: row;
    overflow-x: auto;
  }
  .agent-card {
    min-width: 260px;
    border-bottom: none;
    border-right: 2px solid var(--line-soft);
  }
  .agent-card--selected {
    border-left: none;
    border-bottom: 4px solid var(--focus);
  }
}
```

### JS Behavior

```javascript
/* ============================================================
   AGENT CONFIGURATION PANEL
   ============================================================ */

// Agent card selection
document.addEventListener('click', (e) => {
  const card = e.target.closest('.agent-card');
  if (!card) return;

  // Deselect all
  for (const c of qsa('.agent-card')) {
    c.classList.remove('agent-card--selected');
  }
  // Select clicked
  card.classList.add('agent-card--selected');

  // Update detail panel header
  const detailPanel = document.getElementById('agentDetail');
  if (detailPanel) {
    const name = card.querySelector('.agent-card__name')?.textContent || 'Agent';
    const model = card.querySelector('.agent-card__model')?.textContent || '';
    const detailName = detailPanel.querySelector('.agent-detail__name');
    if (detailName) detailName.textContent = name;

    // Update connection status based on agent status
    const statusEl = card.querySelector('.status');
    const banner = detailPanel.querySelector('.integrity-banner');
    if (banner && statusEl) {
      const text = statusEl.textContent.trim();
      if (text === 'Error') {
        banner.className = 'integrity-banner integrity-banner--danger';
        banner.textContent = 'Connection failed. Click "Test connection" to retry.';
      } else if (text === 'Inactive') {
        banner.className = 'integrity-banner integrity-banner--warn';
        banner.textContent = 'Agent is inactive. Activate to use in workflows.';
      } else {
        banner.className = 'integrity-banner integrity-banner--ok';
        banner.textContent = 'Connection healthy. Last test: 2m ago (latency: 180ms).';
      }
    }
  }
});

// Register the new screen
// SCREENS.push('agents');
// Add to sidebar: <a class="nav__item" href="#agents">Agents</a>
```

### Navigation Integration

- Add to SCREENS array: `'agents'`
- Add sidebar nav item: `<a class="nav__item" href="#agents">Agents</a>` (positioned after "Settings" or under a new "Configuration" section title)
- Admin persona quick action could link to Agents
- The Workflow Builder's Agent Task nodes should link to this screen for configuration
- Add to parentMap if needed (agents is top-level, no parent mapping required)

### HCI Rationale

1. **List-detail pattern (master-detail):** The left list / right detail layout is one of the most established and learnable patterns in productivity software. Users instantly understand "select on left, edit on right" without instruction.

2. **Status at a glance:** The agent cards show status (Active/Error/Inactive) with color-coded badges, plus three key metrics (runs, success rate, response time). This lets operators quickly identify which agents need attention without opening each one.

3. **Error visibility:** The error state on the Policy Validator card is visually prominent (red border, inline error message). This follows Nielsen's heuristic of visibility of system status -- errors should not be hidden behind a "details" click.

4. **Impact awareness:** The Integrations tab shows which workflows use the agent, and the deactivation callout warns about downstream effects. This prevents the "I changed a setting and broke 3 workflows" scenario by making blast radius visible before the action.

5. **Capability toggles as checkboxes:** Binary capabilities (read, write, classify, etc.) are presented as a 2-column checkbox grid rather than a complex permissions matrix. This is appropriate for the lo-fi stage and communicates the concept clearly.

6. **Connection testing feedback:** The "Test connection" button with an integrity banner provides immediate, in-context feedback. The latency metric helps operators distinguish between "working" and "working but slow."

---

## Integration Summary

### Sidebar Navigation (updated)

```html
<nav class="nav" aria-label="Main navigation">
  <a class="nav__item" href="#inbox">Inbox</a>
  <a class="nav__item" href="#project">Project Overview</a>
  <a class="nav__item" href="#work-items">Work Items</a>
  <a class="nav__item" href="#runs">Runs</a>
  <a class="nav__item" href="#workflow-builder">Workflow Builder</a>
  <a class="nav__item" href="#approvals">Approvals</a>
  <a class="nav__item" href="#evidence">Evidence</a>
  <a class="nav__item" href="#agents">Agents</a>
  <a class="nav__item" href="#settings">Settings</a>
</nav>
```

### SCREENS Array (updated)

```javascript
const SCREENS = [
  'inbox',
  'project',
  'work-items',
  'runs',
  'workflow-builder',
  'work-item',
  'run',
  'approvals',
  'evidence',
  'agents',
  'settings',
];
```

### Tab Binding

The new screens use the same `data-tab` / `data-pane` pattern as existing screens, so the existing `bindTabs()` function will work if called after new content is added. However, `bindTabs()` currently binds all `.tab` elements globally, which would conflict with multiple tab sets on different screens. The implementation task should update `bindTabs()` to scope tabs within their parent container:

```javascript
function bindTabs() {
  const tabContainers = qsa('.tabs');
  for (const container of tabContainers) {
    const parent = container.closest('.screen') || container.closest('.agent-detail') || document;
    const tabs = qsa('.tab', container);
    const panes = qsa('.tabpane', parent);

    function setTab(tabId) {
      for (const t of tabs) t.classList.toggle('tab--active', t.dataset.tab === tabId);
      for (const p of panes) p.classList.toggle('tabpane--active', p.dataset.pane === tabId);
    }

    for (const t of tabs) {
      t.addEventListener('click', () => setTab(t.dataset.tab));
    }
  }
}
```

### Cross-References Between Concepts

| From                             | To               | Link                                                    |
| -------------------------------- | ---------------- | ------------------------------------------------------- |
| Workflow Builder Agent Task node | Agents screen    | Click node -> "Configure agent" link in config panel    |
| Agents Integrations tab          | Workflow Builder | Click workflow name to navigate to builder              |
| Approval Triage card             | Run Detail       | "View full run" link preserved                          |
| Sidebar Quick Actions (Approver) | Approval Triage  | "Review approvals" links to #approvals with triage mode |
