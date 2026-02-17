# Keyboard-First UX Design -- Portarium Cockpit

**Status:** Draft
**Date:** 2026-02-17
**Author:** Keyboard UX Agent

## 1. Design Principles

1. **No mouse required.** Every action reachable by keyboard alone.
2. **Progressive disclosure.** Casual users see hints; power users memorize and fly.
3. **No conflicts.** Shortcuts only fire when no text input is focused. Modifier combos (`Ctrl+K`) work everywhere.
4. **Composable chords.** `g` prefix for Go-To navigation mirrors Vim/GitHub convention.
5. **Escape always exits.** Close the topmost layer -- palette, cheatsheet, drawer, modal.
6. **Visual feedback.** Every shortcut press shows a transient toast in the status bar.

---

## 2. Shortcut Map

### 2.1 Global Shortcuts (work everywhere)

| Shortcut | Action | Category |
|---|---|---|
| `Ctrl+K` / `Cmd+K` | Open command palette | Global |
| `?` | Open keyboard cheatsheet | Global |
| `Escape` | Close topmost overlay (palette > cheatsheet > drawer > modal) | Global |
| `/` | Focus global search input | Global |
| `n` | New (context-sensitive: work item, run, etc.) | Action |

### 2.2 Go-To Navigation (g + key chord)

After pressing `g`, the system waits up to 800ms for the second key. A visual indicator appears in the status bar: `g...` while waiting.

| Chord | Destination | Screen |
|---|---|---|
| `g i` | Inbox | `#inbox` |
| `g p` | Project Overview | `#project` |
| `g w` | Work Items | `#work-items` |
| `g r` | Runs | `#runs` |
| `g b` | Workflow Builder | `#workflow-builder` |
| `g a` | Approvals | `#approvals` |
| `g e` | Evidence | `#evidence` |
| `g n` | Agents | `#agents` |
| `g s` | Settings | `#settings` |

### 2.3 List Navigation (active on list/table screens)

| Shortcut | Action |
|---|---|
| `j` | Move selection down |
| `k` | Move selection up |
| `Enter` | Open/navigate to selected item |
| `Backspace` | Go back (navigate to parent list screen) |
| `x` | Toggle select (for batch operations) |

### 2.4 Approval Triage (existing, extended)

These only fire when the triage view is active and no text input is focused.

| Shortcut | Action |
|---|---|
| `A` | Approve |
| `D` | Deny (opens rationale) |
| `R` | Request changes (opens rationale) |
| `S` | Skip |
| `Space` | Toggle card detail expansion |

### 2.5 Drawer Shortcuts

| Shortcut | Action |
|---|---|
| `c` | Open/toggle correlation context drawer |
| `Escape` | Close drawer |

---

## 3. Command Palette Specification

### 3.1 Behavior

- Opens with `Ctrl+K` / `Cmd+K` from anywhere.
- Modal overlay with backdrop. Traps focus.
- Text input with fuzzy search over a command registry.
- Results grouped by category: **Navigate**, **Action**, **Filter**, **Settings**.
- Recent commands shown when input is empty (max 5).
- Contextual commands from the current screen appear first.
- Arrow keys navigate results; `Enter` executes; `Escape` closes.
- Executing a command closes the palette and optionally shows a status bar toast.

### 3.2 Command Registry

```
COMMANDS = [
  // Navigation
  { id: 'nav-inbox',       label: 'Go to Inbox',             category: 'Navigate', keywords: 'inbox home notifications', action: () => goto('inbox'),       icon: '!' },
  { id: 'nav-project',     label: 'Go to Project Overview',  category: 'Navigate', keywords: 'project dashboard',        action: () => goto('project'),     icon: '#' },
  { id: 'nav-work-items',  label: 'Go to Work Items',        category: 'Navigate', keywords: 'work items list',          action: () => goto('work-items'),  icon: '=' },
  { id: 'nav-runs',        label: 'Go to Runs',              category: 'Navigate', keywords: 'runs executions',          action: () => goto('runs'),        icon: '>' },
  { id: 'nav-builder',     label: 'Go to Workflow Builder',  category: 'Navigate', keywords: 'workflow builder canvas',  action: () => goto('workflow-builder'), icon: '<>' },
  { id: 'nav-approvals',   label: 'Go to Approvals',         category: 'Navigate', keywords: 'approvals gates review',   action: () => goto('approvals'),   icon: 'V' },
  { id: 'nav-evidence',    label: 'Go to Evidence',          category: 'Navigate', keywords: 'evidence audit chain',     action: () => goto('evidence'),    icon: 'S' },
  { id: 'nav-agents',      label: 'Go to Agents',            category: 'Navigate', keywords: 'agents ai configuration',  action: () => goto('agents'),      icon: '*' },
  { id: 'nav-settings',    label: 'Go to Settings',          category: 'Navigate', keywords: 'settings workspace config', action: () => goto('settings'),   icon: '.' },

  // Actions
  { id: 'act-new-wi',      label: 'Create Work Item',        category: 'Action',   keywords: 'new create work item',     action: () => goto('work-item') },
  { id: 'act-start-wf',    label: 'Start Workflow',          category: 'Action',   keywords: 'start run workflow execute', action: () => goto('work-item') },
  { id: 'act-open-drawer',  label: 'Open Context Drawer',    category: 'Action',   keywords: 'context drawer correlation', action: () => openDrawer('context') },
  { id: 'act-close-drawer', label: 'Close Drawer',           category: 'Action',   keywords: 'close drawer',             action: () => closeDrawer() },
  { id: 'act-triage',      label: 'Start Approval Triage',   category: 'Action',   keywords: 'triage approve batch',     action: () => { goto('approvals'); /* trigger triage mode */ } },

  // Filters
  { id: 'flt-failed',      label: 'Filter: Failed runs',     category: 'Filter',   keywords: 'filter failed errors',     action: () => {} },
  { id: 'flt-pending',     label: 'Filter: Pending approvals', category: 'Filter', keywords: 'filter pending approvals', action: () => {} },
  { id: 'flt-assigned',    label: 'Filter: Assigned to me',  category: 'Filter',   keywords: 'filter assigned me',       action: () => {} },

  // Settings
  { id: 'set-persona',     label: 'Switch Persona',          category: 'Settings', keywords: 'persona operator approver auditor admin', action: () => {} },
  { id: 'set-workspace',   label: 'Switch Workspace Type',   category: 'Settings', keywords: 'workspace solo team',      action: () => {} },
]
```

