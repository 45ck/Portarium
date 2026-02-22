/**
 * Shared helpers, mappers, and HTTP infrastructure for the Mautic adapter family.
 */

import type { CampaignV1 } from '../../../domain/canonical/campaign-v1.js';
import type { ExternalObjectRef } from '../../../domain/canonical/external-object-ref.js';
import type { PartyV1 } from '../../../domain/canonical/party-v1.js';
import { CampaignId, PartyId } from '../../../domain/primitives/index.js';
import type { MarketingAutomationExecuteOutputV1 } from '../../../application/ports/marketing-automation-adapter.js';

// ── Config / types ─────────────────────────────────────────────────────────

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

export interface MauticResponse<T> {
  data: T;
  status: number;
}

export interface MauticHttp {
  get<T>(path: string): Promise<MauticResponse<T>>;
  post<T>(path: string, body: unknown): Promise<MauticResponse<T>>;
  patch<T>(path: string, body: unknown): Promise<MauticResponse<T>>;
  readonly baseUrl: string;
}

// ── HTTP factory ───────────────────────────────────────────────────────────

type FetchFn = typeof fetch;

export function createMauticHttp(
  config: MauticAdapterConfig,
  fetchFn: FetchFn = fetch,
): MauticHttp {
  const encoded = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  const authHeader = `Basic ${encoded}`;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<MauticResponse<T>> {
    const url = `${config.baseUrl}/api/${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 10_000);
    try {
      const res = await fetchFn(url, {
        method,
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} from Mautic API (${path}): ${text}`);
      }
      const data = (await res.json()) as T;
      return { data, status: res.status };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
    patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
    get baseUrl() {
      return config.baseUrl;
    },
  };
}

// ── String coercion helper ─────────────────────────────────────────────────

export function strOf(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '';
}

// ── Mapper helpers ─────────────────────────────────────────────────────────

function contactDisplayName(
  contact: Record<string, unknown>,
  fields: Record<string, unknown>,
): string {
  const full = `${strOf(fields['firstname'])} ${strOf(fields['lastname'])}`.trim();
  return full || strOf(fields['email']) || strOf(contact['id']);
}

export function mapMauticContactToParty(
  contact: Record<string, unknown>,
  tenantId: string,
): PartyV1 {
  const fields =
    (contact['fields'] as Record<string, Record<string, unknown>> | undefined)?.['all'] ?? {};
  const email = typeof fields['email'] === 'string' ? fields['email'] : undefined;
  return {
    partyId: PartyId(strOf(contact['id'])),
    tenantId: tenantId as PartyV1['tenantId'],
    schemaVersion: 1,
    displayName: contactDisplayName(contact, fields),
    ...(email !== undefined ? { email } : {}),
    roles: ['lead'],
  };
}

export function mapMauticCampaignToCampaign(
  campaign: Record<string, unknown>,
  tenantId: string,
): CampaignV1 {
  return {
    campaignId: CampaignId(strOf(campaign['id'])),
    tenantId: tenantId as CampaignV1['tenantId'],
    schemaVersion: 1,
    name: strOf(campaign['name']),
    status: campaign['isPublished'] ? 'active' : 'draft',
    channelType: 'email',
  };
}

export function makeExternalRef(
  id: string,
  externalType: string,
  displayLabel: string,
  deepLinkUrl: string,
): ExternalObjectRef {
  return {
    sorName: 'Mautic',
    portFamily: 'MarketingAutomation',
    externalId: id,
    externalType,
    displayLabel,
    deepLinkUrl,
  };
}

export function mauticProviderError(err: unknown): MarketingAutomationExecuteOutputV1 {
  const msg = err instanceof Error ? err.message : String(err);
  return { ok: false, error: 'provider_error', message: `Mautic API error: ${msg}` };
}
