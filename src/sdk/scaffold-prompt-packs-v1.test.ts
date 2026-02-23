import { describe, expect, it } from 'vitest';

import type { MisAdapterMetaV1 } from './mis-v1.js';

import {
  buildScaffoldPromptPack,
  CRM_SALES_PACK,
  FINANCE_ACCOUNTING_PACK,
  ITSM_IT_OPS_PACK,
  validateAdapterMeta,
  validateAdapterStructure,
  validateHealthResponse,
  validateInvokeResult,
} from './scaffold-prompt-packs-v1.js';

// ---------------------------------------------------------------------------
// validateAdapterMeta
// ---------------------------------------------------------------------------

describe('validateAdapterMeta', () => {
  const validMeta: MisAdapterMetaV1 = {
    schemaVersion: 1,
    adapterId: 'acme-crm-v1',
    portFamily: 'CrmSales',
    displayName: 'Acme CRM',
  };

  it('accepts valid metadata', () => {
    const r = validateAdapterMeta(validMeta);
    expect(r.valid).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('rejects wrong schemaVersion', () => {
    const r = validateAdapterMeta({
      ...validMeta,
      schemaVersion: 99 as unknown as 1,
    });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(
      expect.objectContaining({ rule: 'schema_version', severity: 'error' }),
    );
  });

  it('rejects empty adapterId', () => {
    const r = validateAdapterMeta({ ...validMeta, adapterId: '' });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(
      expect.objectContaining({ rule: 'adapter_id_required', severity: 'error' }),
    );
  });

  it('rejects whitespace-only adapterId', () => {
    const r = validateAdapterMeta({ ...validMeta, adapterId: '   ' });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(expect.objectContaining({ rule: 'adapter_id_required' }));
  });

  it('warns on non-kebab-case adapterId', () => {
    const r = validateAdapterMeta({ ...validMeta, adapterId: 'AcmeCRM' });
    expect(r.valid).toBe(true); // warning, not error
    expect(r.violations).toContainEqual(
      expect.objectContaining({ rule: 'adapter_id_format', severity: 'warning' }),
    );
  });

  it('rejects unknown portFamily', () => {
    const r = validateAdapterMeta({
      ...validMeta,
      portFamily: 'UnknownFamily' as MisAdapterMetaV1['portFamily'],
    });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(
      expect.objectContaining({ rule: 'port_family_valid', severity: 'error' }),
    );
  });

  it('rejects empty displayName', () => {
    const r = validateAdapterMeta({ ...validMeta, displayName: '' });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(expect.objectContaining({ rule: 'display_name_required' }));
  });

  it('warns on bad operation format', () => {
    const r = validateAdapterMeta({
      ...validMeta,
      supportedOperations: ['good:op', 'bad format'],
    });
    expect(r.valid).toBe(true);
    const opViolations = r.violations.filter((v) => v.rule === 'operation_format');
    expect(opViolations).toHaveLength(1);
    expect(opViolations[0]!.message).toContain('bad format');
  });

  it('warns on bad version format', () => {
    const r = validateAdapterMeta({ ...validMeta, version: 'alpha' });
    expect(r.valid).toBe(true);
    expect(r.violations).toContainEqual(
      expect.objectContaining({ rule: 'version_format', severity: 'warning' }),
    );
  });

  it('accepts valid semver version', () => {
    const r = validateAdapterMeta({ ...validMeta, version: '1.2.3' });
    expect(r.valid).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('returns frozen violations array', () => {
    const r = validateAdapterMeta({ ...validMeta, adapterId: '' });
    expect(Object.isFrozen(r.violations)).toBe(true);
  });

  it('collects multiple violations', () => {
    const r = validateAdapterMeta({
      schemaVersion: 0 as unknown as 1,
      adapterId: '',
      portFamily: 'Bad' as MisAdapterMetaV1['portFamily'],
      displayName: '',
    });
    expect(r.valid).toBe(false);
    expect(r.violations.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// validateAdapterStructure
// ---------------------------------------------------------------------------

describe('validateAdapterStructure', () => {
  it('rejects null', () => {
    const r = validateAdapterStructure(null);
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(expect.objectContaining({ rule: 'adapter_is_object' }));
  });

  it('rejects undefined', () => {
    const r = validateAdapterStructure(undefined);
    expect(r.valid).toBe(false);
  });

  it('rejects a string', () => {
    const r = validateAdapterStructure('not an adapter');
    expect(r.valid).toBe(false);
  });

  it('rejects missing meta', () => {
    const r = validateAdapterStructure({
      health: () => {},
      invoke: () => {},
    });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(expect.objectContaining({ rule: 'meta_required' }));
  });

  it('rejects missing required methods', () => {
    const r = validateAdapterStructure({ meta: {} });
    expect(r.valid).toBe(false);
    const methodViolations = r.violations.filter((v) => v.rule === 'method_required');
    expect(methodViolations).toHaveLength(2); // health + invoke
  });

  it('accepts a structurally valid adapter', () => {
    const adapter = {
      meta: { adapterId: 'test' },
      health: () => Promise.resolve({ status: 'healthy' }),
      invoke: () => Promise.resolve({ ok: true, value: {} }),
    };
    const r = validateAdapterStructure(adapter);
    expect(r.valid).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('rejects health as a non-function', () => {
    const r = validateAdapterStructure({
      meta: {},
      health: 'not a function',
      invoke: () => {},
    });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(
      expect.objectContaining({ rule: 'method_required', field: 'health' }),
    );
  });
});

// ---------------------------------------------------------------------------
// validateHealthResponse
// ---------------------------------------------------------------------------

describe('validateHealthResponse', () => {
  it('accepts healthy', () => {
    const r = validateHealthResponse({ status: 'healthy' });
    expect(r.valid).toBe(true);
  });

  it('accepts degraded with detail', () => {
    const r = validateHealthResponse({ status: 'degraded', detail: 'slow' });
    expect(r.valid).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('accepts unhealthy', () => {
    const r = validateHealthResponse({ status: 'unhealthy' });
    expect(r.valid).toBe(true);
  });

  it('rejects null', () => {
    const r = validateHealthResponse(null);
    expect(r.valid).toBe(false);
  });

  it('rejects missing status', () => {
    const r = validateHealthResponse({});
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(
      expect.objectContaining({ rule: 'health_status_required' }),
    );
  });

  it('rejects invalid status value', () => {
    const r = validateHealthResponse({ status: 'broken' });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(expect.objectContaining({ rule: 'health_status_valid' }));
  });

  it('warns on non-string detail', () => {
    const r = validateHealthResponse({ status: 'healthy', detail: 42 });
    expect(r.valid).toBe(true); // warning only
    expect(r.violations).toContainEqual(
      expect.objectContaining({ rule: 'health_detail_type', severity: 'warning' }),
    );
  });
});

// ---------------------------------------------------------------------------
// validateInvokeResult
// ---------------------------------------------------------------------------

describe('validateInvokeResult', () => {
  it('accepts ok result with value', () => {
    const r = validateInvokeResult({ ok: true, value: { id: '123' } });
    expect(r.valid).toBe(true);
  });

  it('rejects null', () => {
    const r = validateInvokeResult(null);
    expect(r.valid).toBe(false);
  });

  it('rejects missing ok field', () => {
    const r = validateInvokeResult({ value: {} });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(expect.objectContaining({ rule: 'result_ok_required' }));
  });

  it('rejects ok=true without value', () => {
    const r = validateInvokeResult({ ok: true });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(expect.objectContaining({ rule: 'result_ok_value' }));
  });

  it('accepts a complete error result', () => {
    const r = validateInvokeResult({
      ok: false,
      code: 'NOT_FOUND',
      message: 'gone',
      retryable: false,
    });
    expect(r.valid).toBe(true);
  });

  it('rejects error result missing code', () => {
    const r = validateInvokeResult({
      ok: false,
      message: 'oops',
      retryable: true,
    });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(expect.objectContaining({ rule: 'result_err_code' }));
  });

  it('rejects error result missing message', () => {
    const r = validateInvokeResult({
      ok: false,
      code: 'TIMEOUT',
      retryable: true,
    });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(expect.objectContaining({ rule: 'result_err_message' }));
  });

  it('rejects error result missing retryable', () => {
    const r = validateInvokeResult({
      ok: false,
      code: 'TIMEOUT',
      message: 'too slow',
    });
    expect(r.valid).toBe(false);
    expect(r.violations).toContainEqual(expect.objectContaining({ rule: 'result_err_retryable' }));
  });

  it('rejects error result with all fields missing', () => {
    const r = validateInvokeResult({ ok: false });
    expect(r.valid).toBe(false);
    expect(r.violations.filter((v) => v.severity === 'error')).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// buildScaffoldPromptPack
// ---------------------------------------------------------------------------

describe('buildScaffoldPromptPack', () => {
  it('builds a frozen pack for a valid port family', () => {
    const pack = buildScaffoldPromptPack({
      portFamily: 'CrmSales',
      adapterId: 'salesforce-v1',
      displayName: 'Salesforce',
      exampleOperations: ['account:list', 'contact:get'],
    });

    expect(pack.schemaVersion).toBe(1);
    expect(pack.packId).toBe('scaffold-crmsales-salesforce-v1');
    expect(pack.displayName).toBe('Salesforce Adapter Scaffold');
    expect(pack.portFamily).toBe('CrmSales');
    expect(pack.exampleOperations).toEqual(['account:list', 'contact:get']);
    expect(Object.isFrozen(pack)).toBe(true);
    expect(Object.isFrozen(pack.validationChecklist)).toBe(true);
    expect(Object.isFrozen(pack.exampleOperations)).toBe(true);
  });

  it('embeds port family and adapter ID in system context', () => {
    const pack = buildScaffoldPromptPack({
      portFamily: 'FinanceAccounting',
      adapterId: 'odoo-v1',
      displayName: 'Odoo',
      exampleOperations: ['invoice:create'],
    });

    expect(pack.systemContext).toContain('Port family: FinanceAccounting');
    expect(pack.systemContext).toContain('Adapter ID: odoo-v1');
  });

  it('lists operations in task template', () => {
    const pack = buildScaffoldPromptPack({
      portFamily: 'ItsmItOps',
      adapterId: 'snow-v1',
      displayName: 'ServiceNow',
      exampleOperations: ['incident:create', 'change:approve'],
    });

    expect(pack.taskTemplate).toContain('- incident:create');
    expect(pack.taskTemplate).toContain('- change:approve');
  });

  it('includes port family in validation checklist', () => {
    const pack = buildScaffoldPromptPack({
      portFamily: 'Payroll',
      adapterId: 'payroll-v1',
      displayName: 'Payroll',
      exampleOperations: [],
    });

    expect(pack.validationChecklist).toContain('meta.portFamily is "Payroll"');
  });

  it('throws for unknown port family', () => {
    expect(() =>
      buildScaffoldPromptPack({
        portFamily: 'FakeFamily' as MisAdapterMetaV1['portFamily'],
        adapterId: 'x',
        displayName: 'X',
        exampleOperations: [],
      }),
    ).toThrow('Unknown port family: FakeFamily');
  });
});

// ---------------------------------------------------------------------------
// Pre-built packs
// ---------------------------------------------------------------------------

describe('pre-built packs', () => {
  it('CRM_SALES_PACK targets CrmSales', () => {
    expect(CRM_SALES_PACK.portFamily).toBe('CrmSales');
    expect(CRM_SALES_PACK.schemaVersion).toBe(1);
    expect(CRM_SALES_PACK.exampleOperations.length).toBeGreaterThan(0);
    expect(Object.isFrozen(CRM_SALES_PACK)).toBe(true);
  });

  it('FINANCE_ACCOUNTING_PACK targets FinanceAccounting', () => {
    expect(FINANCE_ACCOUNTING_PACK.portFamily).toBe('FinanceAccounting');
    expect(FINANCE_ACCOUNTING_PACK.exampleOperations).toContain('invoice:create');
  });

  it('ITSM_IT_OPS_PACK targets ItsmItOps', () => {
    expect(ITSM_IT_OPS_PACK.portFamily).toBe('ItsmItOps');
    expect(ITSM_IT_OPS_PACK.exampleOperations).toContain('incident:create');
  });
});
