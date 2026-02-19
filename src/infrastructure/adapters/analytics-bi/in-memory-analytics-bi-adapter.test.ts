import { describe, expect, it } from 'vitest';

import { TenantId } from '../../../domain/primitives/index.js';
import { InMemoryAnalyticsBiAdapter } from './in-memory-analytics-bi-adapter.js';

const TENANT_A = TenantId('tenant-a');
const TENANT_B = TenantId('tenant-b');

describe('InMemoryAnalyticsBiAdapter', () => {
  it('returns tenant-scoped dashboards and users', async () => {
    const seedA = InMemoryAnalyticsBiAdapter.seedMinimal(TENANT_A);
    const seedB = InMemoryAnalyticsBiAdapter.seedMinimal(TENANT_B);
    const adapter = new InMemoryAnalyticsBiAdapter({
      seed: {
        ...seedA,
        dashboards: [...seedA.dashboards!, ...seedB.dashboards!],
        users: [...seedA.users!, ...seedB.users!],
      },
    });

    const dashboards = await adapter.execute({ tenantId: TENANT_A, operation: 'listDashboards' });
    expect(dashboards.ok).toBe(true);
    if (!dashboards.ok || dashboards.result.kind !== 'externalRefs') return;
    expect(dashboards.result.externalRefs).toHaveLength(1);
    expect(dashboards.result.externalRefs[0]?.externalId).toBe('dashboard-1000');

    const users = await adapter.execute({ tenantId: TENANT_A, operation: 'listUsers' });
    expect(users.ok).toBe(true);
    if (!users.ok || users.result.kind !== 'parties') return;
    expect(users.result.parties).toHaveLength(1);
    expect(users.result.parties[0]?.tenantId).toBe(TENANT_A);
  });

  it('supports dashboard/report reads and query execution', async () => {
    const adapter = new InMemoryAnalyticsBiAdapter({
      seed: InMemoryAnalyticsBiAdapter.seedMinimal(TENANT_A),
    });

    const dashboard = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getDashboard',
      payload: { dashboardId: 'dashboard-1000' },
    });
    expect(dashboard.ok).toBe(true);
    if (!dashboard.ok || dashboard.result.kind !== 'externalRef') return;
    expect(dashboard.result.externalRef.externalType).toBe('dashboard');

    const report = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getReport',
      payload: { reportId: 'report-1000' },
    });
    expect(report.ok).toBe(true);
    if (!report.ok || report.result.kind !== 'externalRef') return;
    expect(report.result.externalRef.externalType).toBe('report');

    const queryRun = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'runQuery',
      payload: { query: 'SELECT 1 AS ok' },
    });
    expect(queryRun.ok).toBe(true);
    if (!queryRun.ok || queryRun.result.kind !== 'externalRef') return;
    const queryId = queryRun.result.externalRef.externalId;

    const queryResults = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getQueryResults',
      payload: { queryId },
    });
    expect(queryResults.ok).toBe(true);
    if (!queryResults.ok || queryResults.result.kind !== 'externalRef') return;
    expect(queryResults.result.externalRef.externalType).toBe('query_result');
  });

  it('supports data source and dataset operations', async () => {
    const adapter = new InMemoryAnalyticsBiAdapter({
      seed: InMemoryAnalyticsBiAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const dataSources = await adapter.execute({ tenantId: TENANT_A, operation: 'listDataSources' });
    expect(dataSources.ok).toBe(true);
    if (!dataSources.ok || dataSources.result.kind !== 'externalRefs') return;
    expect(dataSources.result.externalRefs.length).toBeGreaterThan(0);

    const createdDataSource = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createDataSource',
      payload: { name: 'Warehouse Replica' },
    });
    expect(createdDataSource.ok).toBe(true);
    if (!createdDataSource.ok || createdDataSource.result.kind !== 'externalRef') return;
    const dataSourceId = createdDataSource.result.externalRef.externalId;

    const fetchedDataSource = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getDataSource',
      payload: { dataSourceId },
    });
    expect(fetchedDataSource.ok).toBe(true);
    if (!fetchedDataSource.ok || fetchedDataSource.result.kind !== 'externalRef') return;
    expect(fetchedDataSource.result.externalRef.externalId).toBe(dataSourceId);

    const datasets = await adapter.execute({ tenantId: TENANT_A, operation: 'listDatasets' });
    expect(datasets.ok).toBe(true);
    if (!datasets.ok || datasets.result.kind !== 'externalRefs') return;
    const datasetId = datasets.result.externalRefs[0]!.externalId;

    const dataset = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getDataset',
      payload: { datasetId },
    });
    expect(dataset.ok).toBe(true);
    if (!dataset.ok || dataset.result.kind !== 'externalRef') return;
    expect(dataset.result.externalRef.externalId).toBe(datasetId);

    const refresh = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'refreshDataset',
      payload: { datasetId },
    });
    expect(refresh.ok).toBe(true);
    if (!refresh.ok || refresh.result.kind !== 'externalRef') return;
    expect(refresh.result.externalRef.externalType).toBe('dataset_refresh');
    expect(refresh.result.externalRef.deepLinkUrl).toContain('2026-02-19T00%3A00%3A00.000Z');

    const metrics = await adapter.execute({ tenantId: TENANT_A, operation: 'listMetrics' });
    expect(metrics.ok).toBe(true);
    if (!metrics.ok || metrics.result.kind !== 'externalRefs') return;
    expect(metrics.result.externalRefs.length).toBeGreaterThan(0);
  });

  it('supports report export and sharing', async () => {
    const adapter = new InMemoryAnalyticsBiAdapter({
      seed: InMemoryAnalyticsBiAdapter.seedMinimal(TENANT_A),
      now: () => new Date('2026-02-19T00:00:00.000Z'),
    });

    const exportedReport = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'exportReport',
      payload: { reportId: 'report-1000', format: 'csv' },
    });
    expect(exportedReport.ok).toBe(true);
    if (!exportedReport.ok || exportedReport.result.kind !== 'document') return;
    expect(exportedReport.result.document.mimeType).toBe('text/csv');
    expect(exportedReport.result.document.createdAtIso).toBe('2026-02-19T00:00:00.000Z');

    const sharedReport = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'shareReport',
      payload: { reportId: 'report-1000', target: 'ops@example.com' },
    });
    expect(sharedReport.ok).toBe(true);
    if (!sharedReport.ok || sharedReport.result.kind !== 'externalRef') return;
    expect(sharedReport.result.externalRef.externalType).toBe('report_share');
  });

  it('returns validation and not-found errors for malformed inputs', async () => {
    const adapter = new InMemoryAnalyticsBiAdapter({
      seed: InMemoryAnalyticsBiAdapter.seedMinimal(TENANT_A),
    });

    const missingQuery = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'runQuery',
      payload: {},
    });
    expect(missingQuery).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'query is required for runQuery.',
    });

    const missingDataSourceName = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'createDataSource',
      payload: {},
    });
    expect(missingDataSourceName).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'name is required for createDataSource.',
    });

    const missingShareTarget = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'shareReport',
      payload: { reportId: 'report-1000' },
    });
    expect(missingShareTarget).toEqual({
      ok: false,
      error: 'validation_error',
      message: 'target is required for shareReport.',
    });

    const missingQueryResults = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'getQueryResults',
      payload: { queryId: 'query-does-not-exist' },
    });
    expect(missingQueryResults).toEqual({
      ok: false,
      error: 'not_found',
      message: 'Query results for query-does-not-exist were not found.',
    });
  });

  it('rejects unsupported operations', async () => {
    const adapter = new InMemoryAnalyticsBiAdapter();
    const result = await adapter.execute({
      tenantId: TENANT_A,
      operation: 'bogusOperation' as unknown as 'listDashboards',
    });
    expect(result).toEqual({
      ok: false,
      error: 'unsupported_operation',
      message: 'Unsupported AnalyticsBi operation: bogusOperation.',
    });
  });
});
