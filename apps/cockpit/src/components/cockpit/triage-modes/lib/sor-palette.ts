/**
 * Unified SOR color palette with fuzzy matching.
 * Replaces duplicate palettes in: action-replay-mode, diff-view-mode,
 * approval-triage-card, and blast-map-mode (SOR_FILL/SOR_BG).
 */

export interface SorPaletteEntry {
  /** Tailwind bg class */
  bg: string;
  /** Tailwind text class */
  text: string;
  /** Hex fill color (for SVG) */
  fill: string;
  /** Hex bg color with alpha (for SVG backgrounds) */
  fillBg: string;
}

export const SOR_PALETTE: Record<string, SorPaletteEntry> = {
  Odoo: { bg: 'bg-indigo-600', text: 'text-white', fill: '#6366f1', fillBg: '#6366f11a' },
  Stripe: { bg: 'bg-violet-600', text: 'text-white', fill: '#8b5cf6', fillBg: '#8b5cf61a' },
  NetSuite: { bg: 'bg-blue-600', text: 'text-white', fill: '#3b82f6', fillBg: '#3b82f61a' },
  Okta: { bg: 'bg-sky-500', text: 'text-white', fill: '#0ea5e9', fillBg: '#0ea5e91a' },
  Mautic: { bg: 'bg-orange-500', text: 'text-white', fill: '#f97316', fillBg: '#f973161a' },
  Zammad: { bg: 'bg-rose-500', text: 'text-white', fill: '#f43f5e', fillBg: '#f43f5e1a' },
  Vault: { bg: 'bg-amber-500', text: 'text-white', fill: '#f59e0b', fillBg: '#f59e0b1a' },
  SAP: { bg: 'bg-blue-700', text: 'text-white', fill: '#2563eb', fillBg: '#2563eb1a' },
  ServiceNow: { bg: 'bg-teal-600', text: 'text-white', fill: '#0d9488', fillBg: '#0d94881a' },
  'LabWare LIMS': { bg: 'bg-teal-500', text: 'text-white', fill: '#14b8a6', fillBg: '#14b8a61a' },
  'DEA ARCOS': { bg: 'bg-red-600', text: 'text-white', fill: '#dc2626', fillBg: '#dc26261a' },
  'Paperless-ngx': { bg: 'bg-lime-600', text: 'text-white', fill: '#65a30d', fillBg: '#65a30d1a' },
  'FDA Reporting': {
    bg: 'bg-purple-600',
    text: 'text-white',
    fill: '#9333ea',
    fillBg: '#9333ea1a',
  },
  'adapter-ups-freight': {
    bg: 'bg-yellow-700',
    text: 'text-white',
    fill: '#854d0e',
    fillBg: '#854d0e1a',
  },
};

const FUZZY_KEYS: [string, string][] = [
  ['LIMS', 'LabWare LIMS'],
  ['UPS', 'adapter-ups-freight'],
  ['Paperless', 'Paperless-ngx'],
  ['DEA', 'DEA ARCOS'],
  ['FDA', 'FDA Reporting'],
];

export const DEFAULT_PALETTE: SorPaletteEntry = {
  bg: 'bg-muted-foreground',
  text: 'text-white',
  fill: '#6b7280',
  fillBg: '#6b72801a',
};

export function resolveSorPalette(name: string): SorPaletteEntry {
  if (SOR_PALETTE[name]) return SOR_PALETTE[name];
  for (const [substr, key] of FUZZY_KEYS) {
    if (name.includes(substr)) return SOR_PALETTE[key]!;
  }
  return DEFAULT_PALETTE;
}
