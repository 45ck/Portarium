/* ============================================================
   Portarium Alt-C: Spatial / Board-First  --  wireframe.js
   ============================================================ */

const STORAGE_KEY = 'portarium_alt_c_v1';

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
   DETAIL PANEL CONTENT TEMPLATES
   ============================================================ */
const DETAIL_CONTENT = {
  /* ---- Work Item WI-1099 ---- */
  'wi-1099': {
    type: 'Work Item',
    id: 'WI-1099',
    status: '<span class="status status--warn">Needs approval</span>',
    body: `
      <div class="detail-section">
        <div class="detail-section__title">ExternalObjectRefs</div>
        <div class="detail-chips">
          <span class="chip">NetSuite | Invoice | INV-22318</span>
          <span class="chip">Stripe | Charge | ch_9d2a</span>
          <span class="chip">Zendesk | Ticket | 4831</span>
        </div>
      </div>
      <div class="callout callout--policy">
        Effective policy: Execution Tier <strong>Human-approve</strong>.
        SoD constraint: maker-checker may require a distinct approver.
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Timeline</div>
        <div class="list">
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Plan created</div>
              <div class="timeline-entry__subtle">Actor: User | Summary: Portarium intends to update invoice fields.</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--info">Plan</span></div>
          </div>
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Approval Gate opened</div>
              <div class="timeline-entry__subtle">Actor: System | Waiting on decision with rationale</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--warn">Approval</span></div>
          </div>
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Run paused</div>
              <div class="timeline-entry__subtle">Run: R-8920 | Workflow: Invoice correction</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--warn">Run</span></div>
          </div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Runs</div>
        <div class="list">
          <div class="timeline-entry" style="cursor:pointer" data-navigate="r-8920">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">R-8920 Invoice correction (paused)</div>
              <div class="timeline-entry__subtle">Started 12m ago | Waiting on Approval Gate</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--warn">Paused</span></div>
          </div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Evidence</div>
        <div class="list">
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Evidence entries (12)</div>
              <div class="timeline-entry__subtle">Plan | Approval | Action | System</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--info">View</span></div>
          </div>
        </div>
      </div>
    `,
    footer: '<button class="btn btn--primary" type="button">Start workflow/runbook</button>',
  },

  /* ---- Run R-8920 ---- */
  'r-8920': {
    type: 'Run',
    id: 'R-8920',
    status: '<span class="status status--warn">Paused</span>',
    body: `
      <div class="detail-section">
        <div class="detail-section__title">Run Progress</div>
        <div class="steps">
          <span class="step step--done">Queued</span>
          <span class="step step--done">Running</span>
          <span class="step step--active">Approval Gate</span>
          <span class="step">Complete</span>
        </div>
        <div class="subtle" style="margin-top:6px">Workflow: Invoice correction | Initiator: Me</div>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Plan + Effects</div>
        <div class="effects">
          <div class="effects__section">
            <div class="effects__title">Planned Effects</div>
            <div class="effects__hint">Portarium intends to...</div>
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
          <div class="effects__section">
            <div class="effects__title">Predicted Effects (optional)</div>
            <div class="effects__hint">The provider preview suggests...</div>
            <div class="effects__list">
              <div class="effect">
                <div class="effect__main">
                  <span class="pill">Update</span>
                  <span class="effect__target">NetSuite | Invoice | INV-22318</span>
                  <span class="confidence">Confidence: 0.82</span>
                </div>
                <div class="effect__subtle">Total remains unchanged.</div>
              </div>
            </div>
          </div>
          <div class="effects__section">
            <div class="effects__title">Verified Effects</div>
            <div class="effects__hint">Observed change (available post-run)</div>
            <div class="effects__list">
              <div class="effect effect--muted">
                <div class="effect__main">
                  <span class="pill">-</span>
                  <span class="effect__target">Not available yet</span>
                </div>
                <div class="effect__subtle">Run must complete to record verified evidence.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Approval Gate</div>
        <div class="callout callout--danger" style="margin-bottom:10px">
          SoD constraint: the initiator cannot self-approve (maker-checker).
        </div>
        <div class="form">
          <label class="field">
            <span class="field__label">Decision</span>
            <select class="field__input">
              <option>Approve</option>
              <option>Deny</option>
              <option>Request changes</option>
            </select>
          </label>
          <label class="field">
            <span class="field__label">Rationale (required)</span>
            <textarea class="field__input" rows="3" placeholder="Explain why this Plan is acceptable or not."></textarea>
          </label>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Evidence (Run-scoped)</div>
        <div class="list">
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Evidence: Plan recorded (hash chained)</div>
              <div class="timeline-entry__subtle">Category: Plan | Actor: User | Linked: Plan P-551</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--info">Evidence</span></div>
          </div>
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Evidence: Approval Gate opened</div>
              <div class="timeline-entry__subtle">Category: Approval | Actor: System | Linked: Run R-8920</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--warn">Evidence</span></div>
          </div>
        </div>
      </div>
    `,
    footer:
      '<button class="btn btn--primary" type="button">Submit decision</button><button class="btn" type="button">Retry</button>',
  },

  /* ---- Run R-8892 ---- */
  'r-8892': {
    type: 'Run',
    id: 'R-8892',
    status: '<span class="status status--info">Running</span>',
    body: `
      <div class="detail-section">
        <div class="detail-section__title">Run Progress</div>
        <div class="steps">
          <span class="step step--done">Queued</span>
          <span class="step step--active">Running</span>
          <span class="step">Approval Gate</span>
        </div>
        <div class="subtle" style="margin-top:6px">Workflow: Update Ticket priority | Initiator: Me</div>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Plan + Effects</div>
        <div class="effects">
          <div class="effects__section">
            <div class="effects__title">Planned Effects</div>
            <div class="effects__hint">Portarium intends to...</div>
            <div class="effects__list">
              <div class="effect">
                <div class="effect__main">
                  <span class="pill">Update</span>
                  <span class="effect__target">Zendesk | Ticket | 4831</span>
                </div>
                <div class="effect__subtle">Update priority from Normal to High.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Evidence (Run-scoped)</div>
        <div class="list">
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Evidence: Run initiated</div>
              <div class="timeline-entry__subtle">Category: Run | Actor: User | Linked: Run R-8892</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--info">Evidence</span></div>
          </div>
        </div>
      </div>
    `,
    footer: '<button class="btn" type="button">Export run summary</button>',
  },

  /* ---- Approval Gate: WI-1099 ---- */
  'ag-wi1099': {
    type: 'Approval Gate',
    id: 'AG-442',
    status: '<span class="status status--warn">Pending</span>',
    body: `
      <div class="detail-section">
        <div class="detail-section__title">Gate Details</div>
        <div class="list">
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Approve Plan: Create Invoice in NetSuite</div>
              <div class="timeline-entry__subtle">Work Item: WI-1099 | Run: R-8920</div>
            </div>
          </div>
        </div>
      </div>
      <div class="callout callout--policy">
        Execution Tier: <strong>Human-approve</strong><br>
        SoD constraint: maker-checker -- the initiator cannot self-approve.
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Plan Summary</div>
        <div class="effects">
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
      <div class="detail-section">
        <div class="detail-section__title">Decision</div>
        <div class="callout callout--danger" style="margin-bottom:10px">
          SoD constraint: the initiator cannot self-approve (maker-checker).
        </div>
        <div class="form">
          <label class="field">
            <span class="field__label">Decision</span>
            <select class="field__input">
              <option>Approve</option>
              <option>Deny</option>
              <option>Request changes</option>
            </select>
          </label>
          <label class="field">
            <span class="field__label">Rationale (required)</span>
            <textarea class="field__input" rows="3" placeholder="Explain why this Plan is acceptable or not."></textarea>
          </label>
        </div>
      </div>
    `,
    footer: '<button class="btn btn--primary" type="button">Submit decision</button>',
  },

  /* ---- Approval Gate: WI-1042 ---- */
  'ag-wi1042': {
    type: 'Approval Gate',
    id: 'AG-443',
    status: '<span class="status status--warn">Pending</span>',
    body: `
      <div class="detail-section">
        <div class="detail-section__title">Gate Details</div>
        <div class="list">
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Approve Plan: Update Ticket priority in Zendesk</div>
              <div class="timeline-entry__subtle">Work Item: WI-1042 | Run: R-8892</div>
            </div>
          </div>
        </div>
      </div>
      <div class="callout callout--policy">
        Execution Tier: <strong>Human-approve</strong>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Plan Summary</div>
        <div class="effects">
          <div class="effects__list">
            <div class="effect">
              <div class="effect__main">
                <span class="pill">Update</span>
                <span class="effect__target">Zendesk | Ticket | 4831</span>
              </div>
              <div class="effect__subtle">Update priority from Normal to High.</div>
            </div>
          </div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Decision</div>
        <div class="form">
          <label class="field">
            <span class="field__label">Decision</span>
            <select class="field__input">
              <option>Approve</option>
              <option>Deny</option>
              <option>Request changes</option>
            </select>
          </label>
          <label class="field">
            <span class="field__label">Rationale (required)</span>
            <textarea class="field__input" rows="3" placeholder="Explain why this Plan is acceptable or not."></textarea>
          </label>
        </div>
      </div>
    `,
    footer: '<button class="btn btn--primary" type="button">Submit decision</button>',
  },

  /* ---- Run: WI-1021 (failed CRM sync) ---- */
  'run-wi1021': {
    type: 'Run',
    id: 'R-8850',
    status: '<span class="status status--danger">Failed</span>',
    body: `
      <div class="detail-section">
        <div class="detail-section__title">Run Progress</div>
        <div class="steps">
          <span class="step step--done">Queued</span>
          <span class="step step--done">Running (step 1)</span>
          <span class="step" style="border-color:var(--danger)">Failed (step 2)</span>
        </div>
        <div class="subtle" style="margin-top:6px">Workflow: Update Opportunity | Work Item: WI-1021</div>
      </div>
      <div class="callout callout--danger">
        Run failed: CRM sync hit rate limit. The adapter reported HTTP 429 from the CRM API.
        Retry is available once the rate limit window expires.
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Evidence (Run-scoped)</div>
        <div class="list">
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Evidence: Run initiated</div>
              <div class="timeline-entry__subtle">Category: Run | Actor: User</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--info">Evidence</span></div>
          </div>
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Evidence: Action failed (rate limit)</div>
              <div class="timeline-entry__subtle">Category: Action | Actor: Adapter | HTTP 429</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--danger">Evidence</span></div>
          </div>
        </div>
      </div>
    `,
    footer:
      '<button class="btn btn--primary" type="button">Retry</button><button class="btn" type="button">Export run summary</button>',
  },

  /* ---- Run: WI-1103 (blocked missing scope) ---- */
  'run-wi1103': {
    type: 'Run',
    id: 'R-8860',
    status: '<span class="status status--danger">Blocked</span>',
    body: `
      <div class="detail-section">
        <div class="detail-section__title">Run Progress</div>
        <div class="steps">
          <span class="step step--done">Queued</span>
          <span class="step" style="border-color:var(--danger)">Blocked (step 1)</span>
          <span class="step">Send Email</span>
        </div>
        <div class="subtle" style="margin-top:6px">Workflow: Send Email | Work Item: WI-1103</div>
      </div>
      <div class="callout callout--danger">
        Run blocked: missing provider scope. The adapter requires
        <code>mail.send</code> scope which is not configured for this workspace.
        <a href="#settings">Go to settings</a> to add the required scope.
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Evidence (Run-scoped)</div>
        <div class="list">
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Evidence: Run initiated</div>
              <div class="timeline-entry__subtle">Category: Run | Actor: User</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--info">Evidence</span></div>
          </div>
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Evidence: Scope check failed</div>
              <div class="timeline-entry__subtle">Category: System | Actor: Adapter | Required: mail.send</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--danger">Evidence</span></div>
          </div>
        </div>
      </div>
    `,
    footer: '<a class="btn btn--primary" href="#settings">Configure provider scopes</a>',
  },

  /* ---- Policy: SoD ---- */
  'policy-sod': {
    type: 'Policy Violation',
    id: 'SoD-001',
    status: '<span class="status status--warn">Needs action</span>',
    body: `
      <div class="detail-section">
        <div class="detail-section__title">Violation Details</div>
        <div class="callout callout--warn">
          <strong>Separation of Duties constraint: maker-checker required.</strong><br>
          The initiator of Run R-8920 (WI-1099) cannot approve the resulting Approval Gate.
          A distinct approver must be assigned, or the policy must be updated to allow self-approval.
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Related Entities</div>
        <div class="list">
          <div class="timeline-entry" style="cursor:pointer" data-navigate="wi-1099">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">WI-1099 Invoice correction for ACME</div>
              <div class="timeline-entry__subtle">Work Item | Owner: Me</div>
            </div>
          </div>
          <div class="timeline-entry" style="cursor:pointer" data-navigate="r-8920">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">R-8920 Invoice correction</div>
              <div class="timeline-entry__subtle">Run | Paused at Approval Gate</div>
            </div>
          </div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Remediation</div>
        <div class="subtle">
          Option 1: Assign a different approver to the Approval Gate.<br>
          Option 2: Update the SoD policy to allow self-approval for this tier (Admin only).
        </div>
      </div>
    `,
    footer:
      '<button class="btn btn--primary" type="button">Assign approver (stub)</button><a class="btn" href="#settings">Edit policy</a>',
  },

  /* ---- Resolved item ---- */
  'resolved-1': {
    type: 'Run',
    id: 'R-8801',
    status: '<span class="status status--ok">Resolved</span>',
    body: `
      <div class="detail-section">
        <div class="detail-section__title">Run Progress</div>
        <div class="steps">
          <span class="step step--done">Queued</span>
          <span class="step step--done">Running</span>
          <span class="step step--done">Complete</span>
        </div>
        <div class="subtle" style="margin-top:6px">Workflow: Receipt export | Work Item: WI-1013 | Completed 3h ago</div>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Evidence (Run-scoped)</div>
        <div class="list">
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Evidence: Run completed successfully</div>
              <div class="timeline-entry__subtle">Category: Run | Actor: System | All steps passed</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--ok">Evidence</span></div>
          </div>
        </div>
      </div>
    `,
    footer: '<button class="btn" type="button">Export run summary</button>',
  },

  /* ---- Work Item WI-1013 ---- */
  'wi-1013': {
    type: 'Work Item',
    id: 'WI-1013',
    status: '<span class="status">Open</span>',
    body: `
      <div class="detail-section">
        <div class="detail-section__title">ExternalObjectRefs</div>
        <div class="detail-chips">
          <span class="chip">Stripe | Charge | multiple</span>
          <span class="chip">Drive | Folder | audit-2026-Q1</span>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Timeline</div>
        <div class="list">
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Work Item created</div>
              <div class="timeline-entry__subtle">Actor: User | Receipt export for audit period</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--info">Created</span></div>
          </div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Runs</div>
        <div class="subtle">No runs started yet.</div>
      </div>
    `,
    footer: '<button class="btn btn--primary" type="button">Start workflow/runbook</button>',
  },

  /* ---- Work Item WI-1042 ---- */
  'wi-1042': {
    type: 'Work Item',
    id: 'WI-1042',
    status: '<span class="status status--info">In progress</span>',
    body: `
      <div class="detail-section">
        <div class="detail-section__title">ExternalObjectRefs</div>
        <div class="detail-chips">
          <span class="chip">Stripe | Dispute | dp_8f3c</span>
          <span class="chip">Zendesk | Ticket | 4831</span>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Timeline</div>
        <div class="list">
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Work Item created</div>
              <div class="timeline-entry__subtle">Actor: User | Dispute: investigate payment failure</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--info">Created</span></div>
          </div>
          <div class="timeline-entry">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">Run started</div>
              <div class="timeline-entry__subtle">Run: R-8892 | Workflow: Update Ticket priority</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--info">Run</span></div>
          </div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section__title">Runs</div>
        <div class="list">
          <div class="timeline-entry" style="cursor:pointer" data-navigate="r-8892">
            <div class="timeline-entry__main">
              <div class="timeline-entry__title">R-8892 Update Ticket priority (running)</div>
              <div class="timeline-entry__subtle">Started 1h ago | Step 1/3</div>
            </div>
            <div class="timeline-entry__right"><span class="status status--info">Running</span></div>
          </div>
        </div>
      </div>
    `,
    footer: '<button class="btn btn--primary" type="button">Start workflow/runbook</button>',
  },
};

