import type { DocumentV1 } from '../../../domain/canonical/document-v1.js';
import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { TicketV1 } from '../../../domain/canonical/ticket-v1.js';
import { DocumentId, TicketId } from '../../../domain/primitives/index.js';
import type {
  ComplianceGrcAdapterPort,
  ComplianceGrcExecuteInputV1,
  ComplianceGrcExecuteOutputV1,
} from '../../../application/ports/compliance-grc-adapter.js';
import { COMPLIANCE_GRC_OPERATIONS_V1 } from '../../../application/ports/compliance-grc-adapter.js';

const OPERATION_SET = new Set<string>(COMPLIANCE_GRC_OPERATIONS_V1);
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
type TicketPriority = (typeof TICKET_PRIORITIES)[number];

type TenantExternalRef = Readonly<{
  tenantId: ComplianceGrcExecuteInputV1['tenantId'];
  externalRef: ExternalObjectRef;
}>;

type InMemoryComplianceGrcAdapterSeed = Readonly<{
  controls?: readonly TenantExternalRef[];
  risks?: readonly TenantExternalRef[];
  policies?: readonly TenantExternalRef[];
  audits?: readonly TenantExternalRef[];
  findings?: readonly TicketV1[];
  evidenceRequests?: readonly TenantExternalRef[];
  frameworks?: readonly TenantExternalRef[];
}>;

type InMemoryComplianceGrcAdapterParams = Readonly<{
  seed?: InMemoryComplianceGrcAdapterSeed;
  now?: () => Date;
}>;

