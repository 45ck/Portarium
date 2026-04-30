import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiBaseUrl = process.env['PORTARIUM_LIVE_STACK_API_BASE_URL'] ?? 'http://localhost:8080';
const workspaceId = process.env['PORTARIUM_LIVE_STACK_WORKSPACE_ID'] ?? 'ws-local-dev';
const devToken = process.env['PORTARIUM_DEV_TOKEN'] ?? 'portarium-dev-token';
const approvalId = 'apr-live-001';
const runId = 'run-live-001';
const runningRunId = 'run-live-002';
const workItemId = 'wi-live-001';
const decisionRationale = 'Live-stack smoke approval persisted through the Cockpit UI.';

interface PageResponse<T> {
  items: T[];
}

interface ApprovalApiView {
  approvalId: string;
  status: string;
  rationale?: string;
}

interface EvidenceApiView {
  evidenceId: string;
  category: string;
  summary: string;
  links?: {
    approvalId?: string;
    runId?: string;
    workItemId?: string;
  };
}

interface RunApiView {
  runId: string;
  status: string;
}

interface WorkItemApiView {
  workItemId: string;
  title: string;
}

function authHeaders(): Record<string, string> {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${devToken}`,
  };
}

async function apiGet<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(`${apiBaseUrl}${path}`, { headers: authHeaders() });
  expect(response.ok(), `${path} returned ${response.status()}`).toBe(true);
  return (await response.json()) as T;
}

async function createDevSession(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${apiBaseUrl}/auth/dev-session`, {
    headers: {
      Accept: 'application/json',
      'X-Portarium-Request': '1',
    },
  });
  expect(response.ok(), `dev session returned ${response.status()}`).toBe(true);
}

function installRuntimeErrorGuard(page: Page): string[] {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      failures.push(`console.error: ${message.text()}`);
    }
  });
  return failures;
}

test.describe('Cockpit live-stack smoke', () => {
  test('loads seeded live data and persists an approval decision with MSW disabled', async ({
    context,
    page,
  }, testInfo) => {
    const runtimeFailures = installRuntimeErrorGuard(page);
    await createDevSession(context.request);

    const runsBefore = await apiGet<PageResponse<RunApiView>>(
      context.request,
      `/v1/workspaces/${workspaceId}/runs`,
    );
    expect(runsBefore.items.map((run) => run.runId)).toEqual(
      expect.arrayContaining([runId, runningRunId]),
    );

    const approvalBefore = await apiGet<ApprovalApiView>(
      context.request,
      `/v1/workspaces/${workspaceId}/approvals/${approvalId}`,
    );
    expect(approvalBefore.status).toBe('Pending');

    const workItem = await apiGet<WorkItemApiView>(
      context.request,
      `/v1/workspaces/${workspaceId}/work-items/${workItemId}`,
    );
    expect(workItem.title).toContain('Approve invoice hold');

    const runEvidenceBefore = await apiGet<PageResponse<EvidenceApiView>>(
      context.request,
      `/v1/workspaces/${workspaceId}/runs/${runId}/evidence`,
    );
    expect(runEvidenceBefore.items.map((entry) => entry.evidenceId)).toEqual(
      expect.arrayContaining(['ev-live-001', 'ev-live-002']),
    );

    await page.goto('/runs');
    await expect(page.getByRole('heading', { name: 'Runs' })).toBeVisible();
    await expect(page.getByText(runId, { exact: false })).toBeVisible();
    await expect(page.getByText(runningRunId, { exact: false })).toBeVisible();

    await page.goto(`/runs/${runId}`);
    await expect(page.getByRole('heading', { name: `Run: ${runId}` })).toBeVisible();
    await page.getByRole('tab', { name: 'Evidence' }).click();
    await expect(page.getByText('Plan created for invoice hold remediation.')).toBeVisible();
    await expect(page.getByText('Approval requested for the invoice write action.')).toBeVisible();

    await page.goto('/work-items');
    await expect(page.getByRole('heading', { name: 'Work Items' })).toBeVisible();
    await expect(page.getByText(workItemId, { exact: false })).toBeVisible();
    await expect(page.getByText('Approve invoice hold before finance write')).toBeVisible();

    await page.goto(`/work-items/${workItemId}`);
    await expect(page.getByRole('heading', { name: workItem.title })).toBeVisible();
    await expect(page.getByText('Evidence Timeline')).toBeVisible();

    const decisionResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/approvals/${approvalId}/decide`) &&
        response.request().method() === 'POST',
      { timeout: 20_000 },
    );

    await page.goto(`/approvals?focus=${approvalId}&from=notification`);
    await expect(page.getByRole('heading', { name: 'Approval Review' })).toBeVisible();
    await expect(page.getByText(approvalId, { exact: false })).toBeVisible();
    await page
      .getByRole('textbox', { name: new RegExp(`Decision rationale for approval ${approvalId}`) })
      .fill(decisionRationale);
    await page.getByTitle('Approve (A)').click();

    const response = await decisionResponse;
    expect(response.status()).toBe(200);

    const approvalAfter = await apiGet<ApprovalApiView>(
      context.request,
      `/v1/workspaces/${workspaceId}/approvals/${approvalId}`,
    );
    expect(approvalAfter.status).toBe('Approved');
    expect(approvalAfter.rationale).toBe(decisionRationale);

    const approvalEvidence = await apiGet<PageResponse<EvidenceApiView>>(
      context.request,
      `/v1/workspaces/${workspaceId}/evidence?category=Approval&limit=50`,
    );
    expect(
      approvalEvidence.items.some(
        (entry) =>
          entry.links?.approvalId === approvalId && entry.summary.includes('decided: Approved'),
      ),
    ).toBe(true);

    await page.goto(`/approvals?focus=${approvalId}&from=notification`);
    await expect(page.getByText('Approval already decided')).toBeVisible();

    await testInfo.attach('live-stack-api-after-decision.json', {
      body: JSON.stringify({ approvalAfter, approvalEvidence }, null, 2),
      contentType: 'application/json',
    });

    expect(runtimeFailures, runtimeFailures.join('\n')).toEqual([]);
  });
});