/* ============================================================
   BOARD / VIEW ROUTING
   ============================================================ */
const BOARDS = ['triage', 'work-items', 'runs', 'approvals'];
const SCREENS = ['evidence', 'settings'];
const ALL_VIEWS = BOARDS.concat(SCREENS);

function getViewFromHash() {
  const raw = (location.hash || '#triage').slice(1);
  return ALL_VIEWS.indexOf(raw) !== -1 ? raw : 'triage';
}

/* ============================================================
   RENDERING
   ============================================================ */
function activateView(view) {
  /* Boards */
  qsa('.board').forEach(function (el) {
    el.classList.toggle('is-active', el.dataset.board === view);
  });

  /* Screens */
  qsa('.screen').forEach(function (el) {
    el.classList.toggle('is-active', el.dataset.screen === view);
  });

  /* Board selector buttons */
  qsa('.board-selector__btn').forEach(function (btn) {
    btn.classList.toggle('is-active', btn.dataset.board === view);
  });

  /* Hide grouping control for non-board views */
  var groupingCtrl = qs('#grouping').closest('.control');
  groupingCtrl.style.display = BOARDS.indexOf(view) !== -1 ? 'grid' : 'none';
}

function setBanners(systemState) {
  qs('.js-banner-degraded').hidden = systemState !== 'degraded';
  qs('.js-banner-misconfigured').hidden = systemState !== 'misconfigured';
  qs('.js-banner-policy').hidden = systemState !== 'policy-blocked';
  qs('.js-banner-rbac').hidden = systemState !== 'rbac-limited';
}

