/* ===================================================================
   Portarium Alt-B: Activity-Stream / Timeline-Centred Prototype
   JavaScript — localStorage, routing, filters, threads, state mgmt
   =================================================================== */

const STORAGE_KEY = 'portarium_alt_b_v1';

// ---- Utility helpers ----

function qs(sel) {
  const el = document.querySelector(sel);
  if (!el) throw new Error('Missing element: ' + sel);
  return el;
}

function qsa(sel) {
  return Array.from(document.querySelectorAll(sel));
}

// ---- State persistence ----

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

// ---- Body data attributes ----

function applyBodyFlags(state) {
  document.body.dataset.persona = state.persona;
  document.body.dataset.workspaceType = state.workspaceType;
  document.body.dataset.systemState = state.systemState;
}

// ---- System state banners ----

function setBanners(systemState) {
  var degraded = qs('.js-banner-degraded');
  var misconfigured = qs('.js-banner-misconfigured');
  var policy = qs('.js-banner-policy');
  var rbac = qs('.js-banner-rbac');

  degraded.hidden = systemState !== 'degraded';
  misconfigured.hidden = systemState !== 'misconfigured';
  policy.hidden = systemState !== 'policy-blocked';
  rbac.hidden = systemState !== 'rbac-limited';
}

// ---- Empty states ----

function setEmptyStates(systemState) {
  var isEmpty = systemState === 'empty';

  // Stream
  var emptyStream = qs('.js-empty-stream');
  var streamContent = qs('.js-stream-content');
  emptyStream.hidden = !isEmpty;
  streamContent.hidden = isEmpty;

  // Entity
  var emptyEntity = qs('.js-empty-entity');
  var entityContent = qs('.js-entity-content');
  emptyEntity.hidden = !isEmpty;
  entityContent.hidden = isEmpty;

  // Evidence
  var emptyEvidence = qs('.js-empty-evidence');
  var evidenceContent = qs('.js-evidence-content');
  emptyEvidence.hidden = !isEmpty;
  evidenceContent.hidden = isEmpty;
}

// ---- Workspace type ----

function setWorkspaceType(workspaceType) {
  var showUnassigned = workspaceType === 'team';
  qsa('.js-chip-unassigned').forEach(function (chip) {
    chip.style.display = showUnassigned ? 'inline-flex' : 'none';
  });
  qsa('.js-owner-unassigned').forEach(function (cell) {
    cell.textContent = showUnassigned ? 'Unassigned' : 'Me';
  });
}

// ---- Persona defaults ----

var PERSONA_FILTER_DEFAULTS = {
  operator: {
    label: 'Default: failures + blocks',
    categories: { runs: true, approvals: true, evidence: true, system: true, 'work-items': true },
    actors: { me: true, system: true, machine: true },
  },
  approver: {
    label: 'Default: approvals assigned to me',
    categories: {
      runs: false,
      approvals: true,
      evidence: false,
      system: false,
      'work-items': false,
    },
    actors: { me: true, system: true, machine: false },
  },
  auditor: {
    label: 'Default: evidence + verification',
    categories: {
      runs: false,
      approvals: true,
      evidence: true,
      system: false,
      'work-items': false,
    },
    actors: { me: true, system: true, machine: true },
  },
  admin: {
    label: 'Default: config + policy events',
    categories: { runs: true, approvals: true, evidence: true, system: true, 'work-items': true },
    actors: { me: true, system: true, machine: true },
  },
};

function setPersona(persona) {
  // Update persona chip in filter rail
  var chip = qs('.js-persona-chip');
  var defaults = PERSONA_FILTER_DEFAULTS[persona];
  chip.textContent = defaults ? defaults.label : 'Default: all events';

  // Apply persona filter defaults to checkboxes
  if (defaults) {
    qsa('[data-filter-cat]').forEach(function (cb) {
      var cat = cb.getAttribute('data-filter-cat');
      if (Object.prototype.hasOwnProperty.call(defaults.categories, cat)) {
        cb.checked = defaults.categories[cat];
      }
    });
    qsa('[data-filter-actor]').forEach(function (cb) {
      var actor = cb.getAttribute('data-filter-actor');
      if (Object.prototype.hasOwnProperty.call(defaults.actors, actor)) {
        cb.checked = defaults.actors[actor];
      }
    });
  }

  // Update settings role display
  qsa('.js-settings-role').forEach(function (el) {
    el.textContent = persona;
  });

  // Disable action buttons and fields for RBAC-limited
  var isLimited = document.body.dataset.systemState === 'rbac-limited';
  qsa('.js-action-btn').forEach(function (btn) {
    btn.disabled = isLimited;
  });
  qsa('.js-action-field').forEach(function (field) {
    field.disabled = isLimited;
  });

  // Show misconfigured provider row in settings when misconfigured
  var misconfiguredRow = document.querySelector('.js-misconfigured-provider');
  if (misconfiguredRow) {
    misconfiguredRow.hidden = document.body.dataset.systemState !== 'misconfigured';
  }

  // Re-apply stream filters after persona defaults change
  applyStreamFilters();
}

// ---- Stream filtering ----

