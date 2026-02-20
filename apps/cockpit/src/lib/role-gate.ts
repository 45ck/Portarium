import type { PersonaId } from '@/stores/ui-store';

type Feature =
  | 'users'
  | 'governance'
  | 'approvals'
  | 'runs:cancel'
  | 'agents:register'
  | 'runs:create'
  | 'credentials'
  | 'settings';

const ACCESS_MATRIX: Record<Feature, PersonaId[]> = {
  users: ['Admin'],
  governance: ['Admin', 'Auditor', 'Approver', 'Operator'],
  approvals: ['Admin', 'Approver'],
  'runs:cancel': ['Admin', 'Operator'],
  'agents:register': ['Admin'],
  'runs:create': ['Admin', 'Operator'],
  credentials: ['Admin'],
  settings: ['Admin'],
};

export function canAccess(persona: PersonaId, feature: Feature): boolean {
  return ACCESS_MATRIX[feature]?.includes(persona) ?? false;
}
