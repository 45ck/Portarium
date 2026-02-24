# AI Summary for Approval Triage -- Design Specification

> **Date:** 2026-02-17
> **Status:** Ready for integration
> **Depends on:** A/B Toggle system (`ab-toggle-design.md`), Triage card (`index.html`)

---

## 1. Summary Schema Definition

Every AI summary follows a fixed schema so approvers build muscle memory. The
schema is the same regardless of the approval type -- only the content changes.

```typescript
interface AISummary {
  /** Unique ID matching the approval gate */
  gateId: string;

  /** 1-2 sentence plain-language description of what approval means */
  actionSummary: string;

  /** Risk assessment with structured level + rationale */
  risk: {
    level: 'low' | 'medium' | 'high';
    rationale: string;
    why?: string; // AI reasoning (shown on "Why?" tap)
  };

  /** Per-policy compliance check */
  compliance: {
    status: 'pass' | 'warn' | 'fail';
    policy: string;
    detail: string;
    why?: string;
  }[];

  /** External systems that will be written to or read from */
  affectedSystems: {
    system: string;
    operation: 'read' | 'write' | 'delete';
    target: string;
  }[];

  /** Can this action be undone? */
  reversibility: {
    reversible: boolean;
    detail: string;
    why?: string;
  };

  /** Regulatory or legal notes (omitted when empty) */
  legalNotes: string | null;

  /** 0-100 confidence score with explanation */
  confidence: {
    score: number;
    explanation: string;
  };

  /** ISO timestamp of when the summary was generated */
  generatedAt: string;
}
```

### 1.1 Display Modes

| Mode         | Shows                                        | Use case                      |
| ------------ | -------------------------------------------- | ----------------------------- |
| **Quick**    | Action summary + risk badge + confidence dot | Scan-and-decide in <5 seconds |
| **Detailed** | Full schema: all six fields + "Why?" links   | Deep review before high-risk  |

---

## 2. HTML Component

### 2.1 Quick Summary (collapsed -- default)

Injected inside `.triage-card__front`, immediately after `.triage-card__effects-summary`
and before the `.callout--policy` block.

