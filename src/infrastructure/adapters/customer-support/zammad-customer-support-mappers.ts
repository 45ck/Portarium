/**
 * Mapper helpers for ZammadCustomerSupportAdapter.
 * Bead: bead-0423
 */

import type { DocumentV1 } from '../../../domain/canonical/document-v1.js';
import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../../domain/canonical/party-v1.js';
import type { TicketV1 } from '../../../domain/canonical/ticket-v1.js';
import { DocumentId, PartyId, TicketId } from '../../../domain/primitives/index.js';

// ── Config ────────────────────────────────────────────────────────────────

export interface ZammadAdapterConfig {
  /** Base URL of the Zammad instance (e.g. https://zammad.example.com). */
  baseUrl: string;
  /** Zammad API token for token-based auth (`Authorization: Token token=<key>`). */
  apiToken: string;
  /** Optional request timeout in ms. Default: 10 000. */
  timeoutMs?: number;
}

// ── Safe string coercion ───────────────────────────────────────────────────

/**
 * Safely coerces an `unknown` value to string without risking `[object Object]`.
 * Returns `fallback` when the value is not a string/number/boolean.
 */
export function toStr(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

// ── Zammad ↔ canonical status mapping ────────────────────────────────────

const ZAMMAD_TO_CANONICAL_STATUS: Readonly<Record<string, TicketV1['status']>> = {
  new: 'open',
  open: 'open',
  'pending reminder': 'pending',
  'pending action': 'pending',
  pending_reminder: 'pending',
  pending_action: 'pending',
  resolved: 'resolved',
  closed: 'closed',
};

export const CANONICAL_TO_ZAMMAD_STATUS: Readonly<Record<TicketV1['status'], string>> = {
  open: 'open',
  pending: 'pending reminder',
  resolved: 'closed',
  closed: 'closed',
};

const ZAMMAD_TO_CANONICAL_PRIORITY: Readonly<Record<string, TicketV1['priority']>> = {
  '1 low': 'low',
  low: 'low',
  '2 normal': 'medium',
  normal: 'medium',
  '3 high': 'high',
  high: 'high',
  '4 urgent': 'urgent',
  urgent: 'urgent',
};

// ── Mappers ───────────────────────────────────────────────────────────────

export function mapZammadTicketToTicket(
  ticket: Record<string, unknown>,
  tenantId: string,
): TicketV1 {
  const statusKey = toStr(ticket['state_id'] ?? ticket['state']).toLowerCase();
  const priorityKey = toStr(ticket['priority_id'] ?? ticket['priority']).toLowerCase();
  const canonicalStatus: TicketV1['status'] = ZAMMAD_TO_CANONICAL_STATUS[statusKey] ?? 'open';
  const canonicalPriority: TicketV1['priority'] | undefined =
    ZAMMAD_TO_CANONICAL_PRIORITY[priorityKey];
  const ownerId = ticket['owner_id'];
  const hasAssignee = ownerId !== undefined && ownerId !== null && ownerId !== 1;

  return {
    ticketId: TicketId(toStr(ticket['id'])),
    tenantId: tenantId as TicketV1['tenantId'],
    schemaVersion: 1,
    subject: toStr(ticket['title']),
    status: canonicalStatus,
    ...(canonicalPriority !== undefined ? { priority: canonicalPriority } : {}),
    ...(hasAssignee ? { assigneeId: toStr(ownerId) } : {}),
    createdAtIso: toStr(ticket['created_at'], new Date().toISOString()),
  };
}

export function mapZammadUserToParty(user: Record<string, unknown>, tenantId: string): PartyV1 {
  const firstname = toStr(user['firstname']);
  const lastname = toStr(user['lastname']);
  const displayName = `${firstname} ${lastname}`.trim() || toStr(user['login'] ?? user['id']);

  return {
    partyId: PartyId(toStr(user['id'])),
    tenantId: tenantId as PartyV1['tenantId'],
    schemaVersion: 1,
    displayName,
    ...(typeof user['email'] === 'string' && user['email'].length > 0
      ? { email: user['email'] }
      : {}),
    roles: ['user'],
  };
}

export function mapZammadArticleToExternalRef(
  article: Record<string, unknown>,
  baseUrl: string,
  ticketId: string,
): ExternalObjectRef {
  return {
    sorName: 'Zammad',
    portFamily: 'CustomerSupport',
    externalId: toStr(article['id']),
    externalType: 'ticket_article',
    displayLabel: toStr(article['subject'] ?? article['body']).slice(0, 60),
    deepLinkUrl: `${baseUrl}/#ticket/zoom/${ticketId}`,
  };
}

export function mapZammadKbArticleToDocument(
  article: Record<string, unknown>,
  tenantId: string,
): DocumentV1 {
  return {
    documentId: DocumentId(toStr(article['id'])),
    tenantId: tenantId as DocumentV1['tenantId'],
    schemaVersion: 1,
    title: toStr(article['title']),
    mimeType: 'text/html',
    createdAtIso: toStr(article['created_at'], new Date().toISOString()),
  };
}

export function makeTagRef(name: string, baseUrl: string): ExternalObjectRef {
  return {
    sorName: 'Zammad',
    portFamily: 'CustomerSupport',
    externalId: name,
    externalType: 'ticket_tag',
    displayLabel: name,
    deepLinkUrl: `${baseUrl}/tags/${encodeURIComponent(name)}`,
  };
}

export function makeExternalRef(params: {
  id: string;
  externalType: string;
  displayLabel: string;
  baseUrl: string;
  path: string;
}): ExternalObjectRef {
  return {
    sorName: 'Zammad',
    portFamily: 'CustomerSupport',
    externalId: params.id,
    externalType: params.externalType,
    displayLabel: params.displayLabel,
    deepLinkUrl: `${params.baseUrl}/${params.path}/${params.id}`,
  };
}
