/**
 * Zammad reference adapter for the CustomerSupport port family.
 *
 * Implements `CustomerSupportAdapterPort` against Zammad's REST API v1.
 * Zammad exposes a RESTful HTTP API under `/api/v1/`.
 *
 * Authentication: HTTP Token (API token) or Basic Auth.
 * This adapter uses HTTP Token auth via the `Authorization: Token token=<key>` header.
 *
 * Zammad API reference: https://docs.zammad.org/en/latest/api/intro.html
 *
 * Covered operations (all 15 CustomerSupportOperationV1):
 *   listTickets / getTicket / createTicket / updateTicket / closeTicket
 *   listAgents / assignTicket
 *   addComment / listComments
 *   listTags / createTag
 *   getKnowledgeArticle / listKnowledgeArticles
 *   getSLA / listCustomerSatisfactionRatings
 *
 * Bead: bead-0423
 */

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

// ── Config ────────────────────────────────────────────────────────────────────

export interface ZammadAdapterConfig {
  /** Base URL, e.g. https://support.mycompany.com */
  baseUrl: string;
  /** Zammad API token (Settings → API → Token Access). */
  apiToken: string;
  /** Optional request timeout in ms. Default: 12 000. */
  timeoutMs?: number;
}

type FetchFn = typeof fetch;

// ── Mappers ───────────────────────────────────────────────────────────────────

const ZAMMAD_STATE_MAP: Record<string, TicketV1['status']> = {
  new: 'open',
  open: 'open',
  'pending reminder': 'pending',
  'pending close': 'pending',
  closed: 'closed',
  merged: 'closed',
  removed: 'closed',
};

const ZAMMAD_PRIORITY_MAP: Record<string, NonNullable<TicketV1['priority']>> = {
  '1 low': 'low',
  '2 normal': 'medium',
  '3 high': 'high',
};

function mapZammadTicket(rec: Record<string, unknown>, tenantId: string): TicketV1 {
  const state = String(rec['state'] ?? rec['state_name'] ?? 'open');
  const priority = String(rec['priority'] ?? rec['priority_name'] ?? '2 normal');

  return {
    ticketId: TicketId(String(rec['id'])),
    tenantId: tenantId as TicketV1['tenantId'],
    schemaVersion: 1,
    subject: String(rec['title'] ?? rec['subject'] ?? ''),
    status: ZAMMAD_STATE_MAP[state] ?? 'open',
    ...(ZAMMAD_PRIORITY_MAP[priority] ? { priority: ZAMMAD_PRIORITY_MAP[priority] } : {}),
    ...(rec['owner_id'] && rec['owner_id'] !== 1 ? { assigneeId: String(rec['owner_id']) } : {}),
    createdAtIso: String(rec['created_at'] ?? new Date().toISOString()),
  };
}

function mapZammadUser(rec: Record<string, unknown>, tenantId: string): PartyV1 {
  return {
    partyId: PartyId(String(rec['id'])),
    tenantId: tenantId as PartyV1['tenantId'],
    schemaVersion: 1,
    displayName:
      `${String(rec['firstname'] ?? '')} ${String(rec['lastname'] ?? '')}`.trim() ||
      String(rec['login'] ?? rec['id']),
    ...(typeof rec['email'] === 'string' && rec['email'] ? { email: rec['email'] } : {}),
    ...(typeof rec['phone'] === 'string' && rec['phone'] ? { phone: rec['phone'] } : {}),
    roles: ['agent'],
  };
}

function mapZammadArticle(
  rec: Record<string, unknown>,
  tenantId: string,
  baseUrl: string,
): DocumentV1 {
  return {
    documentId: DocumentId(String(rec['id'])),
    tenantId: tenantId as DocumentV1['tenantId'],
    schemaVersion: 1,
    title: String(rec['title'] ?? ''),
    mimeType: 'text/html',
    createdAtIso: String(rec['created_at'] ?? new Date().toISOString()),
    externalRefs: [
      {
        sorName: 'Zammad',
        portFamily: 'CustomerSupport',
        externalId: String(rec['id']),
        externalType: 'knowledge_base_answer',
        displayLabel: String(rec['title'] ?? ''),
        deepLinkUrl: `${baseUrl}/#knowledge_base`,
      },
    ],
  };
}