```html
<!-- AI Summary: Quick Mode (collapsed) -->
<div class="ai-summary" data-ai-gate="AG-442">
  <div class="ai-summary__header">
    <div class="ai-summary__badge">
      <span class="ai-summary__icon">&#9670;</span>
      <span class="ai-summary__label">AI Summary</span>
    </div>
    <div class="ai-summary__header-right">
      <span class="ai-summary__confidence" data-confidence="high" title="Confidence: 92%">
        <span class="ai-summary__confidence-dot"></span>
        92%
      </span>
      <button
        class="ai-summary__toggle js-ai-summary-toggle"
        type="button"
        aria-expanded="false"
        aria-controls="aiDetailAG442"
      >
        Details
      </button>
    </div>
  </div>
  <div class="ai-summary__quick">
    <p class="ai-summary__action">
      Updates invoice INV-22318 memo and line items in NetSuite, then creates a receipt bundle in
      Drive for audit evidence.
    </p>
    <div class="ai-summary__tags">
      <span class="ai-summary__risk ai-summary__risk--medium"> Medium risk </span>
      <span class="ai-summary__compliance ai-summary__compliance--pass"> Compliance: pass </span>
      <span class="ai-summary__reversibility ai-summary__reversibility--partial">
        Partially reversible
      </span>
    </div>
  </div>

  <!-- Detailed Mode (expanded on click) -->
  <div class="ai-summary__detail" id="aiDetailAG442" hidden>
    <!-- Risk Assessment -->
    <div class="ai-summary__section">
      <div class="ai-summary__section-header">
        <span class="ai-summary__section-title">Risk Assessment</span>
        <span class="ai-summary__risk ai-summary__risk--medium">Medium</span>
      </div>
      <p class="ai-summary__section-body">
        Invoice amount ($12,500) exceeds the $10,000 policy threshold. Two external systems will be
        written to. No prior failed attempts for this work item.
      </p>
      <button class="ai-summary__why js-ai-why" type="button">Why?</button>
      <div class="ai-summary__why-detail" hidden>
        Risk scored medium because: (1) write amount is above policy threshold but within 2x the
        limit; (2) both target systems have healthy connections; (3) idempotency keys are present
        for retry safety.
      </div>
    </div>

    <!-- Compliance Check -->
    <div class="ai-summary__section">
      <div class="ai-summary__section-header">
        <span class="ai-summary__section-title">Compliance</span>
      </div>
      <div class="ai-summary__compliance-list">
        <div class="ai-summary__compliance-item">
          <span class="ai-summary__compliance ai-summary__compliance--pass">Pass</span>
          <span>Invoice write threshold policy (amount &gt; $10,000 requires human approval)</span>
        </div>
        <div class="ai-summary__compliance-item">
          <span class="ai-summary__compliance ai-summary__compliance--pass">Pass</span>
          <span>Segregation of Duties: maker-checker constraint satisfied</span>
        </div>
      </div>
    </div>

    <!-- Affected Systems -->
    <div class="ai-summary__section">
      <div class="ai-summary__section-header">
        <span class="ai-summary__section-title">Affected Systems</span>
      </div>
      <div class="ai-summary__systems">
        <div class="ai-summary__system">
          <span class="pill">Write</span>
          <span>NetSuite | Invoice | INV-22318</span>
        </div>
        <div class="ai-summary__system">
          <span class="pill">Create</span>
          <span>Google Drive | Document | Receipt bundle</span>
        </div>
      </div>
    </div>

    <!-- Reversibility -->
    <div class="ai-summary__section">
      <div class="ai-summary__section-header">
        <span class="ai-summary__section-title">Reversibility</span>
        <span class="ai-summary__reversibility ai-summary__reversibility--partial">Partial</span>
      </div>
      <p class="ai-summary__section-body">
        Invoice memo update can be reverted. Line item reclassification can be undone. Drive
        document creation cannot be automatically deleted (requires manual removal).
      </p>
      <button class="ai-summary__why js-ai-why" type="button">Why?</button>
      <div class="ai-summary__why-detail" hidden>
        NetSuite invoice fields support PUT overwrite, so the memo and line items can be restored to
        previous values. Google Drive file creation has no automated delete in the current adapter
        scope configuration.
      </div>
    </div>

    <!-- Legal / Regulatory -->
    <div class="ai-summary__section">
      <div class="ai-summary__section-header">
        <span class="ai-summary__section-title">Legal / Regulatory</span>
      </div>
      <p class="ai-summary__section-body">
        Invoice modifications above $10,000 are subject to SOX compliance logging. Evidence chain
        entry will be created automatically upon approval.
      </p>
    </div>

    <!-- Confidence -->
    <div class="ai-summary__section ai-summary__section--confidence">
      <div class="ai-summary__section-header">
        <span class="ai-summary__section-title">AI Confidence</span>
        <span class="ai-summary__confidence" data-confidence="high">
          <span class="ai-summary__confidence-dot"></span>
          92%
        </span>
      </div>
      <p class="ai-summary__section-body">
        High confidence. Based on: matching historical approval patterns (14 similar invoices
        approved), healthy system connections, and complete policy rule coverage.
      </p>
    </div>

    <div class="ai-summary__footer">Generated 2 minutes ago</div>
  </div>
</div>
```

---

## 3. CSS Styles

Append to `wireframe.css`:

```css
/* ============================================================
   AI SUMMARY (Approval Triage)
   ============================================================ */

/* ---- Container ---- */
.ai-summary {
  margin: 12px 0;
  padding: 12px;
  border-radius: var(--r-md);
  border: 2px solid rgba(108, 93, 211, 0.35);
  background: rgba(108, 93, 211, 0.03);
}

/* ---- Header row ---- */
.ai-summary__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.ai-summary__badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6c5dd3;
}
.ai-summary__icon {
  font-size: 10px;
}
.ai-summary__header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ---- Confidence indicator ---- */
.ai-summary__confidence {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 900;
  color: var(--muted);
}
.ai-summary__confidence-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  border: 2px solid var(--line-soft);
  background: var(--muted);
}
.ai-summary__confidence[data-confidence='high'] .ai-summary__confidence-dot {
  background: var(--ok);
  border-color: var(--ok);
}
.ai-summary__confidence[data-confidence='medium'] .ai-summary__confidence-dot {
  background: var(--warn);
  border-color: var(--warn);
}
.ai-summary__confidence[data-confidence='low'] .ai-summary__confidence-dot {
  background: var(--danger);
  border-color: var(--danger);
}

/* ---- Toggle button ---- */
.ai-summary__toggle {
  padding: 3px 8px;
  border-radius: 999px;
  border: 2px solid rgba(108, 93, 211, 0.3);
  background: rgba(108, 93, 211, 0.06);
  font-size: 11px;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
  color: #6c5dd3;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}
.ai-summary__toggle:hover {
  background: rgba(108, 93, 211, 0.12);
  border-color: rgba(108, 93, 211, 0.5);
}
.ai-summary__toggle:focus-visible {
  outline: 3px solid rgba(10, 102, 255, 0.35);
  outline-offset: 2px;
}
.ai-summary__toggle[aria-expanded='true'] {
  background: rgba(108, 93, 211, 0.15);
  border-color: #6c5dd3;
}

/* ---- Quick view ---- */
.ai-summary__quick {
  margin-bottom: 0;
}
.ai-summary__action {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--ink);
}
.ai-summary__tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}

/* ---- Risk badge ---- */
.ai-summary__risk {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  border: 2px solid var(--line-soft);
  font-size: 11px;
  font-weight: 900;
  background: #fff;
}
.ai-summary__risk--low {
  border-color: var(--ok);
  color: var(--ok);
}
.ai-summary__risk--medium {
  border-color: var(--warn);
  color: var(--warn);
}
.ai-summary__risk--high {
  border-color: var(--danger);
  color: var(--danger);
}

/* ---- Compliance badge ---- */
.ai-summary__compliance {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  border: 2px solid var(--line-soft);
  font-size: 11px;
  font-weight: 900;
  background: #fff;
}
.ai-summary__compliance--pass {
  border-color: var(--ok);
  color: var(--ok);
}
.ai-summary__compliance--warn {
  border-color: var(--warn);
  color: var(--warn);
}
.ai-summary__compliance--fail {
  border-color: var(--danger);
  color: var(--danger);
}

/* ---- Reversibility badge ---- */
.ai-summary__reversibility {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  border: 2px solid var(--line-soft);
  font-size: 11px;
  font-weight: 900;
  background: #fff;
}
.ai-summary__reversibility--full {
  border-color: var(--ok);
  color: var(--ok);
}
.ai-summary__reversibility--partial {
  border-color: var(--warn);
  color: var(--warn);
}
.ai-summary__reversibility--none {
  border-color: var(--danger);
  color: var(--danger);
}

/* ---- Detailed view ---- */
.ai-summary__detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(108, 93, 211, 0.2);
}

/* ---- Section blocks ---- */
.ai-summary__section {
  padding: 10px 0;
  border-bottom: 1px solid rgba(108, 93, 211, 0.12);
}
.ai-summary__section:last-of-type {
  border-bottom: none;
}
.ai-summary__section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.ai-summary__section-title {
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--muted);
}
.ai-summary__section-body {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--ink);
}
.ai-summary__section--confidence {
  background: rgba(108, 93, 211, 0.04);
  margin: 0 -12px;
  padding: 10px 12px;
  border-radius: 0 0 var(--r-md) var(--r-md);
  border-bottom: none;
}

/* ---- Compliance list ---- */
.ai-summary__compliance-list {
  display: grid;
  gap: 6px;
  margin-top: 6px;
}
.ai-summary__compliance-item {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  font-weight: 700;
}

/* ---- Affected systems list ---- */
.ai-summary__systems {
  display: grid;
  gap: 6px;
  margin-top: 6px;
}
.ai-summary__system {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  font-weight: 700;
}

/* ---- "Why?" links ---- */
.ai-summary__why {
  display: inline-flex;
  align-items: center;
  margin-top: 4px;
  padding: 2px 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-size: 12px;
  font-weight: 800;
  font-family: inherit;
  color: #6c5dd3;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.ai-summary__why:hover {
  background: rgba(108, 93, 211, 0.08);
}
.ai-summary__why:focus-visible {
  outline: 3px solid rgba(10, 102, 255, 0.35);
  outline-offset: 2px;
}
.ai-summary__why-detail {
  margin-top: 4px;
  padding: 8px 10px;
  border-radius: var(--r-sm);
  border: 1px dashed rgba(108, 93, 211, 0.3);
  background: rgba(108, 93, 211, 0.04);
  font-size: 12px;
  line-height: 1.4;
  color: var(--muted);
}

/* ---- Footer ---- */
.ai-summary__footer {
  margin-top: 8px;
  font-size: 11px;
  color: var(--muted);
  font-weight: 700;
}

/* ---- Feature flag toggle in screen header ---- */
.ai-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 2px solid rgba(108, 93, 211, 0.3);
  background: var(--panel);
  font-size: 11px;
  font-weight: 900;
  font-family: inherit;
  cursor: pointer;
  color: var(--muted);
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
  user-select: none;
}
.ai-toggle:hover {
  border-color: rgba(108, 93, 211, 0.5);
}
.ai-toggle:focus-visible {
  outline: 3px solid rgba(10, 102, 255, 0.35);
  outline-offset: 2px;
}
.ai-toggle--active {
  background: rgba(108, 93, 211, 0.08);
  border-color: #6c5dd3;
  color: #6c5dd3;
}
.ai-toggle__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  border: 2px solid var(--line-soft);
  background: var(--muted);
  transition:
    background 0.15s,
    border-color 0.15s;
}
.ai-toggle--active .ai-toggle__dot {
  background: #6c5dd3;
  border-color: #6c5dd3;
}

/* ---- Hidden when AI is off ---- */
.ai-summary--hidden {
  display: none;
}
```

