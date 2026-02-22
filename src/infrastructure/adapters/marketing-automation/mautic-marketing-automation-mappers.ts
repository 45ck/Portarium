/**
 * Mapper helpers and config types for MauticMarketingAutomationAdapter.
 * Bead: bead-0421 (lint fixes: bead-0423)
 */

// ── Imports ────────────────────────────────────────────────────────────────

import type { CampaignV1 } from '../../../domain/canonical/campaign-v1.js';
import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../../domain/canonical/party-v1.js';
import { CampaignId, PartyId } from '../../../domain/primitives/index.js';
import type {
  MarketingAutomationExecuteInputV1,
  MarketingAutomationExecuteOutputV1,
} from '../../../application/ports/marketing-automation-adapter.js';

// ── Config ────────────────────────────────────────────────────────────────

export interface MauticAdapterConfig {
  /** Base URL of the Mautic instance (e.g. https://mautic.example.com). */
  baseUrl: string;
  /** Mautic API username. */
  username: string;
  /** Mautic API password. */
  password: string;
  /** Optional request timeout in ms. Default: 10 000. */
  timeoutMs?: number;
}

// ── Primitive helpers ──────────────────────────────────────────────────────

/**
 * Safely coerces an `unknown` value to string without risking `[object Object]`.
 * Returns `fallback` when the value is not a string/number/boolean.
 */
