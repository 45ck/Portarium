# A/B Layout Variant Toggle -- Design Specification

> **Date:** 2026-02-17
> **Status:** Ready for integration
> **Screens with variants:** Inbox, Project Overview, Work Items, Approvals

---

## 1. Toggle Component

### 1.1 HTML (injected per-screen by JS)

```html
<!-- Floating toggle pill, injected into each screen that has variants -->
<button
  class="ab-toggle"
  type="button"
  aria-label="Switch layout variant"
  data-screen="inbox"
  title="Switch layout variant"
>
  <span class="ab-toggle__track">
    <span class="ab-toggle__label ab-toggle__label--active">A</span>
    <span class="ab-toggle__divider">|</span>
    <span class="ab-toggle__label">B</span>
  </span>
</button>
```

### 1.2 CSS

Add to `wireframe.css` (or a new `ab-toggle.css` loaded after it):

```css
/* ============================================================
   A/B LAYOUT VARIANT TOGGLE
   ============================================================ */

/* ---- Toggle pill ---- */
.ab-toggle {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: 2px solid var(--line);
  border-radius: 999px;
  background: var(--panel);
  box-shadow: var(--shadow);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 900;
  transition:
    box-shadow 0.15s ease,
    transform 0.15s ease;
  user-select: none;
}

.ab-toggle:hover {
  box-shadow: 0 4px 0 rgba(27, 27, 27, 0.22);
}

.ab-toggle:active {
  transform: translateY(1px);
  box-shadow: 0 2px 0 rgba(27, 27, 27, 0.12);
}

.ab-toggle:focus-visible {
  outline: 3px solid rgba(10, 102, 255, 0.35);
  outline-offset: 2px;
}

/* ---- Track (the row of labels) ---- */
.ab-toggle__track {
  display: inline-flex;
  align-items: center;
  gap: 0;
}

/* ---- Individual variant labels ---- */
.ab-toggle__label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  padding: 5px 8px;
  color: var(--muted);
  transition:
    color 0.15s ease,
    background 0.15s ease;
  border-radius: 999px;
}

.ab-toggle__label--active {
  color: var(--ink);
  background: rgba(27, 27, 27, 0.08);
}

/* ---- Divider between labels ---- */
.ab-toggle__divider {
  color: var(--line-soft);
  font-weight: 400;
  padding: 0 1px;
}

/* ---- Pulse animation on toggle ---- */
@keyframes ab-toggle-pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
}

.ab-toggle--animating {
  animation: ab-toggle-pulse 0.25s ease;
}

/* ---- Variant content wrappers ---- */
.ab-variant {
  display: none;
}

.ab-variant.ab-variant--active {
  display: block;
}

/* ---- Fade transition for variant swap ---- */
@keyframes ab-variant-fadein {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ab-variant--entering {
  animation: ab-variant-fadein 0.2s ease;
}

/* ============================================================
   VARIANT-SPECIFIC: KANBAN BOARD (Work Items B)
   ============================================================ */
.kanban {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.kanban__column {
  min-height: 200px;
  padding: 10px;
  border-radius: var(--r-md);
  border: 2px solid var(--line);
  background: var(--panel);
  box-shadow: var(--shadow);
}

.kanban__column-title {
  font-weight: 950;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--muted);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--line-soft);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kanban__column-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  border: 2px solid var(--line-soft);
  font-size: 11px;
  font-weight: 900;
  background: rgba(255, 255, 255, 0.8);
}

.kanban__card {
  padding: 10px;
  border-radius: var(--r-md);
  border: 2px solid var(--line-soft);
  background: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;
  text-decoration: none;
  display: block;
  color: inherit;
}

.kanban__card:hover {
  border-color: rgba(27, 27, 27, 0.35);
}

.kanban__card-title {
  font-weight: 700;
  font-size: 13px;
}

.kanban__card-meta {
  color: var(--muted);
  font-size: 12px;
  margin-top: 4px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

@media (max-width: 980px) {
  .kanban {
    grid-template-columns: 1fr;
  }
}

/* ============================================================
   VARIANT-SPECIFIC: TRIAGE QUEUE (Approvals B)
   ============================================================ */
.triage {
  max-width: 640px;
  margin: 12px auto 0;
}

.triage__card {
  padding: 16px;
  border-radius: var(--r-md);
  border: 2px solid var(--line);
  background: var(--panel);
  box-shadow: var(--shadow);
}

.triage__card-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 12px;
  margin-bottom: 12px;
}

.triage__card-title {
  font-weight: 900;
  font-size: 16px;
}

.triage__card-meta {
  color: var(--muted);
  font-size: 12px;
  margin-top: 4px;
}

.triage__card-body {
  margin-top: 12px;
}

.triage__actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 2px solid var(--line-soft);
}

.triage__actions .btn {
  flex: 1;
  justify-content: center;
}

.triage__progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}

.triage__progress-bar {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  border: 2px solid var(--line-soft);
  background: rgba(255, 255, 255, 0.8);
  overflow: hidden;
}

.triage__progress-fill {
  height: 100%;
  background: var(--ink);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.triage__nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.triage__nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--r-md);
  border: 2px solid var(--line);
  background: var(--panel);
  box-shadow: var(--shadow);
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  font-family: inherit;
}

.triage__nav-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.triage__nav-btn:focus-visible {
  outline: 3px solid rgba(10, 102, 255, 0.35);
  outline-offset: 2px;
}

/* ============================================================
   VARIANT-SPECIFIC: DASHBOARD (Project Overview B)
   ============================================================ */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

@media (max-width: 980px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

.sparkline {
  display: flex;
  align-items: end;
  gap: 3px;
  height: 40px;
  margin-top: 8px;
}

.sparkline__bar {
  flex: 1;
  border-radius: 2px 2px 0 0;
  border: 1px solid var(--line-soft);
  background: rgba(27, 27, 27, 0.08);
  min-width: 4px;
  transition: height 0.2s ease;
}

.sparkline__bar--accent {
  background: rgba(37, 87, 167, 0.25);
  border-color: var(--info);
}

.heatmap {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
}

.heatmap__cell {
  padding: 8px;
  border-radius: var(--r-sm);
  border: 2px solid var(--line-soft);
  text-align: center;
  font-size: 11px;
  font-weight: 700;
}

.heatmap__cell--low {
  background: rgba(31, 122, 54, 0.08);
  border-color: rgba(31, 122, 54, 0.3);
}

.heatmap__cell--medium {
  background: rgba(164, 107, 0, 0.08);
  border-color: rgba(164, 107, 0, 0.3);
}

.heatmap__cell--high {
  background: rgba(179, 38, 30, 0.08);
  border-color: rgba(179, 38, 30, 0.3);
}

.heatmap__cell--none {
  background: rgba(27, 27, 27, 0.03);
}

.heatmap__cell-value {
  font-size: 18px;
  font-weight: 950;
  display: block;
}

.heatmap__cell-label {
  font-size: 10px;
  color: var(--muted);
  margin-top: 2px;
  display: block;
}

/* ============================================================
   VARIANT-SPECIFIC: PRIORITY MATRIX (Inbox B)
   ============================================================ */
.priority-matrix {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 12px;
  margin-top: 12px;
}

.priority-matrix__quadrant {
  padding: 12px;
  border-radius: var(--r-md);
  border: 2px solid var(--line);
  background: var(--panel);
  box-shadow: var(--shadow);
  min-height: 140px;
}

.priority-matrix__quadrant-title {
  font-weight: 950;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--line-soft);
}

.priority-matrix__quadrant--ui {
  border-color: var(--danger);
}

.priority-matrix__quadrant--ui .priority-matrix__quadrant-title {
  color: var(--danger);
}

.priority-matrix__quadrant--uni {
  border-color: var(--warn);
}

.priority-matrix__quadrant--uni .priority-matrix__quadrant-title {
  color: var(--warn);
}

.priority-matrix__quadrant--nui {
  border-color: var(--info);
}

.priority-matrix__quadrant--nui .priority-matrix__quadrant-title {
  color: var(--info);
}

.priority-matrix__quadrant--nuni {
  border-color: var(--line-soft);
}

.priority-matrix__quadrant--nuni .priority-matrix__quadrant-title {
  color: var(--muted);
}

@media (max-width: 980px) {
  .priority-matrix {
    grid-template-columns: 1fr;
  }
}
```

