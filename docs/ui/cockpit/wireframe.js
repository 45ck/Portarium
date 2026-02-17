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
  'work-item',
  'run',
  'approvals',
  'evidence',
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
  for (const link of qsa('.nav__item')) {
    const href = link.getAttribute('href') || '';
    link.setAttribute('aria-current', href === '#' + screen ? 'page' : 'false');
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
      operator: { text: 'Start workflow', href: '#work-item' },
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
        { text: 'Start workflow', href: '#work-item' },
        { text: 'Retry failed runs', href: '#run' },
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
}

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

  /* Initial render */
  render(initial);
}

main();
