/* ============================================================
   Cockpit demo mock API -- fetch interception for /api/* routes
   ============================================================ */

(function () {
  const FIXTURE_PATH = './fixtures/demo.json';
  const STATE_STORAGE_KEY = 'portarium_cockpit_demo_state_v1';
  const LATENCY_MS = 140;
  const JSON_HEADERS = { 'content-type': 'application/json' };

  const FALLBACK_FIXTURE = {
    meta: {
      workspaceId: 'ws_demo',
      generatedAt: '2026-02-20T09:10:00Z',
      scenario: 'invoice_remediation',
    },
    connectors: [],
    workItems: [],
    runs: [],
    approvals: [],
    evidence: [],
  };

  const nativeFetch = window.fetch.bind(window);

  let seedState = null;
  let runtimeState = null;
  let readyPromise = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function readPersistedState() {
    try {
      const raw = localStorage.getItem(STATE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function persistState() {
    if (!runtimeState) return;
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(runtimeState));
  }

  function normalizeFixtureData(source) {
    return {
      meta: source?.meta ?? FALLBACK_FIXTURE.meta,
      connectors: Array.isArray(source?.connectors) ? source.connectors : [],
      workItems: Array.isArray(source?.workItems) ? source.workItems : [],
      runs: Array.isArray(source?.runs) ? source.runs : [],
      approvals: Array.isArray(source?.approvals) ? source.approvals : [],
      evidence: Array.isArray(source?.evidence) ? source.evidence : [],
    };
  }

  async function loadFixtureData() {
    try {
      const response = await nativeFetch(FIXTURE_PATH, { cache: 'no-store' });
      if (!response.ok) {
        return normalizeFixtureData(FALLBACK_FIXTURE);
      }
      const parsed = await response.json();
      return normalizeFixtureData(parsed);
    } catch {
      return normalizeFixtureData(FALLBACK_FIXTURE);
    }
  }

  async function ensureReady() {
    if (!readyPromise) {
      readyPromise = (async () => {
        const fixtureData = await loadFixtureData();
        seedState = clone(fixtureData);
        const persisted = readPersistedState();
        runtimeState = persisted ? normalizeFixtureData(persisted) : clone(seedState);
        persistState();
      })();
    }
    await readyPromise;
  }

  function resetState() {
    runtimeState = clone(seedState ?? FALLBACK_FIXTURE);
    persistState();
    return clone(runtimeState);
  }

  function findById(collection, id) {
    return collection.find((item) => item.id === id);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeDecision(decision) {
    const value = String(decision ?? '')
      .trim()
      .toLowerCase();
    if (value === 'approve') return 'approve';
    if (value === 'deny') return 'deny';
    if (value === 'request changes') return 'request_changes';
    if (value === 'request_changes') return 'request_changes';
    return '';
  }

  function labelForDecision(decision) {
    if (decision === 'approve') return 'approved';
    if (decision === 'deny') return 'denied';
    if (decision === 'request_changes') return 'changes_requested';
    return 'unknown';
  }

  function updateLinkedEntitiesAfterDecision(approval, decision, actor, rationale) {
    const timestamp = nowIso();
    approval.status = 'decided';
    approval.decision = decision;
    approval.rationale = rationale;
    approval.decidedBy = actor;
    approval.decidedAt = timestamp;

    const run = findById(runtimeState.runs, approval.runId);
    if (run) {
      run.status = decision === 'approve' ? 'approved' : 'rejected';
    }

    const workItem = findById(runtimeState.workItems, approval.workItemId);
    if (workItem) {
      workItem.status = decision === 'approve' ? 'approved' : 'rejected';
      workItem.updatedAt = timestamp;
    }

    const previousHash =
      runtimeState.evidence.length > 0
        ? runtimeState.evidence[runtimeState.evidence.length - 1].hash
        : 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
    const proofSuffix = Math.floor(Date.now() % 1000000)
      .toString(16)
      .padStart(6, '0');
    const evidenceEntry = {
      id: 'ev_decision_' + Date.now().toString(36),
      type: 'approval_decided',
      message: 'Approval decision submitted (' + labelForDecision(decision).replace('_', ' ') + ')',
      workItemId: approval.workItemId,
      runId: approval.runId,
      approvalId: approval.id,
      correlationId: run?.correlationId ?? workItem?.correlationId ?? 'cor_demo',
      actor,
      occurredAt: timestamp,
      previousHash,
      hash: 'sha256:' + proofSuffix + proofSuffix,
    };

    runtimeState.evidence.push(evidenceEntry);
    return {
      approval,
      run,
      workItem,
      evidenceEntry,
    };
  }

  function listWorkItems(searchParams) {
    const statusFilter = searchParams.get('status');
    const items = runtimeState.workItems
      .filter((item) => {
        if (!statusFilter) return true;
        return String(item.status).toLowerCase() === statusFilter.toLowerCase();
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return { items };
  }

  function listRuns(searchParams) {
    const statusFilter = searchParams.get('status');
    const items = runtimeState.runs
      .filter((run) => {
        if (!statusFilter) return true;
        return String(run.status).toLowerCase() === statusFilter.toLowerCase();
      })
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return { items };
  }

  function listApprovals(searchParams) {
    const statusFilter = searchParams.get('status');
    const items = runtimeState.approvals
      .filter((approval) => {
        if (!statusFilter) return true;
        return String(approval.status).toLowerCase() === statusFilter.toLowerCase();
      })
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    return { items };
  }

  function listEvidence(searchParams) {
    const correlationFilter = searchParams.get('correlationId');
    const runFilter = searchParams.get('runId');
    const items = runtimeState.evidence
      .filter((entry) => {
        if (correlationFilter && entry.correlationId !== correlationFilter) return false;
        if (runFilter && entry.runId !== runFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    return { items };
  }

  function jsonResponse(payload, status) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: JSON_HEADERS,
    });
  }

  function problem(status, title, detail) {
    return {
      type: 'about:blank',
      title,
      status,
      detail,
      instance: '/api/mock',
    };
  }

  async function handleApiRequest(url, init) {
    await ensureReady();
    const method = String(init?.method ?? 'GET').toUpperCase();
    const segments = url.pathname.split('/').filter(Boolean);
    const resource = segments[1] ?? '';

    if (resource === 'demo' && method === 'POST' && segments[2] === 'reset') {
      const state = resetState();
      return jsonResponse({ ok: true, meta: state.meta }, 200);
    }

    if (resource === 'connectors' && method === 'GET') {
      return jsonResponse({ items: runtimeState.connectors }, 200);
    }

    if (resource === 'work-items' && method === 'GET' && segments.length === 2) {
      return jsonResponse(listWorkItems(url.searchParams), 200);
    }

    if (resource === 'work-items' && method === 'GET' && segments.length === 3) {
      const item = findById(runtimeState.workItems, segments[2]);
      if (!item) {
        return jsonResponse(problem(404, 'Work Item not found', 'Unknown work item id.'), 404);
      }
      return jsonResponse(item, 200);
    }

    if (resource === 'runs' && method === 'GET' && segments.length === 2) {
      return jsonResponse(listRuns(url.searchParams), 200);
    }

    if (resource === 'runs' && method === 'GET' && segments.length === 3) {
      const run = findById(runtimeState.runs, segments[2]);
      if (!run) {
        return jsonResponse(problem(404, 'Run not found', 'Unknown run id.'), 404);
      }
      return jsonResponse(run, 200);
    }

    if (resource === 'approvals' && method === 'GET' && segments.length === 2) {
      return jsonResponse(listApprovals(url.searchParams), 200);
    }

    if (
      resource === 'approvals' &&
      method === 'POST' &&
      segments.length === 4 &&
      segments[3] === 'decision'
    ) {
      let payload = {};
      try {
        payload = init?.body ? JSON.parse(String(init.body)) : {};
      } catch {
        return jsonResponse(problem(400, 'Invalid JSON', 'Request body must be valid JSON.'), 400);
      }

      const approval = findById(runtimeState.approvals, segments[2]);
      if (!approval) {
        return jsonResponse(problem(404, 'Approval not found', 'Unknown approval id.'), 404);
      }

      if (approval.status !== 'pending') {
        return jsonResponse(
          problem(409, 'Approval already decided', 'Only pending approvals can be decided.'),
          409,
        );
      }

      const decision = normalizeDecision(payload.decision);
      if (!decision) {
        return jsonResponse(
          problem(400, 'Invalid decision', 'Decision must be approve, deny, or request changes.'),
          400,
        );
      }

      const rationale = String(payload.rationale ?? '').trim();
      const requiresRationale = decision === 'deny' || decision === 'request_changes';
      if (requiresRationale && rationale.length < 10) {
        return jsonResponse(
          problem(
            400,
            'Rationale required',
            'Provide at least 10 characters for deny or request changes.',
          ),
          400,
        );
      }

      const actor = String(payload.actor ?? 'Approver User').trim() || 'Approver User';
      const updated = updateLinkedEntitiesAfterDecision(approval, decision, actor, rationale);
      persistState();
      return jsonResponse(updated, 200);
    }

    if (resource === 'evidence' && method === 'GET') {
      return jsonResponse(listEvidence(url.searchParams), 200);
    }

    return jsonResponse(problem(404, 'Not found', 'No mock route matches ' + url.pathname), 404);
  }

  window.fetch = async function mockFetch(input, init) {
    const requestInit = init ?? {};
    const requestUrl = new URL(
      typeof input === 'string' ? input : input.url,
      window.location.origin,
    );
    if (!requestUrl.pathname.startsWith('/api/')) {
      return nativeFetch(input, init);
    }

    await sleep(LATENCY_MS);
    return handleApiRequest(requestUrl, requestInit);
  };

  window.PortariumDemoMock = {
    ensureReady,
    reset: resetState,
    getState: function getState() {
      return clone(runtimeState ?? FALLBACK_FIXTURE);
    },
  };
})();