### 3.3 Fuzzy Search Algorithm

Simple token-based fuzzy match:
1. Split query into tokens (space-separated).
2. For each command, build a search string: `label + ' ' + keywords + ' ' + category`.
3. Every token must appear as a substring (case-insensitive).
4. Score = sum of (position-based bonus: earlier match = higher score) + (label match bonus).
5. Sort by score descending, then alphabetically.

---

## 4. Keyboard Cheatsheet Specification

### 4.1 Behavior

- Opens with `?` from anywhere (except text inputs).
- Modal overlay, similar styling to command palette but wider.
- Grouped by category with two-column layout.
- Shows contextual shortcuts for the current screen at the top.
- Dismissible with `Escape` or clicking backdrop.

### 4.2 Categories

- **Navigation** -- go-to chords, back, search
- **Actions** -- new, triage, drawer
- **List Navigation** -- j/k/Enter/x
- **Triage** -- A/D/R/S/Space (shown only when on approvals screen)
- **Command Palette** -- Ctrl+K

---

## 5. Status Bar Integration

### 5.1 Shortcut Hint Area

Add a new `statusbar__item` at the right end of the status bar:

```
<span class="statusbar__item statusbar__kbd-hint js-kbd-hint">
  <kbd>Ctrl+K</kbd> Command palette
  <span class="statusbar__separator">|</span>
  <kbd>?</kbd> Shortcuts
</span>
```

### 5.2 Command Toast

When a command executes (via shortcut or palette), show a transient toast in the status bar:

```
<span class="statusbar__toast js-kbd-toast" hidden>
  Navigated to Inbox
</span>
```

Toast auto-hides after 2 seconds with a fade-out.

---

## 6. HTML Implementation

### 6.1 Command Palette Modal

Add this before `</body>` in `index.html`:

```html
<!-- ============================================================
     COMMAND PALETTE (Ctrl+K / Cmd+K)
     ============================================================ -->
<div class="cmd-palette-backdrop js-cmd-backdrop" hidden aria-hidden="true"></div>
<div class="cmd-palette" id="cmdPalette" role="dialog" aria-modal="true" aria-label="Command palette" hidden>
  <div class="cmd-palette__header">
    <input
      class="cmd-palette__input"
      id="cmdInput"
      type="text"
      placeholder="Type a command..."
      autocomplete="off"
      spellcheck="false"
      aria-label="Search commands"
    />
    <kbd class="cmd-palette__esc">Esc</kbd>
  </div>
  <div class="cmd-palette__body" id="cmdResults" role="listbox" aria-label="Command results">
    <!-- Results injected by JS -->
  </div>
  <div class="cmd-palette__footer">
    <span class="cmd-palette__hint"><kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate</span>
    <span class="cmd-palette__hint"><kbd>Enter</kbd> execute</span>
    <span class="cmd-palette__hint"><kbd>Esc</kbd> close</span>
  </div>
</div>
```

### 6.2 Keyboard Cheatsheet Modal

```html
<!-- ============================================================
     KEYBOARD CHEATSHEET (?)
     ============================================================ -->
<div class="kbd-cheatsheet-backdrop js-cheatsheet-backdrop" hidden aria-hidden="true"></div>
<div class="kbd-cheatsheet" id="kbdCheatsheet" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" hidden>
  <div class="kbd-cheatsheet__header">
    <h2 class="kbd-cheatsheet__title">Keyboard Shortcuts</h2>
    <button class="drawer__close js-cheatsheet-close" type="button" aria-label="Close">&times;</button>
  </div>
  <div class="kbd-cheatsheet__body">
    <div class="kbd-cheatsheet__context js-cheatsheet-context">
      <!-- Contextual shortcuts for current screen injected by JS -->
    </div>
    <div class="kbd-cheatsheet__grid">
      <div class="kbd-cheatsheet__group">
        <h3 class="kbd-cheatsheet__group-title">Navigation</h3>
        <div class="kbd-cheatsheet__list">
          <div class="kbd-cheatsheet__row"><kbd>g</kbd> then <kbd>i</kbd><span>Inbox</span></div>
          <div class="kbd-cheatsheet__row"><kbd>g</kbd> then <kbd>p</kbd><span>Project Overview</span></div>
          <div class="kbd-cheatsheet__row"><kbd>g</kbd> then <kbd>w</kbd><span>Work Items</span></div>
          <div class="kbd-cheatsheet__row"><kbd>g</kbd> then <kbd>r</kbd><span>Runs</span></div>
          <div class="kbd-cheatsheet__row"><kbd>g</kbd> then <kbd>b</kbd><span>Workflow Builder</span></div>
          <div class="kbd-cheatsheet__row"><kbd>g</kbd> then <kbd>a</kbd><span>Approvals</span></div>
          <div class="kbd-cheatsheet__row"><kbd>g</kbd> then <kbd>e</kbd><span>Evidence</span></div>
          <div class="kbd-cheatsheet__row"><kbd>g</kbd> then <kbd>n</kbd><span>Agents</span></div>
          <div class="kbd-cheatsheet__row"><kbd>g</kbd> then <kbd>s</kbd><span>Settings</span></div>
        </div>
      </div>
      <div class="kbd-cheatsheet__group">
        <h3 class="kbd-cheatsheet__group-title">Global</h3>
        <div class="kbd-cheatsheet__list">
          <div class="kbd-cheatsheet__row"><kbd>Ctrl+K</kbd><span>Command palette</span></div>
          <div class="kbd-cheatsheet__row"><kbd>/</kbd><span>Focus search</span></div>
          <div class="kbd-cheatsheet__row"><kbd>?</kbd><span>This cheatsheet</span></div>
          <div class="kbd-cheatsheet__row"><kbd>Esc</kbd><span>Close overlay / drawer</span></div>
          <div class="kbd-cheatsheet__row"><kbd>n</kbd><span>New (context-sensitive)</span></div>
          <div class="kbd-cheatsheet__row"><kbd>c</kbd><span>Toggle context drawer</span></div>
        </div>
      </div>
      <div class="kbd-cheatsheet__group">
        <h3 class="kbd-cheatsheet__group-title">Lists</h3>
        <div class="kbd-cheatsheet__list">
          <div class="kbd-cheatsheet__row"><kbd>j</kbd><span>Move down</span></div>
          <div class="kbd-cheatsheet__row"><kbd>k</kbd><span>Move up</span></div>
          <div class="kbd-cheatsheet__row"><kbd>Enter</kbd><span>Open selected</span></div>
          <div class="kbd-cheatsheet__row"><kbd>Backspace</kbd><span>Go back</span></div>
          <div class="kbd-cheatsheet__row"><kbd>x</kbd><span>Toggle select</span></div>
        </div>
      </div>
      <div class="kbd-cheatsheet__group">
        <h3 class="kbd-cheatsheet__group-title">Approval Triage</h3>
        <div class="kbd-cheatsheet__list">
          <div class="kbd-cheatsheet__row"><kbd>A</kbd><span>Approve</span></div>
          <div class="kbd-cheatsheet__row"><kbd>D</kbd><span>Deny</span></div>
          <div class="kbd-cheatsheet__row"><kbd>R</kbd><span>Request changes</span></div>
          <div class="kbd-cheatsheet__row"><kbd>S</kbd><span>Skip</span></div>
          <div class="kbd-cheatsheet__row"><kbd>Space</kbd><span>Expand / collapse</span></div>
        </div>
      </div>
    </div>
  </div>
</div>
```

