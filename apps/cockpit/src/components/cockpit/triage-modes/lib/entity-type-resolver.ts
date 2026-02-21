/**
 * Shared external type → domain entity resolver.
 * Replaces duplicated logic in: action-replay-mode, diff-view-mode.
 */

import type { DomainEntityType } from '@/assets/types';

const EXTERNAL_TYPE_MAP: Record<string, DomainEntityType> = {
  Invoice: 'invoice',
  Payment: 'payment',
  Ticket: 'ticket',
  Subscription: 'subscription',
  Order: 'order',
  Account: 'account',
  Party: 'party',
  Product: 'product',
};

export function resolveEntity(ext: string): DomainEntityType {
  for (const [k, v] of Object.entries(EXTERNAL_TYPE_MAP)) {
    if (ext.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return 'external-object-ref';
}

export { EXTERNAL_TYPE_MAP };
