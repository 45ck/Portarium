/* global closeDrawer, openDrawer */
/* ============================================================
   Portarium Cockpit -- Keyboard-First UX Module
   ============================================================ */
const Keyboard = (function () {
  'use strict';

  /* ---- State ---- */
  var chordPending = null;
  var chordTimer = null;
  var kbdSelectedIndex = -1;
  var toastTimer = null;
  var recentCommands = []; // max 5

  /* ---- Helpers ---- */
  function isInputFocused() {
    var el = document.activeElement;
    if (!el) return false;
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function getActiveScreenId() {
    var active = document.querySelector('.screen.is-active');
    return active ? active.dataset.screen : 'inbox';
  }

  /* ---- Navigation ---- */
  function goto(screen) {
    location.hash = '#' + screen;
  }

  /* ---- Toast ---- */
  function showToast(message) {
    var el = document.querySelector('.js-kbd-toast');
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
    var hint = document.querySelector('.js-kbd-hint');
    if (!hint) return;
    var chord = hint.querySelector('.statusbar__chord');
    if (!chord) {
      chord = document.createElement('span');
      chord.className = 'statusbar__chord';
      hint.prepend(chord);
    }
    chord.textContent = key + '...';
    chord.hidden = false;
  }

  function hideChord() {
    var chord = document.querySelector('.statusbar__chord');
    if (chord) chord.hidden = true;
  }

  /* ============================================================
     COMMAND PALETTE
     ============================================================ */
  var COMMANDS = [
    // Navigate
    { id: 'nav-inbox',      label: 'Go to Inbox',             category: 'Navigate', keywords: 'inbox home notifications',   shortcut: 'g i',  icon: '!',      action: function () { goto('inbox'); } },
    { id: 'nav-project',    label: 'Go to Project Overview',  category: 'Navigate', keywords: 'project dashboard overview',  shortcut: 'g p',  icon: '#',      action: function () { goto('project'); } },
    { id: 'nav-work-items', label: 'Go to Work Items',        category: 'Navigate', keywords: 'work items list',            shortcut: 'g w',  icon: '\u2261', action: function () { goto('work-items'); } },
    { id: 'nav-runs',       label: 'Go to Runs',              category: 'Navigate', keywords: 'runs executions',            shortcut: 'g r',  icon: '\u203A', action: function () { goto('runs'); } },
    { id: 'nav-builder',    label: 'Go to Workflow Builder',  category: 'Navigate', keywords: 'workflow builder canvas',    shortcut: 'g b',  icon: '\u25CA', action: function () { goto('workflow-builder'); } },
    { id: 'nav-approvals',  label: 'Go to Approvals',         category: 'Navigate', keywords: 'approvals gates review',     shortcut: 'g a',  icon: '\u2713', action: function () { goto('approvals'); } },
    { id: 'nav-evidence',   label: 'Go to Evidence',          category: 'Navigate', keywords: 'evidence audit chain',       shortcut: 'g e',  icon: '\u00A7', action: function () { goto('evidence'); } },
    { id: 'nav-agents',     label: 'Go to Agents',            category: 'Navigate', keywords: 'agents ai configuration',    shortcut: 'g n',  icon: '\u2666', action: function () { goto('agents'); } },
    { id: 'nav-settings',   label: 'Go to Settings',          category: 'Navigate', keywords: 'settings workspace config',  shortcut: 'g s',  icon: '\u2022', action: function () { goto('settings'); } },

    // Actions
    { id: 'act-new-wi',     label: 'Create Work Item',        category: 'Action',   keywords: 'new create work item',       shortcut: 'n',    action: function () { goto('work-item'); } },
    { id: 'act-start-wf',   label: 'Start Workflow',          category: 'Action',   keywords: 'start run workflow execute',                    action: function () { goto('work-item'); } },
    { id: 'act-drawer',     label: 'Toggle Context Drawer',   category: 'Action',   keywords: 'context drawer correlation', shortcut: 'c',    action: function () {
        var drawer = document.getElementById('drawer');
        if (drawer && drawer.classList.contains('is-open')) { closeDrawer(); } else { openDrawer('context'); }
      }
    },
    { id: 'act-triage',     label: 'Start Approval Triage',   category: 'Action',   keywords: 'triage approve batch swipe',                   action: function () {
        goto('approvals');
        setTimeout(function () {
          var btn = document.querySelector('.js-triage-mode[data-mode="triage"]');
          if (btn) btn.click();
        }, 100);
      }
    },

    // Filter
    { id: 'flt-failed',     label: 'Filter: Failed runs',      category: 'Filter',  keywords: 'filter failed errors danger',  action: function () { showToast('Filter applied: Failed runs'); } },
    { id: 'flt-pending',    label: 'Filter: Pending approvals', category: 'Filter', keywords: 'filter pending approval gate', action: function () { showToast('Filter applied: Pending approvals'); } },
    { id: 'flt-assigned',   label: 'Filter: Assigned to me',   category: 'Filter',  keywords: 'filter assigned owner me',     action: function () { showToast('Filter applied: Assigned to me'); } },

    // Settings
    { id: 'set-persona',    label: 'Switch Persona',           category: 'Settings', keywords: 'persona operator approver auditor admin role', action: function () { document.getElementById('persona').focus(); } },
    { id: 'set-workspace',  label: 'Switch Workspace Type',    category: 'Settings', keywords: 'workspace solo team type',   action: function () { document.getElementById('workspaceType').focus(); } },
    { id: 'set-shortcuts',  label: 'Keyboard Shortcuts',       category: 'Settings', keywords: 'keyboard shortcuts help cheatsheet', shortcut: '?', action: function () { openCheatsheet(); } },
  ];

  var paletteOpen = false;
  var paletteSelectedIdx = 0;
  var filteredCommands = [];

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
        score += (100 - pos);
        if (c.label.toLowerCase().indexOf(tokens[t]) > -1) score += 50;
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
  var cheatsheetOpen = false;

  function openCheatsheet() {
    var el = document.getElementById('kbdCheatsheet');
    var backdrop = document.querySelector('.js-cheatsheet-backdrop');
    if (!el || !backdrop) return;

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
        '<div class="kbd-cheatsheet__row"><kbd>I</kbd> <span>Toggle AI summary</span></div>' +
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

    // Escape -- close overlays (drawer is handled by existing wireframe.js code)
    if (key === 'Escape') {
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

    var cmdInput = document.getElementById('cmdInput');
    if (cmdInput) {
      cmdInput.addEventListener('input', function () {
        renderPaletteResults(cmdInput.value);
      });
    }

    // Close handlers -- backdrop clicks and X buttons
    var cmdBackdrop = document.querySelector('.js-cmd-backdrop');
    if (cmdBackdrop) {
      cmdBackdrop.addEventListener('click', closePalette);
    }
    var cmdClose = document.querySelector('.js-cmd-close');
    if (cmdClose) {
      cmdClose.addEventListener('click', closePalette);
    }
    var csBackdrop = document.querySelector('.js-cheatsheet-backdrop');
    if (csBackdrop) {
      csBackdrop.addEventListener('click', closeCheatsheet);
    }
    var csClose = document.querySelector('.js-cheatsheet-close');
    if (csClose) {
      csClose.addEventListener('click', closeCheatsheet);
    }

    // Status bar mouse triggers
    var openPaletteBtn = document.querySelector('.js-open-palette');
    if (openPaletteBtn) {
      openPaletteBtn.addEventListener('click', openPalette);
    }
    var openCheatsheetBtn = document.querySelector('.js-open-cheatsheet');
    if (openCheatsheetBtn) {
      openCheatsheetBtn.addEventListener('click', openCheatsheet);
    }

    window.addEventListener('hashchange', function () {
      clearKbdSelection();
    });
  }

  return { init: init, openPalette: openPalette, closePalette: closePalette, openCheatsheet: openCheatsheet, closeCheatsheet: closeCheatsheet, showToast: showToast };
})();

// Initialize after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Keyboard.init);
} else {
  Keyboard.init();
}