---

## 4. JavaScript

### 4.1 Feature Flag Toggle (AB Integration)

The AI summary toggle is a separate feature flag that works orthogonally to
the A/B layout toggle. It uses `sessionStorage` under a dedicated key and
is displayed as a small pill button in the Approvals screen header.

```js
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
```

### 4.2 Detail Toggle and "Why?" Handlers

```js
/* ============================================================
   AI SUMMARY INTERACTIONS
   ============================================================ */

/* Toggle between quick and detailed mode */
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

/* "Why?" reasoning links */
document.addEventListener('click', function (e) {
  var whyBtn = e.target.closest('.js-ai-why');
  if (!whyBtn) return;

  var detail = whyBtn.nextElementSibling;
  if (detail && detail.classList.contains('ai-summary__why-detail')) {
    detail.hidden = !detail.hidden;
    whyBtn.textContent = detail.hidden ? 'Why?' : 'Hide reasoning';
  }
});
```

### 4.3 Mock Data

```js
/* ============================================================
   AI SUMMARY MOCK DATA
   ============================================================ */
const AI_SUMMARY_MOCKS = {
  /* AG-442: Invoice correction in NetSuite */
  'AG-442': {
    gateId: 'AG-442',
    actionSummary:
      'Updates invoice INV-22318 memo and line items in NetSuite, ' +
      'then creates a receipt bundle in Drive for audit evidence.',
    risk: {
      level: 'medium',
      rationale:
        'Invoice amount ($12,500) exceeds the $10,000 policy threshold. ' +
        'Two external systems will be written to. No prior failed attempts.',
      why:
        'Risk scored medium because: (1) write amount is above policy ' +
        'threshold but within 2x the limit; (2) both target systems have ' +
        'healthy connections; (3) idempotency keys are present for retry safety.',
    },
    compliance: [
      {
        status: 'pass',
        policy: 'Invoice write threshold',
        detail: 'Amount > $10,000 requires human approval -- gate is open.',
      },
      {
        status: 'pass',
        policy: 'Segregation of Duties',
        detail: 'Maker-checker constraint satisfied (different approver).',
      },
    ],
    affectedSystems: [
      { system: 'NetSuite', operation: 'write', target: 'Invoice | INV-22318' },
      { system: 'Google Drive', operation: 'write', target: 'Document | Receipt bundle' },
    ],
    reversibility: {
      reversible: true,
      detail:
        'Invoice memo update can be reverted. Line item reclassification ' +
        'can be undone. Drive document creation cannot be automatically ' +
        'deleted (requires manual removal).',
      why:
        'NetSuite invoice fields support PUT overwrite, so the memo and ' +
        'line items can be restored to previous values. Google Drive file ' +
        'creation has no automated delete in the current adapter scope.',
    },
    legalNotes:
      'Invoice modifications above $10,000 are subject to SOX compliance ' +
      'logging. Evidence chain entry will be created automatically upon approval.',
    confidence: {
      score: 92,
      explanation:
        'High confidence. Based on: matching historical approval patterns ' +
        '(14 similar invoices approved), healthy system connections, and ' +
        'complete policy rule coverage.',
    },
    generatedAt: '2026-02-17T10:43:00Z',
  },

  /* AG-443: Zendesk ticket priority update */
  'AG-443': {
    gateId: 'AG-443',
    actionSummary:
      'Changes priority of Zendesk ticket #4831 from Normal to Urgent ' +
      'and adds an internal note explaining the escalation reason.',
    risk: {
      level: 'low',
      rationale:
        'Ticket priority change is a metadata update with no financial ' +
        'impact. Single system write. Operation is fully idempotent.',
      why:
        'Risk scored low because: (1) no monetary value involved; ' +
        '(2) only one external system affected; (3) the Zendesk API ' +
        'supports idempotent PUT for ticket updates.',
    },
    compliance: [
      {
        status: 'pass',
        policy: 'Ticket escalation policy',
        detail: 'Priority changes require human-approve tier for audit trail.',
      },
    ],
    affectedSystems: [{ system: 'Zendesk', operation: 'write', target: 'Ticket | #4831' }],
    reversibility: {
      reversible: true,
      detail:
        'Priority can be changed back to Normal at any time. Internal ' +
        'note can be deleted manually. Full rollback is straightforward.',
    },
    legalNotes: null,
    confidence: {
      score: 97,
      explanation:
        'Very high confidence. Simple metadata update with clear ' +
        'precedent (42 similar ticket updates in the last 30 days).',
    },
    generatedAt: '2026-02-17T10:41:00Z',
  },

  /* AG-444: CRM sync -- Salesforce opportunity update */
  'AG-444': {
    gateId: 'AG-444',
    actionSummary:
      'Syncs updated close date and deal value ($85,000) from HubSpot ' +
      'to Salesforce opportunity OPP-2291, overwriting the current ' +
      'Salesforce values.',
    risk: {
      level: 'high',
      rationale:
        'Cross-system sync overwrites Salesforce data. Deal value change ' +
        'of $85,000 exceeds reporting threshold. Potential downstream ' +
        'impact on pipeline forecasting dashboards.',
      why:
        'Risk scored high because: (1) overwrite operation on a financial ' +
        'record; (2) amount exceeds $50,000 pipeline reporting threshold; ' +
        '(3) Salesforce triggers may fire downstream automations that ' +
        'cannot be easily reversed.',
    },
    compliance: [
      {
        status: 'pass',
        policy: 'CRM sync authorization',
        detail: 'Cross-system writes require human-approve tier.',
      },
      {
        status: 'warn',
        policy: 'Pipeline value threshold',
        detail:
          'Deal value ($85,000) exceeds $50,000 -- finance team ' +
          'notification will be triggered automatically.',
      },
    ],
    affectedSystems: [
      { system: 'Salesforce', operation: 'write', target: 'Opportunity | OPP-2291' },
    ],
    reversibility: {
      reversible: false,
      detail:
        'Salesforce opportunity update triggers workflow rules and ' +
        'possibly Apex triggers. While the field values can be ' +
        'manually restored, downstream automations (email alerts, ' +
        'task creation) cannot be undone.',
      why:
        'Salesforce workflow rules execute immediately on field ' +
        'change. The adapter does not have access to deactivate ' +
        'or reverse those automations.',
    },
    legalNotes:
      'Pipeline changes above $50,000 are reported in the quarterly ' +
      'revenue forecast. CFO notification is automatic.',
    confidence: {
      score: 78,
      explanation:
        'Moderate confidence. The sync logic is well-tested, but ' +
        'downstream Salesforce automations are outside adapter ' +
        'visibility. Manual review recommended.',
    },
    generatedAt: '2026-02-17T10:39:00Z',
  },
};
```