### 6.3 Status Bar Additions

Add these items inside the existing `<footer class="statusbar">`:

```html
<span class="statusbar__item statusbar__toast js-kbd-toast" hidden></span>
<span class="statusbar__item statusbar__kbd-hint js-kbd-hint">
  <kbd class="triage__kbd">Ctrl+K</kbd> palette
  <span class="statusbar__sep">&middot;</span>
  <kbd class="triage__kbd">?</kbd> shortcuts
</span>
```

---

## 7. CSS Implementation

Add to `wireframe.css`:

```css
/* ============================================================
   COMMAND PALETTE
   ============================================================ */
.cmd-palette-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(27, 27, 27, 0.4);
  z-index: 90;
  animation: cmd-backdrop-in 0.15s ease;
}
@keyframes cmd-backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.cmd-palette {
  position: fixed;
  top: min(20%, 140px);
  left: 50%;
  transform: translateX(-50%);
  width: min(600px, calc(100vw - 32px));
  max-height: min(480px, 60vh);
  display: flex;
  flex-direction: column;
  border-radius: var(--r-md);
  border: 2px solid var(--line);
  background: var(--panel);
  box-shadow: 0 12px 40px rgba(27, 27, 27, 0.25);
  z-index: 100;
  animation: cmd-palette-in 0.15s ease;
  overflow: hidden;
}
@keyframes cmd-palette-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

.cmd-palette__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 2px solid var(--line);
}

.cmd-palette__input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 16px;
  font-family: inherit;
  font-weight: 600;
  background: transparent;
  color: var(--ink);
}
.cmd-palette__input::placeholder {
  color: var(--muted);
  font-weight: 400;
}

.cmd-palette__esc {
  flex: none;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--line-soft);
  background: rgba(27, 27, 27, 0.04);
  font-size: 11px;
  font-weight: 900;
  color: var(--muted);
  font-family: inherit;
}

.cmd-palette__body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}

.cmd-palette__category {
  padding: 8px 14px 4px;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
}

.cmd-palette__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  transition: background 0.08s;
}
.cmd-palette__item:hover,
.cmd-palette__item.is-selected {
  background: rgba(10, 102, 255, 0.06);
}
.cmd-palette__item.is-selected {
  outline: none;
  box-shadow: inset 3px 0 0 var(--focus);
}

.cmd-palette__item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid var(--line-soft);
  font-size: 12px;
  font-weight: 900;
  color: var(--muted);
  flex-shrink: 0;
  background: rgba(27, 27, 27, 0.03);
}

.cmd-palette__item-label {
  flex: 1;
  min-width: 0;
}
.cmd-palette__item-label mark {
  background: rgba(10, 102, 255, 0.15);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}

.cmd-palette__item-shortcut {
  flex: none;
  display: flex;
  gap: 3px;
}
.cmd-palette__item-shortcut kbd {
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--line-soft);
  background: rgba(27, 27, 27, 0.04);
  font-size: 11px;
  font-weight: 800;
  font-family: inherit;
  color: var(--muted);
}

.cmd-palette__empty {
  padding: 24px 14px;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}

.cmd-palette__footer {
  display: flex;
  gap: 16px;
  padding: 8px 14px;
  border-top: 1px solid var(--line-soft);
  font-size: 12px;
  color: var(--muted);
}
.cmd-palette__hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.cmd-palette__hint kbd {
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid var(--line-soft);
  background: rgba(27, 27, 27, 0.04);
  font-size: 10px;
  font-weight: 900;
  font-family: inherit;
}

/* ============================================================
   KEYBOARD CHEATSHEET
   ============================================================ */
.kbd-cheatsheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(27, 27, 27, 0.4);
  z-index: 90;
  animation: cmd-backdrop-in 0.15s ease;
}

.kbd-cheatsheet {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(720px, calc(100vw - 32px));
  max-height: min(560px, 80vh);
  display: flex;
  flex-direction: column;
  border-radius: var(--r-md);
  border: 2px solid var(--line);
  background: var(--panel);
  box-shadow: 0 12px 40px rgba(27, 27, 27, 0.25);
  z-index: 100;
  animation: cmd-palette-in 0.15s ease;
  overflow: hidden;
}

.kbd-cheatsheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 2px solid var(--line);
}

.kbd-cheatsheet__title {
  margin: 0;
  font-size: 16px;
  font-weight: 950;
}

.kbd-cheatsheet__body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.kbd-cheatsheet__context {
  margin-bottom: 16px;
  padding: 10px 12px;
  border-radius: var(--r-md);
  border: 2px solid var(--info);
  background: rgba(37, 87, 167, 0.04);
}
.kbd-cheatsheet__context:empty {
  display: none;
}
.kbd-cheatsheet__context-title {
  font-weight: 900;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--info);
  margin-bottom: 6px;
}

.kbd-cheatsheet__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 600px) {
  .kbd-cheatsheet__grid {
    grid-template-columns: 1fr;
  }
}

.kbd-cheatsheet__group-title {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line-soft);
}

.kbd-cheatsheet__list {
  display: grid;
  gap: 4px;
}

.kbd-cheatsheet__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
  font-weight: 600;
}
.kbd-cheatsheet__row kbd {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid var(--line-soft);
  background: rgba(27, 27, 27, 0.04);
  font-size: 11px;
  font-weight: 900;
  font-family: inherit;
  color: var(--muted);
  min-width: 22px;
  text-align: center;
}
.kbd-cheatsheet__row span {
  color: var(--muted);
  font-weight: 500;
}

/* ============================================================
   STATUS BAR KEYBOARD HINTS + TOAST
   ============================================================ */
.statusbar__kbd-hint {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.statusbar__sep {
  color: var(--line-soft);
}

.statusbar__toast {
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(10, 102, 255, 0.08);
  border: 1px solid rgba(10, 102, 255, 0.2);
  color: var(--info);
  font-weight: 700;
  font-size: 11px;
  animation: toast-in 0.2s ease;
}
@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.statusbar__toast--fading {
  animation: toast-out 0.3s ease forwards;
}
@keyframes toast-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}

/* ============================================================
   LIST KEYBOARD SELECTION (j/k navigation)
   ============================================================ */
.row.is-kbd-selected,
.kanban__card.is-kbd-selected,
tr.is-kbd-selected td {
  outline: 2px solid var(--focus);
  outline-offset: -2px;
  background: rgba(10, 102, 255, 0.04);
}

/* ============================================================
   GO-TO CHORD INDICATOR
   ============================================================ */
.statusbar__chord {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(164, 107, 0, 0.08);
  border: 1px solid rgba(164, 107, 0, 0.25);
  color: var(--warn);
  font-weight: 900;
  font-size: 11px;
  animation: toast-in 0.15s ease;
}
```

