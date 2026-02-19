import type { DocumentV1 } from '../../../domain/canonical/document-v1.js';
import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../../domain/canonical/party-v1.js';
import { DocumentId, PartyId } from '../../../domain/primitives/index.js';
import type {
  AnalyticsBiAdapterPort,
  AnalyticsBiExecuteInputV1,
  AnalyticsBiExecuteOutputV1,
} from '../../../application/ports/analytics-bi-adapter.js';
import { ANALYTICS_BI_OPERATIONS_V1 } from '../../../application/ports/analytics-bi-adapter.js';

const OPERATION_SET = new Set<string>(ANALYTICS_BI_OPERATIONS_V1);

type TenantExternalRef = Readonly<{
  tenantId: AnalyticsBiExecuteInputV1['tenantId'];
  externalRef: ExternalObjectRef;
}>;

type QueryResultEntry = Readonly<{
  tenantId: AnalyticsBiExecuteInputV1['tenantId'];
  queryId: string;
  externalRef: ExternalObjectRef;
}>;

type InMemoryAnalyticsBiAdapterSeed = Readonly<{
  dashboards?: readonly TenantExternalRef[];
  reports?: readonly TenantExternalRef[];
  queryResults?: readonly QueryResultEntry[];
  dataSources?: readonly TenantExternalRef[];
  datasets?: readonly TenantExternalRef[];
  metrics?: readonly TenantExternalRef[];
  users?: readonly PartyV1[];
}>;

type InMemoryAnalyticsBiAdapterParams = Readonly<{
  seed?: InMemoryAnalyticsBiAdapterSeed;
  now?: () => Date;
}>;

