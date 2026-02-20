import { TenantId } from '../../domain/primitives/index.js';
import { InMemoryAdsPlatformsAdapter } from '../adapters/ads-platforms/in-memory-ads-platforms-adapter.js';
import { InMemoryAnalyticsBiAdapter } from '../adapters/analytics-bi/in-memory-analytics-bi-adapter.js';
import { InMemoryCommsCollaborationAdapter } from '../adapters/comms-collaboration/in-memory-comms-collaboration-adapter.js';
import { InMemoryComplianceGrcAdapter } from '../adapters/compliance-grc/in-memory-compliance-grc-adapter.js';
import { InMemoryCrmSalesAdapter } from '../adapters/crm-sales/in-memory-crm-sales-adapter.js';
import { InMemoryCustomerSupportAdapter } from '../adapters/customer-support/in-memory-customer-support-adapter.js';
import { InMemoryDocumentsEsignAdapter } from '../adapters/documents-esign/in-memory-documents-esign-adapter.js';
import { InMemoryFinanceAccountingAdapter } from '../adapters/finance-accounting/in-memory-finance-accounting-adapter.js';
import { InMemoryHrisHcmAdapter } from '../adapters/hris-hcm/in-memory-hris-hcm-adapter.js';
import { InMemoryIamDirectoryAdapter } from '../adapters/iam-directory/in-memory-iam-directory-adapter.js';
import { InMemoryItsmItOpsAdapter } from '../adapters/itsm-it-ops/in-memory-itsm-it-ops-adapter.js';
import { InMemoryMarketingAutomationAdapter } from '../adapters/marketing-automation/in-memory-marketing-automation-adapter.js';
import { InMemoryMonitoringIncidentAdapter } from '../adapters/monitoring-incident/in-memory-monitoring-incident-adapter.js';
import { InMemoryPaymentsBillingAdapter } from '../adapters/payments-billing/in-memory-payments-billing-adapter.js';
import { InMemoryPayrollAdapter } from '../adapters/payroll/in-memory-payroll-adapter.js';
import { InMemoryProcurementSpendAdapter } from '../adapters/procurement-spend/in-memory-procurement-spend-adapter.js';
import { InMemoryProjectsWorkMgmtAdapter } from '../adapters/projects-work-mgmt/in-memory-projects-work-mgmt-adapter.js';
import { InMemorySecretsVaultingAdapter } from '../adapters/secrets-vaulting/in-memory-secrets-vaulting-adapter.js';

export const TENANT_ISOLATED_PORT_FAMILIES_V1 = [
  'AdsPlatforms',
  'AnalyticsBi',
  'CommsCollaboration',
  'ComplianceGrc',
  'CrmSales',
  'CustomerSupport',
  'DocumentsEsign',
  'FinanceAccounting',
  'HrisHcm',
  'IamDirectory',
  'ItsmItOps',
  'MarketingAutomation',
  'MonitoringIncident',
  'PaymentsBilling',
  'Payroll',
  'ProcurementSpend',
  'ProjectsWorkMgmt',
  'SecretsVaulting',
] as const;

export type TenantIsolatedPortFamilyV1 = (typeof TENANT_ISOLATED_PORT_FAMILIES_V1)[number];

export type TenantIsolatedPortFixtureBundleV1 = Readonly<
  Record<TenantIsolatedPortFamilyV1, Record<string, unknown>>
>;

export function createTenantIsolatedPortFixtureBundleV1(params: {
  tenantSuffix: string;
}): TenantIsolatedPortFixtureBundleV1 {
  const tenantId = TenantId(`tenant-${sanitizeSuffix(params.tenantSuffix)}`);
  return {
    AdsPlatforms: InMemoryAdsPlatformsAdapter.seedMinimal(tenantId),
    AnalyticsBi: InMemoryAnalyticsBiAdapter.seedMinimal(tenantId),
    CommsCollaboration: InMemoryCommsCollaborationAdapter.seedMinimal(tenantId),
    ComplianceGrc: InMemoryComplianceGrcAdapter.seedMinimal(tenantId),
    CrmSales: InMemoryCrmSalesAdapter.seedMinimal(tenantId),
    CustomerSupport: InMemoryCustomerSupportAdapter.seedMinimal(tenantId),
    DocumentsEsign: InMemoryDocumentsEsignAdapter.seedMinimal(tenantId),
    FinanceAccounting: InMemoryFinanceAccountingAdapter.seedMinimal(tenantId),
    HrisHcm: InMemoryHrisHcmAdapter.seedMinimal(tenantId),
    IamDirectory: InMemoryIamDirectoryAdapter.seedMinimal(tenantId),
    ItsmItOps: InMemoryItsmItOpsAdapter.seedMinimal(tenantId),
    MarketingAutomation: InMemoryMarketingAutomationAdapter.seedMinimal(tenantId),
    MonitoringIncident: InMemoryMonitoringIncidentAdapter.seedMinimal(tenantId),
    PaymentsBilling: InMemoryPaymentsBillingAdapter.seedMinimal(tenantId),
    Payroll: InMemoryPayrollAdapter.seedMinimal(tenantId),
    ProcurementSpend: InMemoryProcurementSpendAdapter.seedMinimal(tenantId),
    ProjectsWorkMgmt: InMemoryProjectsWorkMgmtAdapter.seedMinimal(tenantId),
    SecretsVaulting: InMemorySecretsVaultingAdapter.seedMinimal(tenantId),
  };
}

function sanitizeSuffix(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const normalized = trimmed.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : 'tenant';
}
