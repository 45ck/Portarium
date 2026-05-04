import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';

const apiBaseUrl = process.env['PORTARIUM_LIVE_STACK_API_BASE_URL'] ?? 'http://localhost:8080';
const workspaceId = process.env['PORTARIUM_LIVE_STACK_WORKSPACE_ID'] ?? 'ws-local-dev';
const devToken = process.env['PORTARIUM_DEV_TOKEN'] ?? 'portarium-dev-token';
const approvalId = 'apr-live-001';
const runId = 'run-live-001';
const runningRunId = 'run-live-002';
const workItemId = 'wi-live-001';
const decisionRationalePrefix = 'Live-stack smoke approval persisted through the Cockpit UI.';
const resumeRationale = 'Live-stack smoke resumed the waiting run after operator review.';

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
  controlState?: string;
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
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await request.get(`${apiBaseUrl}${path}`, { headers: authHeaders() });
      if (!response.ok() && response.status() >= 500 && attempt < 3) {
        await delay(250 * attempt);
        continue;
      }

      expect(response.ok(), `${path} returned ${response.status()}`).toBe(true);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      await delay(250 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function resetBrowserStorage(context: BrowserContext, page: Page): Promise<void> {
  await context.setOffline(false);
  await context.clearCookies();
  await context.addInitScript(() => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // Some transient browser documents, such as about:blank, deny storage access.
    }
  });
  await page.goto('/');
  await page.evaluate(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    if ('caches' in window) {
      await Promise.all((await window.caches.keys()).map((key) => window.caches.delete(key)));
    }

    if ('serviceWorker' in navigator) {
      await Promise.all(
        (await navigator.serviceWorker.getRegistrations()).map((registration) =>
          registration.unregister(),
        ),
      );
    }

    if ('indexedDB' in window) {
      const indexedDbWithEnumeration = window.indexedDB as IDBFactory & {
        databases?: () => Promise<Array<{ name?: string }>>;
      };
      const databases = indexedDbWithEnumeration.databases
        ? await indexedDbWithEnumeration.databases()
        : [{ name: 'portarium-cockpit-offline' }];
      await Promise.all(
        databases
          .map((database) => database.name)
          .filter((name): name is string => Boolean(name))
          .map(
            (name) =>
              new Promise<void>((resolve) => {
                const request = window.indexedDB.deleteDatabase(name);
                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
                request.onblocked = () => resolve();
              }),
          ),
      );
    }
  });
  await page.goto('about:blank');
}

function installRuntimeGuards(page: Page): {
  runtimeFailures: string[];
  networkFailures: string[];
} {
  const runtimeFailures: string[] = [];
  const networkFailures: string[] = [];
  page.on('pageerror', (error) => runtimeFailures.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      runtimeFailures.push(`console.error: ${message.text()}`);
    }
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    const failureText = request.failure()?.errorText ?? 'unknown';
    if (url.includes('/events:stream') && failureText === 'net::ERR_ABORTED') return;
    if (request.method() === 'GET' && failureText === 'net::ERR_ABORTED') return;
    if (url.startsWith(apiBaseUrl) || url.includes('localhost:5173')) {
      networkFailures.push(`requestfailed: ${request.method()} ${redactUrl(url)} ${failureText}`);
    }
  });
  page.on('response', (response) => {
    const url = response.url();
    if (
      url.startsWith(apiBaseUrl) &&
      (response.status() === 401 || response.status() === 403 || response.status() >= 500)
    ) {
      networkFailures.push(
        `response.${response.status()}: ${response.request().method()} ${redactUrl(url)}`,
      );
    }
  });
  return { runtimeFailures, networkFailures };
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value.split('?')[0] ?? value;
  }
}

