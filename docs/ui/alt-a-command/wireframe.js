/* ===================================================================
   Alternative A: Command-Palette / Keyboard-First
   Portarium Lo-Fi Prototype -- JavaScript
   =================================================================== */

const STORAGE_KEY = 'portarium_alt_a_v1';

/* ---- Helpers ---- */

function qs(sel) {
  const el = document.querySelector(sel);
  if (!el) throw new Error('Missing element: ' + sel);
  return el;
}

function qsa(sel) {
  return Array.from(document.querySelectorAll(sel));
}

function getState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ===================================================================
   ALLOWED SCREENS
   =================================================================== */
const ALLOWED_SCREENS = new Set([
  'inbox',
  'project',
  'work-items',
  'work-item',
  'run',
  'approvals',
  'evidence',
  'settings',
]);

function getScreenFromHash() {
  const raw = (location.hash || '#inbox').slice(1);
  return ALLOWED_SCREENS.has(raw) ? raw : 'inbox';
}

/* ===================================================================
   SCREEN ACTIVATION
   =================================================================== */
function activateScreen(screen) {
  const target = 'screen-' + screen;
  for (const el of qsa('.screen')) {
    el.classList.toggle('is-active', el.id === target);
  }
  updateBreadcrumbs(screen);
  updateShortcutFooter(screen);
  resetSelections();
}

/* ===================================================================
   BREADCRUMB UPDATES
   =================================================================== */
const BREADCRUMB_MAP = {
  inbox: { trail: [], current: 'Inbox' },
  project: { trail: [], current: 'Billing Governance' },
  'work-items': {
    trail: [{ label: 'Billing Governance', hash: '#project' }],
    current: 'Work Items',
  },
  'work-item': {
    trail: [
      { label: 'Billing Governance', hash: '#project' },
      { label: 'Work Items', hash: '#work-items' },
    ],
    current: 'WI-1099',
  },
  run: {
    trail: [
      { label: 'Billing Governance', hash: '#project' },
      { label: 'Work Items', hash: '#work-items' },
      { label: 'WI-1099', hash: '#work-item' },
    ],
    current: 'R-8920',
  },
  approvals: {
    trail: [],
    current: 'Approvals',
  },
  evidence: {
    trail: [],
    current: 'Evidence',
  },
  settings: {
    trail: [],
    current: 'Settings',
  },
};

function updateBreadcrumbs(screen) {
  const nav = qs('#breadcrumbs');
  const info = BREADCRUMB_MAP[screen] || BREADCRUMB_MAP.inbox;

  let html = '<a href="#inbox">Workspace</a>';

  for (const crumb of info.trail) {
    html += '<span class="breadcrumbs__sep" aria-hidden="true">/</span>';
    html += '<a href="' + crumb.hash + '">' + crumb.label + '</a>';
  }

  html += '<span class="breadcrumbs__sep" aria-hidden="true">/</span>';
  html += '<span class="breadcrumbs__current">' + info.current + '</span>';

  nav.innerHTML = html;
}

/* ===================================================================
   SHORTCUT FOOTER UPDATES (per screen)
   =================================================================== */
const FOOTER_MAP = {
  inbox: [
    { key: 'Ctrl K', label: 'Command palette' },
    { key: 'J/K', label: 'Navigate' },
    { key: 'Enter', label: 'Open' },
    { key: 'A', label: 'Approve' },
    { key: 'R', label: 'Retry' },
    { key: 'F', label: 'Filter' },
  ],
  project: [
    { key: 'Ctrl K', label: 'Command palette' },
    { key: '1-5', label: 'Quick action' },
    { key: 'G W', label: 'Work Items' },
  ],
  'work-items': [
    { key: 'Ctrl K', label: 'Command palette' },
    { key: 'J/K', label: 'Navigate' },
    { key: 'Enter', label: 'Expand' },
    { key: 'C', label: 'Create' },
  ],
  'work-item': [
    { key: 'Ctrl K', label: 'Command palette' },
    { key: '1-5', label: 'Jump to section' },
    { key: 'S', label: 'Start workflow' },
    { key: 'E', label: 'Evidence' },
  ],
  run: [
    { key: 'Ctrl K', label: 'Command palette' },
    { key: 'Tab', label: 'Next field' },
    { key: 'Ctrl Enter', label: 'Submit' },
    { key: 'R', label: 'Retry' },
  ],
  approvals: [
    { key: 'Ctrl K', label: 'Command palette' },
    { key: 'N', label: 'Next' },
    { key: 'P', label: 'Previous' },
    { key: 'Ctrl Enter', label: 'Submit' },
  ],
  evidence: [
    { key: 'Ctrl K', label: 'Command palette' },
    { key: '/', label: 'Search' },
    { key: 'F', label: 'Filter' },
  ],
  settings: [
    { key: 'Ctrl K', label: 'Command palette' },
    { key: 'Tab', label: 'Next section' },
  ],
};