### 4.4 Wiring into main()

```js
/* In main(), after ABToggle.injectToggles(): */
AISummaryToggle.init();
```

---

## 5. Integration Guide

### 5.1 Where to Insert in `index.html`

**Location:** Inside the triage card front face (`.triage-card__front`),
between the effects summary and the policy callout.

Find this block in `index.html` (approximately line 1400):

```html
                  </div>  <!-- end .triage-card__effects-summary -->
                  <div class="callout callout--policy">
```

Insert the AI summary HTML (from Section 2.1) between those two elements:

```html
                  </div>  <!-- end .triage-card__effects-summary -->

                  <!-- AI SUMMARY: injected here -->
                  <div class="ai-summary ai-summary--hidden" data-ai-gate="AG-442">
                    <!-- ... full HTML from Section 2.1 ... -->
                  </div>

                  <div class="callout callout--policy">
```

**Important:** The summary starts with class `ai-summary--hidden` because the
feature flag defaults to off. When the user enables "AI Summary" via the toggle
button, the `ai-summary--hidden` class is removed.

### 5.2 CSS

Append all CSS from Section 3 to the end of `wireframe.css`, after the
existing triage styles.

### 5.3 JavaScript

1. Add `AISummaryToggle` IIFE (Section 4.1) to `wireframe.js`, after
   the `ABToggle` IIFE.