function setEmptyStates(systemState) {
  var isEmpty = systemState === 'empty';

  qsa('.js-empty-col').forEach(function (el) {
    el.hidden = !isEmpty;
  });
  qsa('.js-nonempty-col').forEach(function (el) {
    el.hidden = isEmpty;
  });
  qsa('.js-empty-evidence').forEach(function (el) {
    el.hidden = !isEmpty;
  });
  qsa('.js-nonempty-evidence').forEach(function (el) {
    el.hidden = isEmpty;
  });

  /* Update column counts */
  qsa('.column').forEach(function (col) {
    var cards = col.querySelectorAll('.entity-card:not([hidden])');
    var countEl = col.querySelector('.js-col-count');
    if (countEl) {
      countEl.textContent = isEmpty ? '0' : cards.length;
    }
    /* Update aria-label on header */
    var header = col.querySelector('.column__header');
    if (header) {
      var title = col.querySelector('.column__title');
      var count = isEmpty ? 0 : cards.length;
      header.setAttribute(
        'aria-label',
        (title ? title.textContent : '') + ', ' + count + ' item' + (count !== 1 ? 's' : ''),
      );
    }
  });

  /* Show empty message in columns that have no cards even in normal state */
  if (!isEmpty) {
    qsa('.column').forEach(function (col) {
      var cards = col.querySelectorAll('.entity-card');
      var emptyEl = col.querySelector('.column__empty');
      if (emptyEl && cards.length === 0) {
        emptyEl.hidden = false;
      }
    });
  }
}

