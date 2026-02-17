const STORAGE_KEY = 'portarium_lofi_v1';

function qs(sel) {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
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

function applyBodyFlags({ persona, workspaceType, systemState }) {
  document.body.dataset.persona = persona;
  document.body.dataset.workspaceType = workspaceType;
  document.body.dataset.systemState = systemState;
}

function setBanners(systemState) {
  const degraded = qs('.js-banner-degraded');
  const misconfigured = qs('.js-banner-misconfigured');
  const policy = qs('.js-banner-policy');
  const rbac = qs('.js-banner-rbac');

  degraded.hidden = systemState !== 'degraded';
  misconfigured.hidden = systemState !== 'misconfigured';
  policy.hidden = systemState !== 'policy-blocked';
  rbac.hidden = systemState !== 'rbac-limited';
}

function setEmptyStates(systemState) {
  const emptyInbox = qsa('.js-empty-inbox');
  const nonEmptyInbox = qsa('.js-nonempty-inbox');
  const emptyWi = qs('.js-empty-workitems');
  const nonEmptyWi = qs('.js-nonempty-workitems');

  const isEmpty = systemState === 'empty';
  for (const el of emptyInbox) el.hidden = !isEmpty;
  for (const el of nonEmptyInbox) el.hidden = isEmpty;
  emptyWi.hidden = !isEmpty;
  nonEmptyWi.hidden = isEmpty;
}

function setWorkspaceType(workspaceType) {
  const showUnassigned = workspaceType === 'team';
  for (const chip of qsa('.js-chip-unassigned')) {
    chip.style.display = showUnassigned ? 'inline-flex' : 'none';
  }
  for (const cell of qsa('.js-owner-unassigned')) {
    cell.textContent = showUnassigned ? 'Unassigned' : 'Me';
  }
}

function setPersona(persona) {
  const personaChip = qs('.js-filter-persona');
  const chipText = {
    operator: 'Default filters: failures + blocks',
    approver: 'Default filters: approvals assigned to me',
    auditor: 'Default filters: evidence + verification',
    admin: 'Default filters: configuration + policy',
  }[persona];
  personaChip.textContent = chipText ?? 'Default filters';

  // SoD callout is mainly relevant when acting as Approver; we still hide it for other personas to reduce noise.
  const sodCallout = qs('.js-callout-sod');
  sodCallout.style.display = persona === 'approver' ? 'block' : 'none';
}

function activateScreen(screen) {
  const target = `screen-${screen}`;
  for (const el of qsa('.screen')) {
    el.classList.toggle('is-active', el.id === target);
  }
  for (const link of qsa('.nav__item')) {
    const href = link.getAttribute('href') || '';
    link.setAttribute('aria-current', href === `#${screen}` ? 'page' : 'false');
  }
}

function getScreenFromHash() {
  const raw = (location.hash || '#inbox').slice(1);
  const allowed = new Set([
    'inbox',
    'project',
    'work-items',
    'work-item',
    'run',
    'approvals',
    'evidence',
    'settings',
  ]);
  return allowed.has(raw) ? raw : 'inbox';
}

function bindTabs() {
  const tabs = qsa('.tab');
  if (tabs.length === 0) return;

  const panes = qsa('.tabpane');
  function setTab(tabId) {
    for (const t of tabs) t.classList.toggle('tab--active', t.dataset.tab === tabId);
    for (const p of panes) p.classList.toggle('tabpane--active', p.dataset.pane === tabId);
  }

  for (const t of tabs) {
    t.addEventListener('click', () => setTab(t.dataset.tab));
  }
}

function render(state) {
  applyBodyFlags(state);
  setBanners(state.systemState);
  setEmptyStates(state.systemState);
  setWorkspaceType(state.workspaceType);
  setPersona(state.persona);
  activateScreen(getScreenFromHash());
}

function main() {
  const persona = qs('#persona');
  const workspaceType = qs('#workspaceType');
  const systemState = qs('#systemState');

  const saved = getState();
  const initial = {
    persona: saved?.persona ?? 'operator',
    workspaceType: saved?.workspaceType ?? 'team',
    systemState: saved?.systemState ?? 'normal',
  };

  persona.value = initial.persona;
  workspaceType.value = initial.workspaceType;
  systemState.value = initial.systemState;

  function onChange() {
    const next = {
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

  window.addEventListener('hashchange', () => render(getState() ?? initial));

  bindTabs();
  render(initial);
}

main();