function expectNoSensitiveMaterial(label: string, value: unknown): void {
  const serialized = JSON.stringify(value);
  expect(serialized, `${label} must not contain the dev bearer token`).not.toContain(devToken);
  expect(serialized.toLowerCase(), `${label} must not expose auth headers`).not.toContain(
    'authorization',
  );
  expect(serialized.toLowerCase(), `${label} must not expose token fields`).not.toContain('token');
  expect(serialized.toLowerCase(), `${label} must not expose secrets`).not.toContain('secret');
}

test.describe('Cockpit live-stack smoke', () => {
  test('loads seeded live data and proves the operator approval and resume flow with MSW disabled', async ({
    context,
    page,
  }, testInfo) => {
    const decisionRationale = `${decisionRationalePrefix} ${testInfo.workerIndex}-${Date.now()}`;
    await resetBrowserStorage(context, page);
    await createDevSession(context.request);
    const { runtimeFailures, networkFailures } = installRuntimeGuards(page);

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
    await expect(page.getByText('Mock data', { exact: false })).toHaveCount(0);

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

    await page.goto(`/approvals?focus=${approvalId}&from=notification`);
    await expect(page.getByRole('heading', { name: 'Approval Review' })).toBeVisible();
    await expect(page.getByText(approvalId, { exact: true })).toBeVisible();
    await expect(page.getByTitle('Request changes (R)')).toBeVisible();
    await page
      .getByRole('textbox', { name: new RegExp(`Decision rationale for approval ${approvalId}`) })
      .fill(decisionRationale);

    await page.getByTitle('Approve (A)').click();
    const confirmApprovalButton = page.getByRole('button', { name: 'Confirm' });
    if (await confirmApprovalButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await confirmApprovalButton.click();
    }
    await expect(page.getByText('Approval handled')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo decision' })).toBeVisible();

    const decisionResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/approvals/${approvalId}/decide`) &&
        response.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.getByRole('link', { name: /^Runs$/ }).click();

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
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Approval already decided')).toBeVisible();

    const resumeResponse = page.waitForResponse(
      (apiResponse) =>
        apiResponse.url().includes(`/runs/${runId}/interventions`) &&
        apiResponse.request().method() === 'POST',
      { timeout: 20_000 },
    );

    await page.goto(`/runs/${runId}`);
    await expect(page.getByText('Approved, resume pending after recovery')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record Resume' })).toBeDisabled();
    await page.getByLabel('Rationale').fill(resumeRationale);
    await page.getByRole('button', { name: 'Record Resume' }).click();

    const resumeResult = await resumeResponse;
    expect(resumeResult.status()).toBe(200);

    const runAfterResume = await apiGet<RunApiView>(
      context.request,
      `/v1/workspaces/${workspaceId}/runs/${runId}`,
    );
    expect(runAfterResume.status).toBe('Running');
    expect(runAfterResume.controlState).toBeUndefined();

    const interventionEvidence = await apiGet<PageResponse<EvidenceApiView>>(
      context.request,
      `/v1/workspaces/${workspaceId}/runs/${runId}/evidence`,
    );
    expect(interventionEvidence.items.some((entry) => entry.summary.includes('resume:'))).toBe(
      true,
    );

    await page.goto('/evidence');
    await expect(page.getByRole('heading', { name: 'Evidence' })).toBeVisible();
    await expect(page.getByText('grants/cg-live-machine')).toHaveCount(0);
    await expect(page.getByText(devToken)).toHaveCount(0);

    const operatorFlowEvidence = {
      approvalAfter,
      approvalEvidence,
      runAfterResume,
      interventionEvidence,
      runtimeFailures,
      networkFailures,
    };
    expectNoSensitiveMaterial('live-stack operator evidence', operatorFlowEvidence);

    await testInfo.attach('live-stack-api-after-decision.json', {
      body: JSON.stringify(operatorFlowEvidence, null, 2),
      contentType: 'application/json',
    });

    expect(runtimeFailures, runtimeFailures.join('\n')).toEqual([]);
    expect(networkFailures, networkFailures.join('\n')).toEqual([]);
  });
});