function setWorkspaceType(workspaceType) {
  var showUnassigned = workspaceType === 'team';
  qsa('.js-owner-text').forEach(function (el) {
    el.textContent = showUnassigned ? 'Unassigned' : 'Me';
  });
}

function applyPersonaSorting(persona) {
  /* On the triage board, reorder columns based on persona defaults:
     - Operator: Failed/Blocked first
     - Approver: Needs Approval first
     - Others: default order */
  var triageBoard = qs('#board-triage');
  var columns = qsa('.column', triageBoard);
  if (columns.length === 0) return;

  /* Reset order */
  columns.forEach(function (col) {
    col.style.order = '';
  });

  if (persona === 'operator') {
    /* Failed/Blocked first */
    columns.forEach(function (col) {
      if (col.dataset.column === 'failed-blocked') col.style.order = '-1';
    });
  } else if (persona === 'approver') {
    /* Needs Approval first */
    columns.forEach(function (col) {
      if (col.dataset.column === 'needs-approval') col.style.order = '-1';
    });
  }
}

function disableActions(systemState) {
  var shouldDisable =
    systemState === 'policy-blocked' ||
    systemState === 'rbac-limited' ||
    systemState === 'misconfigured';
  qsa('.entity-card__cta').forEach(function (btn) {
    btn.disabled = shouldDisable;
    if (shouldDisable) {
      btn.setAttribute('aria-disabled', 'true');
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
    } else {
      btn.removeAttribute('aria-disabled');
      btn.style.opacity = '';
      btn.style.pointerEvents = '';
    }
  });
}

