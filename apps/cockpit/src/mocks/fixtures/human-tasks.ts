import type {
  HumanTaskSummary,
  HumanTaskStatus,
  RunSummary,
  WorkItemSummary,
  WorkforceMemberSummary,
  WorkforceCapability,
} from '@portarium/cockpit-types'

const TASK_DESCRIPTIONS = [
  'Review temperature deviation report for cold room Zone 3 and confirm corrective actions.',
  'Verify chain-of-custody documentation for DEA Schedule II substances.',
  'Inspect incoming pharmaceutical batch and sign off on QC results.',
  'Approve corrective action plan for AGV collision incident near bay 4.',
  'Manually reconcile supplier invoice line items with PO — threshold exceeded.',
  'Confirm disposal procedure for temperature-breached Moderna shipment.',
  'Sign off on cryo unit CU-2041 maintenance completion checklist.',
  'Review FDA 21 CFR Part 211 compliance report before submission.',
  'Validate robot fleet charging cycle schedule for Chicago site.',
  'Approve updated calibration certificates for cold storage sensors.',
  'Perform dual-operator verification for controlled substance vault access.',
  'Review and approve cold chain deviation root cause analysis — Dallas.',
  'Confirm packaging integrity check results for outbound shipment PKG-1088.',
  'Approve HVAC calibration results for Atlanta Zone 5.',
  'Verify 3-way match for BioFreeze Solutions invoice INV-4421.',
]

const STEP_IDS = [
  'step-qc-review',
  'step-approval-gate',
  'step-manual-verify',
  'step-compliance-check',
  'step-dual-operator',
  'step-sign-off',
  'step-reconcile',
  'step-inspect',
]

const CAPABILITY_SETS: WorkforceCapability[][] = [
  ['operations.approval'],
  ['operations.dispatch'],
  ['operations.approval', 'operations.escalation'],
  ['robotics.supervision'],
  ['robotics.supervision', 'robotics.safety.override'],
  ['operations.dispatch', 'operations.approval'],
]

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString()
}

export function buildMockHumanTasks(
  runs: RunSummary[],
  workItems: WorkItemSummary[],
  workforceMembers: WorkforceMemberSummary[],
): HumanTaskSummary[] {
  const count = Math.min(12, Math.max(8, runs.length))
  const tasks: HumanTaskSummary[] = []
  const now = new Date()

  const statuses: HumanTaskStatus[] = [
    'pending', 'pending', 'pending',
    'assigned', 'assigned',
    'in-progress', 'in-progress', 'in-progress',
    'completed', 'completed',
    'escalated',
    'pending',
  ]

  for (let i = 0; i < count; i++) {
    const run = runs[i % runs.length]!
    const wi = workItems[i % workItems.length]!
    const status = statuses[i % statuses.length]!
    const description = TASK_DESCRIPTIONS[i % TASK_DESCRIPTIONS.length]!
    const stepId = STEP_IDS[i % STEP_IDS.length]!
    const caps = CAPABILITY_SETS[i % CAPABILITY_SETS.length]!

    const assignable = workforceMembers.filter((m) => m.availabilityStatus !== 'offline')
    const assignee = status !== 'pending' && assignable.length > 0
      ? assignable[i % assignable.length]!
      : undefined

    // Some tasks have due dates, some overdue
    let dueAt: string | undefined
    if (i % 3 !== 2) {
      const hoursOffset = i < 4 ? -12 : 24 + i * 6
      dueAt = addHours(now.toISOString(), hoursOffset)
    }

    const completed = status === 'completed'
    const completedAt = completed ? addHours(now.toISOString(), -(i + 1) * 2) : undefined
    const completedById = completed && assignee ? assignee.workforceMemberId : undefined

    tasks.push({
      schemaVersion: 1,
      humanTaskId: `ht-m${String(i + 1).padStart(4, '0')}`,
      workItemId: wi.workItemId,
      runId: run.runId,
      stepId,
      assigneeId: assignee?.workforceMemberId,
      description,
      requiredCapabilities: caps,
      status,
      dueAt,
      completedAt,
      completedById,
    })
  }

  return tasks
}
