import type { TriageViewMode } from '@/stores/ui-store';

const ADVANCED_TRIAGE_MODES = new Set<TriageViewMode>([
  'briefing',
  'risk-radar',
  'blast-map',
  'action-replay',
  'story-timeline',
  'policy-precedent',
  'finance-impact',
]);

export function shouldShowAdvancedTriageModes(): boolean {
  return import.meta.env.VITE_PORTARIUM_SHOW_ADVANCED_TRIAGE === 'true';
}

export function isTriageModeSelectableByDefault(mode: TriageViewMode): boolean {
  return shouldShowAdvancedTriageModes() || !ADVANCED_TRIAGE_MODES.has(mode);
}