function updateShortcutFooter(screen) {
  const footer = qs('#shortcut-footer');
  const items = FOOTER_MAP[screen] || FOOTER_MAP.inbox;
  footer.innerHTML = items
    .map(function (item) {
      return (
        '<span class="shortcut-footer__item"><span class="kbd">' +
        item.key +
        '</span> ' +
        item.label +
        '</span>'
      );
    })
    .join('');
}

/* ===================================================================
   BANNERS
   =================================================================== */
function setBanners(systemState) {
  qs('.js-banner-degraded').hidden = systemState !== 'degraded';
  qs('.js-banner-misconfigured').hidden = systemState !== 'misconfigured';
  qs('.js-banner-policy').hidden = systemState !== 'policy-blocked';
  qs('.js-banner-rbac').hidden = systemState !== 'rbac-limited';
}

/* ===================================================================
   EMPTY STATES
   =================================================================== */
function setEmptyStates(systemState) {
  const isEmpty = systemState === 'empty';

  for (const el of qsa('.js-empty-inbox')) el.hidden = !isEmpty;
  for (const el of qsa('.js-nonempty-inbox')) el.hidden = isEmpty;
  for (const el of qsa('.js-empty-project')) el.hidden = !isEmpty;
  for (const el of qsa('.js-nonempty-project')) el.hidden = isEmpty;

  var emptyWi = document.querySelector('.js-empty-workitems');
  var nonEmptyWi = document.querySelector('.js-nonempty-workitems');
  if (emptyWi) emptyWi.hidden = !isEmpty;
  if (nonEmptyWi) nonEmptyWi.hidden = isEmpty;

  for (const el of qsa('.js-empty-workitem')) el.hidden = !isEmpty;
  for (const el of qsa('.js-nonempty-workitem')) el.hidden = isEmpty;
  for (const el of qsa('.js-empty-run')) el.hidden = !isEmpty;
  for (const el of qsa('.js-nonempty-run')) el.hidden = isEmpty;
  for (const el of qsa('.js-empty-approvals')) el.hidden = !isEmpty;
  for (const el of qsa('.js-nonempty-approvals')) el.hidden = isEmpty;
  for (const el of qsa('.js-empty-evidence')) el.hidden = !isEmpty;
  for (const el of qsa('.js-nonempty-evidence')) el.hidden = isEmpty;
  for (const el of qsa('.js-empty-settings')) el.hidden = !isEmpty;
  for (const el of qsa('.js-nonempty-settings')) el.hidden = isEmpty;
}

/* ===================================================================
   WORKSPACE TYPE
   =================================================================== */
function setWorkspaceType(workspaceType) {
  const showUnassigned = workspaceType === 'team';
  for (const chip of qsa('.js-chip-unassigned')) {
    chip.style.display = showUnassigned ? 'inline-flex' : 'none';
  }
  for (const cell of qsa('.js-owner-unassigned')) {
    cell.textContent = showUnassigned ? 'Unassigned' : 'Me';
  }
}

/* ===================================================================
   PERSONA
   =================================================================== */
function setPersona(persona) {
  const personaChip = document.querySelector('.js-filter-persona');
  if (personaChip) {
    var chipText = {
      operator: 'Default filters: failures + blocks',
      approver: 'Default filters: approvals assigned to me',
      auditor: 'Default filters: evidence + verification',
      admin: 'Default filters: configuration + policy',
    }[persona];
    personaChip.textContent = chipText || 'Default filters';
  }

  var sodCallout = document.querySelector('.js-callout-sod');
  if (sodCallout) {
    sodCallout.style.display = persona === 'approver' ? 'block' : 'none';
  }

  // Disable action buttons for rbac-limited / auditor
  var isReadOnly = document.body.dataset.systemState === 'rbac-limited' || persona === 'auditor';
  for (var btn of qsa('.btn--primary')) {
    if (isReadOnly) {
      btn.classList.add('btn--disabled');
    } else {
      btn.classList.remove('btn--disabled');
    }
  }
}