function readString(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readTicketPriority(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): TicketPriority | null {
  const value = payload?.[key];
  if (typeof value !== 'string') return null;
  return TICKET_PRIORITIES.includes(value as TicketPriority) ? (value as TicketPriority) : null;
}

function readNumber(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): number | null {
  const value = payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export class InMemoryComplianceGrcAdapter implements ComplianceGrcAdapterPort {
  readonly #now: () => Date;
  readonly #controls: TenantExternalRef[];
  readonly #risks: TenantExternalRef[];
  readonly #policies: TenantExternalRef[];
  readonly #audits: TenantExternalRef[];
  readonly #findings: TicketV1[];
  readonly #evidenceRequests: TenantExternalRef[];
  readonly #frameworks: TenantExternalRef[];
  #controlSequence: number;
  #riskSequence: number;
  #policySequence: number;
  #auditSequence: number;
  #findingSequence: number;
  #evidenceSequence: number;
  #frameworkMapSequence: number;

  public constructor(params?: InMemoryComplianceGrcAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#controls = [...(params?.seed?.controls ?? [])];
    this.#risks = [...(params?.seed?.risks ?? [])];
    this.#policies = [...(params?.seed?.policies ?? [])];
    this.#audits = [...(params?.seed?.audits ?? [])];
    this.#findings = [...(params?.seed?.findings ?? [])];
    this.#evidenceRequests = [...(params?.seed?.evidenceRequests ?? [])];
    this.#frameworks = [...(params?.seed?.frameworks ?? [])];
    this.#controlSequence = this.#controls.length;
    this.#riskSequence = this.#risks.length;
    this.#policySequence = this.#policies.length;
    this.#auditSequence = this.#audits.length;
    this.#findingSequence = this.#findings.length;
    this.#evidenceSequence = 0;
    this.#frameworkMapSequence = 0;
  }

  public async execute(input: ComplianceGrcExecuteInputV1): Promise<ComplianceGrcExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported ComplianceGrc operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'listControls':
        return {
          ok: true,
          result: {
            kind: 'externalRefs',
            externalRefs: this.#listTenantRefs(this.#controls, input),
          },
        };
      case 'getControl':
        return this.#getTenantRef(input, this.#controls, 'controlId', 'Control', 'getControl');
      case 'createControl':
        return this.#createControl(input);
      case 'updateControlStatus':
        return this.#updateControlStatus(input);
      case 'listRisks':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#risks, input) },
        };
      case 'getRisk':
        return this.#getTenantRef(input, this.#risks, 'riskId', 'Risk', 'getRisk');
      case 'createRisk':
        return this.#createRisk(input);
      case 'assessRisk':
        return this.#assessRisk(input);
      case 'listPolicies':
        return {
          ok: true,
          result: {
            kind: 'externalRefs',
            externalRefs: this.#listTenantRefs(this.#policies, input),
          },
        };
      case 'getPolicy':
        return this.#getTenantRef(input, this.#policies, 'policyId', 'Policy', 'getPolicy');
      case 'createPolicy':
        return this.#createPolicy(input);
      case 'publishPolicy':
        return this.#publishPolicy(input);
      case 'listAudits':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#audits, input) },
        };
      case 'getAudit':
        return this.#getTenantRef(input, this.#audits, 'auditId', 'Audit', 'getAudit');
      case 'createAudit':
        return this.#createAudit(input);
      case 'listFindings':
        return { ok: true, result: { kind: 'tickets', tickets: this.#listFindings(input) } };
      case 'createFinding':
        return this.#createFinding(input);
      case 'listEvidenceRequests':
        return {
          ok: true,
          result: {
            kind: 'externalRefs',
            externalRefs: this.#listTenantRefs(this.#evidenceRequests, input),
          },
        };
      case 'uploadEvidence':
        return this.#uploadEvidence(input);
      case 'listFrameworks':
        return {
          ok: true,
          result: {
            kind: 'externalRefs',
            externalRefs: this.#listTenantRefs(this.#frameworks, input),
          },
        };
      case 'getFramework':
        return this.#getTenantRef(
          input,
          this.#frameworks,
          'frameworkId',
          'Framework',
          'getFramework',
        );
      case 'mapControlToFramework':
        return this.#mapControlToFramework(input);
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported ComplianceGrc operation: ${String(input.operation)}.`,
        };
    }
  }

  #createControl(input: ComplianceGrcExecuteInputV1): ComplianceGrcExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createControl.',
      };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'GrcSuite',
      portFamily: 'ComplianceGrc',
      externalId: `control-${++this.#controlSequence}`,
      externalType: 'control',
      displayLabel: name,
    };
    this.#controls.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #updateControlStatus(input: ComplianceGrcExecuteInputV1): ComplianceGrcExecuteOutputV1 {
    const controlId = readString(input.payload, 'controlId');
    if (controlId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'controlId is required for updateControlStatus.',
      };
    }
    const status = readString(input.payload, 'status');
    if (status === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'status is required for updateControlStatus.',
      };
    }
    const control = this.#controls.find(
      (entry) => entry.tenantId === input.tenantId && entry.externalRef.externalId === controlId,
    );
    if (control === undefined) {
      return { ok: false, error: 'not_found', message: `Control ${controlId} was not found.` };
    }
    void control;

    const externalRef: ExternalObjectRef = {
      sorName: 'GrcSuite',
      portFamily: 'ComplianceGrc',
      externalId: controlId,
      externalType: 'control',
      displayLabel: `Control ${controlId} status=${status}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #createRisk(input: ComplianceGrcExecuteInputV1): ComplianceGrcExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return { ok: false, error: 'validation_error', message: 'name is required for createRisk.' };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'GrcSuite',
      portFamily: 'ComplianceGrc',
      externalId: `risk-${++this.#riskSequence}`,
      externalType: 'risk',
      displayLabel: name,
    };
    this.#risks.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #assessRisk(input: ComplianceGrcExecuteInputV1): ComplianceGrcExecuteOutputV1 {
    const riskId = readString(input.payload, 'riskId');
    if (riskId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'riskId is required for assessRisk.',
      };
    }
    const risk = this.#risks.find(
      (entry) => entry.tenantId === input.tenantId && entry.externalRef.externalId === riskId,
    );
    if (risk === undefined) {
      return { ok: false, error: 'not_found', message: `Risk ${riskId} was not found.` };
    }
    void risk;

    const score = readNumber(input.payload, 'score');
    const label =
      score === null ? `Risk assessment for ${riskId}` : `Risk assessment ${riskId} score=${score}`;
    const externalRef: ExternalObjectRef = {
      sorName: 'GrcSuite',
      portFamily: 'ComplianceGrc',
      externalId: `risk-assessment-${riskId}`,
      externalType: 'risk_assessment',
      displayLabel: label,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #createPolicy(input: ComplianceGrcExecuteInputV1): ComplianceGrcExecuteOutputV1 {
    const title = readString(input.payload, 'title');
    if (title === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'title is required for createPolicy.',
      };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'GrcSuite',
      portFamily: 'ComplianceGrc',
      externalId: `policy-${++this.#policySequence}`,
      externalType: 'policy',
      displayLabel: title,
    };
    this.#policies.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #publishPolicy(input: ComplianceGrcExecuteInputV1): ComplianceGrcExecuteOutputV1 {
    const policyId = readString(input.payload, 'policyId');
    if (policyId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'policyId is required for publishPolicy.',
      };
    }
    const policy = this.#policies.find(
      (entry) => entry.tenantId === input.tenantId && entry.externalRef.externalId === policyId,
    );
    if (policy === undefined) {
      return { ok: false, error: 'not_found', message: `Policy ${policyId} was not found.` };
    }
    void policy;

    const externalRef: ExternalObjectRef = {
      sorName: 'GrcSuite',
      portFamily: 'ComplianceGrc',
      externalId: policyId,
      externalType: 'policy',
      displayLabel: `Published ${policyId}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #createAudit(input: ComplianceGrcExecuteInputV1): ComplianceGrcExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return { ok: false, error: 'validation_error', message: 'name is required for createAudit.' };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'GrcSuite',
      portFamily: 'ComplianceGrc',
      externalId: `audit-${++this.#auditSequence}`,
      externalType: 'audit',
      displayLabel: name,
    };
    this.#audits.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #listFindings(input: ComplianceGrcExecuteInputV1): readonly TicketV1[] {
    return this.#findings.filter((finding) => finding.tenantId === input.tenantId);
  }

  #createFinding(input: ComplianceGrcExecuteInputV1): ComplianceGrcExecuteOutputV1 {
    const subject = readString(input.payload, 'subject');
    if (subject === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'subject is required for createFinding.',
      };
    }
    const priority = readTicketPriority(input.payload, 'priority');

    const finding: TicketV1 = {
      ticketId: TicketId(`finding-${++this.#findingSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      subject,
      status: 'open',
      ...(priority !== null ? { priority } : {}),
      createdAtIso: this.#now().toISOString(),
    };
    this.#findings.push(finding);
    return { ok: true, result: { kind: 'ticket', ticket: finding } };
  }

  #uploadEvidence(input: ComplianceGrcExecuteInputV1): ComplianceGrcExecuteOutputV1 {
    const title = readString(input.payload, 'title');
    if (title === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'title is required for uploadEvidence.',
      };
    }

    const sizeBytes = readNumber(input.payload, 'sizeBytes');
    if (sizeBytes !== null && sizeBytes < 0) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'sizeBytes must be a non-negative number for uploadEvidence.',
      };
    }

    const document: DocumentV1 = {
      documentId: DocumentId(`evidence-${++this.#evidenceSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      title,
      mimeType:
        typeof input.payload?.['mimeType'] === 'string'
          ? input.payload['mimeType']
          : 'application/pdf',
      ...(sizeBytes !== null ? { sizeBytes } : {}),
      createdAtIso: this.#now().toISOString(),
    };
    return { ok: true, result: { kind: 'document', document } };
  }

  #mapControlToFramework(input: ComplianceGrcExecuteInputV1): ComplianceGrcExecuteOutputV1 {
    const controlRef = readString(input.payload, 'controlRef');
    if (controlRef === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'controlRef is required for mapControlToFramework.',
      };
    }
    const frameworkRef = readString(input.payload, 'frameworkRef');
    if (frameworkRef === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'frameworkRef is required for mapControlToFramework.',
      };
    }

    const control = this.#controls.find(
      (entry) => entry.tenantId === input.tenantId && entry.externalRef.externalId === controlRef,
    );
    if (control === undefined) {
      return { ok: false, error: 'not_found', message: `Control ${controlRef} was not found.` };
    }
    const framework = this.#frameworks.find(
      (entry) => entry.tenantId === input.tenantId && entry.externalRef.externalId === frameworkRef,
    );
    if (framework === undefined) {
      return { ok: false, error: 'not_found', message: `Framework ${frameworkRef} was not found.` };
    }
    void control;
    void framework;

    const externalRef: ExternalObjectRef = {
      sorName: 'GrcSuite',
      portFamily: 'ComplianceGrc',
      externalId: `control-framework-map-${++this.#frameworkMapSequence}`,
      externalType: 'control_framework_mapping',
      displayLabel: `Mapped ${controlRef} to ${frameworkRef}`,
    };
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #listTenantRefs(
    source: readonly TenantExternalRef[],
    input: ComplianceGrcExecuteInputV1,
  ): readonly ExternalObjectRef[] {
    return source
      .filter((entry) => entry.tenantId === input.tenantId)
      .map((entry) => entry.externalRef);
  }

  #getTenantRef(
    input: ComplianceGrcExecuteInputV1,
    source: readonly TenantExternalRef[],
    key: string,
    label: string,
    operationName: string,
  ): ComplianceGrcExecuteOutputV1 {
    const externalId = readString(input.payload, key);
    if (externalId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: `${key} is required for ${operationName}.`,
      };
    }
    const found = source.find(
      (entry) => entry.tenantId === input.tenantId && entry.externalRef.externalId === externalId,
    );
    if (found === undefined) {
      return { ok: false, error: 'not_found', message: `${label} ${externalId} was not found.` };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef: found.externalRef } };
  }

  public static seedMinimal(
    tenantId: ComplianceGrcExecuteInputV1['tenantId'],
  ): InMemoryComplianceGrcAdapterSeed {
    return {
      controls: [
        {
          tenantId,
          externalRef: {
            sorName: 'GrcSuite',
            portFamily: 'ComplianceGrc',
            externalId: 'control-1000',
            externalType: 'control',
            displayLabel: 'Access review control',
          },
        },
      ],
      risks: [
        {
          tenantId,
          externalRef: {
            sorName: 'GrcSuite',
            portFamily: 'ComplianceGrc',
            externalId: 'risk-1000',
            externalType: 'risk',
            displayLabel: 'Unpatched host risk',
          },
        },
      ],
      policies: [
        {
          tenantId,
          externalRef: {
            sorName: 'GrcSuite',
            portFamily: 'ComplianceGrc',
            externalId: 'policy-1000',
            externalType: 'policy',
            displayLabel: 'Access Control Policy',
          },
        },
      ],
      audits: [
        {
          tenantId,
          externalRef: {
            sorName: 'GrcSuite',
            portFamily: 'ComplianceGrc',
            externalId: 'audit-1000',
            externalType: 'audit',
            displayLabel: 'SOC 2 Type II FY26',
          },
        },
      ],
      findings: [
        {
          ticketId: TicketId('finding-1000'),
          tenantId,
          schemaVersion: 1,
          subject: 'MFA enforcement gap',
          status: 'open',
          priority: 'high',
          createdAtIso: '2026-02-19T00:00:00.000Z',
        },
      ],
      evidenceRequests: [
        {
          tenantId,
          externalRef: {
            sorName: 'GrcSuite',
            portFamily: 'ComplianceGrc',
            externalId: 'evidence-request-1000',
            externalType: 'evidence_request',
            displayLabel: 'Q1 access review evidence',
          },
        },
      ],
      frameworks: [
        {
          tenantId,
          externalRef: {
            sorName: 'GrcSuite',
            portFamily: 'ComplianceGrc',
            externalId: 'framework-1000',
            externalType: 'framework',
            displayLabel: 'SOC 2',
          },
        },
      ],
    };
  }
}