### 1.3 JS Controller (`ABToggle`)

Add to `wireframe.js` (or a separate `ab-toggle.js` loaded before `wireframe.js`'s `main()`):

```js
/* ============================================================
   A/B LAYOUT VARIANT TOGGLE CONTROLLER
   ============================================================ */
const ABToggle = (function () {
  'use strict';

  const AB_STORAGE_KEY = 'portarium_ab_variants';

  /**
   * Registry of screens that have variants.
   * Each entry maps screenId -> { variants: ['A','B',...], renderA, renderB, ... }
   * Renderers are registered by calling ABToggle.register().
   */
  const registry = {};

  /** Read persisted variant selections from sessionStorage */
  function loadState() {
    try {
      const raw = sessionStorage.getItem(AB_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  /** Persist variant selections to sessionStorage */
  function saveState(state) {
    sessionStorage.setItem(AB_STORAGE_KEY, JSON.stringify(state));
  }

  /** Get current variant for a screen, defaulting to 'A' */
  function getVariant(screenId) {
    const state = loadState();
    return state[screenId] || 'A';
  }

  /** Set the variant for a screen */
  function setVariant(screenId, variant) {
    const state = loadState();
    state[screenId] = variant;
    saveState(state);
  }

  /**
   * Register a screen with A/B variants.
   *
   * @param {string}   screenId  - matches data-screen attribute (e.g. 'inbox')
   * @param {string[]} variants  - e.g. ['A', 'B'] or ['A', 'B', 'C']
   * @param {Object}   renderers - keyed by variant letter, each is a function(screenEl)
   */
  function register(screenId, variants, renderers) {
    registry[screenId] = { variants, renderers };
  }

  /**
   * Inject toggle buttons into all registered screens.
   * Call this once after all register() calls and after DOM is ready.
   */
  function injectToggles() {
    for (const [screenId, config] of Object.entries(registry)) {
      const screenEl = document.querySelector(`[data-screen="${screenId}"]`);
      if (!screenEl) continue;

      // Ensure screen header is position-relative for absolute toggle placement
      const header = screenEl.querySelector('.screen__header');
      if (header) header.style.position = 'relative';

      // Create toggle button
      const btn = document.createElement('button');
      btn.className = 'ab-toggle';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Switch layout variant');
      btn.title = 'Switch layout variant';
      btn.dataset.screen = screenId;

      // Build track contents
      const track = document.createElement('span');
      track.className = 'ab-toggle__track';

      const currentVariant = getVariant(screenId);

      config.variants.forEach((v, i) => {
        if (i > 0) {
          const divider = document.createElement('span');
          divider.className = 'ab-toggle__divider';
          divider.textContent = '|';
          track.appendChild(divider);
        }
        const label = document.createElement('span');
        label.className = 'ab-toggle__label';
        label.dataset.variant = v;
        label.textContent = v;
        if (v === currentVariant) {
          label.classList.add('ab-toggle__label--active');
        }
        track.appendChild(label);
      });

      btn.appendChild(track);

      // Click handler: cycle through variants
      btn.addEventListener('click', function () {
        const current = getVariant(screenId);
        const idx = config.variants.indexOf(current);
        const next = config.variants[(idx + 1) % config.variants.length];

        setVariant(screenId, next);

        // Update toggle label highlights
        const labels = btn.querySelectorAll('.ab-toggle__label');
        labels.forEach((lbl) => {
          lbl.classList.toggle('ab-toggle__label--active', lbl.dataset.variant === next);
        });

        // Pulse animation
        btn.classList.remove('ab-toggle--animating');
        // Force reflow to restart animation
        void btn.offsetWidth;
        btn.classList.add('ab-toggle--animating');

        // Apply the variant renderer
        applyVariant(screenId);
      });

      // Insert toggle into the screen__header actions area
      const actionsEl = screenEl.querySelector('.screen__actions');
      if (actionsEl) {
        actionsEl.insertBefore(btn, actionsEl.firstChild);
      } else if (header) {
        header.appendChild(btn);
      }
    }
  }

  /**
   * Apply the current variant's renderer for a given screen.
   * Called on toggle click and also during render() to restore state.
   */
  function applyVariant(screenId) {
    const config = registry[screenId];
    if (!config) return;

    const screenEl = document.querySelector(`[data-screen="${screenId}"]`);
    if (!screenEl) return;

    const variant = getVariant(screenId);
    const renderer = config.renderers[variant];
    if (typeof renderer === 'function') {
      renderer(screenEl);
    }

    // Apply entering animation to the active variant container
    const activeWrapper = screenEl.querySelector('.ab-variant--active');
    if (activeWrapper) {
      activeWrapper.classList.remove('ab-variant--entering');
      void activeWrapper.offsetWidth;
      activeWrapper.classList.add('ab-variant--entering');
    }

    // Sync toggle button label highlights (for render-time calls)
    const btn = screenEl.querySelector('.ab-toggle');
    if (btn) {
      const labels = btn.querySelectorAll('.ab-toggle__label');
      labels.forEach((lbl) => {
        lbl.classList.toggle('ab-toggle__label--active', lbl.dataset.variant === variant);
      });
    }
  }

  /**
   * Apply all registered variant renderers (call during main render cycle).
   */
  function applyAll() {
    for (const screenId of Object.keys(registry)) {
      applyVariant(screenId);
    }
  }

  return {
    register,
    injectToggles,
    applyVariant,
    applyAll,
    getVariant,
    setVariant,
  };
})();
```

---

## 2. Per-Screen Variant HTML

### 2.1 Inbox -- Variant B: Priority Matrix

Replace the current Inbox grid content with two wrappers. The existing grid
markup becomes "Variant A" content; the priority matrix below becomes "Variant B".

**Variant B HTML** (inserted into `#screen-inbox` after the filters and next-action):

```html
<!-- Inbox Variant B: Priority Matrix -->
<div class="ab-variant" data-variant="B" data-variant-screen="inbox">
  <div class="priority-matrix js-nonempty-inbox">
    <!-- Quadrant: Urgent + Important -->
    <div class="priority-matrix__quadrant priority-matrix__quadrant--ui">
      <div class="priority-matrix__quadrant-title">Urgent + Important</div>
      <div class="list">
        <a class="row" href="#run">
          <div class="row__main">
            <div class="row__title">Run failed: CRM sync hit rate limit</div>
            <div class="row__subtle">
              WI-1021 | <span class="status status--danger">Failed</span>
              <span class="idem-badge idem-badge--safe">retry-safe</span>
            </div>
          </div>
        </a>
        <a class="row" href="#run">
          <div class="row__main">
            <div class="row__title">Approve Plan: Create Invoice in NetSuite</div>
            <div class="row__subtle">
              WI-1099 | R-8920 |
              <span class="tier-badge tier-badge--human">Human-approve</span>
            </div>
          </div>
        </a>
      </div>
    </div>

    <!-- Quadrant: Urgent + Not Important -->
    <div class="priority-matrix__quadrant priority-matrix__quadrant--uni">
      <div class="priority-matrix__quadrant-title">Urgent + Not Important</div>
      <div class="list">
        <a class="row" href="#run">
          <div class="row__main">
            <div class="row__title">Run blocked: missing provider scope</div>
            <div class="row__subtle">
              WI-1103 | <span class="status status--danger">Blocked</span>
            </div>
          </div>
        </a>
      </div>
    </div>

    <!-- Quadrant: Not Urgent + Important -->
    <div class="priority-matrix__quadrant priority-matrix__quadrant--nui">
      <div class="priority-matrix__quadrant-title">Not Urgent + Important</div>
      <div class="list">
        <a class="row" href="#run">
          <div class="row__main">
            <div class="row__title">Approve Plan: Update Ticket priority in Zendesk</div>
            <div class="row__subtle">
              WI-1042 | R-8892 |
              <span class="tier-badge tier-badge--human">Human-approve</span>
            </div>
          </div>
        </a>
        <div class="row row--static">
          <div class="row__main">
            <div class="row__title">SoD constraint: maker-checker required</div>
            <div class="row__subtle">Assign an approver or update policy.</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quadrant: Not Urgent + Not Important -->
    <div class="priority-matrix__quadrant priority-matrix__quadrant--nuni">
      <div class="priority-matrix__quadrant-title">Not Urgent + Not Important</div>
      <div class="subtle" style="padding: 8px 0;">No items in this quadrant.</div>
    </div>
  </div>
</div>
```

### 2.2 Work Items -- Variant B: Kanban Board

**Variant B HTML** (inserted into `#screen-work-items`):

```html
<!-- Work Items Variant B: Kanban Board -->
<div class="ab-variant" data-variant="B" data-variant-screen="work-items">
  <div class="kanban js-nonempty-workitems">
    <!-- Column: Open -->
    <div class="kanban__column">
      <div class="kanban__column-title">Open <span class="kanban__column-count">1</span></div>
      <a class="kanban__card" href="#work-item">
        <div class="kanban__card-title">WI-1013 Receipt export for audit period</div>
        <div class="kanban__card-meta">
          <span class="tier-badge tier-badge--auto">Auto</span>
          <span class="chip" style="font-size:11px; padding:3px 6px;">
            <span class="port-icon">PB</span> Stripe
          </span>
          <span class="chip" style="font-size:11px; padding:3px 6px;">
            <span class="port-icon">DM</span> Drive
          </span>
        </div>
      </a>
    </div>

    <!-- Column: In Progress -->
    <div class="kanban__column">
      <div class="kanban__column-title">
        In Progress <span class="kanban__column-count">1</span>
      </div>
      <a class="kanban__card" href="#work-item">
        <div class="kanban__card-title">WI-1042 Dispute: investigate payment failure</div>
        <div class="kanban__card-meta">
          <span class="tier-badge tier-badge--assisted">Assisted</span>
          <span class="status status--info" style="font-size:11px; padding:3px 6px;">Running</span>
        </div>
      </a>
    </div>

    <!-- Column: Blocked -->
    <div class="kanban__column">
      <div class="kanban__column-title">Blocked <span class="kanban__column-count">1</span></div>
      <a class="kanban__card" href="#work-item">
        <div class="kanban__card-title">WI-1099 Invoice correction for ACME</div>
        <div class="kanban__card-meta">
          <span class="tier-badge tier-badge--human">Human-approve</span>
          <span class="status status--warn" style="font-size:11px; padding:3px 6px;"
            >Needs approval</span
          >
          <span class="sod-badge" style="font-size:10px; padding:2px 6px;">SoD</span>
        </div>
      </a>
    </div>

    <!-- Column: Done -->
    <div class="kanban__column">
      <div class="kanban__column-title">Done <span class="kanban__column-count">1</span></div>
      <a class="kanban__card" href="#work-item">
        <div class="kanban__card-title">WI-1105 Sync Salesforce contacts</div>
        <div class="kanban__card-meta">
          <span class="tier-badge tier-badge--auto">Auto</span>
          <span class="status status--ok" style="font-size:11px; padding:3px 6px;">Completed</span>
          <span class="drift-badge">drift</span>
        </div>
      </a>
    </div>
  </div>
</div>
```

### 2.3 Approvals -- Variant B: Triage Queue

**Variant B HTML** (inserted into `#screen-approvals`):

```html
<!-- Approvals Variant B: Triage Queue -->
<div class="ab-variant" data-variant="B" data-variant-screen="approvals">
  <div class="triage">
    <div class="triage__progress">
      <span>1 of 2</span>
      <div class="triage__progress-bar">
        <div class="triage__progress-fill" style="width: 50%"></div>
      </div>
      <span>2 pending</span>
    </div>

    <div class="triage__card" data-triage-index="0">
      <div class="triage__card-header">
        <div>
          <div class="triage__card-title">Approve Plan: Create Invoice in NetSuite</div>
          <div class="triage__card-meta">
            <a href="#work-item">WI-1099</a> | <a href="#run">R-8920</a> | Requested 12m ago
          </div>
        </div>
        <div>
          <span class="tier-badge tier-badge--human">Human-approve</span>
          <span class="sod-badge" style="margin-left: 4px;">maker-checker</span>
        </div>
      </div>

      <div class="triage__card-body">
        <div class="effects">
          <div class="effects__section">
            <div class="effects__title">Planned Effects</div>
            <div class="effects__list">
              <div class="effect">
                <div class="effect__main">
                  <span class="pill">Update</span>
                  <span class="effect__target">NetSuite | Invoice | INV-22318</span>
                </div>
                <div class="effect__subtle">Update memo and line item classification.</div>
              </div>
              <div class="effect">
                <div class="effect__main">
                  <span class="pill">Create</span>
                  <span class="effect__target">Drive | Document | Receipt bundle</span>
                </div>
                <div class="effect__subtle">Create evidence artifact for audit trail.</div>
              </div>
            </div>
          </div>
        </div>

        <div class="callout callout--policy" style="margin-top: 10px;">
          Required approvers: 2 | Scopes: netsuite.write, drive.write
        </div>

        <label class="field" style="margin-top: 12px;">
          <span class="field__label">Rationale (required)</span>
          <textarea class="field__input" rows="3" placeholder="Explain your decision..."></textarea>
        </label>
      </div>

      <div class="triage__actions">
        <button class="btn btn--primary" type="button">Approve</button>
        <button class="btn" type="button">Deny</button>
        <button class="btn" type="button">Request changes</button>
      </div>
    </div>

    <div class="triage__nav">
      <button class="triage__nav-btn" type="button" disabled>Previous</button>
      <span class="subtle">1 / 2</span>
      <button class="triage__nav-btn" type="button">Next</button>
    </div>
  </div>
</div>
```

### 2.4 Project Overview -- Variant B: Dashboard with Sparklines + Heatmap

**Variant B HTML** (inserted into `#screen-project`):

```html
<!-- Project Overview Variant B: Dashboard -->
<div class="ab-variant" data-variant="B" data-variant-screen="project">
  <div class="dashboard-grid">
    <!-- Metric card with sparkline: Runs (7d) -->
    <div class="card">
      <div class="card__title">Runs (7d)</div>
      <div class="card__meta subtle">Completed vs Failed</div>
      <div class="metric__value" style="font-size:22px;">14 total</div>
      <div class="sparkline">
        <div class="sparkline__bar" style="height: 60%"></div>
        <div class="sparkline__bar" style="height: 80%"></div>
        <div class="sparkline__bar sparkline__bar--accent" style="height: 30%"></div>
        <div class="sparkline__bar" style="height: 100%"></div>
        <div class="sparkline__bar" style="height: 50%"></div>
        <div class="sparkline__bar sparkline__bar--accent" style="height: 20%"></div>
        <div class="sparkline__bar" style="height: 70%"></div>
      </div>
      <div class="subtle" style="margin-top: 6px; font-size: 11px;">
        Blue = failure | Gray = success
      </div>
    </div>

    <!-- Metric card with sparkline: Approval Throughput -->
    <div class="card">
      <div class="card__title">Approval Throughput (7d)</div>
      <div class="card__meta subtle">Decisions per day</div>
      <div class="metric__value" style="font-size:22px;">8 decided</div>
      <div class="sparkline">
        <div class="sparkline__bar" style="height: 40%"></div>
        <div class="sparkline__bar" style="height: 70%"></div>
        <div class="sparkline__bar" style="height: 50%"></div>
        <div class="sparkline__bar" style="height: 90%"></div>
        <div class="sparkline__bar" style="height: 30%"></div>
        <div class="sparkline__bar" style="height: 60%"></div>
        <div class="sparkline__bar" style="height: 80%"></div>
      </div>
      <div class="subtle" style="margin-top: 6px; font-size: 11px;">Avg latency: 22m</div>
    </div>

    <!-- Metric card with sparkline: Evidence Volume -->
    <div class="card">
      <div class="card__title">Evidence Volume (7d)</div>
      <div class="card__meta subtle">Entries recorded per day</div>
      <div class="metric__value" style="font-size:22px;">47 entries</div>
      <div class="sparkline">
        <div class="sparkline__bar" style="height: 50%"></div>
        <div class="sparkline__bar" style="height: 60%"></div>
        <div class="sparkline__bar" style="height: 90%"></div>
        <div class="sparkline__bar" style="height: 70%"></div>
        <div class="sparkline__bar" style="height: 100%"></div>
        <div class="sparkline__bar" style="height: 80%"></div>
        <div class="sparkline__bar" style="height: 65%"></div>
      </div>
      <div class="subtle" style="margin-top: 6px; font-size: 11px;">Chain: verified | No gaps</div>
    </div>
  </div>

  <!-- Risk Heatmap -->
  <article class="card" style="margin-top: 12px;">
    <div class="card__title">Risk Heatmap (by Port Family)</div>
    <div class="card__meta subtle">
      Color intensity = number of open issues (failures + blocks + policy violations)
    </div>
    <div class="heatmap">
      <div class="heatmap__cell heatmap__cell--high">
        <span class="heatmap__cell-value">3</span>
        <span class="heatmap__cell-label">CrmSales</span>
        <span class="subtle" style="font-size:10px;">No adapter</span>
      </div>
      <div class="heatmap__cell heatmap__cell--medium">
        <span class="heatmap__cell-value">2</span>
        <span class="heatmap__cell-label">FinanceAccounting</span>
        <span class="subtle" style="font-size:10px;">Cred expiring</span>
      </div>
      <div class="heatmap__cell heatmap__cell--low">
        <span class="heatmap__cell-value">0</span>
        <span class="heatmap__cell-label">PaymentsBilling</span>
        <span class="subtle" style="font-size:10px;">Healthy</span>
      </div>
      <div class="heatmap__cell heatmap__cell--low">
        <span class="heatmap__cell-value">0</span>
        <span class="heatmap__cell-label">CustomerSupport</span>
        <span class="subtle" style="font-size:10px;">Healthy</span>
      </div>
    </div>
  </article>

  <!-- Tier Distribution (carried over from Variant A but as a compact chart) -->
  <div class="grid grid--2" style="margin-top: 12px;">
    <article class="card">
      <div class="card__title">Tier Distribution</div>
      <div class="card__meta subtle">Effective execution tiers across all Work Items</div>
      <div class="bars">
        <div class="bar">
          <span class="bar__label">
            <span class="tier-badge tier-badge--auto">Auto</span>
          </span>
          <span class="bar__fill" style="width: 45%"></span>
        </div>
        <div class="bar">
          <span class="bar__label">
            <span class="tier-badge tier-badge--assisted">Assisted</span>
          </span>
          <span class="bar__fill" style="width: 30%"></span>
        </div>
        <div class="bar">
          <span class="bar__label">
            <span class="tier-badge tier-badge--human">Human</span>
          </span>
          <span class="bar__fill" style="width: 20%"></span>
        </div>
        <div class="bar">
          <span class="bar__label">
            <span class="tier-badge tier-badge--manual">Manual</span>
          </span>
          <span class="bar__fill" style="width: 5%"></span>
        </div>
      </div>
    </article>

    <article class="card">
      <div class="card__title">Quick Actions</div>
      <div class="card__meta subtle">Start common workflows/runbooks</div>
      <div class="list">
        <a class="row" href="#work-item">
          <div class="row__main">
            <div class="row__title">Start runbook: Invoice correction</div>
            <div class="row__subtle">
              <span class="tier-badge tier-badge--assisted">Assisted</span>
              Approval Gate likely
            </div>
          </div>
          <div class="row__right"><span class="status status--info">Runbook</span></div>
        </a>
        <a class="row" href="#work-item">
          <div class="row__main">
            <div class="row__title">Start workflow: Collect payment receipts</div>
            <div class="row__subtle">
              <span class="tier-badge tier-badge--auto">Auto</span>
              evidence payloads stored
            </div>
          </div>
          <div class="row__right"><span class="status status--info">Workflow</span></div>
        </a>
      </div>
    </article>
  </div>
</div>
```

---

## 3. Integration Guide

### Step-by-step wiring into the existing prototype:

#### 3.1 Add CSS

Append all CSS from Section 1.2 to the end of `wireframe.css`. This includes the
toggle component styles, the kanban classes, the triage queue classes, the dashboard/
sparkline/heatmap classes, and the priority matrix classes.

#### 3.2 Add the Variant HTML into index.html

For each screen that has variants, wrap the **existing content** (after
`.screen__header` and any shared filters) in an `ab-variant` wrapper with
`data-variant="A"`, then add the Variant B wrapper as a sibling.

**Inbox example** -- find the existing content between the filters/next-action
and the closing `</section>`, wrap it:

```html
<!-- Inside #screen-inbox, after the filters and next-action -->

<!-- Variant A (existing layout, wrapped) -->
<div class="ab-variant ab-variant--active" data-variant="A" data-variant-screen="inbox">
  <!-- ... move existing .grid.grid--2 blocks here ... -->
</div>

<!-- Variant B (priority matrix) -->
<div class="ab-variant" data-variant="B" data-variant-screen="inbox">
  <!-- ... paste Inbox Variant B HTML from Section 2.1 ... -->
</div>
```

Repeat the same wrapping pattern for:

- **Work Items:** wrap the `.table-wrap.js-nonempty-workitems` in `data-variant="A"`,
  add Kanban as `data-variant="B"`
- **Project Overview:** wrap the `.grid.grid--3` metrics and `.grid.grid--2` cards
  in `data-variant="A"`, add Dashboard as `data-variant="B"`
- **Approvals:** wrap the existing `.table-wrap` and inline plan review card in
  `data-variant="A"`, add Triage Queue as `data-variant="B"`

#### 3.3 Add the JS Controller

Add the `ABToggle` IIFE from Section 1.3 into `wireframe.js`, **before** the
`main()` function.

#### 3.4 Register Variants and Wire into main()

Add variant registrations and the `injectToggles()` call inside `main()`. Add
the `ABToggle.applyAll()` call inside the `render()` function.

**In `wireframe.js`, add after the ABToggle IIFE and before `main()`:**

```js
/* ============================================================
   A/B VARIANT REGISTRATIONS
   ============================================================ */

function showVariant(screenEl, variantLetter) {
  const wrappers = screenEl.querySelectorAll('.ab-variant');
  wrappers.forEach((w) => {
    const isTarget =
      w.dataset.variant === variantLetter && w.dataset.variantScreen === screenEl.dataset.screen;
    w.classList.toggle('ab-variant--active', isTarget);
  });
}

ABToggle.register('inbox', ['A', 'B'], {
  A: (el) => showVariant(el, 'A'),
  B: (el) => showVariant(el, 'B'),
});

ABToggle.register('work-items', ['A', 'B'], {
  A: (el) => showVariant(el, 'A'),
  B: (el) => showVariant(el, 'B'),
});

ABToggle.register('approvals', ['A', 'B'], {
  A: (el) => showVariant(el, 'A'),
  B: (el) => showVariant(el, 'B'),
});

ABToggle.register('project', ['A', 'B'], {
  A: (el) => showVariant(el, 'A'),
  B: (el) => showVariant(el, 'B'),
});
```

**In the existing `render()` function, add at the end:**

```js
function render(state) {
  applyBodyFlags(state);
  setBanners(state.systemState);
  setEmptyStates(state.systemState);
  setWorkspaceType(state.workspaceType);
  setPersona(state.persona);
  setStatusBar(state.systemState);
  activateScreen(getScreenFromHash());
  ABToggle.applyAll(); // <-- ADD THIS LINE
}
```

**In `main()`, add after `bindTabs()` and before `render(initial)`:**

```js
/* A/B Toggle */
ABToggle.injectToggles();
```

#### 3.5 Empty State Compatibility

The existing `setEmptyStates()` function targets `.js-nonempty-workitems` etc.
Since those classes are used in both variant A and B wrappers, the
show/hide logic continues to work correctly with no changes.

---

## 4. Interaction Details

### 4.1 Toggle Behavior

| Action              | Result                                                   |
| ------------------- | -------------------------------------------------------- |
| Click toggle        | Cycles A -> B (-> C if registered) -> A                  |
| Page reload         | Restores last-selected variant from `sessionStorage`     |
| Change persona      | Variant selection is preserved (orthogonal to persona)   |
| Change system state | Variant selection is preserved; empty states still apply |
| Navigate away/back  | Variant selection persists per-screen independently      |

### 4.2 Visual Design

- The toggle is an `A|B` pill button positioned at the right end of
  `.screen__actions`, appearing as the first button.
- Active variant letter has a subtle gray background highlight.
- On click, a brief scale pulse animation plays (0.25s).
- Variant content fades in with a 0.2s translateY animation.

### 4.3 Accessibility

- Toggle has `aria-label="Switch layout variant"` and `title` attribute.
- Focus-visible outline matches existing component focus styles.
- Variant wrappers use `display: none` vs `display: block` for screen
  reader compatibility (hidden variants are removed from tab order).
- Keyboard accessible (Space/Enter to toggle, Tab to reach).

### 4.4 Non-Interference

- Toggle uses `position: relative` on `.screen__header` (which is already
  flex layout). The button is inserted as a child of `.screen__actions`.
- Does not conflict with the existing persona/workspace/state controls
  in the topbar.
- Does not conflict with the drawer system.
- Uses `sessionStorage` (per-tab), not `localStorage`, to avoid
  polluting the existing `portarium_cockpit_v1` storage key.

---

## 5. Future Extensions

To add a new variant to any screen:

1. Add variant letter to the `ABToggle.register()` call's variants array.
2. Create the HTML wrapper with `data-variant="C"`.
3. Add a renderer for `C` in the renderers object.

To add A/B variants to a new screen (e.g., Evidence):

1. Call `ABToggle.register('evidence', ['A', 'B'], { A: ..., B: ... })`.
2. Wrap existing content in an `ab-variant` with `data-variant="A"`.
3. Add the new variant HTML as a sibling.

The system is fully extensible without modifying the core `ABToggle` controller.