/* ===================================================================
   BODY FLAGS
   =================================================================== */
function applyBodyFlags(state) {
  document.body.dataset.persona = state.persona;
  document.body.dataset.workspaceType = state.workspaceType;
  document.body.dataset.systemState = state.systemState;
}

/* ===================================================================
   RENDER
   =================================================================== */
function render(state) {
  applyBodyFlags(state);
  setBanners(state.systemState);
  setEmptyStates(state.systemState);
  setWorkspaceType(state.workspaceType);
  setPersona(state.persona);
  activateScreen(getScreenFromHash());
}

/* ===================================================================
   COMMAND PALETTE
   =================================================================== */
var paletteOpen = false;
var paletteSelectedIndex = 0;
var currentPaletteItems = [];

function buildPaletteItems(query, persona) {
  var items = [];
  var q = (query || '').toLowerCase().trim();

  // Sections
  var recent = [
    {
      icon: 'I',
      label: 'Inbox',
      action: function () {
        location.hash = '#inbox';
      },
    },
    {
      icon: 'W',
      label: 'WI-1099 Invoice correction for ACME',
      action: function () {
        location.hash = '#work-item';
      },
    },
    {
      icon: 'R',
      label: 'R-8920 Invoice correction (paused)',
      action: function () {
        location.hash = '#run';
      },
    },
  ];

  var navigate = [
    {
      icon: 'I',
      label: 'Go to Inbox',
      hint: 'G I',
      action: function () {
        location.hash = '#inbox';
      },
    },
    {
      icon: 'P',
      label: 'Go to Project Overview',
      hint: 'G P',
      action: function () {
        location.hash = '#project';
      },
    },
    {
      icon: 'W',
      label: 'Go to Work Items',
      hint: 'G W',
      action: function () {
        location.hash = '#work-items';
      },
    },
    {
      icon: 'A',
      label: 'Go to Approvals',
      hint: 'G A',
      action: function () {
        location.hash = '#approvals';
      },
    },
    {
      icon: 'E',
      label: 'Go to Evidence',
      hint: 'G E',
      action: function () {
        location.hash = '#evidence';
      },
    },
    {
      icon: 'S',
      label: 'Go to Settings',
      hint: 'G S',
      action: function () {
        location.hash = '#settings';
      },
    },
  ];

  var actions = [
    {
      icon: '+',
      label: 'Create Work Item',
      hint: 'C',
      action: function () {
        location.hash = '#work-items';
        setTimeout(function () {
          toggleInlineCreate(true);
        }, 100);
      },
    },
    {
      icon: 'S',
      label: 'Start Run for WI-1099',
      action: function () {
        location.hash = '#run';
      },
    },
    {
      icon: 'A',
      label: 'Review pending approvals',
      action: function () {
        location.hash = '#approvals';
      },
    },
    {
      icon: 'E',
      label: 'Open Evidence log',
      action: function () {
        location.hash = '#evidence';
      },
    },
    {
      icon: 'G',
      label: 'Open Settings',
      action: function () {
        location.hash = '#settings';
      },
    },
  ];

  var search = [
    {
      icon: 'W',
      label: 'WI-1099 Invoice correction for ACME',
      action: function () {
        location.hash = '#work-item';
      },
    },
    {
      icon: 'W',
      label: 'WI-1042 Dispute: investigate payment failure',
      action: function () {
        location.hash = '#work-item';
      },
    },
    {
      icon: 'W',
      label: 'WI-1013 Receipt export for audit period',
      action: function () {
        location.hash = '#work-item';
      },
    },
    {
      icon: 'R',
      label: 'R-8920 Invoice correction (paused)',
      action: function () {
        location.hash = '#run';
      },
    },
    {
      icon: 'R',
      label: 'R-8892 Update Ticket priority (running)',
      action: function () {
        location.hash = '#run';
      },
    },
  ];

  // Persona-aware: approver sees approvals first
  if (persona === 'approver') {
    recent = [
      {
        icon: 'A',
        label: 'My pending approvals (2)',
        action: function () {
          location.hash = '#approvals';
        },
      },
      {
        icon: 'A',
        label: 'Approve Plan: Create Invoice in NetSuite',
        action: function () {
          location.hash = '#approvals';
        },
      },
    ].concat(recent);
  }

  function matchesQuery(item) {
    if (!q) return true;
    return item.label.toLowerCase().indexOf(q) !== -1;
  }

  function addSection(sectionLabel, sectionItems) {
    var filtered = sectionItems.filter(matchesQuery);
    if (filtered.length > 0) {
      items.push({ type: 'section', label: sectionLabel });
      for (var i = 0; i < filtered.length; i++) {
        items.push({ type: 'item', data: filtered[i] });
      }
    }
  }

  if (!q) {
    addSection('Recent', recent);
    addSection('Navigate to...', navigate);
    addSection('Actions', actions);
  } else {
    addSection('Navigate to...', navigate);
    addSection('Actions', actions);
    addSection('Search results', search);
    addSection('Recent', recent);
  }

  return items;
}

