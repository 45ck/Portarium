/**
 * AI-assisted scaffold prompt packs for adapter integration (bead-0742).
 *
 * Provides structured prompt templates that AI coding assistants (Claude Code,
 * Codex CLI) can use to generate MIS-compliant adapter implementations.
 * Each prompt pack contains:
 *   - System context describing the MIS contract
 *   - A structured task template with placeholders
 *   - Validation checklist the AI should verify before emitting code
 *
 * Also provides runtime validation guardrails that verify adapter
 * implementations conform to MIS contracts at registration time.
 */

import {
  MIS_V1,
  type MisAdapterMetaV1,
  type MisPortFamily,
} from './mis-v1.js';

// ---------------------------------------------------------------------------
// Prompt pack types
// ---------------------------------------------------------------------------

/**
 * A scaffold prompt pack is a self-contained unit the AI assistant uses
 * to generate a complete, MIS-compliant adapter skeleton.
 */
export interface ScaffoldPromptPackV1 {
  readonly schemaVersion: 1;
  /** Unique identifier for this prompt pack. */
  readonly packId: string;
  /** Human-readable name shown to the developer. */
  readonly displayName: string;
  /** Port family this pack targets. */
  readonly portFamily: MisPortFamily;
  /** System context injected before the user's request. */
  readonly systemContext: string;
  /** The structured task template with `{{placeholder}}` markers. */
  readonly taskTemplate: string;
  /** Validation checklist the AI should run before emitting code. */
  readonly validationChecklist: readonly string[];
  /** Example operations this adapter type typically supports. */
  readonly exampleOperations: readonly string[];
}

// ---------------------------------------------------------------------------
// Validation guardrails
// ---------------------------------------------------------------------------

export type GuardrailSeverity = 'error' | 'warning';

export interface GuardrailViolation {
  readonly rule: string;
  readonly severity: GuardrailSeverity;
  readonly message: string;
  readonly field?: string;
}

export interface GuardrailResult {
  readonly valid: boolean;
  readonly violations: readonly GuardrailViolation[];
}

/**
 * Validate adapter metadata against MIS v0.1 contract guardrails.
 *
 * Checks:
 *   1. schemaVersion matches MIS_V1
 *   2. adapterId is non-empty and follows kebab-case convention
 *   3. portFamily is a recognized MIS port family
 *   4. displayName is non-empty
 *   5. supportedOperations follow `entity:verb` format
 *   6. version follows semver-like pattern (if provided)
 */
export function validateAdapterMeta(meta: MisAdapterMetaV1): GuardrailResult {
  const violations: GuardrailViolation[] = [];

  // Rule 1: Schema version
  if (meta.schemaVersion !== MIS_V1.schemaVersion) {
    violations.push({
      rule: 'schema_version',
      severity: 'error',
      message: `schemaVersion must be ${MIS_V1.schemaVersion}, got ${meta.schemaVersion}`,
      field: 'schemaVersion',
    });
  }

  // Rule 2: Adapter ID format
  if (!meta.adapterId || meta.adapterId.trim().length === 0) {
    violations.push({
      rule: 'adapter_id_required',
      severity: 'error',
      message: 'adapterId must be a non-empty string',
      field: 'adapterId',
    });
  } else if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(meta.adapterId)) {
    violations.push({
      rule: 'adapter_id_format',
      severity: 'warning',
      message: `adapterId "${meta.adapterId}" should follow kebab-case convention (e.g. "acme-crm-v1")`,
      field: 'adapterId',
    });
  }

  // Rule 3: Port family
  if (!MIS_V1.portFamilies.includes(meta.portFamily)) {
    violations.push({
      rule: 'port_family_valid',
      severity: 'error',
      message: `portFamily "${meta.portFamily}" is not a recognized MIS v0.1 port family. Valid: ${MIS_V1.portFamilies.join(', ')}`,
      field: 'portFamily',
    });
  }

  // Rule 4: Display name
  if (!meta.displayName || meta.displayName.trim().length === 0) {
    violations.push({
      rule: 'display_name_required',
      severity: 'error',
      message: 'displayName must be a non-empty string',
      field: 'displayName',
    });
  }

  // Rule 5: Operation format
  if (meta.supportedOperations) {
    for (const op of meta.supportedOperations) {
      if (!/^[a-zA-Z][a-zA-Z0-9]*:[a-zA-Z][a-zA-Z0-9]*$/.test(op)) {
        violations.push({
          rule: 'operation_format',
          severity: 'warning',
          message: `Operation "${op}" should follow "entity:verb" format (e.g. "invoice:create")`,
          field: 'supportedOperations',
        });
      }
    }
  }

  // Rule 6: Version format
  if (meta.version !== undefined && !/^\d+\.\d+\.\d+/.test(meta.version)) {
    violations.push({
      rule: 'version_format',
      severity: 'warning',
      message: `version "${meta.version}" should follow semver format (e.g. "1.0.0")`,
      field: 'version',
    });
  }

  return {
    valid: violations.filter((v) => v.severity === 'error').length === 0,
    violations: Object.freeze([...violations]),
  };
}