---

## 8. JavaScript Implementation

Add a new file `keyboard.js` loaded after `wireframe.js`, or append to `wireframe.js`.

```js
/* ============================================================
   Portarium Cockpit -- Keyboard-First UX Module
   ============================================================ */
const Keyboard = (function () {
  'use strict';

  /* ---- State ---- */
  let chordPending = null; // e.g. 'g'
  let chordTimer = null;
  let kbdSelectedIndex = -1;
  let toastTimer = null;
  const recentCommands = []; // max 5

  /* ---- Helpers ---- */
  function isInputFocused() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function isMac() {
    return navigator.platform.indexOf('Mac') > -1 || navigator.userAgent.indexOf('Mac') > -1;
  }

  function getActiveScreenId() {
    const active = document.querySelector('.screen.is-active');
    return active ? active.dataset.screen : 'inbox';
  }

  /* ---- Navigation ---- */
  function goto(screen) {
    location.hash = '#' + screen;
  }

  /* ---- Toast ---- */
  function showToast(message) {
    const el = document.querySelector('.js-kbd-toast');
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = message;
    el.hidden = false;
    el.classList.remove('statusbar__toast--fading');
    toastTimer = setTimeout(function () {
      el.classList.add('statusbar__toast--fading');
      setTimeout(function () {
        el.hidden = true;
        el.classList.remove('statusbar__toast--fading');
      }, 300);
    }, 2000);
  }

  /* ---- Chord indicator ---- */
  function showChord(key) {
    // Reuse toast area or create a separate chord indicator
    const hint = document.querySelector('.js-kbd-hint');
    if (!hint) return;
    let chord = hint.querySelector('.statusbar__chord');
    if (!chord) {
      chord = document.createElement('span');
      chord.className = 'statusbar__chord';
      hint.prepend(chord);
    }
    chord.textContent = key + '...';
    chord.hidden = false;
  }

  function hideChord() {
    const chord = document.querySelector('.statusbar__chord');
    if (chord) chord.hidden = true;
  }

  /* ============================================================
     COMMAND PALETTE
     ============================================================ */
  const COMMANDS = [
    // Navigate
    { id: 'nav-inbox',      label: 'Go to Inbox',             category: 'Navigate', keywords: 'inbox home notifications',  shortcut: 'g i',  icon: '!',  action: function () { goto('inbox'); } },
    { id: 'nav-project',    label: 'Go to Project Overview',  category: 'Navigate', keywords: 'project dashboard overview', shortcut: 'g p', icon: '#',  action: function () { goto('project'); } },
    { id: 'nav-work-items', label: 'Go to Work Items',        category: 'Navigate', keywords: 'work items list',           shortcut: 'g w',  icon: '\u2261', action: function () { goto('work-items'); } },
    { id: 'nav-runs',       label: 'Go to Runs',              category: 'Navigate', keywords: 'runs executions',           shortcut: 'g r',  icon: '\u203A', action: function () { goto('runs'); } },
    { id: 'nav-builder',    label: 'Go to Workflow Builder',  category: 'Navigate', keywords: 'workflow builder canvas',   shortcut: 'g b',  icon: '\u25CA', action: function () { goto('workflow-builder'); } },
    { id: 'nav-approvals',  label: 'Go to Approvals',         category: 'Navigate', keywords: 'approvals gates review',    shortcut: 'g a',  icon: '\u2713', action: function () { goto('approvals'); } },
    { id: 'nav-evidence',   label: 'Go to Evidence',          category: 'Navigate', keywords: 'evidence audit chain',      shortcut: 'g e',  icon: '\u00A7', action: function () { goto('evidence'); } },
    { id: 'nav-agents',     label: 'Go to Agents',            category: 'Navigate', keywords: 'agents ai configuration',   shortcut: 'g n',  icon: '\u2666', action: function () { goto('agents'); } },
    { id: 'nav-settings',   label: 'Go to Settings',          category: 'Navigate', keywords: 'settings workspace config', shortcut: 'g s',  icon: '\u2022', action: function () { goto('settings'); } },

    // Actions
    { id: 'act-new-wi',     label: 'Create Work Item',        category: 'Action',   keywords: 'new create work item',      shortcut: 'n',    action: function () { goto('work-item'); } },
    { id: 'act-start-wf',   label: 'Start Workflow',          category: 'Action',   keywords: 'start run workflow execute', action: function () { goto('work-item'); } },
    { id: 'act-drawer',     label: 'Toggle Context Drawer',   category: 'Action',   keywords: 'context drawer correlation', shortcut: 'c',    action: function () {
        var drawer = document.getElementById('drawer');
        if (drawer && drawer.classList.contains('is-open')) { closeDrawer(); } else { openDrawer('context'); }
      }
    },
    { id: 'act-triage',     label: 'Start Approval Triage',   category: 'Action',   keywords: 'triage approve batch swipe', action: function () {
        goto('approvals');
        setTimeout(function () {
          var btn = document.querySelector('.js-triage-mode[data-mode="triage"]');
          if (btn) btn.click();
        }, 100);
      }
    },

    // Filter
    { id: 'flt-failed',     label: 'Filter: Failed runs',      category: 'Filter',  keywords: 'filter failed errors danger', action: function () { showToast('Filter applied: Failed runs'); } },
    { id: 'flt-pending',    label: 'Filter: Pending approvals', category: 'Filter', keywords: 'filter pending approval gate', action: function () { showToast('Filter applied: Pending approvals'); } },
    { id: 'flt-assigned',   label: 'Filter: Assigned to me',   category: 'Filter',  keywords: 'filter assigned owner me',    action: function () { showToast('Filter applied: Assigned to me'); } },

    // Settings
    { id: 'set-persona',    label: 'Switch Persona',           category: 'Settings', keywords: 'persona operator approver auditor admin role', action: function () { document.getElementById('persona').focus(); } },
    { id: 'set-workspace',  label: 'Switch Workspace Type',    category: 'Settings', keywords: 'workspace solo team type',  action: function () { document.getElementById('workspaceType').focus(); } },
    { id: 'set-shortcuts',  label: 'Keyboard Shortcuts',       category: 'Settings', keywords: 'keyboard shortcuts help cheatsheet', shortcut: '?', action: function () { openCheatsheet(); } },
  ];

  let paletteOpen = false;
  let paletteSelectedIdx = 0;
  let filteredCommands = [];

  function openPalette() {
    var el = document.getElementById('cmdPalette');
    var backdrop = document.querySelector('.js-cmd-backdrop');
    if (!el || !backdrop) return;
    el.hidden = false;
    backdrop.hidden = false;
    paletteOpen = true;
    paletteSelectedIdx = 0;
    var input = document.getElementById('cmdInput');
    input.value = '';
    input.focus();
    renderPaletteResults('');
  }

  function closePalette() {
    var el = document.getElementById('cmdPalette');
    var backdrop = document.querySelector('.js-cmd-backdrop');
    if (!el || !backdrop) return;
    el.hidden = true;
    backdrop.hidden = true;
    paletteOpen = false;
  }

  function fuzzyMatch(query, commands) {
    if (!query.trim()) {
      // Show recents, then all
      var result = [];
      if (recentCommands.length > 0) {
        for (var i = 0; i < recentCommands.length; i++) {
          var cmd = commands.find(function (c) { return c.id === recentCommands[i]; });
          if (cmd) result.push({ cmd: cmd, score: 1000 - i, recent: true });
        }
      }
      for (var j = 0; j < commands.length; j++) {
        if (!result.find(function (r) { return r.cmd.id === commands[j].id; })) {
          result.push({ cmd: commands[j], score: 0, recent: false });
        }
      }
      return result;
    }

    var tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    var results = [];
    for (var k = 0; k < commands.length; k++) {
      var c = commands[k];
      var haystack = (c.label + ' ' + c.keywords + ' ' + c.category).toLowerCase();
      var allMatch = true;
      var score = 0;
      for (var t = 0; t < tokens.length; t++) {
        var pos = haystack.indexOf(tokens[t]);
        if (pos === -1) { allMatch = false; break; }
        score += (100 - pos); // earlier = better
        if (c.label.toLowerCase().indexOf(tokens[t]) > -1) score += 50; // label bonus
      }
      if (allMatch) results.push({ cmd: c, score: score, recent: false });
    }
    results.sort(function (a, b) { return b.score - a.score; });
    return results;
  }

  function renderPaletteResults(query) {
    var container = document.getElementById('cmdResults');
    if (!container) return;
    var matches = fuzzyMatch(query, COMMANDS);
    filteredCommands = matches.map(function (m) { return m.cmd; });
    container.innerHTML = '';

    if (filteredCommands.length === 0) {
      container.innerHTML = '<div class="cmd-palette__empty">No matching commands</div>';
      return;
    }

    // Group by category, but show recents first
    var hasRecents = matches.some(function (m) { return m.recent; });
    if (hasRecents && !query.trim()) {
      var catDiv = document.createElement('div');
      catDiv.className = 'cmd-palette__category';
      catDiv.textContent = 'Recent';
      container.appendChild(catDiv);
      matches.filter(function (m) { return m.recent; }).forEach(function (m, idx) {
        container.appendChild(createPaletteItem(m.cmd, idx));
      });
    }

    var currentCat = '';
    var globalIdx = hasRecents && !query.trim() ? matches.filter(function (m) { return m.recent; }).length : 0;
    var nonRecent = query.trim() ? matches : matches.filter(function (m) { return !m.recent; });
    for (var i = 0; i < nonRecent.length; i++) {
      var cat = nonRecent[i].cmd.category;
      if (cat !== currentCat) {
        currentCat = cat;
        var catEl = document.createElement('div');
        catEl.className = 'cmd-palette__category';
        catEl.textContent = cat;
        container.appendChild(catEl);
      }
      container.appendChild(createPaletteItem(nonRecent[i].cmd, globalIdx));
      globalIdx++;
    }

    paletteSelectedIdx = 0;
    updatePaletteSelection();
  }

  function createPaletteItem(cmd, idx) {
    var item = document.createElement('div');
    item.className = 'cmd-palette__item';
    item.dataset.idx = idx;
    item.setAttribute('role', 'option');

    if (cmd.icon) {
      var iconEl = document.createElement('span');
      iconEl.className = 'cmd-palette__item-icon';
      iconEl.textContent = cmd.icon;
      item.appendChild(iconEl);
    }

    var labelEl = document.createElement('span');
    labelEl.className = 'cmd-palette__item-label';
    labelEl.textContent = cmd.label;
    item.appendChild(labelEl);

    if (cmd.shortcut) {
      var shortcutEl = document.createElement('span');
      shortcutEl.className = 'cmd-palette__item-shortcut';
      cmd.shortcut.split(' ').forEach(function (k) {
        var kbd = document.createElement('kbd');
        kbd.textContent = k;
        shortcutEl.appendChild(kbd);
      });
      item.appendChild(shortcutEl);
    }

    item.addEventListener('click', function () {
      executePaletteCommand(cmd);
    });
    item.addEventListener('mouseenter', function () {
      paletteSelectedIdx = parseInt(item.dataset.idx, 10);
      updatePaletteSelection();
    });

    return item;
  }

  function updatePaletteSelection() {
    var items = document.querySelectorAll('.cmd-palette__item');
    items.forEach(function (el, i) {
      el.classList.toggle('is-selected', i === paletteSelectedIdx);
      if (i === paletteSelectedIdx) {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function executePaletteCommand(cmd) {
    closePalette();
    // Track recent
    var idx = recentCommands.indexOf(cmd.id);
    if (idx > -1) recentCommands.splice(idx, 1);
    recentCommands.unshift(cmd.id);
    if (recentCommands.length > 5) recentCommands.pop();

    cmd.action();
    showToast(cmd.label);
  }

  /* ============================================================
     KEYBOARD CHEATSHEET
     ============================================================ */
  let cheatsheetOpen = false;

  function openCheatsheet() {
    var el = document.getElementById('kbdCheatsheet');
    var backdrop = document.querySelector('.js-cheatsheet-backdrop');
    if (!el || !backdrop) return;

    // Inject contextual shortcuts
    var ctxEl = el.querySelector('.js-cheatsheet-context');
    if (ctxEl) {
      var screen = getActiveScreenId();
      var ctxShortcuts = getContextShortcuts(screen);
      if (ctxShortcuts) {
        ctxEl.innerHTML = '<div class="kbd-cheatsheet__context-title">Current Screen: ' +
          screen.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }) +
          '</div>' + ctxShortcuts;
      } else {
        ctxEl.innerHTML = '';
      }
    }

    el.hidden = false;
    backdrop.hidden = false;
    cheatsheetOpen = true;
  }

  function closeCheatsheet() {
    var el = document.getElementById('kbdCheatsheet');
    var backdrop = document.querySelector('.js-cheatsheet-backdrop');
    if (!el || !backdrop) return;
    el.hidden = true;
    backdrop.hidden = true;
    cheatsheetOpen = false;
  }

  function getContextShortcuts(screen) {
    var map = {
      'approvals': '<div class="kbd-cheatsheet__list">' +
        '<div class="kbd-cheatsheet__row"><kbd>A</kbd> <span>Approve</span></div>' +
        '<div class="kbd-cheatsheet__row"><kbd>D</kbd> <span>Deny</span></div>' +
        '<div class="kbd-cheatsheet__row"><kbd>R</kbd> <span>Request changes</span></div>' +
        '<div class="kbd-cheatsheet__row"><kbd>S</kbd> <span>Skip</span></div>' +
        '<div class="kbd-cheatsheet__row"><kbd>Space</kbd> <span>Expand / collapse card</span></div>' +
        '</div>',
      'work-items': '<div class="kbd-cheatsheet__list">' +
        '<div class="kbd-cheatsheet__row"><kbd>j</kbd>/<kbd>k</kbd> <span>Navigate rows</span></div>' +
        '<div class="kbd-cheatsheet__row"><kbd>Enter</kbd> <span>Open work item</span></div>' +
        '<div class="kbd-cheatsheet__row"><kbd>n</kbd> <span>Create new work item</span></div>' +
        '</div>',
      'runs': '<div class="kbd-cheatsheet__list">' +
        '<div class="kbd-cheatsheet__row"><kbd>j</kbd>/<kbd>k</kbd> <span>Navigate rows</span></div>' +
        '<div class="kbd-cheatsheet__row"><kbd>Enter</kbd> <span>Open run</span></div>' +
        '</div>',
      'evidence': '<div class="kbd-cheatsheet__list">' +
        '<div class="kbd-cheatsheet__row"><kbd>j</kbd>/<kbd>k</kbd> <span>Navigate entries</span></div>' +
        '<div class="kbd-cheatsheet__row"><kbd>Enter</kbd> <span>View evidence detail</span></div>' +
        '</div>',
      'inbox': '<div class="kbd-cheatsheet__list">' +
        '<div class="kbd-cheatsheet__row"><kbd>j</kbd>/<kbd>k</kbd> <span>Navigate items</span></div>' +
        '<div class="kbd-cheatsheet__row"><kbd>Enter</kbd> <span>Open item</span></div>' +
        '</div>',
    };
    return map[screen] || null;
  }

  /* ============================================================
     LIST NAVIGATION (j/k/Enter)
     ============================================================ */
  function getNavigableItems() {
    var screen = document.querySelector('.screen.is-active');
    if (!screen) return [];
    // Collect rows, kanban cards, table rows (skip thead)
    var items = [];
    screen.querySelectorAll('.row:not(.row--static), .kanban__card, tbody tr').forEach(function (el) {
      if (!el.closest('[hidden]') && el.offsetParent !== null) {
        items.push(el);
      }
    });
    return items;
  }

  function clearKbdSelection() {
    document.querySelectorAll('.is-kbd-selected').forEach(function (el) {
      el.classList.remove('is-kbd-selected');
    });
    kbdSelectedIndex = -1;
  }

  function selectKbdItem(direction) {
    var items = getNavigableItems();
    if (items.length === 0) return;

    clearKbdSelection();

    if (direction === 'down') {
      kbdSelectedIndex = Math.min(kbdSelectedIndex + 1, items.length - 1);
    } else {
      kbdSelectedIndex = Math.max(kbdSelectedIndex - 1, 0);
    }

    items[kbdSelectedIndex].classList.add('is-kbd-selected');
    items[kbdSelectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function activateKbdItem() {
    var items = getNavigableItems();
    if (kbdSelectedIndex < 0 || kbdSelectedIndex >= items.length) return;
    var el = items[kbdSelectedIndex];
    // Find a link inside or on the element
    var link = el.tagName === 'A' ? el : el.querySelector('a[href]');
    if (link && link.href) {
      link.click();
    }
  }

  /* ============================================================
     GO-TO CHORD HANDLER
     ============================================================ */
  var GO_TO_MAP = {
    'i': 'inbox',
    'p': 'project',
    'w': 'work-items',
    'r': 'runs',
    'b': 'workflow-builder',
    'a': 'approvals',
    'e': 'evidence',
    'n': 'agents',
    's': 'settings',
  };

  function startChord(key) {
    chordPending = key;
    showChord(key);
    clearTimeout(chordTimer);
    chordTimer = setTimeout(function () {
      chordPending = null;
      hideChord();
    }, 800);
  }

  function handleChord(key) {
    clearTimeout(chordTimer);
    hideChord();
    var target = null;

    if (chordPending === 'g') {
      target = GO_TO_MAP[key];
    }

    chordPending = null;

    if (target) {
      goto(target);
      var label = target.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      showToast('Go to ' + label);
    }
  }

  /* ============================================================
     BACK NAVIGATION
     ============================================================ */
  var BACK_MAP = {
    'work-item': 'work-items',
    'run': 'runs',
  };

  function goBack() {
    var screen = getActiveScreenId();
    var parent = BACK_MAP[screen];
    if (parent) {
      goto(parent);
      showToast('Back');
    }
  }

  /* ============================================================
     MAIN KEY HANDLER
     ============================================================ */
  function onKeyDown(e) {
    // Command palette internal navigation
    if (paletteOpen) {
      if (e.key === 'Escape') {
        closePalette();
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        paletteSelectedIdx = Math.min(paletteSelectedIdx + 1, filteredCommands.length - 1);
        updatePaletteSelection();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        paletteSelectedIdx = Math.max(paletteSelectedIdx - 1, 0);
        updatePaletteSelection();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[paletteSelectedIdx]) {
          executePaletteCommand(filteredCommands[paletteSelectedIdx]);
        }
        return;
      }
      // Let typing flow through to the input
      return;
    }

    // Cheatsheet
    if (cheatsheetOpen) {
      if (e.key === 'Escape') {
        closeCheatsheet();
        e.preventDefault();
      }
      return;
    }

    // Ctrl+K / Cmd+K -- always works
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openPalette();
      return;
    }

    // If input focused, skip single-key shortcuts
    if (isInputFocused()) return;

    // Pending chord?
    if (chordPending) {
      handleChord(e.key.toLowerCase());
      e.preventDefault();
      return;
    }

    var key = e.key;

    // Escape -- close overlays (drawer is handled by existing wireframe.js code,
    // but we add cheatsheet/palette here)
    if (key === 'Escape') {
      // Drawer close is already handled by wireframe.js
      return;
    }

    // ? -- cheatsheet
    if (key === '?') {
      openCheatsheet();
      e.preventDefault();
      return;
    }

    // / -- focus search
    if (key === '/') {
      e.preventDefault();
      var searchInput = document.querySelector('.topbar__search');
      if (searchInput) searchInput.focus();
      showToast('Search focused');
      return;
    }

    // g -- start go-to chord
    if (key === 'g') {
      startChord('g');
      e.preventDefault();
      return;
    }

    // n -- new (context-sensitive)
    if (key === 'n') {
      goto('work-item');
      showToast('Create Work Item');
      e.preventDefault();
      return;
    }

    // c -- toggle context drawer
    if (key === 'c') {
      var drawer = document.getElementById('drawer');
      if (drawer && drawer.classList.contains('is-open')) {
        closeDrawer();
        showToast('Drawer closed');
      } else {
        openDrawer('context');
        showToast('Context drawer opened');
      }
      e.preventDefault();
      return;
    }

    // j/k -- list navigation
    if (key === 'j') {
      selectKbdItem('down');
      e.preventDefault();
      return;
    }
    if (key === 'k') {
      selectKbdItem('up');
      e.preventDefault();
      return;
    }

    // Enter -- activate selected list item
    if (key === 'Enter') {
      activateKbdItem();
      return;
    }

    // Backspace -- go back
    if (key === 'Backspace') {
      goBack();
      e.preventDefault();
      return;
    }
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    document.addEventListener('keydown', onKeyDown);

    // Palette input handler
    var cmdInput = document.getElementById('cmdInput');
    if (cmdInput) {
      cmdInput.addEventListener('input', function () {
        renderPaletteResults(cmdInput.value);
      });
    }

    // Backdrop clicks
    var cmdBackdrop = document.querySelector('.js-cmd-backdrop');
    if (cmdBackdrop) {
      cmdBackdrop.addEventListener('click', closePalette);
    }
    var csBackdrop = document.querySelector('.js-cheatsheet-backdrop');
    if (csBackdrop) {
      csBackdrop.addEventListener('click', closeCheatsheet);
    }

    // Cheatsheet close button
    var csClose = document.querySelector('.js-cheatsheet-close');
    if (csClose) {
      csClose.addEventListener('click', closeCheatsheet);
    }

    // Clear keyboard selection on screen change
    window.addEventListener('hashchange', function () {
      clearKbdSelection();
    });
  }

  return { init, openPalette, closePalette, openCheatsheet, closeCheatsheet, showToast };
})();

// Initialize after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Keyboard.init);
} else {
  Keyboard.init();
}
```