function makeTagRef(tag: string, baseUrl: string): ExternalObjectRef {
  return {
    sorName: 'Zammad',
    portFamily: 'CustomerSupport',
    externalId: tag,
    externalType: 'tag',
    displayLabel: tag,
    deepLinkUrl: `${baseUrl}/#tags`,
  };
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class ZammadCustomerSupportAdapter implements CustomerSupportAdapterPort {
  readonly #config: ZammadAdapterConfig;
  readonly #fetch: FetchFn;

  constructor(config: ZammadAdapterConfig, fetchFn: FetchFn = fetch) {
    this.#config = config;
    this.#fetch = fetchFn;
  }

  async execute(input: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    try {
      switch (input.operation) {
        case 'listTickets':
          return await this.#listTickets(input);
        case 'getTicket':
          return await this.#getTicket(input);
        case 'createTicket':
          return await this.#createTicket(input);
        case 'updateTicket':
          return await this.#updateTicket(input);
        case 'closeTicket':
          return await this.#closeTicket(input);
        case 'listAgents':
          return await this.#listAgents(input);
        case 'assignTicket':
          return await this.#assignTicket(input);
        case 'addComment':
          return await this.#addComment(input);
        case 'listComments':
          return await this.#listComments(input);
        case 'listTags':
          return await this.#listTags(input);
        case 'createTag':
          return await this.#createTag(input);
        case 'getKnowledgeArticle':
          return await this.#getKnowledgeArticle(input);
        case 'listKnowledgeArticles':
          return await this.#listKnowledgeArticles(input);
        case 'getSLA':
          return await this.#getSLA(input);
        case 'listCustomerSatisfactionRatings':
          return await this.#listCSATRatings(input);
        default:
          return {
            ok: false,
            error: 'unsupported_operation',
            message: `Unsupported: ${String(input.operation)}`,
          };
      }
    } catch (err) {
      return {
        ok: false,
        error: 'provider_error',
        message: `Zammad API error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ── Tickets ───────────────────────────────────────────────────────────────

  async #listTickets(
    input: CustomerSupportExecuteInputV1,
  ): Promise<CustomerSupportExecuteOutputV1> {
    const data = await this.#get<Record<string, unknown>[]>('tickets?expand=true&per_page=50');
    const tickets = (Array.isArray(data) ? data : []).map((r) =>
      mapZammadTicket(r, String(input.tenantId)),
    );
    return { ok: true, result: { kind: 'tickets', tickets } };
  }

  async #getTicket(input: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const ticketId = String(input.payload?.['ticketId'] ?? '');
    if (!ticketId)
      return { ok: false, error: 'validation_error', message: 'ticketId is required.' };

    const data = await this.#get<Record<string, unknown>>(`tickets/${ticketId}?expand=true`);
    if (typeof data?.['id'] === 'undefined') {
      return { ok: false, error: 'not_found', message: `Ticket ${ticketId} not found.` };
    }
    return {
      ok: true,
      result: { kind: 'ticket', ticket: mapZammadTicket(data, String(input.tenantId)) },
    };
  }

  async #createTicket(
    input: CustomerSupportExecuteInputV1,
  ): Promise<CustomerSupportExecuteOutputV1> {
    const subject = String(input.payload?.['subject'] ?? '');
    const body = String(input.payload?.['body'] ?? '');
    const customerId = input.payload?.['customerId'];
    const groupId = input.payload?.['groupId'] ?? 1;

    if (!subject) return { ok: false, error: 'validation_error', message: 'subject is required.' };

    const data = await this.#post<Record<string, unknown>>('tickets', {
      title: subject,
      group_id: groupId,
      ...(customerId ? { customer_id: customerId } : {}),
      article: {
        subject,
        body,
        type: 'note',
        internal: false,
      },
    });
    return {
      ok: true,
      result: { kind: 'ticket', ticket: mapZammadTicket(data, String(input.tenantId)) },
    };
  }

  async #updateTicket(
    input: CustomerSupportExecuteInputV1,
  ): Promise<CustomerSupportExecuteOutputV1> {
    const ticketId = String(input.payload?.['ticketId'] ?? '');
    if (!ticketId)
      return { ok: false, error: 'validation_error', message: 'ticketId is required.' };

    const updates: Record<string, unknown> = {};
    if (input.payload?.['subject']) updates['title'] = input.payload['subject'];
    if (input.payload?.['priority']) updates['priority'] = input.payload['priority'];

    const data = await this.#patch<Record<string, unknown>>(`tickets/${ticketId}`, updates);
    return {
      ok: true,
      result: { kind: 'ticket', ticket: mapZammadTicket(data, String(input.tenantId)) },
    };
  }

  async #closeTicket(
    input: CustomerSupportExecuteInputV1,
  ): Promise<CustomerSupportExecuteOutputV1> {
    const ticketId = String(input.payload?.['ticketId'] ?? '');
    if (!ticketId)
      return { ok: false, error: 'validation_error', message: 'ticketId is required.' };

    const data = await this.#patch<Record<string, unknown>>(`tickets/${ticketId}`, {
      state: 'closed',
    });
    return {
      ok: true,
      result: { kind: 'ticket', ticket: mapZammadTicket(data, String(input.tenantId)) },
    };
  }

  // ── Agents ────────────────────────────────────────────────────────────────

  async #listAgents(input: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const data = await this.#get<Record<string, unknown>[]>('users?role=Agent&per_page=100');
    const agents = (Array.isArray(data) ? data : []).map((r) =>
      mapZammadUser(r, String(input.tenantId)),
    );
    return { ok: true, result: { kind: 'agents', agents } };
  }

  async #assignTicket(
    input: CustomerSupportExecuteInputV1,
  ): Promise<CustomerSupportExecuteOutputV1> {
    const ticketId = String(input.payload?.['ticketId'] ?? '');
    const agentId = String(input.payload?.['agentId'] ?? '');
    if (!ticketId || !agentId) {
      return {
        ok: false,
        error: 'validation_error',
        message: 'ticketId and agentId are required.',
      };
    }

    await this.#patch<Record<string, unknown>>(`tickets/${ticketId}`, {
      owner_id: Number(agentId),
    });
    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  // ── Comments (Articles) ───────────────────────────────────────────────────

  async #addComment(input: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const ticketId = String(input.payload?.['ticketId'] ?? '');
    const body = String(input.payload?.['body'] ?? '');
    if (!ticketId || !body) {
      return { ok: false, error: 'validation_error', message: 'ticketId and body are required.' };
    }

    await this.#post<Record<string, unknown>>('ticket_articles', {
      ticket_id: Number(ticketId),
      subject: 'Comment',
      body,
      type: 'note',
      internal: input.payload?.['internal'] === true,
    });
    return { ok: true, result: { kind: 'accepted', operation: input.operation } };
  }

  async #listComments(
    input: CustomerSupportExecuteInputV1,
  ): Promise<CustomerSupportExecuteOutputV1> {
    const ticketId = String(input.payload?.['ticketId'] ?? '');
    if (!ticketId)
      return { ok: false, error: 'validation_error', message: 'ticketId is required.' };

    const data = await this.#get<Record<string, unknown>[]>(
      `ticket_articles/by_ticket/${ticketId}`,
    );
    const refs: ExternalObjectRef[] = (Array.isArray(data) ? data : []).map((r) => ({
      sorName: 'Zammad',
      portFamily: 'CustomerSupport' as const,
      externalId: String(r['id']),
      externalType: 'ticket_article',
      displayLabel: String(r['subject'] ?? `Article #${r['id']}`),
      deepLinkUrl: `${this.#config.baseUrl}/#ticket/zoom/${ticketId}`,
    }));
    return { ok: true, result: { kind: 'externalRefs', externalRefs: refs } };
  }

  // ── Tags ──────────────────────────────────────────────────────────────────

  async #listTags(input: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const ticketId = input.payload?.['ticketId'] ? String(input.payload['ticketId']) : undefined;
    const path = ticketId ? `tags?object=Ticket&o_id=${ticketId}` : 'tag_list';
    const data = await this.#get<{ tags?: string[] } | string[]>(path);

    const tags: string[] = Array.isArray(data) ? data : ((data as { tags?: string[] }).tags ?? []);
    const refs: ExternalObjectRef[] = tags.map((t) => makeTagRef(t, this.#config.baseUrl));
    return { ok: true, result: { kind: 'externalRefs', externalRefs: refs } };
  }

  async #createTag(input: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const tag = String(input.payload?.['tag'] ?? '');
    const ticketId = String(input.payload?.['ticketId'] ?? '');
    if (!tag || !ticketId) {
      return { ok: false, error: 'validation_error', message: 'tag and ticketId are required.' };
    }

    await this.#post<unknown>('tags/add', { object: 'Ticket', o_id: Number(ticketId), item: tag });
    return {
      ok: true,
      result: { kind: 'externalRef', externalRef: makeTagRef(tag, this.#config.baseUrl) },
    };
  }

  // ── Knowledge Base ────────────────────────────────────────────────────────

  async #getKnowledgeArticle(
    input: CustomerSupportExecuteInputV1,
  ): Promise<CustomerSupportExecuteOutputV1> {
    const articleId = String(input.payload?.['articleId'] ?? '');
    if (!articleId)
      return { ok: false, error: 'validation_error', message: 'articleId is required.' };

    const data = await this.#get<Record<string, unknown>>(
      `knowledge_base/*/translation/*/answer/${articleId}/translation`,
    );
    if (typeof data?.['id'] === 'undefined') {
      return {
        ok: false,
        error: 'not_found',
        message: `Knowledge article ${articleId} not found.`,
      };
    }
    return {
      ok: true,
      result: {
        kind: 'document',
        document: mapZammadArticle(data, String(input.tenantId), this.#config.baseUrl),
      },
    };
  }

  async #listKnowledgeArticles(
    input: CustomerSupportExecuteInputV1,
  ): Promise<CustomerSupportExecuteOutputV1> {
    const data = await this.#get<Record<string, unknown>[]>(
      'knowledge_base/*/translation/*/answer',
    );
    const docs = (Array.isArray(data) ? data : []).map((r) =>
      mapZammadArticle(r, String(input.tenantId), this.#config.baseUrl),
    );
    return { ok: true, result: { kind: 'documents', documents: docs } };
  }

  // ── SLA ───────────────────────────────────────────────────────────────────

  async #getSLA(_input: CustomerSupportExecuteInputV1): Promise<CustomerSupportExecuteOutputV1> {
    const data = await this.#get<Record<string, unknown>[]>('slas');
    return {
      ok: true,
      result: { kind: 'opaque', payload: { slas: Array.isArray(data) ? data : [] } },
    };
  }

  // ── CSAT ──────────────────────────────────────────────────────────────────

  async #listCSATRatings(
    _input: CustomerSupportExecuteInputV1,
  ): Promise<CustomerSupportExecuteOutputV1> {
    const data = await this.#get<Record<string, unknown>[]>('csat_surveys');
    return {
      ok: true,
      result: { kind: 'opaque', payload: { ratings: Array.isArray(data) ? data : [] } },
    };
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────────

  async #get<T>(path: string): Promise<T> {
    return this.#request<T>('GET', path);
  }

  async #post<T>(path: string, body: unknown): Promise<T> {
    return this.#request<T>('POST', path, body);
  }

  async #patch<T>(path: string, body: unknown): Promise<T> {
    return this.#request<T>('PATCH', path, body);
  }

  async #request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.#config.baseUrl}/api/v1/${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#config.timeoutMs ?? 12_000);

    try {
      const res = await this.#fetch(url, {
        method,
        headers: {
          Authorization: `Token token=${this.#config.apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} from Zammad (${path}): ${text}`);
      }

      const text = await res.text();
      if (!text) return undefined as T;
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