2. Add the click handlers (Section 4.2) anywhere after the triage handlers.
3. Add the mock data object (Section 4.3) at the top of the file with the
   other constants.
4. Add `AISummaryToggle.init()` inside `main()`, after `ABToggle.injectToggles()`.

### 5.4 Rendering Lifecycle

```
main()
  -> AISummaryToggle.init()   // injects toggle button, reads persisted state
  -> render(initial)
       -> ABToggle.applyAll()
       -> AISummaryToggle.apply()  // sync visibility with feature flag

User clicks "AI Summary" toggle
  -> AISummaryToggle.toggle()
       -> saves to sessionStorage
       -> AISummaryToggle.apply()   // shows/hides all .ai-summary blocks
```

### 5.5 Keyboard Shortcut (Optional)

Add to the existing triage keyboard handler:

```js
/* In the triage keyboard handler, add: */
else if (key === 'i') {
  AISummaryToggle.toggle();
}
```

Update the hint text:

```html
<div class="triage__hint subtle">
  Keyboard: A = Approve, D = Deny, R = Request Changes, S = Skip, Space = Toggle details, I = Toggle
  AI summary
</div>
```

---

## 6. Example Summaries

### Example 1: Invoice Correction (Medium Risk)

**Quick view:**

> Updates invoice INV-22318 memo and line items in NetSuite, then creates
> a receipt bundle in Drive for audit evidence.
>
> `Medium risk` `Compliance: pass` `Partially reversible` | Confidence: 92%