/**
 * Validate that an adapter object structurally conforms to MisAdapterV1.
 *
 * This is a runtime structural check for adapters that may not use TypeScript
 * or may be loaded dynamically (e.g. from a plugin JAR or Python bridge).
 */
export function validateAdapterStructure(adapter: unknown): GuardrailResult {
  const violations: GuardrailViolation[] = [];

  if (adapter === null || adapter === undefined || typeof adapter !== 'object') {
    violations.push({
      rule: 'adapter_is_object',
      severity: 'error',
      message: 'Adapter must be a non-null object',
    });
    return { valid: false, violations: Object.freeze(violations) };
  }

  const obj = adapter as Record<string, unknown>;

  // Check meta
  if (!('meta' in obj) || typeof obj['meta'] !== 'object' || obj['meta'] === null) {
    violations.push({
      rule: 'meta_required',
      severity: 'error',
      message: 'Adapter must have a "meta" property of type object',
      field: 'meta',
    });
  }

  // Check required methods
  for (const method of MIS_V1.requiredMethods) {
    if (!(method in obj) || typeof obj[method] !== 'function') {
      violations.push({
        rule: 'method_required',
        severity: 'error',
        message: `Adapter must implement "${method}" as a function`,
        field: method,
      });
    }
  }

  return {
    valid: violations.filter((v) => v.severity === 'error').length === 0,
    violations: Object.freeze(violations),
  };
}

/**
 * Validate an adapter's health response conforms to the expected shape.
 */
export function validateHealthResponse(response: unknown): GuardrailResult {
  const violations: GuardrailViolation[] = [];

  if (response === null || response === undefined || typeof response !== 'object') {
    violations.push({
      rule: 'health_is_object',
      severity: 'error',
      message: 'Health response must be a non-null object',
    });
    return { valid: false, violations: Object.freeze(violations) };
  }

  const obj = response as Record<string, unknown>;
  const validStatuses = ['healthy', 'degraded', 'unhealthy'];

  if (!('status' in obj) || typeof obj['status'] !== 'string') {
    violations.push({
      rule: 'health_status_required',
      severity: 'error',
      message: 'Health response must have a "status" string property',
      field: 'status',
    });
  } else if (!validStatuses.includes(obj['status'])) {
    violations.push({
      rule: 'health_status_valid',
      severity: 'error',
      message: `Health status must be one of: ${validStatuses.join(', ')}`,
      field: 'status',
    });
  }

  if ('detail' in obj && typeof obj['detail'] !== 'string') {
    violations.push({
      rule: 'health_detail_type',
      severity: 'warning',
      message: 'Health detail should be a string if provided',
      field: 'detail',
    });
  }

  return {
    valid: violations.filter((v) => v.severity === 'error').length === 0,
    violations: Object.freeze(violations),
  };
}

/**
 * Validate an invoke result conforms to MisResult shape.
 */
export function validateInvokeResult(result: unknown): GuardrailResult {
  const violations: GuardrailViolation[] = [];

  if (result === null || result === undefined || typeof result !== 'object') {
    violations.push({
      rule: 'result_is_object',
      severity: 'error',
      message: 'Invoke result must be a non-null object',
    });
    return { valid: false, violations: Object.freeze(violations) };
  }

  const obj = result as Record<string, unknown>;

  if (!('ok' in obj) || typeof obj['ok'] !== 'boolean') {
    violations.push({
      rule: 'result_ok_required',
      severity: 'error',
      message: 'Invoke result must have a boolean "ok" property',
      field: 'ok',
    });
    return { valid: false, violations: Object.freeze(violations) };
  }

  if (obj['ok'] === true) {
    if (!('value' in obj)) {
      violations.push({
        rule: 'result_ok_value',
        severity: 'error',
        message: 'Successful result (ok=true) must have a "value" property',
        field: 'value',
      });
    }
  } else {
    if (!('code' in obj) || typeof obj['code'] !== 'string') {
      violations.push({
        rule: 'result_err_code',
        severity: 'error',
        message: 'Error result (ok=false) must have a string "code" property',
        field: 'code',
      });
    }
    if (!('message' in obj) || typeof obj['message'] !== 'string') {
      violations.push({
        rule: 'result_err_message',
        severity: 'error',
        message: 'Error result (ok=false) must have a string "message" property',
        field: 'message',
      });
    }
    if (!('retryable' in obj) || typeof obj['retryable'] !== 'boolean') {
      violations.push({
        rule: 'result_err_retryable',
        severity: 'error',
        message: 'Error result (ok=false) must have a boolean "retryable" property',
        field: 'retryable',
      });
    }
  }

  return {
    valid: violations.filter((v) => v.severity === 'error').length === 0,
    violations: Object.freeze(violations),
  };
}

// ---------------------------------------------------------------------------
// Scaffold prompt pack builder
// ---------------------------------------------------------------------------