function applyGrouping(grouping) {
  qsa('.board').forEach(function (board) {
    board.classList.toggle('has-swimlanes', grouping === 'owner');
  });
}

/* ============================================================
   DETAIL PANEL
   ============================================================ */
function openDetailPanel(detailId) {
  var content = DETAIL_CONTENT[detailId];
  if (!content) return;

  var panel = qs('#detailPanel');
  qs('#panelType', panel).textContent = content.type;
  qs('#panelId', panel).textContent = content.id;
  qs('#panelStatus', panel).innerHTML = content.status;
  qs('#panelBody', panel).innerHTML = content.body;
  qs('#panelFooter', panel).innerHTML = content.footer;

  panel.classList.add('is-open');

  /* Highlight selected card */
  qsa('.entity-card.is-selected').forEach(function (c) {
    c.classList.remove('is-selected');
  });
  var selectedCard = document.querySelector('[data-detail="' + detailId + '"]');
  if (selectedCard) selectedCard.classList.add('is-selected');

  /* Dim boards behind panel */
  qsa('.board.is-active').forEach(function (b) {
    b.classList.add('is-dimmed');
  });

  /* Focus close button */
  qs('#panelClose').focus();

  /* Wire up navigate links inside the panel */
  qsa('[data-navigate]', panel).forEach(function (el) {
    el.addEventListener('click', function () {
      openDetailPanel(el.dataset.navigate);
    });
  });
}

