/* ============================================================
   Portarium Cockpit Lo-Fi Prototype  --  wireframe.js
   ============================================================ */

const STORAGE_KEY = 'portarium_cockpit_v1';

/* ---- Helpers ---- */
function qs(sel, root) {
  const el = (root || document).querySelector(sel);
  if (!el) throw new Error('Missing element: ' + sel);
  return el;
}

function qsa(sel, root) {
  return Array.from((root || document).querySelectorAll(sel));
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

/* ============================================================
   DRAWER CONTENT TEMPLATES
   ============================================================ */
const DRAWER_CONTENT = {
  /* ---- Default context ---- */
  context: {
    title: 'Correlation Context',
    body: `
      <div>
        <div class="drawer-section__title">Correlation Thread</div>
        <div class="list">
          <a class="row" href="#work-item" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">WI-1099 Invoice correction</div>
              <div class="row__subtle">Work Item (hub)</div>
            </div>
          </a>
          <a class="row" href="#run" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">R-8920 Invoice correction</div>
              <div class="row__subtle">Run (paused at gate)</div>
            </div>
          </a>
          <a class="row" href="#approvals" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">AG-442 Approve Plan</div>
              <div class="row__subtle">Approval Gate (pending)</div>
            </div>
          </a>
          <a class="row" href="#evidence" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">12 Evidence entries</div>
              <div class="row__subtle">Chain verified</div>
            </div>
          </a>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">SoR Ref Cluster</div>
        <div class="chips">
          <span class="chip"><span class="port-icon">FA</span> NetSuite | Invoice | INV-22318</span>
          <span class="chip"><span class="port-icon">PB</span> Stripe | Charge | ch_9d2a</span>
          <span class="chip"><span class="port-icon">CS</span> Zendesk | Ticket | 4831</span>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Policy Evaluation</div>
        <div class="callout callout--policy">
          Tier: <strong>Human-approve</strong><br>
          Rule: Invoice writes &gt; $10,000<br>
          Required approvers: 2<br>
          SoD: maker-checker
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Next Action</div>
        <div class="next-action">
          <div>
            <div class="next-action__text">Review and approve Plan</div>
            <div class="next-action__subtle">Approval Gate pending for R-8920</div>
          </div>
          <a class="btn btn--primary btn--small" href="#run">Go</a>
        </div>
      </div>
    `,
  },

  /* ---- Work Item WI-1099 context ---- */
  'wi-1099': {
    title: 'WI-1099 Context',
    body: `
      <div>
        <div class="drawer-section__title">Correlation Thread</div>
        <div class="list">
          <a class="row" href="#work-item" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">WI-1099 Invoice correction for ACME</div>
              <div class="row__subtle">Work Item (hub) | Owner: Me</div>
            </div>
          </a>
          <a class="row" href="#run" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">R-8920 Invoice correction</div>
              <div class="row__subtle">Run | Paused at Approval Gate</div>
            </div>
          </a>
          <a class="row" href="#approvals" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">AG-442 Approve Plan</div>
              <div class="row__subtle">Approval Gate | Pending</div>
            </div>
          </a>
          <a class="row" href="#evidence" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">12 Evidence entries</div>
              <div class="row__subtle">Chain: verified (120-146)</div>
            </div>
          </a>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">SoR Ref Cluster</div>
        <div class="chips">
          <span class="chip"><span class="port-icon">FA</span> NetSuite | Invoice | INV-22318</span>
          <span class="chip"><span class="port-icon">PB</span> Stripe | Charge | ch_9d2a</span>
          <span class="chip"><span class="port-icon">CS</span> Zendesk | Ticket | 4831</span>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Policy Evaluation</div>
        <div class="callout callout--policy">
          Tier: <strong>Human-approve</strong> | Rule: Invoice writes &gt; $10,000<br>
          Required approvers: 2 | SoD: maker-checker<br>
          <em>Why this tier:</em> Invoice total ($12,500) exceeds $10,000 threshold.
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Next Action</div>
        <div class="next-action">
          <div>
            <div class="next-action__text">Review and approve Plan for R-8920</div>
            <div class="next-action__subtle">SoD: requires a different approver than initiator</div>
          </div>
          <a class="btn btn--primary btn--small" href="#run">Review</a>
        </div>
      </div>
    `,
  },

  /* ---- Approval Gate context ---- */
  'ag-wi1099': {
    title: 'AG-442 Context',
    body: `
      <div>
        <div class="drawer-section__title">Correlation Thread</div>
        <div class="list">
          <a class="row" href="#work-item" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">WI-1099 Invoice correction for ACME</div>
              <div class="row__subtle">Work Item (origin)</div>
            </div>
          </a>
          <a class="row" href="#run" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">R-8920 Invoice correction</div>
              <div class="row__subtle">Run (paused)</div>
            </div>
          </a>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">SoR Ref Cluster</div>
        <div class="chips">
          <span class="chip"><span class="port-icon">FA</span> NetSuite | Invoice | INV-22318</span>
          <span class="chip"><span class="port-icon">PB</span> Stripe | Charge | ch_9d2a</span>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Policy Evaluation</div>
        <div class="callout callout--policy">
          Tier: <strong>Human-approve</strong><br>
          SoD: maker-checker (initiator cannot self-approve)<br>
          Required approvers: 2
        </div>
      </div>
    `,
  },

  /* ---- Run failed context ---- */
  'run-failed': {
    title: 'R-8850 Context',
    body: `
      <div>
        <div class="drawer-section__title">Correlation Thread</div>
        <div class="list">
          <a class="row" href="#work-item" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">WI-1021 CRM sync</div>
              <div class="row__subtle">Work Item</div>
            </div>
          </a>
          <div class="row row--static">
            <div class="row__main">
              <div class="row__title">R-8850 Update Opportunity</div>
              <div class="row__subtle">Run | Failed (rate limit)</div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">SoR Ref Cluster</div>
        <div class="chips">
          <span class="chip"><span class="port-icon">CR</span> Salesforce | Opportunity | OPP-2291</span>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Next Action</div>
        <div class="next-action">
          <div>
            <div class="next-action__text">Retry run after rate limit window</div>
            <div class="next-action__subtle">Idempotency key present: retry is safe</div>
          </div>
          <button class="btn btn--primary btn--small" type="button">Retry</button>
        </div>
      </div>
    `,
  },

  /* ---- Run R-8920 context ---- */
  'run-8920': {
    title: 'R-8920 Context',
    body: `
      <div>
        <div class="drawer-section__title">Correlation Thread</div>
        <div class="list">
          <a class="row" href="#work-item" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">WI-1099 Invoice correction for ACME</div>
              <div class="row__subtle">Work Item (hub)</div>
            </div>
          </a>
          <div class="row row--static">
            <div class="row__main">
              <div class="row__title">R-8920 Invoice correction</div>
              <div class="row__subtle">Run | Paused at Approval Gate</div>
            </div>
          </div>
          <a class="row" href="#approvals" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">AG-442 Approve Plan</div>
              <div class="row__subtle">Approval Gate | Pending</div>
            </div>
          </a>
          <a class="row" href="#evidence" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">Evidence entries (2)</div>
              <div class="row__subtle">Plan recorded, Gate opened</div>
            </div>
          </a>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">SoR Ref Cluster</div>
        <div class="chips">
          <span class="chip"><span class="port-icon">FA</span> NetSuite | Invoice | INV-22318</span>
          <span class="chip"><span class="port-icon">PB</span> Stripe | Charge | ch_9d2a</span>
          <span class="chip"><span class="port-icon">CS</span> Zendesk | Ticket | 4831</span>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Policy Evaluation</div>
        <div class="callout callout--policy">
          Tier: <strong>Human-approve</strong><br>
          Rule: Invoice writes &gt; $10,000<br>
          SoD: maker-checker
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Next Action</div>
        <div class="next-action">
          <div>
            <div class="next-action__text">Awaiting approval decision</div>
            <div class="next-action__subtle">1 of 2 required approvers still needed</div>
          </div>
        </div>
      </div>
    `,
  },

  /* ---- Evidence entry context ---- */
  'evidence-1': {
    title: 'Evidence Context',
    body: `
      <div>
        <div class="drawer-section__title">Correlation Thread</div>
        <div class="list">
          <div class="row row--static">
            <div class="row__main">
              <div class="row__title">EvidenceEntry: Approval decision submitted</div>
              <div class="row__subtle">Category: Approval | Actor: User</div>
            </div>
          </div>
          <a class="row" href="#run" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">R-8920 Invoice correction</div>
              <div class="row__subtle">Linked Run</div>
            </div>
          </a>
          <a class="row" href="#work-item" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">WI-1099 Invoice correction for ACME</div>
              <div class="row__subtle">Linked Work Item</div>
            </div>
          </a>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Canonical Object</div>
        <div class="card">
          <div class="card__title"><span class="port-icon">FA</span> Invoice</div>
          <div class="subtle">NetSuite | INV-22318 | Total: $12,500</div>
        </div>
      </div>
    `,
  },

  'evidence-2': {
    title: 'Evidence Context',
    body: `
      <div>
        <div class="drawer-section__title">Correlation Thread</div>
        <div class="list">
          <div class="row row--static">
            <div class="row__main">
              <div class="row__title">EvidenceEntry: Action executed (adapter write)</div>
              <div class="row__subtle">Category: Action | Actor: Adapter</div>
            </div>
          </div>
          <a class="row" href="#run" style="text-decoration:none">
            <div class="row__main">
              <div class="row__title">R-8920 Invoice correction</div>
              <div class="row__subtle">Linked Run</div>
            </div>
          </a>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Canonical Object</div>
        <div class="card">
          <div class="card__title"><span class="port-icon">PB</span> Charge</div>
          <div class="subtle">Stripe | ch_9d2a | Amount: $12,500</div>
        </div>
      </div>
    `,
  },
};

/* ============================================================
   ROUTING
   ============================================================ */
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

function getScreenFromHash() {
  const raw = (location.hash || '#inbox').slice(1);
  return SCREENS.includes(raw) ? raw : 'inbox';
}

function activateScreen(screen) {
  const target = 'screen-' + screen;
  for (const el of qsa('.screen')) {
    el.classList.toggle('is-active', el.id === target);
  }
  /* Map detail views to their parent nav item for sidebar highlighting (H6) */
  const parentMap = { 'work-item': 'work-items', run: 'runs' };
  const navScreen = parentMap[screen] || screen;
  for (const link of qsa('.nav__item')) {
    const href = link.getAttribute('href') || '';
    link.setAttribute('aria-current', href === '#' + navScreen ? 'page' : 'false');
  }
}

/* ============================================================
   BANNERS
   ============================================================ */
function setBanners(systemState) {
  qs('.js-banner-degraded').hidden = systemState !== 'degraded';
  qs('.js-banner-misconfigured').hidden = systemState !== 'misconfigured';
  qs('.js-banner-policy').hidden = systemState !== 'policy-blocked';
  qs('.js-banner-rbac').hidden = systemState !== 'rbac-limited';
}

/* ============================================================
   EMPTY STATES
   ============================================================ */
function setEmptyStates(systemState) {
  const isEmpty = systemState === 'empty';

  for (const el of qsa('.js-empty-inbox')) el.hidden = !isEmpty;
  for (const el of qsa('.js-nonempty-inbox')) el.hidden = isEmpty;

  const emptyWi = document.querySelector('.js-empty-workitems');
  const nonEmptyWi = document.querySelector('.js-nonempty-workitems');
  if (emptyWi) emptyWi.hidden = !isEmpty;
  if (nonEmptyWi) nonEmptyWi.hidden = isEmpty;

  const emptyEv = document.querySelector('.js-empty-evidence');
  const nonEmptyEv = document.querySelector('.js-nonempty-evidence');
  if (emptyEv) emptyEv.hidden = !isEmpty;
  if (nonEmptyEv) nonEmptyEv.hidden = isEmpty;

  const emptyRuns = document.querySelector('.js-empty-runs');
  const nonEmptyRuns = document.querySelector('.js-nonempty-runs');
  if (emptyRuns) emptyRuns.hidden = !isEmpty;
  if (nonEmptyRuns) nonEmptyRuns.hidden = isEmpty;
}

/* ============================================================
   WORKSPACE TYPE
   ============================================================ */
function setWorkspaceType(workspaceType) {
  const showUnassigned = workspaceType === 'team';
  for (const chip of qsa('.js-chip-unassigned')) {
    chip.style.display = showUnassigned ? 'inline-flex' : 'none';
  }
  for (const cell of qsa('.js-owner-unassigned')) {
    cell.textContent = showUnassigned ? 'Unassigned' : 'Me';
  }
}

/* ============================================================
   PERSONA SWITCHING
   ============================================================ */
function setPersona(persona) {
  /* Default filter chip text */
  const filterChip = document.querySelector('.js-filter-persona');
  if (filterChip) {
    const chipText = {
      operator: 'Default filters: failures + blocks',
      approver: 'Default filters: approvals assigned to me',
      auditor: 'Default filters: evidence + verification',
      admin: 'Default filters: configuration + health',
    }[persona];
    filterChip.textContent = chipText || 'Default filters';
  }

  /* Inbox CTA button */
  const inboxCta = document.querySelector('.js-inbox-cta');
  if (inboxCta) {
    const ctaConfig = {
      operator: { text: 'Start workflow', href: '#work-items' },
      approver: { text: 'Review + decide', href: '#approvals' },
      auditor: { text: 'Export evidence', href: '#evidence' },
      admin: { text: 'Diagnose', href: '#settings' },
    }[persona];
    if (ctaConfig) {
      inboxCta.textContent = ctaConfig.text;
      inboxCta.href = ctaConfig.href;
    }
  }

  /* Next action prompt text */
  const nextActionText = document.querySelector('.js-next-action-text');
  if (nextActionText) {
    const naText = {
      operator: 'Run R-8850 failed: CRM sync hit rate limit. Retry available.',
      approver: 'Approval Gate pending: Create Invoice in NetSuite (WI-1099 / R-8920).',
      auditor: 'Evidence chain verified (120-146). 2 entries approaching retention expiry.',
      admin: 'CrmSales port family has no adapter configured. 1 credential expiring soon.',
    }[persona];
    nextActionText.textContent = naText || '';
  }

  /* SoD callout visibility */
  const sodCallout = document.querySelector('.js-callout-sod');
  if (sodCallout) {
    sodCallout.style.display = persona === 'approver' ? 'block' : 'none';
  }

  /* ---- Inbox card reordering + featured + show/hide (Fix 1) ---- */
  const inboxLayout = {
    operator: {
      primary: 'failures',
      secondary: ['approvals', 'violations'],
      hidden: ['evidence', 'health'],
    },
    approver: {
      primary: 'approvals',
      secondary: ['violations'],
      hidden: ['failures', 'evidence', 'health'],
    },
    auditor: {
      primary: 'evidence',
      secondary: ['violations'],
      hidden: ['failures', 'approvals', 'health'],
    },
    admin: {
      primary: 'health',
      secondary: ['violations', 'failures'],
      hidden: ['approvals', 'evidence'],
    },
  }[persona];

  if (inboxLayout) {
    const allInboxCards = qsa('[data-inbox-section]');
    const visible = [inboxLayout.primary, ...inboxLayout.secondary];
    for (const card of allInboxCards) {
      const section = card.dataset.inboxSection;
      if (inboxLayout.hidden.includes(section)) {
        card.hidden = true;
        card.classList.remove('card--featured');
        card.style.order = '';
      } else {
        card.hidden = false;
        if (section === inboxLayout.primary) {
          card.classList.add('card--featured');
          card.style.order = '0';
        } else {
          card.classList.remove('card--featured');
          card.style.order = String(visible.indexOf(section) + 1);
        }
      }
    }
  }

  /* Sidebar quick actions */
  const action1 = document.querySelector('.js-persona-action-1');
  const action2 = document.querySelector('.js-persona-action-2');
  if (action1 && action2) {
    const actions = {
      operator: [
        { text: 'Start workflow', href: '#work-items' },
        { text: 'Retry failed runs', href: '#runs' },
      ],
      approver: [
        { text: 'Review approvals', href: '#approvals' },
        { text: 'View pending gates', href: '#inbox' },
      ],
      auditor: [
        { text: 'Verify evidence', href: '#evidence' },
        { text: 'Export bundle', href: '#evidence' },
      ],
      admin: [
        { text: 'Diagnose health', href: '#settings' },
        { text: 'Configure adapters', href: '#settings' },
      ],
    }[persona];
    if (actions) {
      action1.textContent = actions[0].text;
      action1.href = actions[0].href;
      action2.textContent = actions[1].text;
      action2.href = actions[1].href;
    }
  }

  /* Sidebar persona hint */
  const hintTitle = document.querySelector('.js-persona-hint-title');
  const hintBody = document.querySelector('.js-persona-hint-body');
  if (hintTitle && hintBody) {
    const hints = {
      operator: {
        title: 'Operator mode',
        body: 'Failures and blocks surfaced first. Use quick actions to start workflows or retry failed runs.',
      },
      approver: {
        title: 'Approver mode',
        body: 'Approval gates prioritised. SoD constraints visible. Review and decide with mandatory rationale.',
      },
      auditor: {
        title: 'Auditor mode',
        body: 'Evidence and verification first. Chain integrity visible. Export actions prominent.',
      },
      admin: {
        title: 'Admin mode',
        body: 'Configuration and health surfaced. Adapter status, credential expiry, and policy diagnostics visible.',
      },
    }[persona];
    if (hints) {
      hintTitle.textContent = hints.title;
      hintBody.textContent = hints.body;
    }
  }
}

/* ============================================================
   STATUS BAR
   ============================================================ */
function setStatusBar(systemState) {
  const runsDot = document.querySelector('.js-status-runs');
  const runsText = document.querySelector('.js-status-runs-text');
  const chainDot = document.querySelector('.js-status-chain');
  const chainText = document.querySelector('.js-status-chain-text');
  const eventsDot = document.querySelector('.js-status-events');
  const eventsText = document.querySelector('.js-status-events-text');

  /* Reset to defaults */
  if (runsDot) runsDot.className = 'statusbar__dot statusbar__dot--ok js-status-runs';
  if (runsText) runsText.textContent = 'Runs: 1 active';
  if (chainDot) chainDot.className = 'statusbar__dot statusbar__dot--ok js-status-chain';
  if (chainText) chainText.textContent = 'Chain: verified';
  if (eventsDot) eventsDot.className = 'statusbar__dot statusbar__dot--ok js-status-events';
  if (eventsText) eventsText.textContent = 'Events: connected';

  /* Degraded: events amber */
  if (systemState === 'degraded') {
    if (eventsDot) eventsDot.className = 'statusbar__dot statusbar__dot--warn js-status-events';
    if (eventsText) eventsText.textContent = 'Events: degraded';
  }

  /* Misconfigured: runs amber (Fix 8) */
  if (systemState === 'misconfigured') {
    if (runsDot) runsDot.className = 'statusbar__dot statusbar__dot--warn js-status-runs';
    if (runsText) runsText.textContent = 'Runs: config warning';
  }

  /* Policy blocked: chain amber (Fix 8) */
  if (systemState === 'policy-blocked') {
    if (chainDot) chainDot.className = 'statusbar__dot statusbar__dot--warn js-status-chain';
    if (chainText) chainText.textContent = 'Chain: policy hold';
  }
}

/* ============================================================
   RIGHT DRAWER
   ============================================================ */
function openDrawer(contentId) {
  const content = DRAWER_CONTENT[contentId] || DRAWER_CONTENT.context;
  const drawer = qs('#drawer');
  qs('#drawerTitle').textContent = content.title;
  qs('#drawerBody').innerHTML = content.body;
  drawer.classList.add('is-open');
  qs('.app').classList.add('app--drawer-open');
  qs('#drawerClose').focus();
}

function closeDrawer() {
  qs('#drawer').classList.remove('is-open');
  qs('.app').classList.remove('app--drawer-open');
}

/* ============================================================
   TABS
   ============================================================ */
function bindTabs() {
  const tabContainers = qsa('.tabs');
  for (const container of tabContainers) {
    const parent = container.closest('.agent-detail') || container.closest('.screen') || document;
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

/* ============================================================
   BODY FLAGS
   ============================================================ */
function applyBodyFlags({ persona, workspaceType, systemState }) {
  document.body.dataset.persona = persona;
  document.body.dataset.workspaceType = workspaceType;
  document.body.dataset.systemState = systemState;
}

/* ============================================================
   RENDER
   ============================================================ */
function render(state) {
  applyBodyFlags(state);
  setBanners(state.systemState);
  setEmptyStates(state.systemState);
  setWorkspaceType(state.workspaceType);
  setPersona(state.persona);
  setStatusBar(state.systemState);
  activateScreen(getScreenFromHash());
  ABToggle.applyAll();
  AISummaryToggle.apply();
}

/* ============================================================
   A/B LAYOUT VARIANT TOGGLE CONTROLLER
   ============================================================ */
const ABToggle = (function () {
  'use strict';
  const AB_STORAGE_KEY = 'portarium_ab_variants';
  const registry = {};

  function loadState() {
    try {
      const raw = sessionStorage.getItem(AB_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  function saveState(state) {
    sessionStorage.setItem(AB_STORAGE_KEY, JSON.stringify(state));
  }
  function getVariant(screenId) {
    return loadState()[screenId] || 'A';
  }
  function setVariant(screenId, variant) {
    const s = loadState();
    s[screenId] = variant;
    saveState(s);
  }

  function register(screenId, variants, renderers, labelMap) {
    registry[screenId] = { variants, renderers, labelMap: labelMap || {} };
  }

  function injectToggles() {
    for (const [screenId, config] of Object.entries(registry)) {
      const screenEl = document.querySelector('[data-screen="' + screenId + '"]');
      if (!screenEl) continue;
      const header = screenEl.querySelector('.screen__header');
      if (header) header.style.position = 'relative';

      const btn = document.createElement('button');
      btn.className = 'ab-toggle';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Switch layout variant');
      btn.title = 'Switch layout variant';
      btn.dataset.screen = screenId;

      const track = document.createElement('span');
      track.className = 'ab-toggle__track';
      const currentVariant = getVariant(screenId);

      config.variants.forEach(function (v, i) {
        if (i > 0) {
          const d = document.createElement('span');
          d.className = 'ab-toggle__divider';
          d.textContent = '|';
          track.appendChild(d);
        }
        const label = document.createElement('span');
        label.className = 'ab-toggle__label';
        label.dataset.variant = v;
        label.textContent = config.labelMap[v] || v;
        if (v === currentVariant) label.classList.add('ab-toggle__label--active');
        track.appendChild(label);
      });
      btn.appendChild(track);

      btn.addEventListener('click', function () {
        const current = getVariant(screenId);
        const idx = config.variants.indexOf(current);
        const next = config.variants[(idx + 1) % config.variants.length];
        setVariant(screenId, next);
        btn.querySelectorAll('.ab-toggle__label').forEach(function (lbl) {
          lbl.classList.toggle('ab-toggle__label--active', lbl.dataset.variant === next);
        });
        btn.classList.remove('ab-toggle--animating');
        void btn.offsetWidth;
        btn.classList.add('ab-toggle--animating');
        applyVariant(screenId);
      });

      const actionsEl = screenEl.querySelector('.screen__actions');
      if (actionsEl) actionsEl.insertBefore(btn, actionsEl.firstChild);
      else if (header) header.appendChild(btn);
    }
  }

  function applyVariant(screenId) {
    const config = registry[screenId];
    if (!config) return;
    const screenEl = document.querySelector('[data-screen="' + screenId + '"]');
    if (!screenEl) return;
    const variant = getVariant(screenId);
    const renderer = config.renderers[variant];
    if (typeof renderer === 'function') renderer(screenEl);
    const active = screenEl.querySelector('.ab-variant--active');
    if (active) {
      active.classList.remove('ab-variant--entering');
      void active.offsetWidth;
      active.classList.add('ab-variant--entering');
    }
    const btn = screenEl.querySelector('.ab-toggle');
    if (btn)
      btn.querySelectorAll('.ab-toggle__label').forEach(function (lbl) {
        lbl.classList.toggle('ab-toggle__label--active', lbl.dataset.variant === variant);
      });
  }

  function applyAll() {
    for (const screenId of Object.keys(registry)) applyVariant(screenId);
  }

  return { register, injectToggles, applyVariant, applyAll, getVariant, setVariant };
})();

/* ============================================================
   AI SUMMARY FEATURE FLAG
   ============================================================ */
const AISummaryToggle = (function () {
  'use strict';

  const STORAGE_KEY = 'portarium_ai_summary';
  let enabled = false;

  function loadState() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  function saveState(val) {
    sessionStorage.setItem(STORAGE_KEY, String(val));
  }

  function isEnabled() {
    return enabled;
  }

  function toggle() {
    enabled = !enabled;
    saveState(enabled);
    apply();
    return enabled;
  }

  function apply() {
    /* Toggle button state */
    var btn = document.querySelector('.js-ai-toggle');
    if (btn) {
      btn.classList.toggle('ai-toggle--active', enabled);
      btn.setAttribute('aria-pressed', String(enabled));
    }

    /* Show/hide all AI summary blocks */
    var summaries = document.querySelectorAll('.ai-summary');
    summaries.forEach(function (el) {
      el.classList.toggle('ai-summary--hidden', !enabled);
    });
  }

  function init() {
    enabled = loadState();

    /* Inject toggle button into Approvals screen header */
    var approvalsScreen = document.querySelector('#screen-approvals');
    if (!approvalsScreen) return;
    var actions = approvalsScreen.querySelector('.screen__actions');
    if (!actions) return;

    var btn = document.createElement('button');
    btn.className = 'ai-toggle js-ai-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle AI summaries');
    btn.setAttribute('aria-pressed', String(enabled));
    btn.title = 'Toggle AI summaries on approval cards';
    if (enabled) btn.classList.add('ai-toggle--active');

    btn.innerHTML = '<span class="ai-toggle__dot"></span>' + '<span>AI Summary</span>';

    btn.addEventListener('click', function () {
      toggle();
    });

    actions.insertBefore(btn, actions.firstChild);
    apply();
  }

  return { init, isEnabled, toggle, apply };
})();

/* ============================================================
   A/B VARIANT REGISTRATIONS
   ============================================================ */
function showVariant(screenEl, variantLetter) {
  const wrappers = screenEl.querySelectorAll('.ab-variant');
  wrappers.forEach(function (w) {
    var isTarget =
      w.dataset.variant === variantLetter && w.dataset.variantScreen === screenEl.dataset.screen;
    w.classList.toggle('ab-variant--active', isTarget);
  });
}

ABToggle.register(
  'inbox',
  ['A', 'B'],
  {
    A: function (el) {
      showVariant(el, 'A');
    },
    B: function (el) {
      showVariant(el, 'B');
    },
  },
  { A: 'Cards', B: 'Matrix' },
);
ABToggle.register(
  'work-items',
  ['A', 'B'],
  {
    A: function (el) {
      showVariant(el, 'A');
    },
    B: function (el) {
      showVariant(el, 'B');
    },
  },
  { A: 'Table', B: 'Kanban' },
);
ABToggle.register(
  'project',
  ['A', 'B'],
  {
    A: function (el) {
      showVariant(el, 'A');
    },
    B: function (el) {
      showVariant(el, 'B');
    },
  },
  { A: 'Summary', B: 'Dashboard' },
);

/* ============================================================
   APPROVAL TRIAGE
   ============================================================ */
let triageIndex = 0;
const triageResults = { approved: 0, denied: 0, changes: 0, skipped: 0 };

function triageAction(action) {
  var requiresRationale = action === 'deny' || action === 'changes';
  var rationaleEl = document.getElementById('triageRationale');
  var rationaleInput = document.getElementById('triageRationaleInput');

  if (requiresRationale && rationaleEl) {
    rationaleEl.hidden = false;
    var label =
      action === 'deny'
        ? 'Rationale (required for deny)'
        : 'Rationale (required for request changes)';
    document.getElementById('triageRationaleLabel').textContent = label;
    rationaleInput.focus();
    rationaleEl.dataset.pendingAction = action;
    return;
  }

  var card = document.getElementById('triageCard');
  if (!card) return;
  var exitClass = {
    approve: 'triage-card--exit-right',
    deny: 'triage-card--exit-left',
    changes: 'triage-card--exit-up',
    skip: 'triage-card--exit-down',
  }[action];
  card.classList.add(exitClass);
  var resultKey = { approve: 'approved', deny: 'denied', changes: 'changes', skip: 'skipped' }[
    action
  ];
  triageResults[resultKey]++;
  setTimeout(function () {
    card.classList.remove(exitClass);
    triageIndex++;
    var progressFill = document.querySelector('.triage__progress-fill');
    var currentSpan = document.querySelector('.triage__current');
    if (progressFill) progressFill.style.width = (triageIndex / 2) * 100 + '%';
    if (currentSpan) currentSpan.textContent = Math.min(triageIndex + 1, 2);
    if (triageIndex >= 2) {
      var triageEl = document.getElementById('triage');
      var completeEl = document.getElementById('triageComplete');
      if (triageEl) triageEl.hidden = true;
      if (completeEl) completeEl.hidden = false;
    }
  }, 350);
}

/* ============================================================
   WORKFLOW BUILDER - Node Selection
   ============================================================ */
document.addEventListener('click', function (e) {
  var node = e.target.closest('.wf-node');
  if (!node) return;
  qsa('.wf-node').forEach(function (n) {
    n.classList.remove('wf-node--selected');
  });
  node.classList.add('wf-node--selected');
  var configPanel = document.getElementById('wfConfig');
  if (configPanel) {
    var nameEl = node.querySelector('.wf-node__name');
    var nodeName = nameEl ? nameEl.textContent : 'Step';
    var configTitle = configPanel.querySelector('.wf-config__title');
    var configSubtitle = configPanel.querySelector('.wf-config__subtitle');
    if (configTitle) configTitle.textContent = nodeName;
    if (configSubtitle)
      configSubtitle.textContent = 'Configure step: ' + (node.dataset.nodeId || '');
  }
});

/* ============================================================
   AGENT CONFIG - Card Selection
   ============================================================ */
document.addEventListener('click', function (e) {
  var card = e.target.closest('.agent-card');
  if (!card) return;
  qsa('.agent-card').forEach(function (c) {
    c.classList.remove('agent-card--selected');
  });
  card.classList.add('agent-card--selected');
  var detailPanel = document.getElementById('agentDetail');
  if (detailPanel) {
    var nameEl = card.querySelector('.agent-card__name');
    var name = nameEl ? nameEl.textContent : 'Agent';
    var detailName = detailPanel.querySelector('.agent-detail__name');
    if (detailName) detailName.textContent = name;
    var statusEl = card.querySelector('.status');
    var banner = detailPanel.querySelector('.integrity-banner');
    if (banner && statusEl) {
      var text = statusEl.textContent.trim();
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

/* ============================================================
   MAIN
   ============================================================ */
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

  /* Hash routing */
  window.addEventListener('hashchange', () => {
    closeDrawer();
    render(getState() ?? initial);
  });

  /* Drawer triggers */
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.js-drawer-trigger');
    if (trigger) {
      const drawerId = trigger.dataset.drawer;
      if (drawerId) {
        openDrawer(drawerId);
        /* Don't prevent default for links -- let them navigate AND open drawer */
      }
    }
  });

  /* Drawer close button */
  qs('#drawerClose').addEventListener('click', closeDrawer);

  /* Escape key to close drawer */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const drawer = qs('#drawer');
      if (drawer.classList.contains('is-open')) {
        closeDrawer();
        e.preventDefault();
      }
    }
  });

  /* Tabs */
  bindTabs();

  /* A/B Toggle */
  ABToggle.injectToggles();

  /* AI Summary Toggle */
  AISummaryToggle.init();

  /* Triage mode toggle */
  document.addEventListener('click', function (e) {
    var modeBtn = e.target.closest('.js-triage-mode');
    if (!modeBtn) return;
    var mode = modeBtn.dataset.mode;
    var tableWrap = document.querySelector('#screen-approvals .js-approvals-table');
    var triageEl = document.getElementById('triage');
    if (mode === 'triage') {
      if (tableWrap) tableWrap.hidden = true;
      if (triageEl) triageEl.hidden = false;
    } else {
      if (tableWrap) tableWrap.hidden = false;
      if (triageEl) triageEl.hidden = true;
    }
    qsa('.js-triage-mode').forEach(function (btn) {
      btn.classList.toggle('btn--primary', btn.dataset.mode === mode);
    });
  });

  /* Triage action button clicks */
  document.addEventListener('click', function (e) {
    var actionBtn = e.target.closest('.triage__action');
    if (actionBtn) triageAction(actionBtn.dataset.action);
  });

  /* Triage rationale submit/cancel */
  document.addEventListener('click', function (e) {
    if (e.target.id === 'triageRationaleSubmit') {
      var rationaleEl = document.getElementById('triageRationale');
      var action = rationaleEl.dataset.pendingAction;
      rationaleEl.hidden = true;
      document.getElementById('triageRationaleInput').value = '';
      triageAction(action);
    }
    if (e.target.id === 'triageRationaleCancel') {
      document.getElementById('triageRationale').hidden = true;
      document.getElementById('triageRationaleInput').value = '';
    }
  });

  /* Triage expand/collapse */
  document.addEventListener('click', function (e) {
    if (e.target.closest('.js-triage-expand')) {
      var back = document.querySelector('.triage-card__back');
      if (back) back.hidden = false;
    }
    if (e.target.closest('.js-triage-collapse')) {
      var back2 = document.querySelector('.triage-card__back');
      if (back2) back2.hidden = true;
    }
  });

  /* AI Summary: toggle between quick and detailed mode */
  document.addEventListener('click', function (e) {
    var toggleBtn = e.target.closest('.js-ai-summary-toggle');
    if (!toggleBtn) return;

    var targetId = toggleBtn.getAttribute('aria-controls');
    var detail = document.getElementById(targetId);
    if (!detail) return;

    var isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    toggleBtn.setAttribute('aria-expanded', String(!isExpanded));
    detail.hidden = isExpanded;
    toggleBtn.textContent = isExpanded ? 'Details' : 'Collapse';
  });

  /* AI Summary: "Why?" reasoning links */
  document.addEventListener('click', function (e) {
    var whyBtn = e.target.closest('.js-ai-why');
    if (!whyBtn) return;

    var detail = whyBtn.nextElementSibling;
    if (detail && detail.classList.contains('ai-summary__why-detail')) {
      detail.hidden = !detail.hidden;
      whyBtn.textContent = detail.hidden ? 'Why?' : 'Hide reasoning';
    }
  });

  /* Triage keyboard shortcuts */
  document.addEventListener('keydown', function (e) {
    var triageEl = document.getElementById('triage');
    var rationaleEl = document.getElementById('triageRationale');
    if (!triageEl || triageEl.hidden) return;
    if (rationaleEl && !rationaleEl.hidden) return;
    /* Guard: skip when focus is in a text input (prevents firing in forms) */
    var focused = document.activeElement;
    if (focused) {
      var tag = focused.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (focused.isContentEditable) return;
    }
    var key = e.key.toLowerCase();
    if (key === 'a') triageAction('approve');
    else if (key === 'd') triageAction('deny');
    else if (key === 'r') triageAction('changes');
    else if (key === 's') triageAction('skip');
    else if (key === 'i') AISummaryToggle.toggle();
    else if (key === ' ') {
      e.preventDefault();
      var back = document.querySelector('.triage-card__back');
      if (back) back.hidden = !back.hidden;
    }
  });

  /* Initial render */
  render(initial);
}

main();