function renderPalette(query, persona) {
  var results = qs('#cmd-palette-results');
  currentPaletteItems = buildPaletteItems(query, persona);
  paletteSelectedIndex = 0;

  var html = '';
  var itemIndex = 0;

  for (var i = 0; i < currentPaletteItems.length; i++) {
    var entry = currentPaletteItems[i];
    if (entry.type === 'section') {
      html += '<div class="cmd-palette__section">' + entry.label + '</div>';
    } else {
      var selected = itemIndex === paletteSelectedIndex ? ' is-selected' : '';
      var hint = entry.data.hint
        ? '<span class="cmd-item__hint"><span class="kbd">' + entry.data.hint + '</span></span>'
        : '';
      html +=
        '<div class="cmd-item' +
        selected +
        '" data-palette-index="' +
        itemIndex +
        '" role="option">' +
        '<span class="cmd-item__icon">' +
        entry.data.icon +
        '</span>' +
        '<span class="cmd-item__label">' +
        entry.data.label +
        '</span>' +
        hint +
        '</div>';
      itemIndex++;
    }
  }

  if (itemIndex === 0) {
    html =
      '<div style="padding:16px;color:var(--muted);text-align:center;">No results found.</div>';
  }

  results.innerHTML = html;
}

function getSelectableItems() {
  return currentPaletteItems.filter(function (e) {
    return e.type === 'item';
  });
}

function updatePaletteSelection() {
  var items = qsa('.cmd-item');
  for (var i = 0; i < items.length; i++) {
    items[i].classList.toggle('is-selected', i === paletteSelectedIndex);
  }
  // Scroll into view
  if (items[paletteSelectedIndex]) {
    items[paletteSelectedIndex].scrollIntoView({ block: 'nearest' });
  }
}

function executePaletteItem() {
  var selectable = getSelectableItems();
  if (selectable[paletteSelectedIndex]) {
    selectable[paletteSelectedIndex].data.action();
    closePalette();
  }
}

function openPalette() {
  paletteOpen = true;
  qs('#cmd-palette-backdrop').classList.add('is-open');
  var input = qs('#cmd-palette-input');
  input.value = '';
  input.focus();
  var persona = document.body.dataset.persona || 'operator';
  renderPalette('', persona);
}

function closePalette() {
  paletteOpen = false;
  qs('#cmd-palette-backdrop').classList.remove('is-open');
  qs('#cmd-palette-input').value = '';
}

/* ===================================================================
   KEYBOARD NAVIGATION (j/k) FOR LISTS
   =================================================================== */
var selectedInboxIndex = -1;
var selectedWiIndex = -1;

function resetSelections() {
  selectedInboxIndex = -1;
  selectedWiIndex = -1;
  for (const el of qsa('.triage-row.is-selected')) el.classList.remove('is-selected');
  for (const el2 of qsa('.js-wi-row.is-selected')) el2.classList.remove('is-selected');
}

function navigateList(direction, listSelector, indexRef) {
  var items = qsa(listSelector);
  if (items.length === 0) return indexRef;

  var newIndex = indexRef + direction;
  if (newIndex < 0) newIndex = 0;
  if (newIndex >= items.length) newIndex = items.length - 1;

  for (var i = 0; i < items.length; i++) {
    items[i].classList.toggle('is-selected', i === newIndex);
  }
  items[newIndex].scrollIntoView({ block: 'nearest' });
  return newIndex;
}