function closeDetailPanel() {
  var panel = qs('#detailPanel');
  panel.classList.remove('is-open');

  /* Remove card highlights */
  qsa('.entity-card.is-selected').forEach(function (c) {
    c.classList.remove('is-selected');
  });

  /* Un-dim boards */
  qsa('.board.is-dimmed').forEach(function (b) {
    b.classList.remove('is-dimmed');
  });

  /* Return focus to the previously selected card */
  var focused = document.querySelector('.entity-card:focus');
  if (!focused) {
    var first = document.querySelector('.board.is-active .entity-card');
    if (first) first.focus();
  }
}

/* ============================================================
   KEYBOARD NAVIGATION
   ============================================================ */
function getCardGrid() {
  /* Build a 2D grid: columns x cards */
  var activeBoard = document.querySelector('.board.is-active');
  if (!activeBoard) return [];

  var columns = qsa('.column', activeBoard);
  var grid = [];
  columns.forEach(function (col) {
    var cards = qsa('.entity-card:not([hidden])', col);
    if (cards.length > 0) {
      grid.push(cards);
    }
  });
  return grid;
}

function findCardPosition(card) {
  var grid = getCardGrid();
  for (var col = 0; col < grid.length; col++) {
    for (var row = 0; row < grid[col].length; row++) {
      if (grid[col][row] === card) {
        return { col: col, row: row };
      }
    }
  }
  return null;
}

