import type { DocumentV1 } from '../../../domain/canonical/document-v1.js';
import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../../domain/canonical/party-v1.js';
import type { TicketV1 } from '../../../domain/canonical/ticket-v1.js';
import { DocumentId, PartyId, TicketId } from '../../../domain/primitives/index.js';
import type {
  CustomerSupportAdapterPort,
  CustomerSupportExecuteInputV1,
  CustomerSupportExecuteOutputV1,
} from '../../../application/ports/customer-support-adapter.js';
import { CUSTOMER_SUPPORT_OPERATIONS_V1 } from '../../../application/ports/customer-support-adapter.js';

const OPERATION_SET = new Set<string>(CUSTOMER_SUPPORT_OPERATIONS_V1);
const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;
type TicketStatus = (typeof TICKET_STATUSES)[number];
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
type TicketPriority = (typeof TICKET_PRIORITIES)[number];

type TenantExternalRef = Readonly<{
  tenantId: CustomerSupportExecuteInputV1['tenantId'];
  externalRef: ExternalObjectRef;
}>;

type TicketExternalRef = Readonly<{
  tenantId: CustomerSupportExecuteInputV1['tenantId'];
  ticketId: string;
  externalRef: ExternalObjectRef;
}>;

type InMemoryCustomerSupportAdapterSeed = Readonly<{
  tickets?: readonly TicketV1[];
  agents?: readonly PartyV1[];
  comments?: readonly TicketExternalRef[];
  tags?: readonly TenantExternalRef[];
  knowledgeArticles?: readonly DocumentV1[];
  slaRefs?: readonly TicketExternalRef[];
  csatRatings?: readonly TenantExternalRef[];
}>;

type InMemoryCustomerSupportAdapterParams = Readonly<{
  seed?: InMemoryCustomerSupportAdapterSeed;
  now?: () => Date;
}>;

