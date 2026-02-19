import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryAnalyticsBiAdapter } from './in-memory-analytics-bi-adapter.js';

const TENANT = TenantId('tenant-integration');

describe('InMemoryAnalyticsBiAdapter integration', () => {
  it('supports dashboard/report retrieval and query execution flow', async () => {
    const adapter = new InMemoryAnalyticsBiAdapter({
      seed: InMemoryAnalyticsBiAdapter.seedMinimal(TENANT),
    });

    const dashboards = await adapter.execute({ tenantId: TENANT, operation: 'listDashboards' });
    expect(dashboards.ok).toBe(true);
    if (!dashboards.ok || dashboards.result.kind !== 'externalRefs') return;
    const dashboardId = dashboards.result.externalRefs[0]!.externalId;

    const dashboard = await adapter.execute({
      tenantId: TENANT,
      operation: 'getDashboard',
      payload: { dashboardId },
    });
    expect(dashboard.ok).toBe(true);
    if (!dashboard.ok || dashboard.result.kind !== 'externalRef') return;
    expect(dashboard.result.externalRef.externalId).toBe(dashboardId);

    const reports = await adapter.execute({ tenantId: TENANT, operation: 'listReports' });
    expect(reports.ok).toBe(true);
    if (!reports.ok || reports.result.kind !== 'externalRefs') return;
    const reportId = reports.result.externalRefs[0]!.externalId;

    const report = await adapter.execute({
      tenantId: TENANT,
      operation: 'getReport',
      payload: { reportId },
    });
    expect(report.ok).toBe(true);
    if (!report.ok || report.result.kind !== 'externalRef') return;
    expect(report.result.externalRef.externalId).toBe(reportId);

    const queryRun = await adapter.execute({
      tenantId: TENANT,
      operation: 'runQuery',
      payload: { query: 'SELECT count(*) FROM incidents' },
    });
    expect(queryRun.ok).toBe(true);
    if (!queryRun.ok || queryRun.result.kind !== 'externalRef') return;
    const queryId = queryRun.result.externalRef.externalId;

    const queryResults = await adapter.execute({
      tenantId: TENANT,
      operation: 'getQueryResults',
      payload: { queryId },
    });
    expect(queryResults.ok).toBe(true);
    if (!queryResults.ok || queryResults.result.kind !== 'externalRef') return;
    expect(queryResults.result.externalRef.externalType).toBe('query_result');
  });

  it('supports data-source and dataset lifecycle operations', async () => {
    const adapter = new InMemoryAnalyticsBiAdapter({
      seed: InMemoryAnalyticsBiAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const createdDataSource = await adapter.execute({
      tenantId: TENANT,
      operation: 'createDataSource',
      payload: { name: 'Warehouse Replica' },
    });
    expect(createdDataSource.ok).toBe(true);
    if (!createdDataSource.ok || createdDataSource.result.kind !== 'externalRef') return;
    const dataSourceId = createdDataSource.result.externalRef.externalId;

    const fetchedDataSource = await adapter.execute({
      tenantId: TENANT,
      operation: 'getDataSource',
      payload: { dataSourceId },
    });
    expect(fetchedDataSource.ok).toBe(true);
    if (!fetchedDataSource.ok || fetchedDataSource.result.kind !== 'externalRef') return;
    expect(fetchedDataSource.result.externalRef.externalId).toBe(dataSourceId);

    const datasets = await adapter.execute({ tenantId: TENANT, operation: 'listDatasets' });
    expect(datasets.ok).toBe(true);
    if (!datasets.ok || datasets.result.kind !== 'externalRefs') return;
    const datasetId = datasets.result.externalRefs[0]!.externalId;

    const dataset = await adapter.execute({
      tenantId: TENANT,
      operation: 'getDataset',
      payload: { datasetId },
    });
    expect(dataset.ok).toBe(true);
    if (!dataset.ok || dataset.result.kind !== 'externalRef') return;
    expect(dataset.result.externalRef.externalId).toBe(datasetId);

    const refresh = await adapter.execute({
      tenantId: TENANT,
      operation: 'refreshDataset',
      payload: { datasetId },
    });
    expect(refresh.ok).toBe(true);
    if (!refresh.ok || refresh.result.kind !== 'externalRef') return;
    expect(refresh.result.externalRef.externalType).toBe('dataset_refresh');
    expect(refresh.result.externalRef.deepLinkUrl).toContain('2026-02-19T00%3A00%3A00.000Z');

    const metrics = await adapter.execute({ tenantId: TENANT, operation: 'listMetrics' });
    expect(metrics.ok).toBe(true);
    if (!metrics.ok || metrics.result.kind !== 'externalRefs') return;
    expect(metrics.result.externalRefs.length).toBeGreaterThan(0);
  });

  it('supports sharing/export and returns validation/not-found errors', async () => {
    const adapter = new InMemoryAnalyticsBiAdapter({
      seed: InMemoryAnalyticsBiAdapter.seedMinimal(TENANT),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const users = await adapter.execute({ tenantId: TENANT, operation: 'listUsers' });
    expect(users.ok).toBe(true);
    if (!users.ok || users.result.kind !== 'parties') return;
    expect(users.result.parties.length).toBeGreaterThan(0);

    const exported = await adapter.execute({
      tenantId: TENANT,
      operation: 'exportReport',
      payload: { reportId: 'report-1000', format: 'pdf' },
    });
    expect(exported.ok).toBe(true);
    if (!exported.ok || exported.result.kind !== 'document') return;
    expect(exported.result.document.mimeType).toBe('application/pdf');

    const shared = await adapter.execute({
      tenantId: TENANT,
      operation: 'shareReport',
      payload: { reportId: 'report-1000', target: 'ops@example.com' },
    });
    expect(shared.ok).toBe(true);
    if (!shared.ok || shared.result.kind !== 'externalRef') return;
    expect(shared.result.externalRef.externalType).toBe('report_share');

    const missingReport = await adapter.execute({
      tenantId: TENANT,
      operation: 'exportReport',
      payload: { reportId: 'report-does-not-exist' },
    });
    expect(missingReport).toEqual({
      ok: false,
      error: 'not_found',
      message: 'Report report-does-not-exist was not found.',
    });

    const missingTarget = await adapter.execute({
      tenantId: TENANT,
      operation: 'shareReport',
      payload: { reportId: 'report-1000' },
    });
    expect(missingTarget).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'target is required for shareReport.',
    });
  });
});