---

## 9. Integration Points with wireframe.js

### 9.1 Load Order

In `index.html`, add after the existing `<script src="./wireframe.js">`:

```html
<script src="./keyboard.js"></script>
```

### 9.2 Dependencies on Existing Functions

The keyboard module calls these functions from `wireframe.js` which are already in global scope:

- `openDrawer(contentId)` -- opens the correlation context drawer
- `closeDrawer()` -- closes the drawer
- `triageAction(action)` -- fires triage actions (A/D/R/S)

No modifications to `wireframe.js` are required. The triage keyboard shortcuts in `wireframe.js` (lines 1086-1101) continue to work as-is because:

1. The keyboard module's `onKeyDown` skips single-key shortcuts when `isInputFocused()` returns true.
2. The existing triage handler checks `triageEl.hidden` to avoid conflicts.
3. The `a/d/r/s` shortcuts in the keyboard module are **not** duplicated -- the existing triage handler will catch them first when the triage view is active.

### 9.3 Conflict Resolution

| Key | When triage active | When triage inactive |
|---|---|---|
| `a` | Approve (existing handler) | Go-to chord handled by keyboard module **only after `g`** |
| `d` | Deny (existing handler) | Not mapped as standalone key |
| `r` | Request changes (existing handler) | Not mapped as standalone key |
| `s` | Skip (existing handler) | Not mapped as standalone key |
| `Escape` | Existing handler closes drawer | Keyboard module closes palette/cheatsheet first |

