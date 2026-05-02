import { type ExecutionTier } from '@/lib/policy-studio-search';

export type CapabilityPosturePresetId = 'balanced' | 'conservative' | 'high-throughput';

export interface CapabilityPosture {
  tier: ExecutionTier;
  roles: readonly string[];
  evidence: readonly string[];
}

export interface CapabilityPostureException {
  id: string;
  label: string;
  appliesTo: string;
  tier: ExecutionTier;
  roles?: readonly string[];
  evidence?: readonly string[];
  reason: string;
  source: string;
}

export interface CapabilityPostureRow {
  id: string;
  capability: string;
  family: string;
  actionPattern: string;
  environment: string;
  resource: string;
  dataSensitivity: string;
  blastRadius: string;
  persistence: string;
  inheritedFrom: string;
  doctrine: string;
  defaultPosture: CapabilityPosture;
  presetOverrides?: Partial<Record<CapabilityPosturePresetId, Partial<CapabilityPosture>>>;
  exceptions: readonly CapabilityPostureException[];
  rationale: string;
}

export interface CapabilityPosturePreset {
  id: CapabilityPosturePresetId;
  label: string;
  description: string;
}

export interface EffectivePostureLayer {
  label: string;
  source: string;
  posture: CapabilityPosture;
  note: string;
}

export interface EffectiveCapabilityPosture {
  row: CapabilityPostureRow;
  preset: CapabilityPosturePreset;
  posture: CapabilityPosture;
  exceptionCount: number;
  strongestException?: CapabilityPostureException;
  layers: readonly EffectivePostureLayer[];
  explanation: string;
}

export const CAPABILITY_POSTURE_PRESETS: readonly CapabilityPosturePreset[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Keep current Workspace defaults and show exceptions explicitly.',
  },
  {
    id: 'conservative',
    label: 'Conservative',
    description: 'Raise risky write, delivery, and administration Actions toward review.',
  },
  {
    id: 'high-throughput',
    label: 'High throughput',
    description: 'Relax low-risk reversible Actions where evidence remains visible.',
  },
] as const;