function openSelectedInboxItem() {
  var items = qsa('.triage-row');
  if (items[selectedInboxIndex]) {
    var href = items[selectedInboxIndex].getAttribute('href');
    if (href) location.hash = href;
  }
}

/* ===================================================================
   ACCORDION ROWS (work items table)
   =================================================================== */
function toggleAccordion(wi) {
  var accordion = document.querySelector('.accordion-row[data-accordion="' + wi + '"]');
  if (accordion) {
    accordion.classList.toggle('is-open');
  }
}

function openSelectedWiAccordion() {
  var items = qsa('.js-wi-row');
  if (items[selectedWiIndex]) {
    var wi = items[selectedWiIndex].dataset.wi;
    toggleAccordion(wi);
  }
}

/* ===================================================================
   INLINE CREATE FORM
   =================================================================== */
function toggleInlineCreate(forceOpen) {
  var form = document.querySelector('#inline-create-form');
  if (!form) return;
  if (forceOpen === true) {
    form.classList.add('is-open');
    var formInput = form.querySelector('.field__input');
    if (formInput) formInput.focus();
  } else if (forceOpen === false) {
    form.classList.remove('is-open');
  } else {
    form.classList.toggle('is-open');
    if (form.classList.contains('is-open')) {
      var formInput2 = form.querySelector('.field__input');
      if (formInput2) formInput2.focus();
    }
  }
}

/* ===================================================================
   APPROVAL QUEUE NAVIGATION
   =================================================================== */
var currentApproval = 1;
var totalApprovals = 2;

function showApproval(index) {
  if (index < 1) index = 1;
  if (index > totalApprovals) index = totalApprovals;
  currentApproval = index;

  var cards = qsa('.js-approval-card');
  for (var i = 0; i < cards.length; i++) {
    cards[i].style.display =
      parseInt(cards[i].dataset.approval) === currentApproval ? 'block' : 'none';
  }

  var counterEl = document.querySelector('#approval-current');
  if (counterEl) counterEl.textContent = currentApproval;
}

/* ===================================================================
   SECTION COLLAPSE (Work Item Detail)
   =================================================================== */
function initSectionCollapse() {
  for (var header of qsa('.section-collapse__header')) {
    header.addEventListener('click', function () {
      var section = this.closest('.section-collapse');
      section.classList.toggle('is-collapsed');
      var expanded = !section.classList.contains('is-collapsed');
      this.setAttribute('aria-expanded', String(expanded));
    });
  }
}

/* ===================================================================
   SETTINGS SECTION COLLAPSE
   =================================================================== */
function initSettingsCollapse() {
  for (var header of qsa('.settings-section__header')) {
    header.addEventListener('click', function () {
      var section = this.closest('.settings-section');
      section.classList.toggle('is-collapsed');
      var expanded = !section.classList.contains('is-collapsed');
      this.setAttribute('aria-expanded', String(expanded));
    });
  }
}

/* ===================================================================
   EVIDENCE SEARCH
   =================================================================== */
function initEvidenceSearch() {
  var input = document.querySelector('#evidence-search-input');
  if (!input) return;

  input.addEventListener('input', function () {
    var q = this.value.toLowerCase().trim();
    var entries = qsa('.log-entry');
    for (var i = 0; i < entries.length; i++) {
      var text = entries[i].textContent.toLowerCase();
      entries[i].style.display = !q || text.indexOf(q) !== -1 ? '' : 'none';
    }
  });
}

/* ===================================================================
   CHIP TOGGLE
   =================================================================== */
function initChipToggle() {
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('chip') && !e.target.classList.contains('js-filter-persona')) {
      e.target.classList.toggle('chip--active');
    }
  });
}

/* ===================================================================
   WORK ITEM ROW CLICKS
   =================================================================== */
function initWiRowClicks() {
  for (var row of qsa('.js-wi-row')) {
    row.addEventListener('click', function () {
      var wi = this.dataset.wi;
      toggleAccordion(wi);
    });
  }
}

/* ===================================================================
   CLOSE CREATE FORM
   =================================================================== */
