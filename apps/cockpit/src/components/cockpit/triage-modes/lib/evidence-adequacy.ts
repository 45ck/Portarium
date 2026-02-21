import type { EvidenceEntry } from '@portarium/cockpit-types';

export interface AdequacyResult {
  score: number;
  label: 'Adequate' | 'Partial' | 'Insufficient';
  color: string;
  entryCount: number;
  actorCount: number;
  categoryCount: number;
  attachmentCount: number;
}

function actorLabel(actor: EvidenceEntry['actor']): string {
  switch (actor.kind) {
    case 'User':
      return actor.userId;
    case 'Machine':
      return actor.machineId;
    case 'Adapter':
      return actor.adapterId;
    case 'System':
      return 'System';
  }
}

export function computeAdequacy(entries: EvidenceEntry[]): AdequacyResult {
  const entryCount = entries.length;
  const actorSet = new Set(entries.map((e) => actorLabel(e.actor)));
  const actorCount = actorSet.size;
  const categories = new Set(entries.map((e) => e.category));
  const categoryCount = categories.size;
  const attachmentCount = entries.reduce((sum, e) => sum + (e.payloadRefs?.length ?? 0), 0);

  let score = 0;
  if (entryCount >= 3) score += 25;
  score += Math.min(25, (categoryCount / 5) * 25);
  if (actorCount >= 2) score += 25;
  if (attachmentCount >= 1) score += 25;
  score = Math.round(score);

  const label: AdequacyResult['label'] =
    score >= 75 ? 'Adequate' : score >= 40 ? 'Partial' : 'Insufficient';
  const color = score >= 75 ? 'text-emerald-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600';

  return { score, label, color, entryCount, actorCount, categoryCount, attachmentCount };
}