export const CAPABILITY_POSTURE_ROWS: readonly CapabilityPostureRow[] = [
  {
    id: 'external-communication',
    capability: 'External communication',
    family: 'CommsCollaboration',
    actionPattern: 'message.send.external',
    environment: 'Production',
    resource: 'Customer and partner channels',
    dataSensitivity: 'Customer-visible content',
    blastRadius: 'External recipients',
    persistence: 'Visible downstream output',
    inheritedFrom: 'Workspace default / Comms policy',
    doctrine: 'External messages need a visible draft and recipient set before release.',
    defaultPosture: {
      tier: 'HumanApprove',
      roles: ['Approver', 'Comms operator'],
      evidence: ['Draft preview', 'Recipient or target list', 'Policy trace'],
    },
    presetOverrides: {
      conservative: {
        tier: 'HumanApprove',
        evidence: ['Draft preview', 'Recipient or target list', 'Sample output', 'Policy trace'],
      },
      'high-throughput': {
        tier: 'Assisted',
        roles: ['Comms operator'],
      },
    },
    exceptions: [
      {
        id: 'vip-review',
        label: 'VIP recipient exception',
        appliesTo: 'Executive accounts and named strategic customers',
        tier: 'HumanApprove',
        roles: ['Approver', 'Comms operator'],
        evidence: ['Draft preview', 'Recipient or target list', 'Account owner note'],
        reason: 'Named accounts need account-owner visibility before outbound contact.',
        source: 'Vertical Pack: Revenue Operations',
      },
    ],
    rationale:
      'The default allows operators to prepare outbound work while keeping customer-visible delivery gated.',
  },
  {
    id: 'internal-note-update',
    capability: 'Internal note update',
    family: 'CrmSales',
    actionPattern: 'note.update.internal',
    environment: 'Production',
    resource: 'CRM and support notes',
    dataSensitivity: 'Internal operational metadata',
    blastRadius: 'Single record',
    persistence: 'Reversible workspace change',
    inheritedFrom: 'Platform doctrine / low-risk writes',
    doctrine: 'Low-risk internal updates can run without a human queue when the diff is visible.',
    defaultPosture: {
      tier: 'Auto',
      roles: ['Operator'],
      evidence: ['Sample output'],
    },
    presetOverrides: {
      conservative: {
        tier: 'Assisted',
        evidence: ['Sample output', 'Diff artifact', 'Policy trace'],
      },
      'high-throughput': {
        tier: 'Auto',
      },
    },
    exceptions: [
      {
        id: 'pii-note-review',
        label: 'PII note exception',
        appliesTo: 'Notes containing personal data',
        tier: 'Assisted',
        evidence: ['Diff artifact', 'Policy trace'],
        reason: 'Personal data edits require a visible diff even when the action is reversible.',
        source: 'Workspace privacy rule',
      },
    ],
    rationale:
      'Routine internal notes should not add approval noise, but the PII exception keeps privacy review visible.',
  },
  {
    id: 'persistent-automation',
    capability: 'Persistent automation',
    family: 'ProjectsWorkMgmt',
    actionPattern: 'schedule.create.persistent',
    environment: 'Production',
    resource: 'Scheduled workflows and recurring jobs',
    dataSensitivity: 'Workspace automation control',
    blastRadius: 'Repeated future Actions',
    persistence: 'Long-running schedule',
    inheritedFrom: 'Platform doctrine / persistent execution',
    doctrine: 'Persistent unattended execution cannot be treated as a one-off Action.',
    defaultPosture: {
      tier: 'ManualOnly',
      roles: ['Admin', 'Policy owner'],
      evidence: ['Diff artifact', 'Rollback plan', 'Connector posture check', 'Policy trace'],
    },
    presetOverrides: {
      conservative: {
        tier: 'ManualOnly',
        evidence: [
          'Diff artifact',
          'Rollback plan',
          'Connector posture check',
          'Break-glass ticket',
          'Policy trace',
        ],
      },
    },
    exceptions: [
      {
        id: 'sandbox-schedule-pilot',
        label: 'Sandbox pilot exception',
        appliesTo: 'Sandbox only, disabled by default in production',
        tier: 'HumanApprove',
        roles: ['Admin'],
        evidence: ['Diff artifact', 'Rollback plan', 'Policy trace'],
        reason: 'Sandbox pilots can test schedules while production keeps manual control.',
        source: 'Workspace exception',
      },
    ],
    rationale:
      'Schedule creation changes future autonomy, so the default posture stays outside direct automation.',
  },
  {
    id: 'money-movement',
    capability: 'Money movement',
    family: 'PaymentsBilling',
    actionPattern: 'payment.create|refund.create',
    environment: 'Production',
    resource: 'Payment and refund providers',
    dataSensitivity: 'Financial transaction data',
    blastRadius: 'External financial transfer',
    persistence: 'Partially reversible',
    inheritedFrom: 'Workspace default / Finance policy',
    doctrine: 'Financial Actions need maker-checker authority and evidence before execution.',
    defaultPosture: {
      tier: 'HumanApprove',
      roles: ['Finance reviewer', 'Approver'],
      evidence: ['Diff artifact', 'Recipient or target list', 'Policy trace'],
    },
    presetOverrides: {
      conservative: {
        tier: 'ManualOnly',
        roles: ['Finance reviewer', 'Admin'],
        evidence: ['Diff artifact', 'Recipient or target list', 'Rollback plan', 'Policy trace'],
      },
      'high-throughput': {
        tier: 'HumanApprove',
      },
    },
    exceptions: [
      {
        id: 'high-value-transfer',
        label: 'High-value transfer exception',
        appliesTo: 'Amount exceeds workspace payment threshold',
        tier: 'ManualOnly',
        roles: ['Finance reviewer', 'Admin'],
        evidence: ['Diff artifact', 'Recipient or target list', 'Rollback plan', 'Policy trace'],
        reason: 'Large transfers require manual dual control and rollback planning.',
        source: 'SoD constraint: Finance Dual Control',
      },
    ],
    rationale:
      'Most payment work can be prepared by workflow, but authority and evidence stay human-gated.',
  },
  {
    id: 'destructive-mailbox',
    capability: 'Destructive mailbox action',
    family: 'CommsCollaboration',
    actionPattern: 'mail.delete.bulk',
    environment: 'Production',
    resource: 'Shared inboxes',
    dataSensitivity: 'Customer and audit communications',
    blastRadius: 'Workspace-wide mailbox state',
    persistence: 'Irreversible',
    inheritedFrom: 'Platform doctrine / destructive Actions',
    doctrine: 'Destructive shared-state Actions stay outside autonomous execution.',
    defaultPosture: {
      tier: 'ManualOnly',
      roles: ['Security admin'],
      evidence: ['Blast radius preview', 'Break-glass ticket', 'Rollback plan', 'Policy trace'],
    },
    presetOverrides: {
      'high-throughput': {
        tier: 'ManualOnly',
      },
    },
    exceptions: [],
    rationale:
      'The default intentionally prevents approval fatigue from normalizing destructive mailbox changes.',
  },
];

const TIER_RANK: Record<ExecutionTier, number> = {
  Auto: 0,
  Assisted: 1,
  HumanApprove: 2,
  ManualOnly: 3,
};

const PRESETS_BY_ID = new Map(CAPABILITY_POSTURE_PRESETS.map((preset) => [preset.id, preset]));

export function coerceCapabilityPosturePreset(
  value: unknown,
): CapabilityPosturePresetId | undefined {
  return PRESETS_BY_ID.has(value as CapabilityPosturePresetId)
    ? (value as CapabilityPosturePresetId)
    : undefined;
}

