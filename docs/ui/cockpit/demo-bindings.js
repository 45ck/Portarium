/* ============================================================
   Cockpit demo bindings -- hydrate high-fidelity UI from mock API
   ============================================================ */

(function () {
  const api = window.PortariumDemoApi;
  if (!api) return;

  let latestSnapshot = null;

  const RUN_STATUS_META = {
    waiting_for_approval: { label: 'Waiting for approval', tone: 'warn', icon: '⏸' },
    running: { label: 'Running', tone: 'info', icon: '↻' },
    approved: { label: 'Approved', tone: 'ok', icon: '✓' },
    rejected: { label: 'Rejected', tone: 'danger', icon: '✕' },
    failed: { label: 'Failed', tone: 'danger', icon: '✕' },
    succeeded: { label: 'Succeeded', tone: 'ok', icon: '✓' },
    cancelled: { label: 'Cancelled', tone: 'muted', icon: '⊘' },
  };

  const WORK_ITEM_STATUS_LABEL = {
    pending_approval: 'Open',
    approved: 'Approved',
    rejected: 'Rejected',
    running: 'Open',
    closed: 'Closed',
  };

  function text(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  function htmlEscape(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function applyStatus(element, status) {
    if (!element) return;
    const meta = RUN_STATUS_META[status] ?? { label: status, tone: 'muted', icon: '•' };
    element.className = 'status status--' + meta.tone;
    element.innerHTML = '<span class="status__icon">' + meta.icon + '</span>' + meta.label;
  }

  function formatRelativeTime(isoString) {
    const timestamp = new Date(isoString).getTime();
    if (Number.isNaN(timestamp)) return '--';
    const deltaMs = Date.now() - timestamp;
    const absMs = Math.abs(deltaMs);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (absMs < hour) {
      const mins = Math.max(1, Math.round(absMs / minute));
      return mins + 'm';
    }
    if (absMs < day) {
      const hours = Math.max(1, Math.round(absMs / hour));
      return hours + 'h';
    }
    const days = Math.max(1, Math.round(absMs / day));
    return days + 'd';
  }

  function formatRelativePhrase(isoString) {
    const compact = formatRelativeTime(isoString);
    if (compact === '--') return '--';
    if (compact.endsWith('m')) return compact.slice(0, -1) + ' minutes ago';
    if (compact.endsWith('h')) return compact.slice(0, -1) + ' hours ago';
    if (compact.endsWith('d')) return compact.slice(0, -1) + ' days ago';
    return compact;
  }

  function formatSla(dueAtIso) {
    const dueAt = new Date(dueAtIso).getTime();
    if (Number.isNaN(dueAt)) {
      return { text: '--', tone: '' };
    }
    const deltaMs = dueAt - Date.now();
    const hours = Math.floor(Math.abs(deltaMs) / (60 * 60 * 1000));
    const minutes = Math.floor((Math.abs(deltaMs) % (60 * 60 * 1000)) / (60 * 1000));
    if (deltaMs < 0) {
      return {
        text: 'Overdue ' + hours + 'h ' + minutes + 'm',
        tone: 'sla-badge sla-badge--danger',
      };
    }
    return {
      text: 'Due ' + hours + 'h ' + minutes + 'm',
      tone: 'sla-badge sla-badge--warn',
    };
  }

  function findPrimaryWorkItem(snapshot) {
    const pendingApproval = snapshot.approvals.find(function (approval) {
      return approval.status === 'pending';
    });
    if (pendingApproval) {
      const fromPending = snapshot.workItems.find(function (item) {
        return item.id === pendingApproval.workItemId;
      });
      if (fromPending) return fromPending;
    }

    const waitingRun = snapshot.runs.find(function (run) {
      return run.status === 'waiting_for_approval';
    });
    if (waitingRun) {
      const fromRun = snapshot.workItems.find(function (item) {
        return item.id === waitingRun.workItemId;
      });
      if (fromRun) return fromRun;
    }

    return snapshot.workItems[0];
  }

  function findPrimaryRun(snapshot, workItem) {
    if (!workItem) return snapshot.runs[0];
    const linked = snapshot.runs.find(function (run) {
      return run.workItemId === workItem.id;
    });
    return linked ?? snapshot.runs[0];
  }

  function findPrimaryApproval(snapshot, run) {
    if (!run) return snapshot.approvals[0];
    const pending = snapshot.approvals.find(function (approval) {
      return approval.runId === run.id && approval.status === 'pending';
    });
    if (pending) return pending;
    return (
      snapshot.approvals.find(function (approval) {
        return approval.runId === run.id;
      }) ?? snapshot.approvals[0]
    );
  }

  function renderWorkItem(primaryWorkItem, primaryRun) {
    if (!primaryWorkItem) return;

    text('demoWorkItemTitle', primaryWorkItem.code + ' ' + primaryWorkItem.title);
    text(
      'demoWorkItemStatus',
      WORK_ITEM_STATUS_LABEL[primaryWorkItem.status] ?? primaryWorkItem.status,
    );
    text('demoWorkItemUpdated', formatRelativeTime(primaryWorkItem.updatedAt));

    const slaBadge = document.getElementById('demoWorkItemSla');
    if (slaBadge) {
      const sla = formatSla(primaryWorkItem.slaDueAt);
      slaBadge.className = sla.tone || 'sla-badge';
      slaBadge.textContent = sla.text;
    }

    applyStatus(document.getElementById('demoWorkItemRunStatus'), primaryRun?.status || 'running');

    text('demoKanbanBlockedTitle', primaryWorkItem.code + ' ' + primaryWorkItem.title);
    const kanbanStatus = document.getElementById('demoKanbanBlockedStatus');
    if (kanbanStatus) {
      kanbanStatus.textContent =
        primaryRun?.status === 'waiting_for_approval'
          ? 'Awaiting approval'
          : (RUN_STATUS_META[primaryRun?.status || 'running']?.label ?? 'Updated');
      kanbanStatus.className =
        'status ' +
        (primaryRun?.status === 'rejected'
          ? 'status--danger'
          : primaryRun?.status === 'approved' || primaryRun?.status === 'succeeded'
            ? 'status--ok'
            : 'status--warn');
    }
  }

  function renderRunList(snapshot, primaryWorkItem, primaryRun) {
    if (!primaryRun) return;

    text('demoRunListId', primaryRun.code);
    text('demoRunListWorkflow', primaryRun.workflowName);
    text('demoRunListWorkItem', primaryWorkItem?.code ?? '--');
    text('demoRunListInitiator', primaryRun.initiator);
    text('demoRunListStarted', formatRelativePhrase(primaryRun.startedAt));

    const pendingApprovals = snapshot.approvals.filter(function (approval) {
      return approval.status === 'pending' && approval.runId === primaryRun.id;
    }).length;
    text('demoRunListApprovals', pendingApprovals + ' pending');
    applyStatus(document.getElementById('demoRunListStatus'), primaryRun.status);

    text('demoRunsPagination', 'Page 1 of 1 · ' + snapshot.runs.length + ' runs');
  }

  function renderRunDetail(snapshot, primaryRun) {
    if (!primaryRun) return;

    const runLabel = RUN_STATUS_META[primaryRun.status]?.label ?? primaryRun.status;
    text('demoRunHeadingText', 'Run ' + primaryRun.code + ' (' + runLabel + ')');
    text('demoRunCorrelation', 'Correlation: ' + (primaryRun.correlationId ?? 'cor_demo'));

    const stepperText =
      primaryRun.status === 'approved'
        ? 'Approved'
        : primaryRun.status === 'rejected'
          ? 'Rejected'
          : runLabel;
    text('demoRunStepperActive', stepperText);
    applyStatus(document.getElementById('demoRunStepGateStatus'), primaryRun.status);

    const pendingCount = snapshot.approvals.filter(function (approval) {
      return approval.status === 'pending' && approval.runId === primaryRun.id;
    }).length;

    const outcomeText =
      primaryRun.status === 'approved'
        ? 'Decision captured. Run is approved and ready for downstream execution.'
        : primaryRun.status === 'rejected'
          ? 'Decision captured. Run is rejected and requires remediation before retry.'
          : 'Run remains waiting for approval. ' + pendingCount + ' more approver(s) needed.';
    text('demoRunOutcomePreview', outcomeText);

    const runEvidenceCount = snapshot.evidence.filter(function (entry) {
      return entry.runId === primaryRun.id;
    }).length;
    text('demoRunEvidenceSummary', 'Evidence (' + runEvidenceCount + ' entries)');
  }

  function renderApprovals(snapshot, primaryApproval, primaryWorkItem, primaryRun) {
    const pendingCount = snapshot.approvals.filter(function (approval) {
      return approval.status === 'pending';
    }).length;
    text(
      'demoApprovalsHeroText',
      'You have ' + pendingCount + ' approvals waiting for your decision. Review each and decide.',
    );
    text('demoApprovalsPagination', 'Page 1 of 1 · ' + pendingCount + ' pending');

    if (!primaryApproval) return;

    text('demoApprovalTitle', primaryApproval.title);
    text('demoApprovalWorkItem', primaryWorkItem?.code ?? '--');
    text('demoApprovalRun', primaryRun?.code ?? '--');
    text('demoApprovalRule', primaryApproval.rule || 'Manual review');
    text('demoApprovalAssignee', primaryApproval.assignee || 'Unassigned');
    text('demoApprovalRequested', formatRelativeTime(primaryApproval.requestedAt));

    const slaBadge = document.getElementById('demoApprovalSla');
    if (slaBadge) {
      const sla = formatSla(primaryApproval.slaDueAt);
      slaBadge.className = sla.tone || 'sla-badge';
      slaBadge.textContent = sla.text;
    }

    const triageCard = document.getElementById('triageCard');
    if (triageCard) {
      const idEl = triageCard.querySelector('.triage-card__id');
      const titleEl = triageCard.querySelector('.triage-card__title');
      const metaItems = triageCard.querySelectorAll('.triage-card__meta-item span:last-child');
      if (idEl) idEl.textContent = primaryApproval.code;
      if (titleEl) titleEl.textContent = primaryApproval.title;
      if (metaItems[0]) {
        metaItems[0].textContent =
          (primaryWorkItem?.code ?? '--') + ' ' + (primaryWorkItem?.title ?? '');
      }
      if (metaItems[1]) {
        metaItems[1].textContent =
          (primaryRun?.code ?? '--') +
          ' (' +
          (RUN_STATUS_META[primaryRun?.status]?.label ?? 'pending') +
          ')';
      }
      if (metaItems[2]) {
        metaItems[2].textContent = primaryApproval.requestedBy || '--';
      }
      if (metaItems[3]) {
        metaItems[3].textContent = formatRelativePhrase(primaryApproval.requestedAt);
      }
    }
  }

  function renderEvidence(snapshot, primaryRun) {
    const chainTitle = document.getElementById('demoChainIntegrityTitle');
    if (chainTitle) {
      chainTitle.textContent =
        '✓ Chain Integrity: All ' + snapshot.evidence.length + ' entries verified';
    }

    const chainMeta = document.getElementById('demoChainIntegrityMeta');
    if (chainMeta) {
      const latest = snapshot.evidence[0];
      const latestTime = latest ? formatRelativePhrase(latest.occurredAt) : '--';
      chainMeta.textContent =
        'Entries loaded: ' +
        snapshot.evidence.length +
        ' · SHA-256 hash chain · Last verified: ' +
        latestTime;
    }

    const evidenceList = document.getElementById('demoEvidenceList');
    if (!evidenceList) return;

    const entries = snapshot.evidence.slice(0, 5);
    evidenceList.innerHTML = entries
      .map(function (entry) {
        const runCode =
          snapshot.runs.find(function (run) {
            return run.id === entry.runId;
          })?.code ?? '--';
        const statusTone = entry.type === 'approval_decided' ? 'status--ok' : 'status--info';
        return (
          '<div class="row row--static">' +
          '<div class="row__main">' +
          '<div class="row__title">' +
          htmlEscape(entry.message) +
          '</div>' +
          '<div class="row__subtle">Category: ' +
          htmlEscape(entry.type) +
          ' | Actor: ' +
          htmlEscape(entry.actor) +
          ' | Run: ' +
          htmlEscape(runCode) +
          ' | ' +
          htmlEscape(formatRelativePhrase(entry.occurredAt)) +
          '</div>' +
          '<div style="font-size: 10px; margin-top: 4px">' +
          '<code>' +
          htmlEscape(entry.hash) +
          '</code> · Prev: <code>' +
          htmlEscape(entry.previousHash) +
          '</code>' +
          '</div>' +
          '</div>' +
          '<div class="row__right"><span class="status ' +
          statusTone +
          '"><span class="status__icon">✓</span>Verified</span></div>' +
          '</div>'
        );
      })
      .join('');

    if (primaryRun) {
      const runEvidenceCount = snapshot.evidence.filter(function (entry) {
        return entry.runId === primaryRun.id;
      }).length;
      text('demoRunEvidenceSummary', 'Evidence (' + runEvidenceCount + ' entries)');
    }
  }

  function renderStatusBar(snapshot) {
    const pendingApprovals = snapshot.approvals.filter(function (approval) {
      return approval.status === 'pending';
    }).length;
    const activeRuns = snapshot.runs.filter(function (run) {
      return run.status === 'running' || run.status === 'waiting_for_approval';
    }).length;
    text('demoRunListApprovals', pendingApprovals + ' pending');
    text('demoApprovalsPagination', 'Page 1 of 1 · ' + pendingApprovals + ' pending');
    text('demoRunsPagination', 'Page 1 of 1 · ' + snapshot.runs.length + ' runs');

    const runsText = document.querySelector('.js-status-runs-text');
    if (runsText) {
      runsText.textContent = 'Runs: ' + activeRuns + ' active';
    }

    const chainText = document.querySelector('.js-status-chain-text');
    if (chainText) {
      chainText.textContent = 'Audit log: OK (' + snapshot.evidence.length + ' entries)';
    }
  }

  function showToast(message) {
    const toast = document.querySelector('.js-kbd-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.setTimeout(function () {
      toast.hidden = true;
    }, 2200);
  }

  function getCurrentApproval() {
    if (!latestSnapshot) return null;
    const run = findPrimaryRun(latestSnapshot, findPrimaryWorkItem(latestSnapshot));
    return findPrimaryApproval(latestSnapshot, run);
  }

  async function hydrate() {
    const snapshot = await api.bootstrap();
    latestSnapshot = snapshot;

    const primaryWorkItem = findPrimaryWorkItem(snapshot);
    const primaryRun = findPrimaryRun(snapshot, primaryWorkItem);
    const primaryApproval = findPrimaryApproval(snapshot, primaryRun);

    renderWorkItem(primaryWorkItem, primaryRun);
    renderRunList(snapshot, primaryWorkItem, primaryRun);
    renderRunDetail(snapshot, primaryRun);
    renderApprovals(snapshot, primaryApproval, primaryWorkItem, primaryRun);
    renderEvidence(snapshot, primaryRun);
    renderStatusBar(snapshot);
  }

  async function handleSubmitDecision(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const approval = getCurrentApproval();
    if (!approval) {
      showToast('No pending approval was found.');
      return;
    }
    if (approval.status !== 'pending') {
      showToast('Primary approval is already decided. Reset demo state to replay.');
      return;
    }

    const decisionEl = document.getElementById('approvalDecision');
    const rationaleEl = document.getElementById('approvalRationale');
    const submitButton = document.getElementById('submitDecision');
    if (!decisionEl || !rationaleEl || !submitButton) return;

    const selectedDecision = decisionEl.value;
    if (!selectedDecision) {
      text('demoRunOutcomePreview', 'Select a decision before submitting.');
      return;
    }

    const decision =
      selectedDecision === 'Approve'
        ? 'approve'
        : selectedDecision === 'Deny'
          ? 'deny'
          : 'request_changes';

    const rationale = rationaleEl.value.trim();
    if ((decision === 'deny' || decision === 'request_changes') && rationale.length < 10) {
      text('demoRunOutcomePreview', 'Provide at least 10 characters of rationale.');
      return;
    }

    const previousText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    try {
      await api.submitApprovalDecision(approval.id, {
        decision,
        rationale,
        actor: 'Approver User',
      });

      decisionEl.value = '';
      rationaleEl.value = '';
      decisionEl.dispatchEvent(new Event('change', { bubbles: true }));
      rationaleEl.dispatchEvent(new Event('input', { bubbles: true }));

      await hydrate();
      showToast('Decision submitted. Audit evidence updated.');
    } catch (error) {
      text('demoRunOutcomePreview', String(error?.message || error));
    } finally {
      submitButton.textContent = previousText;
      submitButton.disabled = false;
    }
  }

  function installDemoControls() {
    const hints = document.querySelector('.js-kbd-hint');
    if (!hints || document.getElementById('demoResetButton')) return;

    const separator = document.createElement('span');
    separator.className = 'statusbar__sep';
    separator.innerHTML = '&middot;';

    const badge = document.createElement('span');
    badge.className = 'chip';
    badge.textContent = 'Demo data';

    const resetButton = document.createElement('button');
    resetButton.id = 'demoResetButton';
    resetButton.className = 'statusbar__hint-btn';
    resetButton.type = 'button';
    resetButton.textContent = 'Reset demo state';

    resetButton.addEventListener('click', async function () {
      resetButton.disabled = true;
      try {
        await api.resetDemoState();
        await hydrate();
        showToast('Demo state reset.');
      } catch (error) {
        showToast('Reset failed: ' + String(error?.message || error));
      } finally {
        resetButton.disabled = false;
      }
    });

    hints.appendChild(separator);
    hints.appendChild(badge);
    hints.appendChild(resetButton);
  }

  function bindEvents() {
    const submitButton = document.getElementById('submitDecision');
    if (submitButton && submitButton.dataset.demoBound !== '1') {
      submitButton.dataset.demoBound = '1';
      submitButton.removeAttribute('data-confirm');
      submitButton.addEventListener('click', handleSubmitDecision);
    }

    window.addEventListener('hashchange', function () {
      window.setTimeout(function () {
        void hydrate();
      }, 0);
    });

    ['persona', 'workspaceType', 'systemState'].forEach(function (id) {
      const select = document.getElementById(id);
      if (!select) return;
      select.addEventListener('change', function () {
        window.setTimeout(function () {
          void hydrate();
        }, 0);
      });
    });
  }

  async function init() {
    installDemoControls();
    bindEvents();
    await hydrate();
  }

  void init();
})();