function handleArrowKeys(e) {
  var panel = qs('#detailPanel');
  if (panel.classList.contains('is-open')) return;

  var focused = document.activeElement;
  if (!focused || !focused.classList.contains('entity-card')) return;

  var pos = findCardPosition(focused);
  if (!pos) return;

  var grid = getCardGrid();
  var nextCard = null;

  switch (e.key) {
    case 'ArrowUp':
      if (pos.row > 0) nextCard = grid[pos.col][pos.row - 1];
      e.preventDefault();
      break;
    case 'ArrowDown':
      if (pos.row < grid[pos.col].length - 1) nextCard = grid[pos.col][pos.row + 1];
      e.preventDefault();
      break;
    case 'ArrowLeft':
      if (pos.col > 0) {
        var targetRow = Math.min(pos.row, grid[pos.col - 1].length - 1);
        nextCard = grid[pos.col - 1][targetRow];
      }
      e.preventDefault();
      break;
    case 'ArrowRight':
      if (pos.col < grid.length - 1) {
        var targetRow2 = Math.min(pos.row, grid[pos.col + 1].length - 1);
        nextCard = grid[pos.col + 1][targetRow2];
      }
      e.preventDefault();
      break;
    case 'Enter':
      var detailId = focused.dataset.detail;
      if (detailId) openDetailPanel(detailId);
      e.preventDefault();
      break;
  }

  if (nextCard) {
    nextCard.focus();
  }
}

/* ============================================================
   MAIN
   ============================================================ */
function render(state) {
  setBanners(state.systemState);
  setEmptyStates(state.systemState);
  setWorkspaceType(state.workspaceType);
  applyPersonaSorting(state.persona);
  disableActions(state.systemState);
  applyGrouping(state.grouping || 'none');
  activateView(getViewFromHash());
}

function main() {
  var persona = qs('#persona');
  var workspaceType = qs('#workspaceType');
  var systemState = qs('#systemState');
  var grouping = qs('#grouping');

  var saved = getState();
  var initial = {
    persona: saved && saved.persona ? saved.persona : 'operator',
    workspaceType: saved && saved.workspaceType ? saved.workspaceType : 'team',
    systemState: saved && saved.systemState ? saved.systemState : 'normal',
    grouping: saved && saved.grouping ? saved.grouping : 'none',
  };

  persona.value = initial.persona;
  workspaceType.value = initial.workspaceType;
  systemState.value = initial.systemState;
  grouping.value = initial.grouping;

  function onChange() {
    var next = {
      persona: persona.value,
      workspaceType: workspaceType.value,
      systemState: systemState.value,
      grouping: grouping.value,
    };
    setState(next);
    render(next);
  }

  persona.addEventListener('change', onChange);
  workspaceType.addEventListener('change', onChange);
  systemState.addEventListener('change', onChange);
  grouping.addEventListener('change', onChange);

  /* Hash routing */
  window.addEventListener('hashchange', function () {
    closeDetailPanel();
    activateView(getViewFromHash());
  });

  /* Card clicks */
  document.addEventListener('click', function (e) {
    var card = e.target.closest('.entity-card');
    if (card && card.dataset.detail) {
      e.preventDefault();
      openDetailPanel(card.dataset.detail);
      return;
    }
  });

  /* Panel close button */
  qs('#panelClose').addEventListener('click', closeDetailPanel);

  /* Escape key to close panel */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var panel = qs('#detailPanel');
      if (panel.classList.contains('is-open')) {
        closeDetailPanel();
        e.preventDefault();
        return;
      }
    }
    /* Arrow keys for card navigation */
    handleArrowKeys(e);
  });

  /* Responsive: toggle column collapse on narrow viewports */
  document.addEventListener('click', function (e) {
    if (window.innerWidth > 768) return;
    var header = e.target.closest('.column__header');
    if (header) {
      var col = header.closest('.column');
      if (col) col.classList.toggle('is-collapsed');
    }
  });

  /* Initial render */
  render(initial);
}

main();