function initCloseCreate() {
  for (var closeBtn of qsa('.js-close-create')) {
    closeBtn.addEventListener('click', function () {
      toggleInlineCreate(false);
    });
  }
  for (var createBtn of qsa('.js-create-wi-btn')) {
    createBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (getScreenFromHash() !== 'work-items') {
        location.hash = '#work-items';
        setTimeout(function () {
          toggleInlineCreate(true);
        }, 50);
      } else {
        toggleInlineCreate(true);
      }
    });
  }
}

/* ===================================================================
   APPROVAL NAV BUTTONS
   =================================================================== */
function initApprovalNav() {
  var prev = document.querySelector('.js-approval-prev');
  var next = document.querySelector('.js-approval-next');
  if (prev)
    prev.addEventListener('click', function () {
      showApproval(currentApproval - 1);
    });
  if (next)
    next.addEventListener('click', function () {
      showApproval(currentApproval + 1);
    });
}

/* ===================================================================
   "g" PREFIX NAVIGATION
   =================================================================== */
var gPrefixActive = false;
var gPrefixTimeout = null;

function startGPrefix() {
  gPrefixActive = true;
  clearTimeout(gPrefixTimeout);
  gPrefixTimeout = setTimeout(function () {
    gPrefixActive = false;
  }, 1000);
}

function handleGNavigation(key) {
  gPrefixActive = false;
  clearTimeout(gPrefixTimeout);
  var map = {
    i: '#inbox',
    p: '#project',
    w: '#work-items',
    a: '#approvals',
    e: '#evidence',
    s: '#settings',
  };
  if (map[key]) {
    location.hash = map[key];
    return true;
  }
  return false;
}

/* ===================================================================
   KEYBOARD SHORTCUTS (GLOBAL)
   =================================================================== */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

    // Command palette: Ctrl+K / Cmd+K (always active)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (paletteOpen) {
        closePalette();
      } else {
        openPalette();
      }
      return;
    }

    // Escape: close palette, close inline form
    if (e.key === 'Escape') {
      if (paletteOpen) {
        closePalette();
        return;
      }
      toggleInlineCreate(false);
      return;
    }

    // Inside command palette
    if (paletteOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        var max = getSelectableItems().length - 1;
        if (paletteSelectedIndex < max) paletteSelectedIndex++;
        updatePaletteSelection();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (paletteSelectedIndex > 0) paletteSelectedIndex--;
        updatePaletteSelection();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        executePaletteItem();
        return;
      }
      return;
    }

    // Don't handle shortcuts if user is typing in an input
    if (isInput) {
      // Ctrl+Enter to submit (in Run/Approvals)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        // Find the closest submit button
        var form = e.target.closest('.form');
        if (form) {
          var submitBtn = form.querySelector('.btn--primary');
          if (submitBtn) submitBtn.click();
        }
      }
      return;
    }

    var screen = getScreenFromHash();

    // "g" prefix
    if (gPrefixActive) {
      if (handleGNavigation(e.key)) {
        e.preventDefault();
        return;
      }
      gPrefixActive = false;
    }

    if (e.key === 'g') {
      startGPrefix();
      return;
    }

    // Global: open command bar
    if (e.key === '/' && screen !== 'evidence') {
      e.preventDefault();
      qs('#cmd-bar-input').focus();
      return;
    }

    // Per-screen shortcuts
    switch (screen) {
      case 'inbox':
        if (e.key === 'j') {
          e.preventDefault();
          selectedInboxIndex = navigateList(1, '.triage-row', selectedInboxIndex);
        } else if (e.key === 'k') {
          e.preventDefault();
          selectedInboxIndex = navigateList(-1, '.triage-row', selectedInboxIndex);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          openSelectedInboxItem();
        } else if (e.key === 'a') {
          e.preventDefault();
          location.hash = '#approvals';
        } else if (e.key === 'r') {
          e.preventDefault();
          // Retry action (prototype: just show a visual cue)
          var selected = qsa('.triage-row')[selectedInboxIndex];
          if (selected) selected.style.opacity = '0.5';
        } else if (e.key === 'f') {
          e.preventDefault();
          var chips = qsa('#inbox-filters .chip');
          if (chips.length > 1) chips[1].classList.toggle('chip--active');
        } else if (e.key === 'c') {
          e.preventDefault();
          location.hash = '#work-items';
          setTimeout(function () {
            toggleInlineCreate(true);
          }, 50);
        }
        break;

      case 'work-items':
        if (e.key === 'j') {
          e.preventDefault();
          selectedWiIndex = navigateList(1, '.js-wi-row', selectedWiIndex);
        } else if (e.key === 'k') {
          e.preventDefault();
          selectedWiIndex = navigateList(-1, '.js-wi-row', selectedWiIndex);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          openSelectedWiAccordion();
        } else if (e.key === 'c') {
          e.preventDefault();
          toggleInlineCreate(true);
        }
        break;

      case 'work-item':
        if (e.key >= '1' && e.key <= '5') {
          e.preventDefault();
          var section = document.querySelector('.section-collapse[data-section="' + e.key + '"]');
          if (section) {
            if (section.classList.contains('is-collapsed')) {
              section.classList.remove('is-collapsed');
              section
                .querySelector('.section-collapse__header')
                .setAttribute('aria-expanded', 'true');
            }
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        } else if (e.key === 's') {
          e.preventDefault();
          location.hash = '#run';
        } else if (e.key === 'e') {
          e.preventDefault();
          location.hash = '#evidence';
        }
        break;

      case 'run':
        if (e.key === 'r') {
          e.preventDefault();
          // Retry stub
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          // Submit stub
        }
        break;

      case 'approvals':
        if (e.key === 'n') {
          e.preventDefault();
          showApproval(currentApproval + 1);
        } else if (e.key === 'p') {
          e.preventDefault();
          showApproval(currentApproval - 1);
        }
        break;

      case 'evidence':
        if (e.key === '/') {
          e.preventDefault();
          var searchInput = document.querySelector('#evidence-search-input');
          if (searchInput) searchInput.focus();
        } else if (e.key === 'f') {
          e.preventDefault();
          var filterChips = qsa('#evidence-filters .chip');
          if (filterChips.length > 1) filterChips[1].classList.toggle('chip--active');
        }
        break;

      case 'settings':
        // Tab is native; no extra handling needed
        break;
    }
  });
}