The `Escape` key uses a priority stack:
1. Command palette (keyboard module)
2. Cheatsheet (keyboard module)
3. Drawer (existing wireframe.js handler)

This works because the keyboard module's handler checks `paletteOpen` and `cheatsheetOpen` first, and returns early with `e.preventDefault()` before the existing handler runs.

### 9.4 HTML Insertion Points

1. **Command palette + cheatsheet HTML**: Insert before `</body>`, after the drawer div and before `<script>` tags.
2. **Status bar additions**: Insert inside `<footer class="statusbar">` after the existing three `statusbar__item` spans.
3. **CSS**: Append to `wireframe.css`.
4. **JS**: New file `keyboard.js` loaded after `wireframe.js`.

---

## 10. Accessibility Considerations

1. **ARIA roles**: Command palette uses `role="dialog"` with `aria-modal="true"`. Result list uses `role="listbox"` and items use `role="option"`.
2. **Focus trap**: When the palette is open, focus stays in the input. When the cheatsheet is open, close button is focusable.
3. **Screen reader announcements**: The toast in the status bar uses `aria-live="polite"` (add to the HTML element) so screen readers announce executed commands.
4. **Skip shortcuts**: All single-key shortcuts are disabled when a text input is focused, preventing interference with typing.
5. **Visual indicators**: Keyboard-selected items have a visible focus ring (`outline: 2px solid var(--focus)`), meeting WCAG 2.1 AA.