function readString(payload: Readonly<Record<string, unknown>> | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function mimeTypeForExport(format: string): string {
  switch (format.toLowerCase()) {
    case 'csv':
      return 'text/csv';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'pdf':
    default:
      return 'application/pdf';
  }
}

export class InMemoryAnalyticsBiAdapter implements AnalyticsBiAdapterPort {
  readonly #now: () => Date;
  readonly #dashboards: TenantExternalRef[];
  readonly #reports: TenantExternalRef[];
  readonly #queryResults: QueryResultEntry[];
  readonly #dataSources: TenantExternalRef[];
  readonly #datasets: TenantExternalRef[];
  readonly #metrics: TenantExternalRef[];
  readonly #users: PartyV1[];
  #querySequence: number;
  #queryResultSequence: number;
  #dataSourceSequence: number;
  #refreshSequence: number;
  #shareSequence: number;
  #exportSequence: number;

  public constructor(params?: InMemoryAnalyticsBiAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#dashboards = [...(params?.seed?.dashboards ?? [])];
    this.#reports = [...(params?.seed?.reports ?? [])];
    this.#queryResults = [...(params?.seed?.queryResults ?? [])];
    this.#dataSources = [...(params?.seed?.dataSources ?? [])];
    this.#datasets = [...(params?.seed?.datasets ?? [])];
    this.#metrics = [...(params?.seed?.metrics ?? [])];
    this.#users = [...(params?.seed?.users ?? [])];
    this.#querySequence = this.#queryResults.length;
    this.#queryResultSequence = this.#queryResults.length;
    this.#dataSourceSequence = this.#dataSources.length;
    this.#refreshSequence = 0;
    this.#shareSequence = 0;
    this.#exportSequence = 0;
  }

  public async execute(input: AnalyticsBiExecuteInputV1): Promise<AnalyticsBiExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported AnalyticsBi operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'listDashboards':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#dashboards, input) },
        };
      case 'getDashboard':
        return this.#getTenantRef(input, this.#dashboards, 'dashboardId', 'Dashboard', 'getDashboard');
      case 'listReports':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#reports, input) },
        };
      case 'getReport':
        return this.#getTenantRef(input, this.#reports, 'reportId', 'Report', 'getReport');
      case 'runQuery':
        return this.#runQuery(input);
      case 'getQueryResults':
        return this.#getQueryResults(input);
      case 'listDataSources':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#dataSources, input) },
        };
      case 'getDataSource':
        return this.#getTenantRef(input, this.#dataSources, 'dataSourceId', 'Data source', 'getDataSource');
      case 'createDataSource':
        return this.#createDataSource(input);
      case 'listDatasets':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#datasets, input) },
        };
      case 'getDataset':
        return this.#getTenantRef(input, this.#datasets, 'datasetId', 'Dataset', 'getDataset');
      case 'refreshDataset':
        return this.#refreshDataset(input);
      case 'listMetrics':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#metrics, input) },
        };
      case 'exportReport':
        return this.#exportReport(input);
      case 'listUsers':
        return { ok: true, result: { kind: 'parties', parties: this.#listUsers(input) } };
      case 'shareReport':
        return this.#shareReport(input);
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported AnalyticsBi operation: ${String(input.operation)}.`,
        };
    }
  }

  #runQuery(input: AnalyticsBiExecuteInputV1): AnalyticsBiExecuteOutputV1 {
    const query = readString(input.payload, 'query');
    if (query === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'query is required for runQuery.',
      };
    }

    const queryId = `query-${++this.#querySequence}`;
    const queryExternalRef: ExternalObjectRef = {
      sorName: 'InsightHub',
      portFamily: 'AnalyticsBi',
      externalId: queryId,
      externalType: 'query_execution',
      displayLabel: query,
    };
    const resultExternalRef: ExternalObjectRef = {
      sorName: 'InsightHub',
      portFamily: 'AnalyticsBi',
      externalId: `query-result-${++this.#queryResultSequence}`,
      externalType: 'query_result',
      displayLabel: `Results for ${queryId}`,
      deepLinkUrl: `https://analytics.example/query-results/${queryId}`,
    };
    this.#queryResults.push({
      tenantId: input.tenantId,
      queryId,
      externalRef: resultExternalRef,
    });
    return { ok: true, result: { kind: 'externalRef', externalRef: queryExternalRef } };
  }

  #getQueryResults(input: AnalyticsBiExecuteInputV1): AnalyticsBiExecuteOutputV1 {
    const queryId = readString(input.payload, 'queryId');
    if (queryId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'queryId is required for getQueryResults.',
      };
    }
    const found = this.#queryResults.find(
      (entry) => entry.tenantId === input.tenantId && entry.queryId === queryId,
    );
    if (found === undefined) {
      return { ok: false, error: 'not_found', message: `Query results for ${queryId} were not found.` };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef: found.externalRef } };
  }

  #createDataSource(input: AnalyticsBiExecuteInputV1): AnalyticsBiExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createDataSource.',
      };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'InsightHub',
      portFamily: 'AnalyticsBi',
      externalId: `data-source-${++this.#dataSourceSequence}`,
      externalType: 'data_source',
      displayLabel: name,
    };
    this.#dataSources.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #refreshDataset(input: AnalyticsBiExecuteInputV1): AnalyticsBiExecuteOutputV1 {
    const datasetId = readString(input.payload, 'datasetId');
    if (datasetId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'datasetId is required for refreshDataset.',
      };
    }

    const dataset = this.#datasets.find(
      (entry) => entry.tenantId === input.tenantId && entry.externalRef.externalId === datasetId,
    );
    if (dataset === undefined) {
      return { ok: false, error: 'not_found', message: `Dataset ${datasetId} was not found.` };
    }
    void dataset;

    const externalRef: ExternalObjectRef = {
      sorName: 'InsightHub',
      portFamily: 'AnalyticsBi',
      externalId: `dataset-refresh-${++this.#refreshSequence}`,
      externalType: 'dataset_refresh',
      displayLabel: `Refresh queued for ${datasetId}`,
      deepLinkUrl: `https://analytics.example/datasets/${datasetId}/refresh?at=${encodeURIComponent(
        this.#now().toISOString(),
      )}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #exportReport(input: AnalyticsBiExecuteInputV1): AnalyticsBiExecuteOutputV1 {
    const reportId = readString(input.payload, 'reportId');
    if (reportId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'reportId is required for exportReport.',
      };
    }

    const report = this.#reports.find(
      (entry) => entry.tenantId === input.tenantId && entry.externalRef.externalId === reportId,
    );
    if (report === undefined) {
      return { ok: false, error: 'not_found', message: `Report ${reportId} was not found.` };
    }

    const format = readString(input.payload, 'format') ?? 'pdf';
    const titleBase = report.externalRef.displayLabel ?? reportId;
    const document: DocumentV1 = {
      documentId: DocumentId(`report-export-${++this.#exportSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      title: `${titleBase}.${format.toLowerCase()}`,
      mimeType: mimeTypeForExport(format),
      createdAtIso: this.#now().toISOString(),
    };
    return { ok: true, result: { kind: 'document', document } };
  }

  #listUsers(input: AnalyticsBiExecuteInputV1): readonly PartyV1[] {
    return this.#users.filter((party) => party.tenantId === input.tenantId);
  }

  #shareReport(input: AnalyticsBiExecuteInputV1): AnalyticsBiExecuteOutputV1 {
    const reportId = readString(input.payload, 'reportId');
    if (reportId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'reportId is required for shareReport.',
      };
    }
    const target = readString(input.payload, 'target');
    if (target === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'target is required for shareReport.',
      };
    }

    const report = this.#reports.find(
      (entry) => entry.tenantId === input.tenantId && entry.externalRef.externalId === reportId,
    );
    if (report === undefined) {
      return { ok: false, error: 'not_found', message: `Report ${reportId} was not found.` };
    }
    void report;

    const externalRef: ExternalObjectRef = {
      sorName: 'InsightHub',
      portFamily: 'AnalyticsBi',
      externalId: `report-share-${++this.#shareSequence}`,
      externalType: 'report_share',
      displayLabel: `Shared ${reportId} with ${target}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #listTenantRefs(
    source: readonly TenantExternalRef[],
    input: AnalyticsBiExecuteInputV1,
  ): readonly ExternalObjectRef[] {
    return source
      .filter((entry) => entry.tenantId === input.tenantId)
      .map((entry) => entry.externalRef);
  }

  #getTenantRef(
    input: AnalyticsBiExecuteInputV1,
    source: readonly TenantExternalRef[],
    key: string,
    label: string,
    operationName: string,
  ): AnalyticsBiExecuteOutputV1 {
    const externalId = readString(input.payload, key);
    if (externalId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: `${key} is required for ${operationName}.`,
      };
    }
    const found = source.find(
      (entry) =>
        entry.tenantId === input.tenantId && entry.externalRef.externalId === externalId,
    );
    if (found === undefined) {
      return { ok: false, error: 'not_found', message: `${label} ${externalId} was not found.` };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef: found.externalRef } };
  }

  public static seedMinimal(
    tenantId: AnalyticsBiExecuteInputV1['tenantId'],
  ): InMemoryAnalyticsBiAdapterSeed {
    return {
      dashboards: [
        {
          tenantId,
          externalRef: {
            sorName: 'InsightHub',
            portFamily: 'AnalyticsBi',
            externalId: 'dashboard-1000',
            externalType: 'dashboard',
            displayLabel: 'Operations Overview',
          },
        },
      ],
      reports: [
        {
          tenantId,
          externalRef: {
            sorName: 'InsightHub',
            portFamily: 'AnalyticsBi',
            externalId: 'report-1000',
            externalType: 'report',
            displayLabel: 'Weekly SLA Report',
          },
        },
      ],
      queryResults: [
        {
          tenantId,
          queryId: 'query-1000',
          externalRef: {
            sorName: 'InsightHub',
            portFamily: 'AnalyticsBi',
            externalId: 'query-result-1000',
            externalType: 'query_result',
            displayLabel: 'Results for query-1000',
          },
        },
      ],
      dataSources: [
        {
          tenantId,
          externalRef: {
            sorName: 'InsightHub',
            portFamily: 'AnalyticsBi',
            externalId: 'data-source-1000',
            externalType: 'data_source',
            displayLabel: 'Warehouse Primary',
          },
        },
      ],
      datasets: [
        {
          tenantId,
          externalRef: {
            sorName: 'InsightHub',
            portFamily: 'AnalyticsBi',
            externalId: 'dataset-1000',
            externalType: 'dataset',
            displayLabel: 'Incidents Fact Table',
          },
        },
      ],
      metrics: [
        {
          tenantId,
          externalRef: {
            sorName: 'InsightHub',
            portFamily: 'AnalyticsBi',
            externalId: 'metric-1000',
            externalType: 'metric',
            displayLabel: 'Mean Time to Resolve',
          },
        },
      ],
      users: [
        {
          partyId: PartyId('bi-user-1000'),
          tenantId,
          schemaVersion: 1,
          displayName: 'BI Analyst',
          email: 'bi-analyst@example.com',
          roles: ['user'],
        },
      ],
    };
  }
}