const SYSTEM_CONTEXT_TEMPLATE = `You are generating a Portarium MIS v0.1 adapter integration.

The Minimal Integration Surface (MIS) requires every adapter to:
1. Export a class implementing \`MisAdapterV1\` with:
   - \`meta\`: Static metadata (adapterId, portFamily, displayName, schemaVersion: 1)
   - \`health()\`: Returns \`MisHealthResult\` with status: 'healthy' | 'degraded' | 'unhealthy'
   - \`invoke(operation, payload, ctx)\`: Returns \`MisResult<Record<string, unknown>>\`

2. Follow these conventions:
   - Operations use \`entity:verb\` format (e.g. "invoice:create", "account:list")
   - Use \`MisResult.ok(value)\` for success, \`MisResult.err(code, message, retryable)\` for failure
   - Include \`ctx.correlationId\` in all logs and external API calls
   - Respect \`ctx.dryRun\` — validate but skip side effects when true
   - Handle timeouts and return \`MisResult.err('TIMEOUT', ...)\` rather than throwing

3. Error codes: NOT_FOUND | UNAUTHORIZED | RATE_LIMITED | VALIDATION_FAILED | EXTERNAL_ERROR | TIMEOUT | INTERNAL_ERROR

Port family: {{portFamily}}
Adapter ID: {{adapterId}}`;

/**
 * Build a scaffold prompt pack for a specific port family.
 */
export function buildScaffoldPromptPack(params: {
  portFamily: MisPortFamily;
  adapterId: string;
  displayName: string;
  exampleOperations: string[];
}): ScaffoldPromptPackV1 {
  if (!MIS_V1.portFamilies.includes(params.portFamily)) {
    throw new Error(`Unknown port family: ${params.portFamily}`);
  }

  const systemContext = SYSTEM_CONTEXT_TEMPLATE.replace(
    '{{portFamily}}',
    params.portFamily,
  ).replace('{{adapterId}}', params.adapterId);

  const taskTemplate = [
    `Generate a complete MIS v0.1 adapter for "${params.displayName}".`,
    '',
    'Adapter metadata:',
    `  - adapterId: "${params.adapterId}"`,
    `  - portFamily: "${params.portFamily}"`,
    `  - displayName: "${params.displayName}"`,
    '',
    'Required operations:',
    ...params.exampleOperations.map((op) => `  - ${op}`),
    '',
    'Requirements:',
    '  1. Implement the MisAdapterV1 interface',
    '  2. Each operation must validate its payload before calling the external API',
    '  3. Map external API errors to MisErrorCode values',
    '  4. Include a health check that verifies connectivity',
    '  5. Support dry-run mode for all write operations',
    '  6. Include correlation ID in all external API calls',
  ].join('\n');

  const validationChecklist = [
    'meta.schemaVersion is exactly 1',
    'meta.adapterId follows kebab-case convention',
    `meta.portFamily is "${params.portFamily}"`,
    'health() returns MisHealthResult (not a raw string or boolean)',
    'invoke() returns MisResult, never throws for expected errors',
    'All operations follow entity:verb format',
    'MisResult.err() includes retryable flag set correctly',
    'ctx.dryRun is respected for all write operations',
    'ctx.correlationId is forwarded to external API calls',
    'TIMEOUT errors have retryable=true',
    'RATE_LIMITED errors have retryable=true',
    'UNAUTHORIZED errors have retryable=false',
  ];

  return Object.freeze({
    schemaVersion: 1,
    packId: `scaffold-${params.portFamily.toLowerCase()}-${params.adapterId}`,
    displayName: `${params.displayName} Adapter Scaffold`,
    portFamily: params.portFamily,
    systemContext,
    taskTemplate,
    validationChecklist: Object.freeze([...validationChecklist]),
    exampleOperations: Object.freeze([...params.exampleOperations]),
  });
}

// ---------------------------------------------------------------------------
// Pre-built prompt packs for common port families
// ---------------------------------------------------------------------------

/** Pre-built scaffold for a CRM/Sales adapter (Salesforce, HubSpot, etc.) */
export const CRM_SALES_PACK = buildScaffoldPromptPack({
  portFamily: 'CrmSales',
  adapterId: 'crm-adapter-v1',
  displayName: 'CRM Adapter',
  exampleOperations: [
    'account:list',
    'account:get',
    'account:create',
    'account:update',
    'contact:list',
    'contact:get',
    'opportunity:list',
    'opportunity:create',
  ],
});

/** Pre-built scaffold for a Finance/Accounting adapter (Odoo, ERPNext, etc.) */
export const FINANCE_ACCOUNTING_PACK = buildScaffoldPromptPack({
  portFamily: 'FinanceAccounting',
  adapterId: 'finance-adapter-v1',
  displayName: 'Finance Adapter',
  exampleOperations: [
    'invoice:list',
    'invoice:get',
    'invoice:create',
    'journal:list',
    'journal:post',
    'account:list',
    'period:close',
  ],
});

/** Pre-built scaffold for an ITSM/IT Ops adapter (ServiceNow, Jira SM, etc.) */
export const ITSM_IT_OPS_PACK = buildScaffoldPromptPack({
  portFamily: 'ItsmItOps',
  adapterId: 'itsm-adapter-v1',
  displayName: 'ITSM Adapter',
  exampleOperations: [
    'incident:list',
    'incident:get',
    'incident:create',
    'incident:resolve',
    'change:list',
    'change:create',
    'change:approve',
  ],
});