**Decision time target:** 3-4 seconds. The approver sees the action is a
routine invoice update, risk is medium (not high), compliance passes, and
it is partially reversible. Approve with confidence.

### Example 2: Zendesk Ticket Escalation (Low Risk)

**Quick view:**

> Changes priority of Zendesk ticket #4831 from Normal to Urgent and
> adds an internal note explaining the escalation reason.
>
> `Low risk` `Compliance: pass` `Fully reversible` | Confidence: 97%

**Decision time target:** 2 seconds. All green. Single system, low risk,
fully reversible. Instant approve.

### Example 3: CRM Sync (High Risk)

**Quick view:**

> Syncs updated close date and deal value ($85,000) from HubSpot to
> Salesforce opportunity OPP-2291, overwriting current Salesforce values.
>
> `High risk` `Compliance: warn` `Not reversible` | Confidence: 78%

**Decision time target:** 5 seconds to decide to expand details. The red
risk badge and compliance warning immediately signal "look deeper." The
approver clicks "Details" to see the full reasoning, reads the
reversibility section, and understands downstream Salesforce automations
are the concern. Informed decision in 15-20 seconds total.

---

## 7. Design Rationale

### 7.1 Why a Fixed Schema?

Approvers process many gates in succession (triage queue). A consistent
schema builds muscle memory: the eye learns where to look for risk, where
to look for compliance, where to look for reversibility. Variable-format
AI prose would require re-parsing each card.

### 7.2 Why Separate from the AB Toggle?

The AI summary is a feature flag, not a layout variant. An approver may
want layout B (triage queue) with AI summaries on, or layout A (table)
without them. Orthogonal toggles give the user full control.

### 7.3 Why the Purple Accent?

The existing design uses semantic colors: green (ok), amber (warn), red
(danger), blue (info). Purple (`#6c5dd3`) is unused in the existing
palette and signals "AI-generated content" without colliding with any
status meaning. This follows the emerging convention in enterprise tools
where purple/violet denotes AI-assisted features.

### 7.4 Confidence Score

The confidence indicator serves two purposes:

1. **Trust calibration:** The approver knows when to trust the summary
   at a glance vs. when to dig deeper.
2. **Liability signal:** A low-confidence summary is an explicit signal
   that the AI is uncertain and human judgment is critical.

### 7.5 "Why?" Links

The "Why?" links provide on-demand transparency without cluttering the
default view. They address the "explainable AI" requirement for
compliance-sensitive workflows. An auditor reviewing the approval decision
later can see not just what the AI said, but why it said it.

---

## 8. Accessibility

- AI summary toggle has `aria-pressed` attribute for screen readers.
- Detail toggle has `aria-expanded` and `aria-controls` for accordion pattern.
- "Why?" links toggle adjacent sibling visibility (standard disclosure pattern).
- All interactive elements have `:focus-visible` outlines.
- Color is never the sole indicator: badges include text labels alongside
  color (e.g., "Medium risk" not just an amber dot).
- The `ai-summary--hidden` class uses `display: none` which correctly
  removes the element from the accessibility tree.

---

## 9. Future Extensions

1. **Server-side generation:** Replace mock data with API calls to an
   AI service that receives the approval gate context and returns the
   schema-conforming summary.
2. **Summary caching:** Cache summaries per gate ID with TTL to avoid
   re-generation on every triage card view.
3. **Feedback loop:** Add thumbs-up/thumbs-down on each summary section
   to train the model on approver preferences.
4. **Batch mode:** In table view (layout A), show a condensed risk badge
   column populated by AI summaries.
5. **Audit export:** Include AI summary data in the evidence chain entry
   when an approval decision is recorded.
