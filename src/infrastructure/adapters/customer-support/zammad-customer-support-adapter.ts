/**
 * Zammad reference adapter for the CustomerSupport port family.
 *
 * Implements `CustomerSupportAdapterPort` against Zammad's REST API v1.
 * Zammad is an open-source helpdesk / ticketing system that supports:
 *   - Ticket management (create, update, close, list, get)
 *   - Ticket articles (comments / notes)
 *   - Agent (user) management
 *   - Tags on tickets
 *   - Knowledge base articles
 *   - SLA policies
 *   - Customer satisfaction (CSAT) ratings
 *
 * Authentication: HTTP Token auth (`Authorization: Token token=<api-token>`).
 * Base URL example: https://zammad.example.com
 *
 * All Zammad API references: https://docs.zammad.org/en/latest/api/index.html
 *
 * Bead: bead-0423
 */

import type {
  CustomerSupportAdapterPort,
  CustomerSupportExecuteInputV1,
  CustomerSupportExecuteOutputV1,
  CustomerSupportOperationV1,
} from '../../../application/ports/customer-support-adapter.js';
import {
  type ZammadAdapterConfig,
  toStr,
  CANONICAL_TO_ZAMMAD_STATUS,
  makeExternalRef,
  makeTagRef,
  mapZammadArticleToExternalRef,
  mapZammadKbArticleToDocument,
  mapZammadTicketToTicket,
  mapZammadUserToParty,
} from './zammad-customer-support-mappers.js';

export type { ZammadAdapterConfig };

type FetchFn = typeof fetch;

interface ZammadResponse<T> {
  data: T;
  status: number;
}

type OpHandler = (input: CustomerSupportExecuteInputV1) => Promise<CustomerSupportExecuteOutputV1>;

// ── Adapter ───────────────────────────────────────────────────────────────

export class ZammadCustomerSupportAdapter implements CustomerSupportAdapterPort {
  readonly #config: ZammadAdapterConfig;
  readonly #fetch: FetchFn;
  readonly #authHeader: string;
  readonly #ops: ReadonlyMap<CustomerSupportOperationV1, OpHandler>;