function applyStreamFilters() {
  var activeCats = {};
  qsa('[data-filter-cat]').forEach(function (cb) {
    activeCats[cb.getAttribute('data-filter-cat')] = cb.checked;
  });

  var activeActors = {};
  qsa('[data-filter-actor]').forEach(function (cb) {
    activeActors[cb.getAttribute('data-filter-actor')] = cb.checked;
  });

  var scopeSelect = document.getElementById('filterScope');
  var scope = scopeSelect ? scopeSelect.value : 'all';

  // Show/hide summary strip based on project scope
  var summaryStrip = document.getElementById('summaryStrip');
  if (summaryStrip) {
    summaryStrip.hidden = scope === 'all';
  }

  // Filter event cards
  qsa('.event-card').forEach(function (card) {
    var cat = card.getAttribute('data-category');
    var actor = card.getAttribute('data-actor');
    var project = card.getAttribute('data-project');

    var catVisible = Object.prototype.hasOwnProperty.call(activeCats, cat) ? activeCats[cat] : true;
    var actorVisible = Object.prototype.hasOwnProperty.call(activeActors, actor)
      ? activeActors[actor]
      : true;
    var scopeVisible = scope === 'all' || project === scope;

    card.style.display = catVisible && actorVisible && scopeVisible ? '' : 'none';
  });

  // Show/hide time markers based on whether any adjacent events are visible
  updateTimeMarkerVisibility();
}

function updateTimeMarkerVisibility() {
  var markers = qsa('.time-marker');
  markers.forEach(function (marker) {
    // Look at the next siblings until we hit another marker or end
    var nextEl = marker.nextElementSibling;
    var hasVisibleEvent = false;
    while (
      nextEl &&
      !nextEl.classList.contains('time-marker') &&
      !nextEl.classList.contains('pagination')
    ) {
      if (nextEl.classList.contains('event-card') && nextEl.style.display !== 'none') {
        hasVisibleEvent = true;
        break;
      }
      nextEl = nextEl.nextElementSibling;
    }
    marker.style.display = hasVisibleEvent ? '' : 'none';
  });
}

// ---- View tab switching (hash routing) ----

var VALID_VIEWS = ['stream', 'entity', 'evidence', 'settings', 'thread-wi-1099', 'thread-r-8920'];

function getViewFromHash() {
  var raw = (location.hash || '#stream').slice(1);
  return VALID_VIEWS.indexOf(raw) !== -1 ? raw : 'stream';
}

function activateView(viewId) {
  // Show/hide views
  qsa('.view').forEach(function (el) {
    var elView = el.getAttribute('data-view');
    el.classList.toggle('is-active', elView === viewId);
  });

  // Update tab active states
  qsa('.view-tab').forEach(function (tab) {
    var tabView = tab.getAttribute('data-view');
    var isActive = tabView === viewId;
    // Thread views should highlight the stream tab
    if (viewId.startsWith('thread-') && tabView === 'stream') {
      isActive = true;
    }
    tab.classList.toggle('view-tab--active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Show/hide filter rail (only on stream view)
  var filterRail = document.getElementById('filterRail');
  var app = document.getElementById('app');
  var showRail = viewId === 'stream';
  filterRail.style.display = showRail ? '' : 'none';
  app.classList.toggle('app--with-rail', showRail);
}

// ---- Thread expansion ----

function bindThreadExpansion() {
  qsa('.event-card__expand').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.getAttribute('aria-controls');
      var target = document.getElementById(targetId);
      if (!target) return;

      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      target.hidden = !target.hidden;

      // Update button text
      if (!expanded) {
        btn.innerHTML = '<span aria-hidden="true">&#9662;</span> Collapse thread';
      } else {
        btn.innerHTML = '<span aria-hidden="true">&#9656;</span> Expand thread (3 related)';
      }
    });
  });
}

// ---- Filter checkbox binding ----

function bindFilterCheckboxes() {
  qsa('[data-filter-cat], [data-filter-actor]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      applyStreamFilters();
    });
  });

  var scopeSelect = document.getElementById('filterScope');
  if (scopeSelect) {
    scopeSelect.addEventListener('change', function () {
      applyStreamFilters();
    });
  }
}

// ---- System state effects ----

function applySystemStateEffects(systemState) {
  // Disable action buttons when policy-blocked or rbac-limited
  var disableActions = systemState === 'policy-blocked' || systemState === 'rbac-limited';
  qsa('.js-action-btn').forEach(function (btn) {
    btn.disabled = disableActions;
  });
  qsa('.js-action-field').forEach(function (field) {
    field.disabled = disableActions;
  });

  // Show misconfigured provider in settings
  var misconfiguredRow = document.querySelector('.js-misconfigured-provider');
  if (misconfiguredRow) {
    misconfiguredRow.hidden = systemState !== 'misconfigured';
  }
}

// ---- Main render ----

function render(state) {
  applyBodyFlags(state);
  setBanners(state.systemState);
  setEmptyStates(state.systemState);
  setWorkspaceType(state.workspaceType);
  applySystemStateEffects(state.systemState);
  setPersona(state.persona);
  activateView(getViewFromHash());
}

// ---- Initialisation ----

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

  // Hash routing
  window.addEventListener('hashchange', function () {
    activateView(getViewFromHash());
    // Re-apply filters when returning to stream
    if (getViewFromHash() === 'stream') {
      applyStreamFilters();
    }
  });

  // Bind interactions
  bindThreadExpansion();
  bindFilterCheckboxes();

  // Initial render
  render(initial);
}

main();
