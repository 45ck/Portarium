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
              <div class="row__subtle">Run (waiting for approval)</div>
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
              <div class="row__subtle">Audit log: OK</div>
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
          Approval rule: different-approver required
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
              <div class="row__subtle">Run | Waiting for Approval</div>
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
              <div class="row__subtle">Audit log: OK (entries 120-146)</div>
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
          Required approvers: 2 | Approval rule: different-approver required<br>
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
              <div class="row__subtle">Run (waiting for approval)</div>
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
          Approval rule: different-approver required (initiator cannot self-approve)<br>
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
              <div class="row__subtle">Run | Waiting for Approval</div>
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
          Approval rule: different-approver required
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

  /* ---- Robot detail drawers ---- */
  'robot-001-detail': {
    title: 'robot-001 Detail',
    body: `
      <div>
        <div class="drawer-section__title">Identity</div>
        <div class="callout callout--policy">
          Robot ID: <strong>robot-001</strong><br>
          Class: AMR<br>
          SPIFFE SVID: spiffe://portarium/robot-001<br>
          Gateway: ws://gw-wh-a.local:9090
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Telemetry (stubs)</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div>
            <div class="subtle" style="font-size:11px">Battery %</div>
            <svg viewBox="0 0 80 24" width="80" height="24" aria-hidden="true">
              <polyline points="0,20 16,16 32,12 48,8 64,10 80,6" fill="none" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </div>
          <div>
            <div class="subtle" style="font-size:11px">Speed m/s</div>
            <svg viewBox="0 0 80 24" width="80" height="24" aria-hidden="true">
              <polyline points="0,12 16,8 32,16 48,10 64,14 80,6" fill="none" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </div>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Capabilities</div>
        <div class="chips">
          <span class="chip chip--small">navigate_to</span>
          <span class="chip chip--small">pick</span>
          <span class="chip chip--small">dock</span>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Used by Missions</div>
        <div class="list">
          <div class="row row--static">
            <div class="row__main">
              <div class="row__title">mis-0094 &mdash; Navigate to bay 3</div>
              <div class="row__subtle">Status: Executing</div>
            </div>
          </div>
        </div>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn--small js-estop-robot" type="button" data-robot-id="robot-001" data-requires-persona="operator admin">Send E-Stop</button>
        <button class="btn btn--small btn--primary js-clear-estop" type="button" data-robot-id="robot-001" data-requires-persona="admin">Clear E-Stop</button>
      </div>
    `,
  },
  'robot-007-detail': {
    title: 'robot-007 Detail',
    body: `
      <div>
        <div class="drawer-section__title">Identity</div>
        <div class="callout callout--policy">
          Robot ID: <strong>robot-007</strong><br>
          Class: UAV<br>
          SPIFFE SVID: spiffe://portarium/robot-007<br>
          Gateway: ws://gw-yard.local:9090
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Telemetry (stubs)</div>
        <div>
          <div class="subtle" style="font-size:11px">Battery % (critical)</div>
          <svg viewBox="0 0 80 24" width="80" height="24" aria-hidden="true">
            <polyline points="0,4 16,8 32,12 48,16 64,20 80,22" fill="none" stroke="#ef4444" stroke-width="1.5"/>
          </svg>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Capabilities</div>
        <div class="chips">
          <span class="chip chip--small">navigate_to</span>
          <span class="chip chip--small">outdoor_flight</span>
        </div>
      </div>
      <div style="margin-top:12px">
        <button class="btn btn--small js-estop-robot" type="button" data-robot-id="robot-007" data-requires-persona="operator admin">Send E-Stop</button>
        <button class="btn btn--small btn--primary js-clear-estop" type="button" data-robot-id="robot-007" data-requires-persona="admin">Clear E-Stop</button>
      </div>
    `,
  },
  'robot-003-detail': {
    title: 'robot-003 Detail',
    body: `
      <div>
        <div class="drawer-section__title">Identity</div>
        <div class="callout callout--policy">
          Robot ID: <strong>robot-003</strong><br>
          Class: AGV<br>
          SPIFFE SVID: spiffe://portarium/robot-003<br>
          Gateway: ws://gw-wh-a.local:9091
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Capabilities</div>
        <div class="chips">
          <span class="chip chip--small">pick</span>
          <span class="chip chip--small">place</span>
          <span class="chip chip--small">dock</span>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Used by Missions</div>
        <div class="list">
          <div class="row row--static">
            <div class="row__main">
              <div class="row__title">mis-0095 &mdash; Pick SKU-8821</div>
              <div class="row__subtle">Status: Pending</div>
            </div>
          </div>
        </div>
      </div>
      <div style="margin-top:12px">
        <button class="btn btn--small js-estop-robot" type="button" data-robot-id="robot-003" data-requires-persona="operator admin">Send E-Stop</button>
      </div>
    `,
  },
  'robot-009-detail': {
    title: 'robot-009 Detail',
    body: `
      <div>
        <div class="drawer-section__title">Identity</div>
        <div class="callout callout--policy">
          Robot ID: <strong>robot-009</strong><br>
          Class: Manipulator<br>
          SPIFFE SVID: spiffe://portarium/robot-009<br>
          Gateway: ws://gw-floor.local:9092
        </div>
      </div>
      <div>
        <div class="drawer-section__title">E-Stop Status</div>
        <div class="callout" style="background:#fef2f2;border-color:#fca5a5;color:#991b1b">
          &#8856; E-Stopped &mdash; sent by operator@acme at 14:01<br>
          Reason: low battery drift
        </div>
      </div>
      <div style="margin-top:12px">
        <button class="btn btn--small btn--primary js-clear-estop" type="button" data-robot-id="robot-009" data-requires-persona="admin">Clear E-Stop (rationale required)</button>
      </div>
    `,
  },

  /* ---- Mission detail drawers ---- */
  'mission-0094-detail': {
    title: 'Mission mis-0094',
    body: `
      <div>
        <div class="drawer-section__title">ActionExecution Timeline</div>
        <div class="list">
          <div class="row row--static"><div class="row__main"><div class="row__title">DISPATCHED &#8594; robot-001</div><div class="row__subtle">14:02:01</div></div></div>
          <div class="row row--static"><div class="row__main"><div class="row__title">EXECUTING &mdash; navigate_to bay 3</div><div class="row__subtle">14:02:03 (in progress)</div></div></div>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Controls</div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button class="btn btn--small" type="button" data-confirm="preempt-mission" data-requires-persona="operator admin">Pre-empt</button>
          <button class="btn btn--small" type="button" data-confirm="cancel-mission" data-requires-persona="operator admin">Cancel</button>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Evidence</div>
        <a class="btn btn--small" href="#evidence">View Evidence Timeline</a>
      </div>
    `,
  },
  'mission-0095-detail': {
    title: 'Mission mis-0095',
    body: `
      <div>
        <div class="drawer-section__title">ActionExecution Timeline</div>
        <div class="list">
          <div class="row row--static"><div class="row__main"><div class="row__title">PENDING &mdash; awaiting dispatch</div><div class="row__subtle">Queued</div></div></div>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Controls</div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button class="btn btn--small" type="button" data-confirm="cancel-mission" data-requires-persona="operator admin">Cancel</button>
        </div>
      </div>
    `,
  },
  'mission-0087-detail': {
    title: 'Mission mis-0087',
    body: `
      <div>
        <div class="drawer-section__title">ActionExecution Timeline</div>
        <div class="list">
          <div class="row row--static"><div class="row__main"><div class="row__title">DISPATCHED &#8594; robot-002</div><div class="row__subtle">13:41:00</div></div></div>
          <div class="row row--static"><div class="row__main"><div class="row__title">EXECUTING &mdash; dock at charge-01</div><div class="row__subtle">13:41:05</div></div></div>
          <div class="row row--static"><div class="row__main"><div class="row__title">SUCCEEDED</div><div class="row__subtle">13:47:22</div></div></div>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Evidence</div>
        <a class="btn btn--small" href="#evidence">View Evidence Timeline</a>
      </div>
    `,
  },
  'mission-0091-detail': {
    title: 'Mission mis-0091',
    body: `
      <div>
        <div class="drawer-section__title">ActionExecution Timeline</div>
        <div class="list">
          <div class="row row--static"><div class="row__main"><div class="row__title">DISPATCHED &#8594; robot-005</div><div class="row__subtle">12:55:00</div></div></div>
          <div class="row row--static"><div class="row__main"><div class="row__title">FAILED &mdash; dock timeout</div><div class="row__subtle">12:58:44</div></div></div>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Controls</div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button class="btn btn--small" type="button" data-confirm="retry-mission" data-requires-persona="operator admin">Retry</button>
        </div>
      </div>
      <div>
        <div class="drawer-section__title">Evidence</div>
        <a class="btn btn--small" href="#evidence">View Evidence Timeline</a>
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
  'onboarding',
  'objects',
  'events',
  'adapters',
  'components',
  'observability',
  'governance',
  'loading',
  'robots',
  'robot',
  'missions',
  'mission',
  'safety',
  'gateways',
  'workforce',
  'queues',
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
  const parentMap = {
    'work-item': 'work-items',
    run: 'runs',
    mission: 'missions',
    robot: 'robots',
    gateways: 'robots',
    queues: 'workforce',
  };
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

  /* Workforce staleness banner — show when degraded */
  var workforceBanner = document.querySelector('.js-workforce-stale');
  if (workforceBanner) workforceBanner.hidden = systemState !== 'degraded';
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

  /* Inbox hero prompt text */
  const inboxHeroText = document.querySelector('.js-hero-inbox-text');
  if (inboxHeroText) {
    const heroText = {
      operator: 'A run failed and can be retried. Start from the failures queue.',
      approver: 'You have 2 approvals waiting for your decision.',
      auditor: 'Review evidence integrity and retention status for recent runs.',
      admin: 'Configuration drift detected in one adapter. Diagnose and restore health.',
    }[persona];
    inboxHeroText.textContent = heroText || '';
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
      secondary: ['approvals', 'violations', 'human-tasks'],
      hidden: ['evidence', 'health'],
    },
    approver: {
      primary: 'approvals',
      secondary: ['violations', 'human-tasks'],
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

  /* Activate human-tasks filter chip for operator & approver personas */
  var humanTasksChip = document.querySelector('.js-filter-human-tasks');
  if (humanTasksChip) {
    if (persona === 'operator' || persona === 'approver') {
      humanTasksChip.classList.add('chip--active');
      var taskCard = document.getElementById('inboxHumanTasks');
      if (taskCard) taskCard.style.display = '';
    } else {
      humanTasksChip.classList.remove('chip--active');
      var taskCard2 = document.getElementById('inboxHumanTasks');
      if (taskCard2) taskCard2.style.display = 'none';
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

  /* Robotics persona gating — show/hide CTAs based on data-requires-persona */
  document.querySelectorAll('[data-requires-persona]').forEach(function (el) {
    var allowed = el.getAttribute('data-requires-persona').split(' ');
    el.style.display = allowed.includes(persona) ? '' : 'none';
  });

  /* Workforce screen persona adaptation */
  var workforceEditBtns = document.querySelectorAll('.js-workforce-edit-btn');
  workforceEditBtns.forEach(function (btn) {
    btn.hidden = persona !== 'admin';
  });
  var capCheckboxes = document.querySelectorAll('.js-cap-checkbox');
  capCheckboxes.forEach(function (cb) {
    cb.disabled = persona !== 'admin';
  });
  var availToggle = document.querySelector('.js-availability-toggle');
  if (availToggle) {
    availToggle.disabled = persona === 'auditor';
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
  if (chainText) chainText.textContent = 'Audit log: OK';
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
var _drawerTrigger = null;
var _ownerPickerTrigger = null;

function openDrawer(contentId) {
  _drawerTrigger = document.activeElement;
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
  if (_drawerTrigger) { _drawerTrigger.focus(); _drawerTrigger = null; }
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
    var stored = loadState()[screenId];
    if (stored) return stored;
    var config = registry[screenId];
    return (config && config.defaultVariant) || 'A';
  }
  function setVariant(screenId, variant) {
    const s = loadState();
    s[screenId] = variant;
    saveState(s);
  }

  function register(screenId, variants, renderers, labelMap, defaultVariant) {
    registry[screenId] = {
      variants,
      renderers,
      labelMap: labelMap || {},
      defaultVariant: defaultVariant || 'A',
    };
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
  let enabled = true;

  function loadState() {
    try {
      var val = sessionStorage.getItem(STORAGE_KEY);
      return val === null ? true : val === 'true';
    } catch {
      return true;
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
  'B',
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

ABToggle.register(
  'missions',
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
  'A',
);

/* ============================================================
   APPROVAL TRIAGE
   ============================================================ */
let triageIndex = 0;
const triageResults = { approved: 0, denied: 0, changes: 0, skipped: 0 };

/* Undo state — stores the last dismissed card state */
var triageLastUndo = null; // { index, cardId, action, hiddenState }

/* Ordered list of triage card element IDs — must match the approvals table order */
var TRIAGE_CARD_IDS = ['triageCard', 'triageCardZendesk', 'triageCardRobot', 'triageCardAgent'];
/* Label shown in the next-preview strip after each card is swiped */
var TRIAGE_NEXT_LABELS = [
  'Approve Plan: Update Ticket priority in Zendesk',
  'Approve Mission: outdoor_flight \u2014 robot-007',
  'Approve Agent Action: Document Summarizer',
  null,
];

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

  if (triageIndex >= TRIAGE_CARD_IDS.length) return;
  var card = document.getElementById(TRIAGE_CARD_IDS[triageIndex]);
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
  /* Record undo state before dismissing */
  var undoIndex = triageIndex;
  var undoCardId = TRIAGE_CARD_IDS[triageIndex];

  setTimeout(function () {
    card.hidden = true;
    card.classList.remove(exitClass);

    /* Store undo state */
    triageLastUndo = { index: undoIndex, cardId: undoCardId, action: action };
    var undoBtn = document.getElementById('triageUndoBtn');
    if (undoBtn) undoBtn.disabled = false;

    triageIndex++;
    var progressFill = document.querySelector('.triage__progress-fill');
    var progressBar = progressFill ? progressFill.closest('[role="progressbar"]') || progressFill.parentElement : null;
    var currentSpan = document.querySelector('.triage__current');
    if (progressFill) progressFill.style.width = (triageIndex / 4) * 100 + '%';
    if (progressBar) progressBar.setAttribute('aria-valuenow', triageIndex);
    if (currentSpan) currentSpan.textContent = Math.min(triageIndex + 1, 4);
    if (triageIndex >= 4) {
      var triageEl = document.getElementById('triage');
      var completeEl = document.getElementById('triageComplete');
      if (triageEl) triageEl.hidden = true;
      if (completeEl) completeEl.hidden = false;
    } else {
      var nextCard = document.getElementById(TRIAGE_CARD_IDS[triageIndex]);
      if (nextCard) nextCard.hidden = false;
      var nextLabel = TRIAGE_NEXT_LABELS[triageIndex];
      var nextPreviewWrap = document.querySelector('.triage__next-preview');
      var nextTitle = document.querySelector('.triage__next-title');
      if (nextTitle) nextTitle.textContent = nextLabel ? 'Next: ' + nextLabel : '';
      if (nextPreviewWrap) nextPreviewWrap.hidden = !nextLabel;
    }
  }, 350);
}

function triageUndo() {
  if (!triageLastUndo) return;
  var undo = triageLastUndo;
  triageLastUndo = null;

  /* Reverse the result counter */
  var resultKey = { approve: 'approved', deny: 'denied', changes: 'changes', skip: 'skipped' }[undo.action];
  if (resultKey && triageResults[resultKey] > 0) triageResults[resultKey]--;

  /* Hide current card (if any) and restore the undone card */
  if (triageIndex < TRIAGE_CARD_IDS.length) {
    var currentCard = document.getElementById(TRIAGE_CARD_IDS[triageIndex]);
    if (currentCard) currentCard.hidden = true;
  }
  triageIndex = undo.index;

  var restoredCard = document.getElementById(undo.cardId);
  if (restoredCard) {
    restoredCard.hidden = false;
  }

  var progressFill = document.querySelector('.triage__progress-fill');
  var progressBar = progressFill ? progressFill.closest('[role="progressbar"]') || progressFill.parentElement : null;
  var currentSpan = document.querySelector('.triage__current');
  if (progressFill) progressFill.style.width = (triageIndex / 4) * 100 + '%';
  if (progressBar) progressBar.setAttribute('aria-valuenow', triageIndex);
  if (currentSpan) currentSpan.textContent = triageIndex + 1;

  /* Update next preview */
  var nextLabel = triageIndex > 0 ? TRIAGE_NEXT_LABELS[triageIndex - 1] : null;
  var nextPreviewWrap = document.querySelector('.triage__next-preview');
  var nextTitle = document.querySelector('.triage__next-title');
  if (nextTitle) nextTitle.textContent = nextLabel ? 'Next: ' + nextLabel : '';
  if (nextPreviewWrap) nextPreviewWrap.hidden = !nextLabel;

  /* Disable undo button (single-step only) */
  var undoBtn = document.getElementById('triageUndoBtn');
  if (undoBtn) undoBtn.disabled = true;

  if (typeof Keyboard !== 'undefined' && Keyboard.showToast) {
    Keyboard.showToast('Undone: ' + undo.action);
  }
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
const AGENT_DETAIL_CONTENT = {
  'claude-classify': {
    name: 'Invoice Classifier',
    agentId: 'claude-classify',
    provider: 'anthropic',
    model: 'claude-sonnet-4.5',
    modelOptions: [
      { value: 'claude-opus-4.6', label: 'Claude Opus 4.6' },
      { value: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
      { value: 'claude-haiku-4.5', label: 'Claude Haiku 4.5' },
    ],
    temperature: '0.1',
    maxTokens: '4096',
    capabilities: ['read:external', 'classify', 'analyze'],
    permissionsSummary:
      'This agent can access data from: <strong>Finance</strong>, <strong>Payments</strong>. It cannot write to any external system directly.',
    permissionChips: [
      { icon: 'FA', label: 'Finance (read)' },
      { icon: 'PB', label: 'Payments (read)' },
    ],
    prompt:
      'You are an invoice classification agent for Portarium. Given an invoice record, classify each line item into the correct accounting category. Return a JSON array of {lineItemId, category, confidence}.',
    metrics: { runs: '142', success: '96%', latency: '1.2s' },
    recentRuns: [
      {
        title: 'Classify: INV-22318 (12 line items)',
        meta: 'Run R-8920 | WI-1099 | 12m ago | 0.9s',
        statusClass: 'status--ok',
        statusText: 'Success',
      },
      {
        title: 'Classify: INV-22305 (8 line items)',
        meta: 'Run R-8901 | WI-1088 | 2h ago | 1.1s',
        statusClass: 'status--ok',
        statusText: 'Success',
      },
      {
        title: 'Classify: INV-22291 (3 line items)',
        meta: 'Run R-8889 | WI-1072 | 6h ago | 0.8s',
        statusClass: 'status--danger',
        statusText: 'Failed',
      },
    ],
    integrationsMeta: 'Steps that reference Invoice Classifier',
    integrations: [
      {
        title: 'Invoice Correction Workflow',
        subtitle: 'Step: "Classify Line Items" (position 4 of 7)',
        statusClass: 'status--info',
        statusText: 'Active',
      },
      {
        title: 'Quarterly Audit Preparation',
        subtitle: 'Step: "Categorize Entries" (position 2 of 5)',
        statusClass: 'status--info',
        statusText: 'Active',
      },
    ],
    deactivateImpact:
      'Deactivating this agent will pause 2 active workflows at their next Agent Task step.',
    bannerClass: 'integrity-banner--ok',
    bannerText: 'Connection healthy. Last test: 2m ago (latency: 180ms).',
    lifecycleButton: 'Deactivate',
  },
  'openai-summarize': {
    name: 'Document Summarizer',
    agentId: 'openai-summarize',
    provider: 'openai',
    model: 'gpt-4o',
    modelOptions: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4.1', label: 'GPT-4.1' },
      { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
    ],
    temperature: '0.2',
    maxTokens: '8192',
    capabilities: ['read:external', 'generate', 'analyze', 'notify'],
    permissionsSummary:
      'This agent can access data from: <strong>Documents</strong>, <strong>Support</strong>. It can draft summaries and notify channels but cannot write to source records.',
    permissionChips: [
      { icon: 'DE', label: 'Documents (read)' },
      { icon: 'CS', label: 'Support (read)' },
      { icon: 'CC', label: 'Comms (notify)' },
    ],
    prompt:
      'Summarize the provided document set in concise, action-oriented language. Include risks, missing facts, and recommended follow-up actions.',
    metrics: { runs: '58', success: '91%', latency: '3.4s' },
    recentRuns: [
      {
        title: 'Summarize: Escalation bundle #771',
        meta: 'Run R-8892 | WI-1042 | 22m ago | 3.1s',
        statusClass: 'status--ok',
        statusText: 'Success',
      },
      {
        title: 'Summarize: Contract review pack',
        meta: 'Run R-8881 | WI-1037 | 3h ago | 3.7s',
        statusClass: 'status--ok',
        statusText: 'Success',
      },
      {
        title: 'Summarize: Policy change digest',
        meta: 'Run R-8819 | WI-0972 | 1d ago | 4.6s',
        statusClass: 'status--warn',
        statusText: 'Slow',
      },
    ],
    integrationsMeta: 'Steps that reference Document Summarizer',
    integrations: [
      {
        title: 'Customer Escalation Triage',
        subtitle: 'Step: "Summarize Ticket History" (position 3 of 6)',
        statusClass: 'status--info',
        statusText: 'Active',
      },
      {
        title: 'Policy Review Workflow',
        subtitle: 'Step: "Summarize Proposed Changes" (position 2 of 4)',
        statusClass: 'status--info',
        statusText: 'Active',
      },
    ],
    deactivateImpact:
      'Deactivating this agent will pause 2 active workflows that rely on summary generation.',
    bannerClass: 'integrity-banner--ok',
    bannerText: 'Connection healthy. Last test: 6m ago (latency: 410ms).',
    lifecycleButton: 'Deactivate',
  },
  'custom-validator': {
    name: 'Policy Validator',
    agentId: 'custom-validator',
    provider: 'custom',
    model: 'custom-endpoint-v1',
    modelOptions: [{ value: 'custom-endpoint-v1', label: 'Custom endpoint v1' }],
    temperature: '0.0',
    maxTokens: '2048',
    capabilities: ['read:external', 'analyze', 'write:external'],
    permissionsSummary:
      'This agent can access data from: <strong>Payroll</strong>, <strong>Compliance</strong>. It can write policy-evaluation outcomes but cannot trigger payouts.',
    permissionChips: [
      { icon: 'PA', label: 'Payroll (read)' },
      { icon: 'CG', label: 'Compliance (read)' },
      { icon: 'PO', label: 'Policy (write)' },
    ],
    prompt:
      'Validate proposed payroll and policy changes against SoD and threshold rules. Return policy outcome, violated constraints, and required approver set.',
    metrics: { runs: '0', success: '--', latency: '--' },
    recentRuns: [
      {
        title: 'Validate: Payroll policy P-332',
        meta: 'Run R-8854 | WI-1002 | 5m ago | endpoint 502',
        statusClass: 'status--danger',
        statusText: 'Failed',
      },
      {
        title: 'Validate: Compensation exception C-82',
        meta: 'Run R-8848 | WI-0999 | 1h ago | endpoint timeout',
        statusClass: 'status--danger',
        statusText: 'Failed',
      },
    ],
    integrationsMeta: 'Steps that reference Policy Validator',
    integrations: [
      {
        title: 'Payroll Exception Review',
        subtitle: 'Step: "Validate Policy Rule Set" (position 2 of 5)',
        statusClass: 'status--warn',
        statusText: 'Paused',
      },
      {
        title: 'Access Governance Enforcement',
        subtitle: 'Step: "Policy Safety Check" (position 1 of 4)',
        statusClass: 'status--warn',
        statusText: 'Paused',
      },
    ],
    deactivateImpact:
      'This agent is already degraded. Keeping it active may block policy-gated workflows until endpoint health recovers.',
    bannerClass: 'integrity-banner--danger',
    bannerText: 'Connection failed. Click "Test connection" to retry.',
    lifecycleButton: 'Deactivate',
  },
  'claude-draft': {
    name: 'Draft Generator',
    agentId: 'claude-draft',
    provider: 'anthropic',
    model: 'claude-haiku-4.5',
    modelOptions: [
      { value: 'claude-opus-4.6', label: 'Claude Opus 4.6' },
      { value: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
      { value: 'claude-haiku-4.5', label: 'Claude Haiku 4.5' },
    ],
    temperature: '0.7',
    maxTokens: '4096',
    capabilities: ['generate', 'notify'],
    permissionsSummary:
      'This agent has no direct source-system access. It drafts artifacts from provided prompts and posts outputs to review queues.',
    permissionChips: [
      { icon: 'AR', label: 'Artifacts (write)' },
      { icon: 'CC', label: 'Comms (notify)' },
    ],
    prompt:
      'Generate a first draft for the requested document type using provided context and policy-safe language. Flag missing information explicitly.',
    metrics: { runs: '0', success: '--', latency: '--' },
    recentRuns: [
      {
        title: 'No recent runs',
        meta: 'Agent is inactive. Activate to collect runtime metrics.',
        statusClass: 'status--info',
        statusText: 'Idle',
      },
    ],
    integrationsMeta: 'Steps that reference Draft Generator',
    integrations: [
      {
        title: 'Customer Response Workflow',
        subtitle: 'Step: "Draft Customer Email" (position 4 of 6)',
        statusClass: 'status--warn',
        statusText: 'Inactive',
      },
    ],
    deactivateImpact:
      'This agent is inactive. Activate it to enable draft-generation steps in dependent workflows.',
    bannerClass: 'integrity-banner--warn',
    bannerText: 'Agent is inactive. Activate to use in workflows.',
    lifecycleButton: 'Activate',
  },
};

function renderAgentDetail(agentId) {
  var detailPanel = document.getElementById('agentDetail');
  if (!detailPanel) return;

  var data = AGENT_DETAIL_CONTENT[agentId] || AGENT_DETAIL_CONTENT['claude-classify'];

  var detailName = detailPanel.querySelector('.agent-detail__name');
  if (detailName) detailName.textContent = data.name;

  var detailId = detailPanel.querySelector('.js-agent-detail-id');
  if (detailId) detailId.textContent = 'Agent: ' + data.agentId;

  var banner = detailPanel.querySelector('#agentTestResult');
  if (banner) {
    banner.className = 'integrity-banner ' + data.bannerClass;
    banner.textContent = data.bannerText;
  }

  var lifecycleBtn = detailPanel.querySelector('#agentLifecycleButton');
  if (lifecycleBtn) lifecycleBtn.textContent = data.lifecycleButton;

  var configName = detailPanel.querySelector('#agentConfigName');
  if (configName) configName.value = data.name;

  var providerSelect = detailPanel.querySelector('#agentConfigProvider');
  if (providerSelect) providerSelect.value = data.provider;

  var modelSelect = detailPanel.querySelector('#agentConfigModel');
  if (modelSelect) {
    modelSelect.innerHTML = data.modelOptions
      .map(function (opt) {
        var selected = opt.value === data.model ? ' selected' : '';
        return '<option value="' + opt.value + '"' + selected + '>' + opt.label + '</option>';
      })
      .join('');
  }

  var temperatureInput = detailPanel.querySelector('#agentConfigTemperature');
  if (temperatureInput) temperatureInput.value = data.temperature;

  var maxTokensInput = detailPanel.querySelector('#agentConfigMaxTokens');
  if (maxTokensInput) maxTokensInput.value = data.maxTokens;

  qsa('[data-capability]', detailPanel).forEach(function (checkbox) {
    checkbox.checked = data.capabilities.includes(checkbox.dataset.capability);
  });

  var permissionsSummary = detailPanel.querySelector('#agentPermissionsSummary');
  if (permissionsSummary) permissionsSummary.innerHTML = data.permissionsSummary;

  var permissionsChips = detailPanel.querySelector('#agentPermissionsChips');
  if (permissionsChips) {
    permissionsChips.innerHTML = data.permissionChips
      .map(function (chip) {
        return (
          '<span class="chip"><span class="port-icon">' +
          chip.icon +
          '</span> ' +
          chip.label +
          '</span>'
        );
      })
      .join('');
  }

  var promptInput = detailPanel.querySelector('#agentPromptTemplate');
  if (promptInput) promptInput.value = data.prompt;

  var runsMetric = detailPanel.querySelector('#agentMetricRuns');
  if (runsMetric) runsMetric.textContent = data.metrics.runs;

  var successMetric = detailPanel.querySelector('#agentMetricSuccess');
  if (successMetric) successMetric.textContent = data.metrics.success;

  var latencyMetric = detailPanel.querySelector('#agentMetricLatency');
  if (latencyMetric) latencyMetric.textContent = data.metrics.latency;

  var recentRunsList = detailPanel.querySelector('#agentRecentRunsList');
  if (recentRunsList) {
    recentRunsList.innerHTML = data.recentRuns
      .map(function (run) {
        return (
          '<div class="row row--static">' +
          '<div class="row__main">' +
          '<div class="row__title">' +
          run.title +
          '</div>' +
          '<div class="row__subtle">' +
          run.meta +
          '</div>' +
          '</div>' +
          '<div class="row__right">' +
          '<span class="status ' +
          run.statusClass +
          '" style="font-size: 10px; padding: 2px 6px">' +
          run.statusText +
          '</span>' +
          '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  var integrationsMeta = detailPanel.querySelector('#agentIntegrationsMeta');
  if (integrationsMeta) integrationsMeta.textContent = data.integrationsMeta;

  var integrationsList = detailPanel.querySelector('#agentIntegrationsList');
  if (integrationsList) {
    integrationsList.innerHTML = data.integrations
      .map(function (integration) {
        return (
          '<a class="row" href="#workflow-builder" style="text-decoration: none">' +
          '<div class="row__main">' +
          '<div class="row__title">' +
          integration.title +
          '</div>' +
          '<div class="row__subtle">' +
          integration.subtitle +
          '</div>' +
          '</div>' +
          '<div class="row__right">' +
          '<span class="status ' +
          integration.statusClass +
          '" style="font-size: 10px; padding: 2px 6px">' +
          integration.statusText +
          '</span>' +
          '</div>' +
          '</a>'
        );
      })
      .join('');
  }

  var deactivateImpact = detailPanel.querySelector('#agentDeactivateImpact');
  if (deactivateImpact) deactivateImpact.textContent = data.deactivateImpact;
}

function selectAgentCard(card) {
  if (!card) return;
  qsa('.agent-card').forEach(function (el) {
    el.classList.remove('agent-card--selected');
  });
  card.classList.add('agent-card--selected');
  renderAgentDetail(card.dataset.agentId);
}

document.addEventListener('click', function (e) {
  var card = e.target.closest('.agent-card');
  if (!card) return;
  selectAgentCard(card);
});

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  var card = e.target.closest('.agent-card');
  if (!card) return;
  e.preventDefault();
  selectAgentCard(card);
});

/* ============================================================
   CONFIRMATION MODAL (H3, H5)
   ============================================================ */
const ConfirmModal = (function () {
  'use strict';
  var _callback = null;
  var _confirmTrigger = null;

  function show(opts) {
    _confirmTrigger = document.activeElement;
    var backdrop = document.getElementById('confirmBackdrop');
    var modal = document.getElementById('confirmModal');
    if (!backdrop || !modal) return;
    var icon = document.getElementById('confirmIcon');
    var title = document.getElementById('confirmTitle');
    var body = document.getElementById('confirmBody');
    var okBtn = document.getElementById('confirmOk');
    if (icon) icon.textContent = opts.icon || '⚠';
    if (title) title.textContent = opts.title || 'Are you sure?';
    if (body) body.textContent = opts.body || 'This action cannot be undone.';
    if (okBtn) okBtn.textContent = opts.okText || 'Confirm';
    _callback = opts.onConfirm || null;
    backdrop.hidden = false;
    modal.hidden = false;
    if (okBtn) okBtn.focus();
  }

  function hide() {
    var backdrop = document.getElementById('confirmBackdrop');
    var modal = document.getElementById('confirmModal');
    if (backdrop) backdrop.hidden = true;
    if (modal) modal.hidden = true;
    _callback = null;
    if (_confirmTrigger) { _confirmTrigger.focus(); _confirmTrigger = null; }
  }

  function confirm() {
    var cb = _callback;
    hide();
    if (typeof cb === 'function') cb();
  }

  function init() {
    document.addEventListener('click', function (e) {
      if (e.target.id === 'confirmOk') confirm();
      if (e.target.id === 'confirmCancel') hide();
      if (e.target.id === 'confirmBackdrop') hide();
    });
    document.addEventListener('keydown', function (e) {
      var modal = document.getElementById('confirmModal');
      if (!modal || modal.hidden) return;
      if (e.key === 'Escape') {
        hide();
        e.preventDefault();
        return;
      }
      if (e.key === 'Tab') {
        var okBtn = document.getElementById('confirmOk');
        var cancelBtn = document.getElementById('confirmCancel');
        if (!okBtn || !cancelBtn) return;
        if (e.shiftKey) {
          if (document.activeElement === okBtn) {
            e.preventDefault();
            cancelBtn.focus();
          }
        } else {
          if (document.activeElement === cancelBtn) {
            e.preventDefault();
            okBtn.focus();
          }
        }
      }
    });
  }

  return { show, hide, init };
})();

/* ============================================================
   HERO PROMPT DISMISS (H3, H8)
   ============================================================ */
const HeroDismiss = (function () {
  'use strict';
  var STORAGE_KEY = 'portarium_hero_dismissed';

  function loadDismissed() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  function saveDismissed(state) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function init() {
    /* Restore dismissed state */
    var dismissed = loadDismissed();
    document.querySelectorAll('.hero-prompt--dismissible').forEach(function (hp) {
      var screen = hp.closest('.screen');
      if (!screen) return;
      var id = screen.dataset.screen || screen.id;
      if (dismissed[id]) hp.classList.add('hero-prompt--hidden');
    });

    /* Click handler for dismiss buttons */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.hero-prompt__dismiss');
      if (!btn) return;
      var hp = btn.closest('.hero-prompt--dismissible');
      if (!hp) return;
      hp.classList.add('hero-prompt--hidden');
      var screen = hp.closest('.screen');
      if (screen) {
        var state = loadDismissed();
        state[screen.dataset.screen || screen.id] = true;
        saveDismissed(state);
      }
    });
  }

  return { init };
})();

/* ============================================================
   BUTTON LOADING STATE (H1)
   ============================================================ */
function withLoadingState(btn, duration) {
  if (!btn || btn.classList.contains('btn--loading')) return;
  var originalText = btn.textContent;
  btn.classList.add('btn--loading');
  btn.textContent = 'Loading\u2026';
  btn.disabled = true;
  setTimeout(function () {
    btn.classList.remove('btn--loading');
    btn.textContent = originalText;
    btn.disabled = false;
  }, duration || 1500);
}

/* ============================================================
   APPROVAL FORM VALIDATION (H5, H9)
   ============================================================ */
const ApprovalValidation = (function () {
  'use strict';

  function validate() {
    var decision = document.getElementById('approvalDecision');
    var rationale = document.getElementById('approvalRationale');
    var submitBtn = document.getElementById('submitDecision');
    if (!decision || !rationale || !submitBtn) return;

    var decisionValid = decision.value !== '';
    var rationaleValid = rationale.value.trim().length >= 10;

    var fieldDecision = document.getElementById('fieldDecision');
    var fieldRationale = document.getElementById('fieldRationale');
    var decisionTouched = decision.value !== '';
    var rationaleTouched = rationale.value.trim().length > 0;
    if (fieldDecision)
      fieldDecision.classList.toggle('field--error', decisionTouched && !decisionValid);
    if (fieldRationale) {
      var showError = rationaleTouched && !rationaleValid;
      fieldRationale.classList.toggle('field--error', showError);
    }

    /* aria-invalid + error messages */
    decision.setAttribute('aria-invalid', decisionTouched && !decisionValid ? 'true' : 'false');
    var decisionError = fieldDecision ? fieldDecision.querySelector('.field__error') : null;
    if (!decisionError && fieldDecision) {
      decisionError = document.createElement('div');
      decisionError.className = 'field__error';
      decisionError.setAttribute('role', 'alert');
      fieldDecision.appendChild(decisionError);
    }
    if (decisionError) {
      if (decisionTouched && !decisionValid) {
        decisionError.textContent = 'Please select a decision.';
        decisionError.style.display = '';
      } else {
        decisionError.textContent = '';
        decisionError.style.display = 'none';
      }
    }

    rationale.setAttribute('aria-invalid', rationaleTouched && !rationaleValid ? 'true' : 'false');
    var rationaleError = fieldRationale ? fieldRationale.querySelector('.field__error') : null;
    if (!rationaleError && fieldRationale) {
      rationaleError = document.createElement('div');
      rationaleError.className = 'field__error';
      rationaleError.setAttribute('role', 'alert');
      fieldRationale.appendChild(rationaleError);
    }
    if (rationaleError) {
      if (rationaleTouched && !rationaleValid) {
        rationaleError.textContent = 'Rationale must be at least 10 characters.';
        rationaleError.style.display = '';
      } else {
        rationaleError.textContent = '';
        rationaleError.style.display = 'none';
      }
    }

    submitBtn.disabled = !(decisionValid && rationaleValid);
  }

  function init() {
    var decision = document.getElementById('approvalDecision');
    var rationale = document.getElementById('approvalRationale');
    if (decision) decision.addEventListener('change', validate);
    if (rationale) rationale.addEventListener('input', validate);

    /* Submit with confirmation */
    var submitBtn = document.getElementById('submitDecision');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var decisionEl = document.getElementById('approvalDecision');
        var decisionText = decisionEl
          ? decisionEl.options[decisionEl.selectedIndex].text
          : 'this decision';
        ConfirmModal.show({
          icon: decisionText.toLowerCase() === 'approve' ? '✓' : '✕',
          title: 'Submit approval decision?',
          body: 'You are about to submit "' + decisionText + '". This action cannot be undone.',
          okText: 'Submit decision',
          onConfirm: function () {
            withLoadingState(submitBtn, 2000);
          },
        });
      });
    }
  }

  return { init, validate };
})();

/* ============================================================
   BULK SELECTION (H7)
   ============================================================ */
const BulkSelect = (function () {
  'use strict';

  function updateBar() {
    var checks = document.querySelectorAll('.bulk-checkbox:checked');
    var bar = document.getElementById('bulkBar');
    var count = document.getElementById('bulkCount');
    if (bar) bar.hidden = checks.length === 0;
    if (count) count.textContent = checks.length;
  }

  function init() {
    var selectAll = document.getElementById('bulkSelectAll');
    if (selectAll) {
      selectAll.addEventListener('change', function () {
        var checked = selectAll.checked;
        document.querySelectorAll('.bulk-checkbox').forEach(function (cb) {
          cb.checked = checked;
        });
        updateBar();
      });
    }
    document.addEventListener('change', function (e) {
      if (e.target.classList.contains('bulk-checkbox')) updateBar();
    });
  }

  return { init };
})();

/* ============================================================
   ACTION BUTTON CONFIRMATIONS (H3, H5)
   ============================================================ */
function initActionConfirmations() {
  document.addEventListener('click', function (e) {
    /* Retry run button */
    var retryBtn = e.target.closest('.btn');
    if (!retryBtn) return;
    var text = retryBtn.textContent.trim();

    if (text === 'Retry run' || text === 'Retry') {
      e.preventDefault();
      ConfirmModal.show({
        icon: '↻',
        title: 'Retry this run?',
        body: 'The run will be re-queued for execution. This is safe — no duplicate actions will occur.',
        okText: 'Retry run',
        onConfirm: function () {
          withLoadingState(retryBtn, 2000);
        },
      });
      return;
    }

    if (text === 'Deactivate') {
      e.preventDefault();
      ConfirmModal.show({
        icon: '⚠',
        title: 'Deactivate this agent?',
        body: 'This agent may be used in active workflows. Deactivating it could cause running processes to fail.',
        okText: 'Deactivate',
        onConfirm: function () {
          withLoadingState(retryBtn, 1500);
        },
      });
      return;
    }

    if (text === 'Rotate') {
      e.preventDefault();
      ConfirmModal.show({
        icon: '🔑',
        title: 'Rotate this credential?',
        body: 'Workflows using this credential will need the new value. Ensure you have the replacement ready.',
        okText: 'Rotate credential',
        onConfirm: function () {
          withLoadingState(retryBtn, 1500);
        },
      });
      return;
    }

    /* Retry selected (bulk) */
    if (text === 'Retry selected') {
      e.preventDefault();
      var count = document.querySelectorAll('.bulk-checkbox:checked').length;
      ConfirmModal.show({
        icon: '↻',
        title: 'Retry ' + count + ' selected runs?',
        body: 'All selected runs will be re-queued. Only retry-safe runs will execute; others will be skipped.',
        okText: 'Retry ' + count + ' runs',
        onConfirm: function () {
          withLoadingState(retryBtn, 2000);
        },
      });
      return;
    }

    /* data-confirm attribute wiring */
    var confirmKey = retryBtn.getAttribute('data-confirm');
    if (confirmKey) {
      e.preventDefault();
      var CONFIRM_MAP = {
        'cancel-run': {
          icon: '⊘',
          title: 'Cancel this run?',
          body: 'The run will be terminated. Any in-progress actions will be rolled back if possible. This cannot be undone.',
          okText: 'Cancel run',
        },
        'revoke-credential': {
          icon: '🔒',
          title: 'Revoke this credential?',
          body: 'Adapters using this credential will lose access immediately. Running workflows may fail at their next action step.',
          okText: 'Revoke credential',
        },
        'deactivate-workflow': {
          icon: '⚠',
          title: 'Deactivate this workflow?',
          body: 'No new runs can be started. Existing runs will complete but no new triggers will fire.',
          okText: 'Deactivate',
        },
        'delete-workflow': {
          icon: '🗑',
          title: 'Delete this workflow?',
          body: 'This permanently removes the workflow definition and all draft versions. Active runs will not be affected. This cannot be undone.',
          okText: 'Delete workflow',
        },
        'deregister-agent': {
          icon: '⚠',
          title: 'Deregister this agent?',
          body: 'The agent will be removed from all workflow steps that reference it. Running workflows will fail at the agent step.',
          okText: 'Deregister',
        },
        'preempt-mission': {
          icon: '\u2298',
          title: 'Pre-empt this mission?',
          body: 'The mission will be interrupted. The robot will halt and await further instructions.',
          okText: 'Pre-empt mission',
        },
        'cancel-mission': {
          icon: '\u2298',
          title: 'Cancel this mission?',
          body: 'The mission will be cancelled and removed from the queue. This cannot be undone.',
          okText: 'Cancel mission',
        },
        'retry-mission': {
          icon: '\u21BB',
          title: 'Retry this mission?',
          body: 'The mission will be re-dispatched to the same robot. Idempotency is not guaranteed.',
          okText: 'Retry mission',
        },
      };
      var cfg = CONFIRM_MAP[confirmKey];
      if (cfg) {
        ConfirmModal.show({
          icon: cfg.icon,
          title: cfg.title,
          body: cfg.body,
          okText: cfg.okText,
          onConfirm: function () {
            withLoadingState(retryBtn, 1500);
          },
        });
      }
    }
  });
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

  /* Agent detail defaults to the currently selected card */
  var selectedAgentCard =
    document.querySelector('.agent-card.agent-card--selected') ||
    document.querySelector('.agent-card');
  if (selectedAgentCard) renderAgentDetail(selectedAgentCard.dataset.agentId);

  /* A/B Toggle */
  ABToggle.injectToggles();

  /* AI Summary Toggle */
  AISummaryToggle.init();

  /* Confirmation Modal */
  ConfirmModal.init();

  /* Hero Prompt Dismiss */
  HeroDismiss.init();

  /* Approval Form Validation */
  ApprovalValidation.init();

  /* Bulk Selection */
  BulkSelect.init();

  /* Action Confirmations */
  initActionConfirmations();

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
    /* Triage undo button */
    if (e.target.id === 'triageUndoBtn' || e.target.closest('#triageUndoBtn')) {
      triageUndo();
    }
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
    else if (key === 'u') { triageUndo(); e.preventDefault(); }
    else if (key === 'i') AISummaryToggle.toggle();
    else if (key === ' ') {
      e.preventDefault();
      var back = document.querySelector('.triage-card__back');
      if (back) back.hidden = !back.hidden;
    }
  });

  /* ---- Form Dialog wiring ---- */
  qsa('[data-dialog]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var dlg = document.getElementById(btn.getAttribute('data-dialog'));
      if (dlg && dlg.showModal) dlg.showModal();
    });
  });

  /* Close dialogs on backdrop click */
  qsa('.form-dialog').forEach(function (dlg) {
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) dlg.close();
    });
  });

  /* Evidence export mock */
  qsa('.screen__actions button').forEach(function (btn) {
    if (btn.textContent.trim().indexOf('Export') === 0) {
      btn.addEventListener('click', function () {
        btn.textContent = 'Downloading...';
        setTimeout(function () {
          btn.textContent = btn.textContent.replace('Downloading...', 'Downloaded ✓');
        }, 800);
        setTimeout(function () {
          btn.textContent =
            btn.getAttribute('data-original') || btn.textContent.replace('Downloaded ✓', 'Export');
        }, 2500);
      });
    }
  });

  /* ---- CorrelationId copy-to-clipboard ---- */
  qsa('.correlation-id').forEach(function (el) {
    el.addEventListener('click', function () {
      var text = el.textContent.replace('Correlation: ', '');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
      }
      var orig = el.textContent;
      el.textContent = 'Copied!';
      setTimeout(function () {
        el.textContent = orig;
      }, 1200);
    });
  });

  /* ---- Bulk checkbox wiring ---- */
  qsa('.bulk-checkbox-all').forEach(function (allCb) {
    allCb.addEventListener('change', function () {
      var table = allCb.closest('table');
      if (!table) return;
      qsa('.bulk-checkbox', table).forEach(function (cb) {
        cb.checked = allCb.checked;
      });
      var bar = allCb.closest('.table-wrap').previousElementSibling;
      if (bar && bar.classList.contains('bulk-bar')) {
        var count = qsa('.bulk-checkbox:checked', table).length;
        bar.hidden = count === 0;
        var span = bar.querySelector('.bulk-bar__count');
        if (span) span.textContent = count + ' selected';
      }
    });
  });

  /* ---- Payload link mock ---- */
  qsa('.payload-link').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var name = link.textContent;
      link.textContent = 'Loading...';
      setTimeout(function () {
        link.textContent = name + ' (preview)';
      }, 600);
      setTimeout(function () {
        link.textContent = name;
      }, 2000);
    });
  });

  /* Initial render */
  /* ---- Work Item: owner picker toggle ---- */
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.js-owner-picker-trigger');
    var picker = document.getElementById('ownerPicker');
    if (!picker) return;
    if (trigger) {
      var isOpen = !picker.hidden;
      picker.hidden = isOpen;
      trigger.setAttribute('aria-expanded', String(!isOpen));
      if (!isOpen) {
        _ownerPickerTrigger = document.activeElement;
        var searchInput = picker.querySelector('.owner-picker__search');
        if (searchInput) searchInput.focus();
      }
      return;
    }
    /* Close picker on outside click */
    if (!e.target.closest('#ownerPicker')) {
      picker.hidden = true;
      var t = document.querySelector('.js-owner-picker-trigger');
      if (t) t.setAttribute('aria-expanded', 'false');
    }
    /* Pick a member */
    var item = e.target.closest('.owner-picker__item');
    if (item) {
      var nameEl = item.querySelector('.owner-picker__name');
      var triggerBtn = document.querySelector('.js-owner-picker-trigger');
      if (nameEl && triggerBtn) {
        var itemDot = item.querySelector('.availability-dot');
        var dotClass = 'availability-dot availability-dot--available';
        if (itemDot) {
          dotClass = itemDot.className;
        }
        triggerBtn.innerHTML =
          '<span class="' + dotClass + '"></span> ' +
          nameEl.textContent + ' &#9660;';
        triggerBtn.setAttribute('aria-label', 'Change owner — currently ' + nameEl.textContent);
      }
      picker.hidden = true;
      if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'false');
    }
  });

  /* ---- Inbox: Human tasks filter chip ---- */
  document.addEventListener('click', function (e) {
    var chip = e.target.closest('.js-filter-human-tasks');
    if (!chip) return;
    chip.classList.toggle('chip--active');
    var taskCard = document.getElementById('inboxHumanTasks');
    if (taskCard) {
      taskCard.style.display = chip.classList.contains('chip--active') ? '' : 'none';
    }
  });

  /* ---- Workforce: staleness banner in degraded state ---- */
  document.addEventListener('change', function () {
    var sel = document.getElementById('systemState');
    var banner = document.querySelector('.js-workforce-stale');
    if (banner && sel) {
      banner.hidden = sel.value !== 'degraded';
    }
  });

  /* ---- Robotics: class filter chips ---- */
  document.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-robot-class]');
    if (!chip) return;
    var cls = chip.dataset.robotClass;
    document.querySelectorAll('[data-robot-class]').forEach(function (c) {
      c.classList.toggle('chip--active', c.dataset.robotClass === cls);
    });
    document.querySelectorAll('[data-robot-id]').forEach(function (card) {
      card.hidden = cls !== 'all' && card.dataset.robotClass !== cls;
    });
  });

  /* ---- Robotics: Test connection button ---- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-robot-test]');
    if (!btn) return;
    withLoadingState(btn, 1200);
  });

  /* ---- Robotics: E-Stop send ---- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.js-estop-robot');
    if (!btn) return;
    var robotId = btn.dataset.robotId || 'selected robot';
    ConfirmModal.show({
      icon: '\u26A0',
      title: 'Send E-Stop to ' + robotId + '?',
      body: 'This will immediately halt the robot. All active missions will be suspended.',
      okText: 'Send E-Stop',
      onConfirm: function () {
        var banner = document.querySelector('.js-safety-status-banner');
        if (banner) {
          banner.textContent = '\u26A0 E-Stop Active \u2014 ' + robotId + ' halted';
          banner.style.background = '#fef2f2';
          banner.style.borderColor = '#fca5a5';
          banner.style.color = '#991b1b';
        }
      },
    });
  });

  /* ---- Robotics: E-Stop clear ---- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.js-clear-estop');
    if (!btn) return;
    var robotId = btn.dataset.robotId || 'robot';
    ConfirmModal.show({
      icon: '\u2713',
      title: 'Clear E-Stop for ' + robotId + '?',
      body: 'Confirm the robot has been physically verified safe. A rationale will be recorded in the audit log.',
      okText: 'Clear E-Stop',
      onConfirm: function () {
        var banner = document.querySelector('.js-safety-status-banner');
        if (banner) {
          banner.textContent = '\u25CF System NOMINAL \u2014 0 robots in E-Stop state';
          banner.style.background = '#f0fdf4';
          banner.style.borderColor = '#22c55e';
          banner.style.color = '#166534';
        }
      },
    });
  });

  /* ---- Robotics: Global E-Stop ---- */
  var globalEstopBtn = document.getElementById('btnGlobalEstop');
  if (globalEstopBtn) {
    globalEstopBtn.addEventListener('click', function () {
      ConfirmModal.show({
        icon: '\u26A0',
        title: 'Activate Global E-Stop?',
        body: 'ALL robots in the fleet will be immediately halted. This action is logged and requires an admin to clear.',
        okText: 'ACTIVATE GLOBAL E-STOP',
        onConfirm: function () {
          var banner = document.querySelector('.js-safety-status-banner');
          if (banner) {
            banner.textContent = '\u26A0 GLOBAL E-Stop ACTIVE \u2014 All robots halted';
            banner.style.background = '#fef2f2';
            banner.style.borderColor = '#fca5a5';
            banner.style.color = '#991b1b';
          }
        },
      });
    });
  }

  /* ---- WF-2: Owner picker keyboard navigation ---- */
  document.addEventListener('keydown', function (e) {
    var picker = document.getElementById('ownerPicker');
    if (!picker || picker.hidden) return;
    var searchInput = picker.querySelector('.owner-picker__search');
    var items = Array.from(picker.querySelectorAll('.owner-picker__item'));
    if (!items.length) return;

    if (document.activeElement === searchInput) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[0].focus();
      }
    } else if (document.activeElement && document.activeElement.classList.contains('owner-picker__item')) {
      var idx = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (idx < items.length - 1) items[idx + 1].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (idx > 0) items[idx - 1].focus();
        else if (searchInput) searchInput.focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        document.activeElement.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        picker.hidden = true;
        var t = document.querySelector('.js-owner-picker-trigger');
        if (t) t.setAttribute('aria-expanded', 'false');
        if (_ownerPickerTrigger) { _ownerPickerTrigger.focus(); _ownerPickerTrigger = null; }
      }
    }
  });

  /* ---- WF-3: Workforce card click handler ---- */
  var WORKFORCE_DATA = [
    { name: 'Alice Martinez', letter: 'A', email: 'alice.martinez@acme.com', availability: 'available', role: 'approver' },
    { name: 'Bob Chen',       letter: 'B', email: 'bob.chen@acme.com',       availability: 'busy',      role: 'operator' },
    { name: 'Carol Davis',    letter: 'C', email: 'carol.davis@acme.com',    availability: 'available', role: 'admin'    },
    { name: 'Dan Park',       letter: 'D', email: 'dan.park@acme.com',       availability: 'offline',   role: 'auditor'  },
  ];
  var AVAIL_LABEL = { available: 'Available', busy: 'Busy', offline: 'Offline' };
  document.addEventListener('click', function (e) {
    var card = e.target.closest('.workforce-card');
    if (!card) return;
    /* Ignore clicks that are inside the queues screen — those are queue-cards */
    if (e.target.closest('[data-screen="queues"]')) return;
    document.querySelectorAll('[data-screen="workforce"] .workforce-card').forEach(function (c) {
      c.classList.remove('workforce-card--selected');
    });
    card.classList.add('workforce-card--selected');
    var allCards = Array.from(document.querySelectorAll('[data-screen="workforce"] .workforce-card'));
    var idx = allCards.indexOf(card);
    var data = (idx >= 0 && idx < WORKFORCE_DATA.length) ? WORKFORCE_DATA[idx] : null;
    if (!data) return;
    var panel = document.querySelector('[data-screen="workforce"] .workforce-detail');
    if (!panel) return;
    /* Header */
    var nameEl = panel.querySelector('.workforce-detail__name');
    if (nameEl) nameEl.textContent = data.name;
    var avatarEl = panel.querySelector('.workforce-detail__avatar');
    if (avatarEl) avatarEl.textContent = data.letter;
    var dotEl = document.getElementById('wfDetailDot');
    if (dotEl) dotEl.className = 'availability-dot availability-dot--' + data.availability;
    var availText = document.getElementById('wfDetailAvailText');
    if (availText) availText.textContent = AVAIL_LABEL[data.availability] || data.availability;
    var emailEl = panel.querySelector('.workforce-detail__email');
    if (emailEl) emailEl.textContent = data.email;
    /* Overview grid */
    var gridName = document.getElementById('wfDetailGridName');
    if (gridName) gridName.textContent = data.name;
    var gridEmail = document.getElementById('wfDetailGridEmail');
    if (gridEmail) gridEmail.textContent = data.email;
    var gridRole = document.getElementById('wfDetailGridRole');
    if (gridRole) gridRole.textContent = data.role;
    /* Edit capabilities button aria-label */
    var editBtn = panel.querySelector('.js-workforce-edit-btn');
    if (editBtn) editBtn.setAttribute('aria-label', 'Edit capabilities for ' + data.name);
  });

  /* ---- WF-4: Queue card click handler ---- */
  var QUEUE_DATA = {
    'Finance Queue':  { strategy: 'least-busy',   cap: 'finance-review',  memberCount: 4, pendingCount: 2 },
    'Legal Queue':    { strategy: 'round-robin',   cap: 'legal-review',    memberCount: 2, pendingCount: 1 },
    'General Queue':  { strategy: 'manual',        cap: null,              memberCount: 6, pendingCount: 0 },
  };
  document.addEventListener('click', function (e) {
    var card = e.target.closest('.queue-card');
    if (!card) return;
    document.querySelectorAll('.queue-card').forEach(function (c) {
      c.classList.remove('queue-card--selected');
    });
    card.classList.add('queue-card--selected');
    var nameEl = card.querySelector('.queue-card__name');
    var queueName = nameEl ? nameEl.textContent.trim() : 'Queue';
    var qd = QUEUE_DATA[queueName];
    var panel = document.querySelector('[data-screen="queues"] .workforce-detail');
    if (!panel || !qd) return;
    /* Title row */
    var titleDiv = panel.querySelector('div[style*="font-weight: 700"]');
    if (titleDiv) titleDiv.textContent = queueName;
    /* Strategy / capability subtitle */
    var subtitleDiv = panel.querySelector('div[style*="color: var(--muted)"]');
    if (subtitleDiv) {
      subtitleDiv.innerHTML = 'Strategy: <strong>' + qd.strategy + '</strong>'
        + (qd.cap ? ' | Required capability: <strong>' + qd.cap + '</strong>' : ' | No capability required');
    }
    /* Member count label */
    var memberLabel = panel.querySelector('.subtle[style*="text-transform: uppercase"]');
    if (memberLabel) memberLabel.textContent = 'Members (' + qd.memberCount + ')';
    /* Pending tasks label */
    var pendingLabels = panel.querySelectorAll('.subtle[style*="text-transform: uppercase"]');
    if (pendingLabels[1]) pendingLabels[1].textContent = 'Pending HumanTasks (' + qd.pendingCount + ')';
  });

  /* ---- G-1: Chip Space/Enter keydown delegate ---- */
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.matches && e.target.matches('[role="button"][tabindex="0"].chip')) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.target.click();
      }
    }
  });

  render(initial);
}

main();