export function toStr(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function contactDisplayName(fields: Record<string, unknown>, contactId: unknown): string {
  const first = toStr(fields['firstname']);
  const last = toStr(fields['lastname']);
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return toStr(fields['email'] ?? contactId);
}

// ── Domain mappers ─────────────────────────────────────────────────────────

export function mapMauticContactToParty(
  contact: Record<string, unknown>,
  tenantId: string,
): PartyV1 {
  const allFields = contact['fields'] as Record<string, Record<string, unknown>> | undefined;
  const fields: Record<string, unknown> = allFields?.['all'] ?? {};
  const email = typeof fields['email'] === 'string' ? fields['email'] : undefined;

  return {
    partyId: PartyId(toStr(contact['id'])),
    tenantId: tenantId as PartyV1['tenantId'],
    schemaVersion: 1,
    displayName: contactDisplayName(fields, contact['id']),
    ...(email !== undefined ? { email } : {}),
    roles: ['lead'],
  };
}

export function mapMauticCampaignToCampaign(
  campaign: Record<string, unknown>,
  tenantId: string,
): CampaignV1 {
  return {
    campaignId: CampaignId(toStr(campaign['id'])),
    tenantId: tenantId as CampaignV1['tenantId'],
    schemaVersion: 1,
    name: toStr(campaign['name']),
    status: campaign['isPublished'] ? 'active' : 'draft',
    channelType: 'email',
  };
}

export function makeMauticRef(params: {
  id: string | number;
  externalType: string;
  displayLabel: string;
  baseUrl: string;
  path: string;
}): ExternalObjectRef {
  return {
    sorName: 'Mautic',
    portFamily: 'MarketingAutomation',
    externalId: toStr(params.id),
    externalType: params.externalType,
    displayLabel: params.displayLabel,
    deepLinkUrl: `${params.baseUrl}/${params.path}/${toStr(params.id)}`,
  };
}

// ── Operations context ─────────────────────────────────────────────────────

/** Minimal HTTP client passed to extracted operation helpers. */
export interface MauticOpsContext {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  baseUrl: string;
}

// ── Segment operations ─────────────────────────────────────────────────────

export async function mauticListSegments(
  ctx: MauticOpsContext,
): Promise<MarketingAutomationExecuteOutputV1> {
  const r = await ctx.get<{ lists: Record<string, Record<string, unknown>> }>('segments');
  const externalRefs = Object.values(r.lists).map((seg) =>
    makeMauticRef({
      id: toStr(seg['id']),
      externalType: 'segment',
      displayLabel: toStr(seg['name']),
      baseUrl: ctx.baseUrl,
      path: 's/segments',
    }),
  );
  return { ok: true, result: { kind: 'externalRefs', externalRefs } };
}

export async function mauticGetSegment(
  ctx: MauticOpsContext,
  i: MarketingAutomationExecuteInputV1,
): Promise<MarketingAutomationExecuteOutputV1> {
  const listId = toStr(i.payload?.['listId']);
  if (!listId) return { ok: false, error: 'validation_error', message: 'listId is required.' };
  const r = await ctx.get<{ list?: Record<string, unknown> }>(`segments/${listId}`);
  if (!r.list) return { ok: false, error: 'not_found', message: `Segment ${listId} not found.` };
  return {
    ok: true,
    result: {
      kind: 'externalRef',
      externalRef: makeMauticRef({
        id: toStr(r.list['id']),
        externalType: 'segment',
        displayLabel: toStr(r.list['name']),
        baseUrl: ctx.baseUrl,
        path: 's/segments',
      }),
    },
  };
}

export async function mauticAddContactToSegment(
  ctx: MauticOpsContext,
  i: MarketingAutomationExecuteInputV1,
): Promise<MarketingAutomationExecuteOutputV1> {
  const listId = toStr(i.payload?.['listId']);
  const contactId = toStr(i.payload?.['contactId']);
  if (!listId || !contactId)
    return { ok: false, error: 'validation_error', message: 'listId and contactId are required.' };
  await ctx.post(`segments/${listId}/contact/${contactId}/add`, {});
  return { ok: true, result: { kind: 'accepted', operation: i.operation } };
}

export async function mauticRemoveContactFromSegment(
  ctx: MauticOpsContext,
  i: MarketingAutomationExecuteInputV1,
): Promise<MarketingAutomationExecuteOutputV1> {
  const listId = toStr(i.payload?.['listId']);
  const contactId = toStr(i.payload?.['contactId']);
  if (!listId || !contactId)
    return { ok: false, error: 'validation_error', message: 'listId and contactId are required.' };
  await ctx.post(`segments/${listId}/contact/${contactId}/remove`, {});
  return { ok: true, result: { kind: 'accepted', operation: i.operation } };
}

// ── Automation / Form operations ───────────────────────────────────────────

export async function mauticTriggerAutomation(
  ctx: MauticOpsContext,
  i: MarketingAutomationExecuteInputV1,
): Promise<MarketingAutomationExecuteOutputV1> {
  const automationId = toStr(i.payload?.['automationId']);
  const contactId = toStr(i.payload?.['contactId']);
  if (!automationId)
    return { ok: false, error: 'validation_error', message: 'automationId is required.' };
  if (contactId) await ctx.post(`campaigns/${automationId}/contact/${contactId}/add`, {});
  return {
    ok: true,
    result: {
      kind: 'externalRef',
      externalRef: makeMauticRef({
        id: `${automationId}-run-${String(Date.now())}`,
        externalType: 'automation_run',
        displayLabel: `Automation ${automationId} triggered`,
        baseUrl: ctx.baseUrl,
        path: 's/campaigns/view',
      }),
    },
  };
}

export async function mauticListForms(
  ctx: MauticOpsContext,
): Promise<MarketingAutomationExecuteOutputV1> {
  const r = await ctx.get<{ forms: Record<string, Record<string, unknown>> }>('forms');
  const externalRefs = Object.values(r.forms).map((f) =>
    makeMauticRef({
      id: toStr(f['id']),
      externalType: 'form',
      displayLabel: toStr(f['name']),
      baseUrl: ctx.baseUrl,
      path: 's/forms/view',
    }),
  );
  return { ok: true, result: { kind: 'externalRefs', externalRefs } };
}

export async function mauticGetFormSubmissions(
  ctx: MauticOpsContext,
  i: MarketingAutomationExecuteInputV1,
): Promise<MarketingAutomationExecuteOutputV1> {
  const formId = toStr(i.payload?.['formId']);
  if (!formId) return { ok: false, error: 'validation_error', message: 'formId is required.' };
  const r = await ctx.get<{ submissions?: Record<string, Record<string, unknown>> }>(
    `forms/${formId}/submissions`,
  );
  const externalRefs = Object.values(r.submissions ?? {}).map((s) =>
    makeMauticRef({
      id: toStr(s['id']),
      externalType: 'form_submission',
      displayLabel: `Submission #${toStr(s['id'])}`,
      baseUrl: ctx.baseUrl,
      path: 's/forms/results',
    }),
  );
  return { ok: true, result: { kind: 'externalRefs', externalRefs } };
}
