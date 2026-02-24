/* ============================================================
   Cockpit demo API client -- thin wrapper over mock /api routes
   ============================================================ */

(function () {
  async function parseJsonResponse(response) {
    const payload = await response.json();
    if (!response.ok) {
      const detail =
        typeof payload?.detail === 'string'
          ? payload.detail
          : response.statusText || 'Request failed';
      throw new Error(detail);
    }
    return payload;
  }

  async function list(resource) {
    const response = await fetch('/api/' + resource);
    const payload = await parseJsonResponse(response);
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  async function bootstrap() {
    if (window.PortariumDemoMock?.ensureReady) {
      await window.PortariumDemoMock.ensureReady();
    }

    const [connectors, workItems, runs, approvals, evidence] = await Promise.all([
      list('connectors'),
      list('work-items'),
      list('runs'),
      list('approvals'),
      list('evidence'),
    ]);

    const meta = window.PortariumDemoMock?.getState?.().meta ?? {
      workspaceId: 'ws_demo',
      generatedAt: new Date().toISOString(),
      scenario: 'demo',
    };

    return {
      meta,
      connectors,
      workItems,
      runs,
      approvals,
      evidence,
    };
  }

  async function submitApprovalDecision(approvalId, body) {
    const response = await fetch('/api/approvals/' + encodeURIComponent(approvalId) + '/decision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await parseJsonResponse(response);
    const snapshot = await bootstrap();
    return { result, snapshot };
  }

  async function resetDemoState() {
    const response = await fetch('/api/demo/reset', { method: 'POST' });
    await parseJsonResponse(response);
    return bootstrap();
  }

  window.PortariumDemoApi = {
    bootstrap,
    submitApprovalDecision,
    resetDemoState,
  };
})();