### Recommended ARIA addition for the toast:

```html
<span class="statusbar__item statusbar__toast js-kbd-toast" hidden aria-live="polite" role="status"></span>
```

---

## 11. Testing Checklist

- [ ] `Ctrl+K` opens command palette from any screen
- [ ] `Ctrl+K` opens palette even when text input is focused
- [ ] Typing filters commands with fuzzy search
- [ ] Arrow keys navigate palette results
- [ ] `Enter` executes selected command
- [ ] `Escape` closes palette
- [ ] Clicking backdrop closes palette
- [ ] Recent commands appear when palette opens with empty query
- [ ] `?` opens cheatsheet modal
- [ ] `Escape` closes cheatsheet
- [ ] Cheatsheet shows contextual shortcuts for current screen
- [ ] `g i`, `g w`, `g r`, etc. navigate to correct screens
- [ ] `g` shows chord indicator in status bar
- [ ] Chord times out after 800ms
- [ ] `/` focuses the topbar search input
- [ ] `n` navigates to work item creation
- [ ] `c` toggles the context drawer
- [ ] `j`/`k` navigate list items with visible selection
- [ ] `Enter` opens the keyboard-selected item
- [ ] `Backspace` navigates from detail to parent list
- [ ] No shortcuts fire when typing in text inputs (except Ctrl+K)
- [ ] Triage shortcuts (A/D/R/S/Space) still work when triage is active
- [ ] Status bar toast appears and auto-fades after 2s
- [ ] All overlays dismiss in correct priority order (palette > cheatsheet > drawer)
- [ ] Keyboard selection clears on screen change