  constructor(config: ZammadAdapterConfig, fetchFn: FetchFn = fetch) {
    this.#config = config;
    this.#fetch = fetchFn;
    this.#authHeader = `Token token=${config.apiToken}`;
    this.#ops = new Map<CustomerSupportOperationV1, OpHandler>([
      ['listTickets', (i) => this.#listTickets(i)],
      ['getTicket', (i) => this.#getTicket(i)],
      ['createTicket', (i) => this.#createTicket(i)],
      ['updateTicket', (i) => this.#updateTicket(i)],
      ['closeTicket', (i) => this.#closeTicket(i)],
      ['listAgents', (i) => this.#listAgents(i)],
      ['assignTicket', (i) => this.#assignTicket(i)],
      ['addComment', (i) => this.#addComment(i)],
      ['listComments', (i) => this.#listComments(i)],
      ['listTags', (i) => this.#listTags(i)],
      ['createTag', (i) => this.#createTag(i)],
      ['getKnowledgeArticle', (i) => this.#getKnowledgeArticle(i)],
      ['listKnowledgeArticles', (i) => this.#listKnowledgeArticles(i)],
      ['getSLA', (i) => this.#getSLA(i)],
      ['listCustomerSatisfactionRatings', (i) => this.#listCsatRatings(i)],
    ]);
  }

  async execute(input: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const handler = this.#ops.get(input.operation);
    if (!handler) {
      return {
        ok: false,
        error: 'unsupported_operation',
        message: `Unsupported: ${input.operation}`,
      };
    }
    try {
      return await handler(input);
    } catch (err) {
      return {
        ok: false,
        error: 'provider_error',
        message: `Zammad API error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ── Tickets ───────────────────────────────────────────────────────────────

  async #listTickets(i: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const { data } = await this.#get<Record<string, unknown>[]>('tickets');
    const tickets = data.map((t) => mapZammadTicketToTicket(t, String(i.tenantId)));
    return { ok: true, result: { kind: 'tickets', tickets } };
  }

  async #getTicket(i: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const ticketId = toStr(i.payload?.['ticketId']);
    if (!ticketId) return validationError('ticketId is required.');
    const { data } = await this.#get<Record<string, unknown>>(`tickets/${ticketId}`);
    if (!data['id']) return notFoundError(`Ticket ${ticketId} not found.`);
    return {
      ok: true,
      result: { kind: 'ticket', ticket: mapZammadTicketToTicket(data, String(i.tenantId)) },
    };
  }

  async #createTicket(i: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const subject = toStr(i.payload?.['subject']);
    if (!subject) return validationError('subject is required.');
    const { data } = await this.#post<Record<string, unknown>>(
      'tickets',
      buildCreateBody(subject, i.payload ?? {}),
    );
    return {
      ok: true,
      result: { kind: 'ticket', ticket: mapZammadTicketToTicket(data, String(i.tenantId)) },
    };
  }

  async #updateTicket(i: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const ticketId = toStr(i.payload?.['ticketId']);
    if (!ticketId) return validationError('ticketId is required.');
    const body = buildUpdateBody(i.payload ?? {});
    const { data } = await this.#put<Record<string, unknown>>(`tickets/${ticketId}`, body);
    return {
      ok: true,
      result: { kind: 'ticket', ticket: mapZammadTicketToTicket(data, String(i.tenantId)) },
    };
  }

  async #closeTicket(i: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const ticketId = toStr(i.payload?.['ticketId']);
    if (!ticketId) return validationError('ticketId is required.');
    const { data } = await this.#put<Record<string, unknown>>(`tickets/${ticketId}`, {
      state: 'closed',
    });
    return {
      ok: true,
      result: { kind: 'ticket', ticket: mapZammadTicketToTicket(data, String(i.tenantId)) },
    };
  }

  // ── Agents ───────────────────────────────────────────────────────────────

  async #listAgents(i: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const { data } = await this.#get<Record<string, unknown>[]>('users?role[]=Agent');
    const agents = data.map((u) => mapZammadUserToParty(u, String(i.tenantId)));
    return { ok: true, result: { kind: 'agents', agents } };
  }

  async #assignTicket(i: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const ticketId = toStr(i.payload?.['ticketId']);
    const assigneeId = toStr(i.payload?.['assigneeId']);
    if (!ticketId) return validationError('ticketId is required.');
    if (!assigneeId) return validationError('assigneeId is required.');
    const { data } = await this.#put<Record<string, unknown>>(`tickets/${ticketId}`, {
      owner_id: Number(assigneeId),
    });
    return {
      ok: true,
      result: { kind: 'ticket', ticket: mapZammadTicketToTicket(data, String(i.tenantId)) },
    };
  }

  // ── Comments (Articles) ──────────────────────────────────────────────────

  async #addComment(i: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const ticketId = toStr(i.payload?.['ticketId']);
    const content = toStr(i.payload?.['content']);
    if (!ticketId) return validationError('ticketId is required.');
    if (!content) return validationError('content is required.');
    const { data } = await this.#post<Record<string, unknown>>('ticket_articles', {
      ticket_id: Number(ticketId),
      body: content,
      type: 'note',
      internal: false,
    });
    const externalRef = mapZammadArticleToExternalRef(data, this.#config.baseUrl, ticketId);
    return { ok: true, result: { kind: 'externalRef', externalRef } };
  }

  async #listComments(i: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const ticketId = toStr(i.payload?.['ticketId']);
    if (!ticketId) return validationError('ticketId is required.');
    const { data } = await this.#get<Record<string, unknown>[]>(
      `ticket_articles/by_ticket/${ticketId}`,
    );
    const externalRefs = data.map((a) =>
      mapZammadArticleToExternalRef(a, this.#config.baseUrl, ticketId),
    );
    return { ok: true, result: { kind: 'externalRefs', externalRefs } };
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  async #listTags(i: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const ticketId = i.payload?.['ticketId'];
    const path = ticketId ? `tags?object=Ticket&o_id=${toStr(ticketId)}` : 'tag_list';
    const { data } = await this.#get<{ tags?: string[] } | string[]>(path);
    const tags: string[] = Array.isArray(data)
      ? (data as unknown[]).map((t) => (typeof t === 'string' ? t : ''))
      : ((data as { tags?: string[] }).tags ?? []);
    return {
      ok: true,
      result: {
        kind: 'externalRefs',
        externalRefs: tags.map((n) => makeTagRef(n, this.#config.baseUrl)),
      },
    };
  }

  async #createTag(i: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const name = toStr(i.payload?.['name']);
    if (!name) return validationError('name is required.');
    const ticketId = i.payload?.['ticketId'];
    if (ticketId) {
      await this.#post('tags/add', { object: 'Ticket', o_id: Number(toStr(ticketId)), item: name });
    }
    return {
      ok: true,
      result: { kind: 'externalRef', externalRef: makeTagRef(name, this.#config.baseUrl) },
    };
  }

  // ── Knowledge base ───────────────────────────────────────────────────────

  async #getKnowledgeArticle(
    i: CustomerSupportExecuteInputV1,
  ): Promise<CustomerSupportExecuteOutputV1> {
    const documentId = toStr(i.payload?.['documentId']);
    if (!documentId) return validationError('documentId is required.');
    const kbId = toStr(i.payload?.['knowledgeBaseId'], '1');
    const { data } = await this.#get<Record<string, unknown>>(
      `knowledge_bases/${kbId}/items/${documentId}`,
    );
    if (!data['id']) return notFoundError(`Knowledge article ${documentId} not found.`);
    return {
      ok: true,
      result: {
        kind: 'document',
        document: mapZammadKbArticleToDocument(data, String(i.tenantId)),
      },
    };
  }

  async #listKnowledgeArticles(
    i: CustomerSupportExecuteInputV1,
  ): Promise<CustomerSupportExecuteOutputV1> {
    const kbId = toStr(i.payload?.['knowledgeBaseId'], '1');
    const { data } = await this.#get<Record<string, unknown>[]>(`knowledge_bases/${kbId}/items`);
    const documents = data.map((a) => mapZammadKbArticleToDocument(a, String(i.tenantId)));
    return { ok: true, result: { kind: 'documents', documents } };
  }

  // ── SLA ──────────────────────────────────────────────────────────────────

  async #getSLA(i: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const ticketId = toStr(i.payload?.['ticketId']);
    if (!ticketId) return validationError('ticketId is required.');
    const { data: ticket } = await this.#get<Record<string, unknown>>(`tickets/${ticketId}`);
    const slaId = ticket['sla_id'];
    if (!slaId) return notFoundError(`No SLA configured for ticket ${ticketId}.`);
    const slaIdStr = toStr(slaId);
    const { data: sla } = await this.#get<Record<string, unknown>>(`slas/${slaIdStr}`);
    return {
      ok: true,
      result: {
        kind: 'externalRef',
        externalRef: makeExternalRef({
          id: slaIdStr,
          externalType: 'sla_policy',
          displayLabel: toStr(sla['name'], `SLA ${slaIdStr}`),
          baseUrl: this.#config.baseUrl,
          path: 'manage/slas',
        }),
      },
    };
  }

  // ── CSAT ratings ─────────────────────────────────────────────────────────

  async #listCsatRatings(
    _i: CustomerSupportExecuteInputV1,
  ): Promise<CustomerSupportExecuteOutputV1> {
    const { data } = await this.#get<Record<string, unknown>[]>('csat_surveys');
    const externalRefs = data.map((r) =>
      makeExternalRef({
        id: toStr(r['id']),
        externalType: 'csat_rating',
        displayLabel: toStr(r['rating'] ?? r['answer']),
        baseUrl: this.#config.baseUrl,
        path: 'csat_surveys',
      }),
    );
    return { ok: true, result: { kind: 'externalRefs', externalRefs } };
  }

  // ── HTTP primitives ────────────────────────────────────────────────────────

  async #get<T>(path: string): Promise<ZammadResponse<T>> {
    return this.#request<T>('GET', path);
  }

  async #post<T>(path: string, body: unknown): Promise<ZammadResponse<T>> {
    return this.#request<T>('POST', path, body);
  }

  async #put<T>(path: string, body: unknown): Promise<ZammadResponse<T>> {
    return this.#request<T>('PUT', path, body);
  }

  async #request<T>(method: string, path: string, body?: unknown): Promise<ZammadResponse<T>> {
    const url = `${this.#config.baseUrl}/api/v1/${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#config.timeoutMs ?? 10_000);
    try {
      const res = await this.#fetch(url, {
        method,
        headers: {
          Authorization: this.#authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} from Zammad API (${path}): ${text}`);
      }
      const data = (await res.json()) as T;
      return { data, status: res.status };
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ── Module-level helpers ──────────────────────────────────────────────────

function validationError(message: string): CustomerSupportExecuteOutputV1 {
  return { ok: false, error: 'validation_error', message };
}

function notFoundError(message: string): CustomerSupportExecuteOutputV1 {
  return { ok: false, error: 'not_found', message };
}

function buildCreateBody(
  subject: string,
  payload: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: subject,
    group: payload['group'] ?? 'Users',
    customer_id: payload['customerId'] ?? 'guest@example.com',
    article: { subject, body: payload['body'] ?? subject, type: 'note', internal: false },
  };
  if (typeof payload['priority'] === 'string') body['priority'] = payload['priority'];
  return body;
}

function buildUpdateBody(payload: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (typeof payload['subject'] === 'string') body['title'] = payload['subject'];
  if (typeof payload['assigneeId'] === 'string') body['owner_id'] = payload['assigneeId'];
  if (typeof payload['status'] === 'string') {
    body['state'] =
      CANONICAL_TO_ZAMMAD_STATUS[payload['status'] as keyof typeof CANONICAL_TO_ZAMMAD_STATUS] ??
      payload['status'];
  }
  if (typeof payload['priority'] === 'string') body['priority'] = payload['priority'];
  return body;
}
