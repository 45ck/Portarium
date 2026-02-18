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
  'robots',
  'missions',
  'safety',
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

  /* Robotics persona gating — show/hide CTAs based on data-requires-persona */
  document.querySelectorAll('[data-requires-persona]').forEach(function (el) {
    var allowed = el.getAttribute('data-requires-persona').split(' ');
    el.style.display = allowed.includes(persona) ? '' : 'none';
  });
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
    if (progressFill) progressFill.style.width = (triageIndex / 4) * 100 + '%';
    if (currentSpan) currentSpan.textContent = Math.min(triageIndex + 1, 4);
    if (triageIndex >= 4) {
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
   CONFIRMATION MODAL (H3, H5)
   ============================================================ */
const ConfirmModal = (function () {
  'use strict';
  var _callback = null;

  function show(opts) {
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
      if (e.key === 'Escape') {
        var modal = document.getElementById('confirmModal');
        if (modal && !modal.hidden) {
          hide();
          e.preventDefault();
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
  btn.textContent = originalText.replace(/^(.*?)$/, '$1');
  setTimeout(function () {
    btn.classList.remove('btn--loading');
    btn.textContent = originalText;
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
    if (fieldDecision)
      fieldDecision.classList.toggle('field--error', decision.value !== '' && !decisionValid);
    if (fieldRationale) {
      var showError = rationale.value.trim().length > 0 && !rationaleValid;
      fieldRationale.classList.toggle('field--error', showError);
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

  render(initial);
}

main();