function readString(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | null {
  const value = payload?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readTicketStatus(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): TicketStatus | null {
  const value = payload?.[key];
  if (typeof value !== 'string') return null;
  return TICKET_STATUSES.includes(value as TicketStatus) ? (value as TicketStatus) : null;
}

function readTicketPriority(
  payload: Readonly<Record<string, unknown>> | undefined,
  key: string,
): TicketPriority | null {
  const value = payload?.[key];
  if (typeof value !== 'string') return null;
  return TICKET_PRIORITIES.includes(value as TicketPriority) ? (value as TicketPriority) : null;
}

export class InMemoryCustomerSupportAdapter implements CustomerSupportAdapterPort {
  readonly #now: () => Date;
  readonly #tickets: TicketV1[];
  readonly #agents: PartyV1[];
  readonly #comments: TicketExternalRef[];
  readonly #tags: TenantExternalRef[];
  readonly #knowledgeArticles: DocumentV1[];
  readonly #slaRefs: TicketExternalRef[];
  readonly #csatRatings: TenantExternalRef[];
  #ticketSequence: number;
  #commentSequence: number;
  #tagSequence: number;

  public constructor(params?: InMemoryCustomerSupportAdapterParams) {
    this.#now = params?.now ?? (() => new Date());
    this.#tickets = [...(params?.seed?.tickets ?? [])];
    this.#agents = [...(params?.seed?.agents ?? [])];
    this.#comments = [...(params?.seed?.comments ?? [])];
    this.#tags = [...(params?.seed?.tags ?? [])];
    this.#knowledgeArticles = [...(params?.seed?.knowledgeArticles ?? [])];
    this.#slaRefs = [...(params?.seed?.slaRefs ?? [])];
    this.#csatRatings = [...(params?.seed?.csatRatings ?? [])];
    this.#ticketSequence = this.#tickets.length;
    this.#commentSequence = this.#comments.length;
    this.#tagSequence = this.#tags.length;
  }

  public async execute(
    input: CustomerSupportExecuteInputV1,
  ): Promise<CustomerSupportExecuteOutputV1> {
    if (!OPERATION_SET.has(input.operation as string)) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported CustomerSupport operation: ${String(input.operation)}.`,
      };
    }

    switch (input.operation) {
      case 'listTickets':
        return { ok: true, result: { kind: 'tickets', tickets: this.#listTickets(input) } };
      case 'getTicket':
        return this.#getTicket(input);
      case 'createTicket':
        return this.#createTicket(input);
      case 'updateTicket':
        return this.#updateTicket(input);
      case 'closeTicket':
        return this.#closeTicket(input);
      case 'listAgents':
        return { ok: true, result: { kind: 'agents', agents: this.#listAgents(input) } };
      case 'assignTicket':
        return this.#assignTicket(input);
      case 'addComment':
        return this.#addComment(input);
      case 'listComments':
        return this.#listComments(input);
      case 'listTags':
        return {
          ok: true,
          result: { kind: 'externalRefs', externalRefs: this.#listTenantRefs(this.#tags, input) },
        };
      case 'createTag':
        return this.#createTag(input);
      case 'getKnowledgeArticle':
        return this.#getKnowledgeArticle(input);
      case 'listKnowledgeArticles':
        return {
          ok: true,
          result: { kind: 'documents', documents: this.#listKnowledgeArticles(input) },
        };
      case 'getSLA':
        return this.#getSLA(input);
      case 'listCustomerSatisfactionRatings':
        return {
          ok: true,
          result: {
            kind: 'externalRefs',
            externalRefs: this.#listTenantRefs(this.#csatRatings, input),
          },
        };
      default:
        return {
          ok: false,
          error: 'unsupported_operation',
          message: `Unsupported CustomerSupport operation: ${String(input.operation)}.`,
        };
    }
  }

  #listTickets(input: CustomerSupportExecuteInputV1): readonly TicketV1[] {
    return this.#tickets.filter((ticket) => ticket.tenantId === input.tenantId);
  }

  #getTicket(input: CustomerSupportExecuteInputV1): CustomerSupportExecuteOutputV1 {
    const ticketId = readString(input.payload, 'ticketId');
    if (ticketId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'ticketId is required for getTicket.',
      };
    }
    const ticket = this.#tickets.find(
      (item) => item.tenantId === input.tenantId && item.ticketId === ticketId,
    );
    if (ticket === undefined) {
      return { ok: false, error: 'not_found', message: `Ticket ${ticketId} was not found.` };
    }
    return { ok: true, result: { kind: 'ticket', ticket } };
  }

  #createTicket(input: CustomerSupportExecuteInputV1): CustomerSupportExecuteOutputV1 {
    const subject = readString(input.payload, 'subject');
    if (subject === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'subject is required for createTicket.',
      };
    }
    const ticket: TicketV1 = {
      ticketId: TicketId(`ticket-${++this.#ticketSequence}`),
      tenantId: input.tenantId,
      schemaVersion: 1,
      subject,
      status: readTicketStatus(input.payload, 'status') ?? 'open',
      ...(readTicketPriority(input.payload, 'priority') !== null
        ? { priority: readTicketPriority(input.payload, 'priority')! }
        : {}),
      ...(typeof input.payload?.['assigneeId'] === 'string'
        ? { assigneeId: input.payload['assigneeId'] }
        : {}),
      createdAtIso: this.#now().toISOString(),
    };
    this.#tickets.push(ticket);
    return { ok: true, result: { kind: 'ticket', ticket } };
  }

  #updateTicket(input: CustomerSupportExecuteInputV1): CustomerSupportExecuteOutputV1 {
    const ticketId = readString(input.payload, 'ticketId');
    if (ticketId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'ticketId is required for updateTicket.',
      };
    }
    const index = this.#tickets.findIndex(
      (ticket) => ticket.tenantId === input.tenantId && ticket.ticketId === ticketId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Ticket ${ticketId} was not found.` };
    }

    const statusValue = input.payload?.['status'];
    if (statusValue !== undefined && readTicketStatus(input.payload, 'status') === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'status must be one of: open, pending, resolved, closed.',
      };
    }
    const priorityValue = input.payload?.['priority'];
    if (priorityValue !== undefined && readTicketPriority(input.payload, 'priority') === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'priority must be one of: low, medium, high, urgent.',
      };
    }

    const updated: TicketV1 = {
      ...this.#tickets[index]!,
      ...(typeof input.payload?.['subject'] === 'string'
        ? { subject: input.payload['subject'] }
        : {}),
      ...(readTicketStatus(input.payload, 'status') !== null
        ? { status: readTicketStatus(input.payload, 'status')! }
        : {}),
      ...(readTicketPriority(input.payload, 'priority') !== null
        ? { priority: readTicketPriority(input.payload, 'priority')! }
        : {}),
      ...(typeof input.payload?.['assigneeId'] === 'string'
        ? { assigneeId: input.payload['assigneeId'] }
        : {}),
    };
    this.#tickets[index] = updated;
    return { ok: true, result: { kind: 'ticket', ticket: updated } };
  }

  #closeTicket(input: CustomerSupportExecuteInputV1): CustomerSupportExecuteOutputV1 {
    const ticketId = readString(input.payload, 'ticketId');
    if (ticketId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'ticketId is required for closeTicket.',
      };
    }
    const index = this.#tickets.findIndex(
      (ticket) => ticket.tenantId === input.tenantId && ticket.ticketId === ticketId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Ticket ${ticketId} was not found.` };
    }
    const closed: TicketV1 = { ...this.#tickets[index]!, status: 'closed' };
    this.#tickets[index] = closed;
    return { ok: true, result: { kind: 'ticket', ticket: closed } };
  }

  #listAgents(input: CustomerSupportExecuteInputV1): readonly PartyV1[] {
    return this.#agents.filter((agent) => agent.tenantId === input.tenantId);
  }

  #assignTicket(input: CustomerSupportExecuteInputV1): CustomerSupportExecuteOutputV1 {
    const ticketId = readString(input.payload, 'ticketId');
    if (ticketId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'ticketId is required for assignTicket.',
      };
    }
    const assigneeId = readString(input.payload, 'assigneeId');
    if (assigneeId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'assigneeId is required for assignTicket.',
      };
    }

    const agent = this.#agents.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.partyId === assigneeId,
    );
    if (agent === undefined) {
      return { ok: false, error: 'not_found', message: `Agent ${assigneeId} was not found.` };
    }

    const index = this.#tickets.findIndex(
      (ticket) => ticket.tenantId === input.tenantId && ticket.ticketId === ticketId,
    );
    if (index < 0) {
      return { ok: false, error: 'not_found', message: `Ticket ${ticketId} was not found.` };
    }
    const updated: TicketV1 = { ...this.#tickets[index]!, assigneeId: agent.partyId };
    this.#tickets[index] = updated;
    return { ok: true, result: { kind: 'ticket', ticket: updated } };
  }

  #addComment(input: CustomerSupportExecuteInputV1): CustomerSupportExecuteOutputV1 {
    const ticketId = readString(input.payload, 'ticketId');
    if (ticketId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'ticketId is required for addComment.',
      };
    }
    const content = readString(input.payload, 'content');
    if (content === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'content is required for addComment.',
      };
    }
    const ticket = this.#tickets.find(
      (candidate) => candidate.tenantId === input.tenantId && candidate.ticketId === ticketId,
    );
    if (ticket === undefined) {
      return { ok: false, error: 'not_found', message: `Ticket ${ticketId} was not found.` };
    }

    const externalRef: ExternalObjectRef = {
      sorName: 'SupportSuite',
      portFamily: 'CustomerSupport',
      externalId: `comment-${++this.#commentSequence}`,
      externalType: 'ticket_comment',
      displayLabel: content.slice(0, 40),
    };
    this.#comments.push({ tenantId: input.tenantId, ticketId: ticket.ticketId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #listComments(input: CustomerSupportExecuteInputV1): CustomerSupportExecuteOutputV1 {
    const ticketId = readString(input.payload, 'ticketId');
    if (ticketId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'ticketId is required for listComments.',
      };
    }
    const comments = this.#comments
      .filter((comment) => comment.tenantId === input.tenantId && comment.ticketId === ticketId)
      .map((comment) => comment.externalRef);
    return { ok: true, result: { kind: 'externalRefs', externalRefs: comments } };
  }

  #createTag(input: CustomerSupportExecuteInputV1): CustomerSupportExecuteOutputV1 {
    const name = readString(input.payload, 'name');
    if (name === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'name is required for createTag.',
      };
    }
    const externalRef: ExternalObjectRef = {
      sorName: 'SupportSuite',
      portFamily: 'CustomerSupport',
      externalId: `tag-${++this.#tagSequence}`,
      externalType: 'ticket_tag',
      displayLabel: name,
    };
    this.#tags.push({ tenantId: input.tenantId, externalRef });
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  #getKnowledgeArticle(input: CustomerSupportExecuteInputV1): CustomerSupportExecuteOutputV1 {
    const documentId = readString(input.payload, 'documentId');
    if (documentId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'documentId is required for getKnowledgeArticle.',
      };
    }
    const article = this.#knowledgeArticles.find(
      (item) => item.tenantId === input.tenantId && item.documentId === documentId,
    );
    if (article === undefined) {
      return {
        ok: false,
        error: 'not_found',
        message: `Knowledge article ${documentId} was not found.`,
      };
    }
    return { ok: true, result: { kind: 'document', document: article } };
  }

  #listKnowledgeArticles(input: CustomerSupportExecuteInputV1): readonly DocumentV1[] {
    return this.#knowledgeArticles.filter((article) => article.tenantId === input.tenantId);
  }

  #getSLA(input: CustomerSupportExecuteInputV1): CustomerSupportExecuteOutputV1 {
    const ticketId = readString(input.payload, 'ticketId');
    if (ticketId === null) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'ticketId is required for getSLA.',
      };
    }
    const sla = this.#slaRefs.find(
      (item) => item.tenantId === input.tenantId && item.ticketId === ticketId,
    );
    if (sla === undefined) {
      return {
        ok: false,
        error: 'not_found',
        message: `SLA for ticket ${ticketId} was not found.`,
      };
    }
    return { ok: true, result: { kind: 'externalRef', externalRef: sla.externalRef } };
  }

  #listTenantRefs(
    source: readonly TenantExternalRef[],
    input: CustomerSupportExecuteInputV1,
  ): readonly ExternalObjectRef[] {
    return source
      .filter((item) => item.tenantId === input.tenantId)
      .map((item) => item.externalRef);
  }

  public static seedMinimal(
    tenantId: CustomerSupportExecuteInputV1['tenantId'],
  ): InMemoryCustomerSupportAdapterSeed {
    return {
      tickets: [
        {
          ticketId: TicketId('ticket-1000'),
          tenantId,
          schemaVersion: 1,
          subject: 'Default support request',
          status: 'open',
          priority: 'medium',
          createdAtIso: '2026-01-01T00:00:00.000Z',
        },
      ],
      agents: [
        {
          partyId: PartyId('agent-1000'),
          tenantId,
          schemaVersion: 1,
          displayName: 'Support Agent',
          roles: ['user'],
        },
      ],
      comments: [
        {
          tenantId,
          ticketId: 'ticket-1000',
          externalRef: {
            sorName: 'SupportSuite',
            portFamily: 'CustomerSupport',
            externalId: 'comment-1000',
            externalType: 'ticket_comment',
            displayLabel: 'Initial triage note',
          },
        },
      ],
      tags: [
        {
          tenantId,
          externalRef: {
            sorName: 'SupportSuite',
            portFamily: 'CustomerSupport',
            externalId: 'tag-1000',
            externalType: 'ticket_tag',
            displayLabel: 'billing',
          },
        },
      ],
      knowledgeArticles: [
        {
          documentId: DocumentId('kb-1000'),
          tenantId,
          schemaVersion: 1,
          title: 'How to Reset API Tokens',
          mimeType: 'text/markdown',
          createdAtIso: '2026-01-01T00:00:00.000Z',
        },
      ],
      slaRefs: [
        {
          tenantId,
          ticketId: 'ticket-1000',
          externalRef: {
            sorName: 'SupportSuite',
            portFamily: 'CustomerSupport',
            externalId: 'sla-1000',
            externalType: 'sla_policy',
            displayLabel: 'Standard SLA',
          },
        },
      ],
      csatRatings: [
        {
          tenantId,
          externalRef: {
            sorName: 'SupportSuite',
            portFamily: 'CustomerSupport',
            externalId: 'csat-1000',
            externalType: 'csat_rating',
            displayLabel: '5 - Satisfied',
          },
        },
      ],
    };
  }
}
