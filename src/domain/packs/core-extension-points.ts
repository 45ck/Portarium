export const CORE_EXTENSION_POINTS = [
  'core.person',
  'core.organisation',
  'core.organisation_unit',
  'core.location',
  'core.asset',
  'core.transaction',
  'core.financial_transaction',
  'core.event',
  'core.record',
  'core.policy_object',
  'core.evidence_object',
  'core.relationship',
] as const;

export type CoreExtensionPoint = (typeof CORE_EXTENSION_POINTS)[number];

export function isCoreExtensionPoint(value: string): value is CoreExtensionPoint {
  return (CORE_EXTENSION_POINTS as readonly string[]).includes(value);
}