export function resolveCapabilityPosturePreset(id: CapabilityPosturePresetId) {
  return PRESETS_BY_ID.get(id) ?? CAPABILITY_POSTURE_PRESETS[0]!;
}

export function compareExecutionTier(left: ExecutionTier, right: ExecutionTier): number {
  return TIER_RANK[left] - TIER_RANK[right];
}

export function mergeUnique(left: readonly string[], right: readonly string[]): readonly string[] {
  return Array.from(new Set([...left, ...right]));
}

export function applyCapabilityPosturePreset(
  row: CapabilityPostureRow,
  presetId: CapabilityPosturePresetId,
): CapabilityPosture {
  const override = row.presetOverrides?.[presetId];
  return {
    tier: override?.tier ?? row.defaultPosture.tier,
    roles: override?.roles
      ? mergeUnique(row.defaultPosture.roles, override.roles)
      : row.defaultPosture.roles,
    evidence: override?.evidence
      ? mergeUnique(row.defaultPosture.evidence, override.evidence)
      : row.defaultPosture.evidence,
  };
}

export function findStrongestException(
  exceptions: readonly CapabilityPostureException[],
): CapabilityPostureException | undefined {
  return exceptions.reduce<CapabilityPostureException | undefined>((strongest, exception) => {
    if (!strongest) return exception;
    return compareExecutionTier(exception.tier, strongest.tier) > 0 ? exception : strongest;
  }, undefined);
}

export function resolveEffectiveCapabilityPosture(
  row: CapabilityPostureRow,
  presetId: CapabilityPosturePresetId,
): EffectiveCapabilityPosture {
  const preset = resolveCapabilityPosturePreset(presetId);
  const presetPosture = applyCapabilityPosturePreset(row, preset.id);
  const strongestException = findStrongestException(row.exceptions);
  const effectiveTier =
    strongestException && compareExecutionTier(strongestException.tier, presetPosture.tier) > 0
      ? strongestException.tier
      : presetPosture.tier;
  const effectiveRoles = strongestException?.roles
    ? mergeUnique(presetPosture.roles, strongestException.roles)
    : presetPosture.roles;
  const effectiveEvidence = strongestException?.evidence
    ? mergeUnique(presetPosture.evidence, strongestException.evidence)
    : presetPosture.evidence;
  const posture = {
    tier: effectiveTier,
    roles: effectiveRoles,
    evidence: effectiveEvidence,
  };
  const presetChanged =
    presetPosture.tier !== row.defaultPosture.tier ||
    presetPosture.roles.length !== row.defaultPosture.roles.length ||
    presetPosture.evidence.length !== row.defaultPosture.evidence.length;
  const layers: EffectivePostureLayer[] = [
    {
      label: 'Platform doctrine',
      source: row.inheritedFrom,
      posture: row.defaultPosture,
      note: row.doctrine,
    },
    {
      label: 'Workspace default',
      source: row.capability,
      posture: row.defaultPosture,
      note: row.rationale,
    },
    {
      label: 'Preset',
      source: preset.label,
      posture: presetPosture,
      note: presetChanged
        ? `${preset.label} changes this row before exceptions are considered.`
        : `${preset.label} keeps this row at the published default.`,
    },
  ];

  if (strongestException) {
    layers.push({
      label: 'Exception',
      source: strongestException.source,
      posture: {
        tier: strongestException.tier,
        roles: strongestException.roles ?? [],
        evidence: strongestException.evidence ?? [],
      },
      note: `${strongestException.label}: ${strongestException.reason}`,
    });
  }

  return {
    row,
    preset,
    posture,
    exceptionCount: row.exceptions.length,
    ...(strongestException ? { strongestException } : {}),
    layers,
    explanation: buildEffectivePostureExplanation(row, preset.label, posture, strongestException),
  };
}

export function buildEffectivePostureExplanation(
  row: CapabilityPostureRow,
  presetLabel: string,
  posture: CapabilityPosture,
  exception?: CapabilityPostureException,
): string {
  const exceptionText = exception
    ? ` The strongest visible exception is "${exception.label}", which applies to ${exception.appliesTo}.`
    : ' No exception currently overrides the default.';
  return `${row.capability} starts from ${row.inheritedFrom}. The ${presetLabel} preset resolves it to ${posture.tier} with ${posture.roles.length} role gate${posture.roles.length === 1 ? '' : 's'} and ${posture.evidence.length} evidence requirement${posture.evidence.length === 1 ? '' : 's'}.${exceptionText}`;
}

export function summarizeEffectivePostures(
  rows: readonly CapabilityPostureRow[],
  presetId: CapabilityPosturePresetId,
): Record<ExecutionTier, number> {
  return rows.reduce<Record<ExecutionTier, number>>(
    (summary, row) => {
      const effective = resolveEffectiveCapabilityPosture(row, presetId);
      summary[effective.posture.tier] += 1;
      return summary;
    },
    {
      Auto: 0,
      Assisted: 0,
      HumanApprove: 0,
      ManualOnly: 0,
    },
  );
}