/* ===================================================================
   COMMAND PALETTE: click + input handlers
   =================================================================== */
function initPaletteEvents() {
  // Backdrop click closes palette
  qs('#cmd-palette-backdrop').addEventListener('click', function (e) {
    if (e.target === this) closePalette();
  });

  // Input typing
  qs('#cmd-palette-input').addEventListener('input', function () {
    var persona = document.body.dataset.persona || 'operator';
    renderPalette(this.value, persona);
  });

  // Click on palette item
  qs('#cmd-palette-results').addEventListener('click', function (e) {
    var item = e.target.closest('.cmd-item');
    if (item) {
      var idx = parseInt(item.dataset.paletteIndex);
      paletteSelectedIndex = idx;
      executePaletteItem();
    }
  });

  // Command bar click opens palette
  qs('#cmd-bar-input').addEventListener('focus', function () {
    openPalette();
    this.blur();
  });
}

/* ===================================================================
   MAIN
   =================================================================== */
function main() {
  var persona = qs('#persona');
  var workspaceType = qs('#workspaceType');
  var systemState = qs('#systemState');

  var saved = getState();
  var initial = {
    persona: saved && saved.persona ? saved.persona : 'operator',
    workspaceType: saved && saved.workspaceType ? saved.workspaceType : 'team',
    systemState: saved && saved.systemState ? saved.systemState : 'normal',
  };

  persona.value = initial.persona;
  workspaceType.value = initial.workspaceType;
  systemState.value = initial.systemState;

  function onChange() {
    var next = {
      persona: persona.value,
      workspaceType: workspaceType.value,
      systemState: systemState.value,
    };
    setState(next);
    render(next);
  }

  persona.addEventListener('change', onChange);
  workspaceType.addEventListener('change', onChange);
  systemState.addEventListener('change', onChange);

  window.addEventListener('hashchange', function () {
    render(getState() || initial);
  });

  // Init subsystems
  initSectionCollapse();
  initSettingsCollapse();
  initEvidenceSearch();
  initChipToggle();
  initWiRowClicks();
  initCloseCreate();
  initApprovalNav();
  initKeyboardShortcuts();
  initPaletteEvents();

  // Initial render
  render(initial);
}

main();
