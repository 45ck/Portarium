// ---------------------------------------------------------------------------
// Meridian Cold Chain Logistics — Seed helpers
// Shared constants and generator functions for both demo and full datasets.
// ---------------------------------------------------------------------------

import type {
  WorkItemSummary,
  RunSummary,
  ApprovalSummary,
  EvidenceEntry,
  WorkforceMemberSummary,
  WorkforceQueueSummary,
  AgentV1,
  EvidenceCategory,
  EvidenceActor,
  RunStatus,
  ApprovalStatus,
  Plan,
  PlanEffect,
  EffectOperation,
  CredentialGrantV1,
  AdapterSummary,
} from '@portarium/cockpit-types'
import type {
  RobotSummary,
  MissionSummary,
  SafetyConstraint,
  ApprovalThreshold,
  EStopAuditEntry,
  RobotClass,
  RobotStatus,
  MissionStatus,
  MissionActionType,
} from '@/types/robotics'

// ---- deterministic pseudo-random (xorshift32) ----------------------------
function xorshift32(seed: number) {
  let s = seed | 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >> 17
    s ^= s << 5
    return (s >>> 0) / 0xffffffff
  }
}

// ---- timestamp helpers ---------------------------------------------------
function isoDate(year: number, month: number, day: number, h = 0, m = 0, s = 0): string {
  return new Date(Date.UTC(year, month - 1, day, h, m, s)).toISOString()
}

function randomIso(rand: () => number, startIso: string, endIso: string): string {
  const a = new Date(startIso).getTime()
  const b = new Date(endIso).getTime()
  return new Date(a + rand() * (b - a)).toISOString()
}

function addMinutes(iso: string, mins: number): string {
  return new Date(new Date(iso).getTime() + mins * 60_000).toISOString()
}

// ---- fake hash chain -----------------------------------------------------
function fakeHash(index: number): string {
  const hex = 'abcdef0123456789'
  let h = ''
  let v = index * 7919 + 31
  for (let i = 0; i < 64; i++) {
    v = ((v * 48271) % 0x7fffffff) >>> 0
    h += hex[v % 16]
  }
  return h
}

// ---- pick helper ---------------------------------------------------------
function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!
}

function pickN<T>(rand: () => number, arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => rand() - 0.5)
  return shuffled.slice(0, n)
}

// ---- Meridian domain constants -------------------------------------------

const SITES = ['Chicago IL', 'Dallas TX', 'Atlanta GA'] as const
const SITE_CODES = ['CHI', 'DAL', 'ATL'] as const

const WORKFLOW_IDS = [
  'wf-order-fulfillment',
  'wf-qc-approval',
  'wf-maintenance-window',
  'wf-incident-report',
  'wf-supplier-invoice',
  'wf-cold-chain-deviation',
  'wf-controlled-substance-audit',
] as const

const WORKFLOW_TITLES: Record<string, string[]> = {
  'wf-order-fulfillment': [
    'Order fulfillment: Pfizer Batch PFZ-{n} — {site}',
    'Order fulfillment: Moderna shipment MOD-{n} — {site}',
    'Order fulfillment: J&J vaccine lot JNJ-{n} — {site}',
    'Order fulfillment: AbbVie Humira batch ABV-{n} — {site}',
    'Order fulfillment: Roche biologics ROC-{n} — {site}',
  ],
  'wf-qc-approval': [
    'QC approval: Temperature log review — {site} Zone {z}',
    'QC approval: Incoming inspection batch QC-{n} — {site}',
    'QC approval: Packaging integrity check PKG-{n} — {site}',
  ],
  'wf-maintenance-window': [
    'Maintenance window: Cryo unit CU-{n} service — {site}',
    'Maintenance window: AGV fleet charging cycle — {site}',
    'Maintenance window: HVAC calibration — {site} Zone {z}',
  ],
  'wf-incident-report': [
    'Incident: Temperature excursion Zone {z} — {site}',
    'Incident: Robot collision near bay {z} — {site}',
    'Incident: Power fluctuation in cold room — {site}',
  ],
  'wf-supplier-invoice': [
    'Supplier invoice: Carrier Logistics INV-{n}',
    'Supplier invoice: ColdPack Materials INV-{n}',
    'Supplier invoice: BioFreeze Solutions INV-{n}',
  ],
  'wf-cold-chain-deviation': [
    'Cold chain deviation: Shipment SHP-{n} temp breach — {site}',
    'Cold chain deviation: Freezer F-{n} alarm — {site}',
    'Cold chain deviation: Loading dock exposure — {site}',
  ],
  'wf-controlled-substance-audit': [
    'Controlled substance audit: DEA Schedule II — {site}',
    'Controlled substance audit: Opioid inventory CSA-{n} — {site}',
    'Controlled substance audit: Chain of custody COC-{n} — {site}',
  ],
}

const RUN_STATUSES: RunStatus[] = ['Pending', 'Running', 'WaitingForApproval', 'Paused', 'Succeeded', 'Failed', 'Cancelled']
const RUN_STATUS_WEIGHTS = [0.05, 0.10, 0.10, 0.05, 0.50, 0.12, 0.08]

const APPROVAL_STATUSES: ApprovalStatus[] = ['Pending', 'Approved', 'Denied', 'RequestChanges']
const APPROVAL_STATUS_WEIGHTS = [0.20, 0.55, 0.15, 0.10]

const EVIDENCE_CATEGORIES: EvidenceCategory[] = ['System', 'Approval', 'Action', 'Plan', 'Policy']

const ROBOT_CLASSES: RobotClass[] = ['AMR', 'AGV', 'Manipulator', 'UAV', 'PLC']

const ROBOT_CAPABILITIES: Record<RobotClass, string[]> = {
  AMR: ['navigate', 'localize', 'obstacle-avoidance', 'barcode-scan'],
  AGV: ['transport', 'dock', 'pallet-lift'],
  Manipulator: ['pick', 'place', 'grip', 'weigh'],
  UAV: ['fly', 'scan', 'photograph', 'thermal-imaging'],
  PLC: ['temperature-control', 'humidity-control', 'alarm-monitor', 'data-log'],
}

const MISSION_GOALS: Record<RobotClass, { goal: string; action: MissionActionType }[]> = {
  AMR: [
    { goal: 'Navigate to cold room {z} — pick order', action: 'navigate_to' },
    { goal: 'Transport tote to packing station {z}', action: 'navigate_to' },
    { goal: 'Return to staging area after delivery', action: 'navigate_to' },
  ],
  AGV: [
    { goal: 'Move pallet PLT-{n} to loading dock', action: 'navigate_to' },
    { goal: 'Return to charge station', action: 'dock' },
    { goal: 'Transfer pallet to outbound staging', action: 'navigate_to' },
  ],
  Manipulator: [
    { goal: 'Pick SKU-{n} from cold storage shelf', action: 'pick' },
    { goal: 'Place vials into shipping container', action: 'place' },
    { goal: 'Sort incoming shipment items', action: 'pick' },
  ],
  UAV: [
    { goal: 'Inventory scan — Zone {z} racks', action: 'custom' },
    { goal: 'Thermal audit — cold room {z}', action: 'custom' },
    { goal: 'Dock at charging pad', action: 'dock' },
  ],
  PLC: [
    { goal: 'Maintain -20°C in Freezer F-{n}', action: 'custom' },
    { goal: 'Monitor humidity Zone {z}', action: 'custom' },
    { goal: 'Log temperature readings batch', action: 'custom' },
  ],
}

const ADAPTER_DEFS = [
  { id: 'adapter-servicenow', name: 'ServiceNow ITSM', sorFamily: 'Itsm' },
  { id: 'adapter-sap', name: 'SAP ERP', sorFamily: 'FinanceAccounting' },
  { id: 'adapter-salesforce', name: 'Salesforce CRM', sorFamily: 'CrmSales' },
  { id: 'adapter-stripe', name: 'Stripe Billing', sorFamily: 'PaymentsBilling' },
  { id: 'adapter-mautic', name: 'Mautic Comms', sorFamily: 'MarketingComms' },
  { id: 'adapter-keycloak', name: 'Keycloak IAM', sorFamily: 'IdentityAccess' },
  { id: 'adapter-vault', name: 'HashiCorp Vault', sorFamily: 'SecretsManagement' },
  { id: 'adapter-zammad', name: 'Zammad Support', sorFamily: 'CustomerSupport' },
  { id: 'adapter-paperless', name: 'Paperless-ngx Docs', sorFamily: 'DocumentManagement' },
  { id: 'adapter-fda-reporting', name: 'FDA Reporting (custom)', sorFamily: 'RegulatoryCompliance' },
  { id: 'adapter-cold-monitor', name: 'ColdChain IoT Monitor', sorFamily: 'IoTTelemetry' },
  { id: 'adapter-dea-track', name: 'DEA ARCOS Tracking', sorFamily: 'RegulatoryCompliance' },
  { id: 'adapter-ups-freight', name: 'UPS Freight', sorFamily: 'LogisticsShipping' },
  { id: 'adapter-fedex-pharma', name: 'FedEx Pharma Priority', sorFamily: 'LogisticsShipping' },
  { id: 'adapter-lims', name: 'LabWare LIMS', sorFamily: 'LaboratoryInfo' },
] as const

const AGENT_DEFS = [
  { id: 'agent-order-router', name: 'Order Router', model: 'claude-opus-4-6', caps: ['read:external', 'analyze', 'classify'] as const, wfIds: ['wf-order-fulfillment'] },
  { id: 'agent-deviation-detector', name: 'Deviation Detector', model: 'claude-sonnet-4-6', caps: ['read:external', 'analyze', 'notify'] as const, wfIds: ['wf-cold-chain-deviation', 'wf-incident-report'] },
  { id: 'agent-compliance-checker', name: 'Compliance Checker', model: 'claude-opus-4-6', caps: ['read:external', 'analyze', 'classify', 'generate'] as const, wfIds: ['wf-controlled-substance-audit', 'wf-qc-approval'] },
  { id: 'agent-maintenance-scheduler', name: 'Maintenance Scheduler', model: 'claude-haiku-4-5-20251001', caps: ['read:external', 'analyze'] as const, wfIds: ['wf-maintenance-window'] },
  { id: 'agent-invoice-reconciler', name: 'Invoice Reconciler', model: 'claude-sonnet-4-6', caps: ['read:external', 'analyze', 'classify'] as const, wfIds: ['wf-supplier-invoice'] },
  { id: 'agent-fda-reporter', name: 'FDA Report Generator', model: 'claude-opus-4-6', caps: ['read:external', 'generate', 'write:external'] as const, wfIds: ['wf-controlled-substance-audit'] },
  { id: 'agent-cold-chain-analyst', name: 'Cold Chain Analyst', model: 'claude-sonnet-4-6', caps: ['read:external', 'analyze', 'notify'] as const, wfIds: ['wf-cold-chain-deviation'] },
  { id: 'agent-robot-coordinator', name: 'Robot Mission Coordinator', model: 'claude-haiku-4-5-20251001', caps: ['read:external', 'analyze', 'execute-code'] as const, wfIds: ['wf-order-fulfillment', 'wf-maintenance-window'] },
  { id: 'agent-audit-trail', name: 'Audit Trail Compiler', model: 'claude-sonnet-4-6', caps: ['read:external', 'generate'] as const, wfIds: ['wf-controlled-substance-audit', 'wf-qc-approval'] },
  { id: 'agent-sla-watchdog', name: 'SLA Watchdog', model: 'claude-haiku-4-5-20251001', caps: ['read:external', 'analyze', 'notify'] as const, wfIds: ['wf-order-fulfillment', 'wf-supplier-invoice'] },
] as const

const MEMBER_DEFS = [
  { id: 'wfm-m001', userId: 'user-maria-chen', name: 'Maria Chen', role: 'Site Director — Chicago', caps: ['operations.dispatch', 'operations.approval', 'operations.escalation', 'robotics.supervision'] as const },
  { id: 'wfm-m002', userId: 'user-james-walker', name: 'James Walker', role: 'Warehouse Ops Lead — Chicago', caps: ['operations.dispatch', 'operations.approval'] as const },
  { id: 'wfm-m003', userId: 'user-priya-patel', name: 'Priya Patel', role: 'QC Manager — Chicago', caps: ['operations.approval', 'operations.escalation'] as const },
  { id: 'wfm-m004', userId: 'user-derek-johnson', name: 'Derek Johnson', role: 'Robotics Supervisor — Chicago', caps: ['operations.dispatch', 'robotics.supervision', 'robotics.safety.override'] as const },
  { id: 'wfm-m005', userId: 'user-sarah-kim', name: 'Sarah Kim', role: 'Site Director — Dallas', caps: ['operations.dispatch', 'operations.approval', 'operations.escalation', 'robotics.supervision'] as const },
  { id: 'wfm-m006', userId: 'user-carlos-reyes', name: 'Carlos Reyes', role: 'Cold Chain Specialist — Dallas', caps: ['operations.dispatch', 'operations.approval'] as const },
  { id: 'wfm-m007', userId: 'user-amanda-foster', name: 'Amanda Foster', role: 'Compliance Officer', caps: ['operations.approval', 'operations.escalation'] as const },
  { id: 'wfm-m008', userId: 'user-kevin-thompson', name: 'Kevin Thompson', role: 'Site Director — Atlanta', caps: ['operations.dispatch', 'operations.approval', 'operations.escalation'] as const },
  { id: 'wfm-m009', userId: 'user-lisa-nguyen', name: 'Lisa Nguyen', role: 'Warehouse Ops Lead — Dallas', caps: ['operations.dispatch', 'operations.approval'] as const },
  { id: 'wfm-m010', userId: 'user-robert-garcia', name: 'Robert Garcia', role: 'Robotics Supervisor — Dallas', caps: ['operations.dispatch', 'robotics.supervision', 'robotics.safety.override'] as const },
  { id: 'wfm-m011', userId: 'user-emily-davis', name: 'Emily Davis', role: 'Warehouse Ops Lead — Atlanta', caps: ['operations.dispatch', 'operations.approval'] as const },
  { id: 'wfm-m012', userId: 'user-michael-brown', name: 'Michael Brown', role: 'IT & Integrations Lead', caps: ['operations.dispatch', 'operations.escalation'] as const },
] as const

const QUEUE_DEFS = [
  { id: 'queue-chi-ops', name: 'Chicago Operations', caps: ['operations.dispatch'] as const, strategy: 'round-robin' as const, site: 0 },
  { id: 'queue-dal-ops', name: 'Dallas Operations', caps: ['operations.dispatch'] as const, strategy: 'round-robin' as const, site: 1 },
  { id: 'queue-atl-ops', name: 'Atlanta Operations', caps: ['operations.dispatch'] as const, strategy: 'round-robin' as const, site: 2 },
  { id: 'queue-compliance', name: 'Compliance & QC Approvals', caps: ['operations.approval'] as const, strategy: 'least-busy' as const, site: -1 },
  { id: 'queue-robotics', name: 'Robotics Supervision', caps: ['robotics.supervision'] as const, strategy: 'least-busy' as const, site: -1 },
  { id: 'queue-escalation', name: 'Escalation & Incidents', caps: ['operations.escalation'] as const, strategy: 'manual' as const, site: -1 },
] as const

// ---- weighted random pick ------------------------------------------------
function weightedPick<T>(rand: () => number, items: T[], weights: number[]): T {
  const r = rand()
  let acc = 0
  for (let i = 0; i < items.length; i++) {
    acc += weights[i]!
    if (r < acc) return items[i]!
  }
  return items[items.length - 1]!
}

// ---- approval prompts ----------------------------------------------------
function approvalPrompt(rand: () => number, wfId: string, runId: string, site: string): string {
  const prompts: Record<string, string[]> = {
    'wf-order-fulfillment': [
      `Approve release of temperature-sensitive shipment from ${site} cold storage. Run ${runId}.`,
      `Confirm order packaging meets FDA 21 CFR Part 211 requirements. Run ${runId}.`,
    ],
    'wf-qc-approval': [
      `Approve QC inspection results for incoming pharmaceutical batch at ${site}. Run ${runId}.`,
      `Sign off on temperature log deviation analysis — ${site}. Run ${runId}.`,
    ],
    'wf-maintenance-window': [
      `Approve scheduled maintenance window for ${site} cold storage equipment. Run ${runId}.`,
      `Confirm robot fleet can be taken offline for charging cycle. Run ${runId}.`,
    ],
    'wf-incident-report': [
      `Review and approve incident report — temperature excursion at ${site}. Run ${runId}.`,
      `Approve corrective action plan for safety incident at ${site}. Run ${runId}.`,
    ],
    'wf-supplier-invoice': [
      `Approve supplier invoice exceeding auto-approve threshold ($5,000). Run ${runId}.`,
      `Confirm 3-way match for cold-chain logistics invoice. Run ${runId}.`,
    ],
    'wf-cold-chain-deviation': [
      `Approve disposition decision for temperature-breached shipment at ${site}. Run ${runId}.`,
      `Sign off on cold chain deviation root cause analysis — ${site}. Run ${runId}.`,
    ],
    'wf-controlled-substance-audit': [
      `Approve DEA Schedule II inventory reconciliation at ${site}. Run ${runId}.`,
      `Sign off on controlled substance chain-of-custody audit. Run ${runId}.`,
    ],
  }
  const list = prompts[wfId] ?? [`Approve workflow step. Run ${runId}.`]
  return pick(rand, list)
}

// ---- evidence summaries --------------------------------------------------
function evidenceSummary(rand: () => number, category: EvidenceCategory, runId: string, extra: string): string {
  switch (category) {
    case 'System': return pick(rand, [
      `Run ${runId} started by system automation`,
      `System health check passed for ${extra}`,
      `Telemetry snapshot recorded — ${extra}`,
      `Scheduler triggered run ${runId}`,
    ])
    case 'Approval': return pick(rand, [
      `Approval decided for run ${runId} — ${extra}`,
      `Approval requested: ${extra}`,
      `Approval escalated — awaiting senior review for ${runId}`,
    ])
    case 'Action': return pick(rand, [
      `Action completed: ${extra} — run ${runId}`,
      `Adapter sync finished for ${extra}`,
      `Robot mission completed — ${extra}`,
      `Data export generated for ${extra}`,
    ])
    case 'Plan': return pick(rand, [
      `Plan generated: ${extra} effects planned for run ${runId}`,
      `Plan revision submitted for review — ${runId}`,
    ])
    case 'Policy': return pick(rand, [
      `Policy check passed: FDA 21 CFR Part 211 — ${extra}`,
      `Policy violation detected: ${extra}`,
      `Compliance gate cleared for ${runId}`,
    ])
  }
}

// ---- main generator ------------------------------------------------------

export interface MeridianDatasetConfig {
  seed: number
  startIso: string
  endIso: string
  workItemCount: number
  runCount: number
  approvalCount: number
  evidenceCount: number
  memberCount: number
  queueCount: number
  agentCount: number
  adapterCount: number
  robotCount: number
  missionCount: number
}

export interface MeridianDataset {
  WORK_ITEMS: WorkItemSummary[]
  RUNS: RunSummary[]
  APPROVALS: ApprovalSummary[]
  PLANS: Plan[]
  CREDENTIAL_GRANTS: CredentialGrantV1[]
  EVIDENCE: EvidenceEntry[]
  WORKFORCE_MEMBERS: WorkforceMemberSummary[]
  WORKFORCE_QUEUES: WorkforceQueueSummary[]
  AGENTS: AgentV1[]
  ADAPTERS: AdapterSummary[]
  ROBOTS: RobotSummary[]
  MISSIONS: MissionSummary[]
  SAFETY_CONSTRAINTS: SafetyConstraint[]
  APPROVAL_THRESHOLDS: ApprovalThreshold[]
  ESTOP_AUDIT_LOG: EStopAuditEntry[]
  OBSERVABILITY_DATA: {
    runsOverTime: { date: string; succeeded: number; failed: number; waitingForApproval: number }[]
    successRate: number
    avgSlaDays: number
  }
}

export function generateMeridianDataset(cfg: MeridianDatasetConfig): MeridianDataset {
  const rand = xorshift32(cfg.seed)
  const WS = 'ws-meridian'
  const TENANT = 'tenant-meridian'

  // ---- Adapters ----------------------------------------------------------
  const adapterSlice = ADAPTER_DEFS.slice(0, cfg.adapterCount)
  const ADAPTERS = adapterSlice.map((a) => ({
    adapterId: a.id,
    name: a.name,
    sorFamily: a.sorFamily,
    status: (rand() < 0.8 ? 'healthy' : rand() < 0.5 ? 'degraded' : 'unhealthy') as AdapterSummary['status'],
    lastSyncIso: randomIso(rand, cfg.startIso, cfg.endIso),
  }))

  // ---- Agents ------------------------------------------------------------
  const agentSlice = AGENT_DEFS.slice(0, cfg.agentCount)
  const AGENTS: AgentV1[] = agentSlice.map((a) => ({
    schemaVersion: 1 as const,
    agentId: a.id,
    workspaceId: WS,
    name: a.name,
    modelId: a.model,
    endpoint: `https://agents.meridian-coldchain.io/${a.id.replace('agent-', '')}`,
    allowedCapabilities: [...a.caps],
    usedByWorkflowIds: [...a.wfIds],
  }))

  // ---- Workforce Members -------------------------------------------------
  const memberSlice = MEMBER_DEFS.slice(0, cfg.memberCount)
  const availStatuses = ['available', 'busy', 'offline'] as const
  const WORKFORCE_MEMBERS: WorkforceMemberSummary[] = memberSlice.map((m, i) => {
    const queueIds = QUEUE_DEFS.slice(0, cfg.queueCount)
      .filter((q) => m.caps.some((c) => (q.caps as readonly string[]).includes(c)))
      .map((q) => q.id)
    return {
      schemaVersion: 1 as const,
      workforceMemberId: m.id,
      linkedUserId: m.userId,
      displayName: m.name,
      capabilities: [...m.caps],
      availabilityStatus: i < cfg.memberCount - 2 ? pick(rand, ['available', 'busy']) : 'offline',
      queueMemberships: queueIds,
      tenantId: TENANT,
      createdAtIso: isoDate(2025, 6, 15 + i),
    }
  })

  // ---- Workforce Queues --------------------------------------------------
  const queueSlice = QUEUE_DEFS.slice(0, cfg.queueCount)
  const WORKFORCE_QUEUES: WorkforceQueueSummary[] = queueSlice.map((q) => ({
    schemaVersion: 1 as const,
    workforceQueueId: q.id,
    name: q.name,
    requiredCapabilities: [...q.caps],
    memberIds: WORKFORCE_MEMBERS.filter((m) =>
      m.queueMemberships.includes(q.id),
    ).map((m) => m.workforceMemberId),
    routingStrategy: q.strategy,
    tenantId: TENANT,
  }))

  // ---- Robots ------------------------------------------------------------
  const ROBOTS: RobotSummary[] = []
  const robotStatuses: RobotStatus[] = ['Online', 'Degraded', 'E-Stopped', 'Offline']
  const robotStatusWeights = [0.60, 0.15, 0.10, 0.15]
  for (let i = 0; i < cfg.robotCount; i++) {
    const siteIdx = i % 3
    const siteCode = SITE_CODES[siteIdx]!
    const cls = ROBOT_CLASSES[i % ROBOT_CLASSES.length]!
    const classPrefix = cls === 'Manipulator' ? 'ARM' : cls
    const num = String(Math.floor(i / 3) + 1).padStart(3, '0')
    const status = weightedPick(rand, robotStatuses, robotStatusWeights)
    ROBOTS.push({
      robotId: `robot-m${String(i + 1).padStart(3, '0')}`,
      name: `${classPrefix}-${siteCode}-${num}`,
      robotClass: cls,
      status,
      batteryPct: cls === 'PLC' ? 100 : Math.floor(rand() * 80 + 15),
      lastHeartbeatSec: status === 'Offline' ? Math.floor(rand() * 600 + 60) : Math.floor(rand() * 30 + 1),
      gatewayUrl: `grpc://gw-${siteCode.toLowerCase()}.meridian-coldchain.io:${9001 + i}`,
      spiffeSvid: `spiffe://meridian-coldchain.io/robot/robot-m${String(i + 1).padStart(3, '0')}`,
      capabilities: ROBOT_CAPABILITIES[cls]!.slice(0, 2 + Math.floor(rand() * (ROBOT_CAPABILITIES[cls]!.length - 1))),
    })
  }

  // ---- Runs --------------------------------------------------------------
  const RUNS: RunSummary[] = []
  const userIds = memberSlice.map((m) => m.userId)
  for (let i = 0; i < cfg.runCount; i++) {
    const wfId = pick(rand, WORKFLOW_IDS)
    const status = weightedPick(rand, RUN_STATUSES, RUN_STATUS_WEIGHTS)
    const created = randomIso(rand, cfg.startIso, cfg.endIso)
    const started = status !== 'Pending' ? addMinutes(created, Math.floor(rand() * 3 + 1)) : undefined
    const ended = (status === 'Succeeded' || status === 'Failed' || status === 'Cancelled')
      ? addMinutes(started!, Math.floor(rand() * 60 + 5))
      : undefined
    const tier = pick(rand, ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const)
    RUNS.push({
      schemaVersion: 1,
      runId: `run-m${String(i + 1).padStart(4, '0')}`,
      workspaceId: WS,
      workflowId: wfId,
      correlationId: `cor-m${String(i + 1).padStart(4, '0')}`,
      executionTier: tier,
      initiatedByUserId: rand() < 0.3 ? 'system' : pick(rand, userIds),
      status,
      createdAtIso: created,
      startedAtIso: started,
      endedAtIso: ended,
    })
  }

  // sort runs chronologically
  RUNS.sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso))

  // ---- Work Items --------------------------------------------------------
  const WORK_ITEMS: WorkItemSummary[] = []
  for (let i = 0; i < cfg.workItemCount; i++) {
    // link 1-5 runs to this work item
    const linkedRunCount = Math.min(Math.floor(rand() * 5 + 1), cfg.runCount)
    const linkedRuns = pickN(rand, RUNS, linkedRunCount)
    const wfId = linkedRuns[0]!.workflowId
    const siteIdx = i % 3
    const site = SITES[siteIdx]!
    const templates = WORKFLOW_TITLES[wfId] ?? [`Work item for ${wfId} — ${site}`]
    let title = pick(rand, templates)
      .replace('{n}', String(1000 + i))
      .replace('{site}', site)
      .replace('{z}', String(Math.floor(rand() * 8 + 1)))
    const created = linkedRuns.reduce((min, r) => r.createdAtIso < min ? r.createdAtIso : min, linkedRuns[0]!.createdAtIso)
    const isOpen = rand() < 0.6
    const dueDate = rand() < 0.7 ? addMinutes(created, Math.floor(rand() * 4320 + 1440)) : undefined

    WORK_ITEMS.push({
      schemaVersion: 1,
      workItemId: `wi-m${String(i + 1).padStart(4, '0')}`,
      workspaceId: WS,
      createdAtIso: created,
      createdByUserId: pick(rand, userIds),
      title,
      status: isOpen ? 'Open' : 'Closed',
      ownerUserId: rand() < 0.8 ? pick(rand, userIds) : undefined,
      sla: dueDate ? { dueAtIso: dueDate } : undefined,
      links: {
        runIds: linkedRuns.map((r) => r.runId),
      },
    })
  }

  // ---- Approvals ---------------------------------------------------------
  const APPROVALS: ApprovalSummary[] = []
  const approverIds = memberSlice.filter((m) => (m.caps as readonly string[]).includes('operations.approval')).map((m) => m.userId)
  for (let i = 0; i < cfg.approvalCount; i++) {
    const run = pick(rand, RUNS)
    const siteIdx = i % 3
    const site = SITES[siteIdx]!
    const status = weightedPick(rand, APPROVAL_STATUSES, APPROVAL_STATUS_WEIGHTS)
    const requested = addMinutes(run.createdAtIso, Math.floor(rand() * 10 + 1))
    const decided = status !== 'Pending' ? addMinutes(requested, Math.floor(rand() * 480 + 5)) : undefined
    const approver = pick(rand, approverIds)
    const wi = WORK_ITEMS.find((w) => w.links?.runIds?.includes(run.runId))

    const approvalId = `apr-m${String(i + 1).padStart(4, '0')}`
    APPROVALS.push({
      schemaVersion: 1,
      approvalId,
      workspaceId: WS,
      runId: run.runId,
      planId: `plan-m${String(i + 1).padStart(4, '0')}`,
      workItemId: wi?.workItemId,
      prompt: approvalPrompt(rand, run.workflowId, run.runId, site),
      status,
      requestedAtIso: requested,
      requestedByUserId: rand() < 0.4 ? 'system' : pick(rand, userIds),
      assigneeUserId: approver,
      dueAtIso: rand() < 0.6 ? addMinutes(requested, Math.floor(rand() * 2880 + 720)) : undefined,
      decidedAtIso: decided,
      decidedByUserId: decided ? approver : undefined,
      rationale: decided ? pick(rand, [
        'Amounts verified against source documents. Proceeding.',
        'Temperature logs within acceptable range. Approved.',
        'Denied — missing chain-of-custody documentation.',
        'Approved after consulting with site director.',
        'Request changes — need updated calibration certificates.',
        'FDA compliance check passed. Releasing shipment.',
        'Denied — exceeded 2°C deviation threshold without justification.',
        'Approved with conditions: re-inspect within 24 hours.',
        'Controlled substance count matches DEA records.',
        'Denied — supplier invoice does not match PO line items.',
      ]) : undefined,
    })

    // link approval to work item
    if (wi && !wi.links!.approvalIds) {
      wi.links!.approvalIds = []
    }
    if (wi) {
      wi.links!.approvalIds!.push(approvalId)
    }
  }

  // Guarantee at least 3 Pending approvals so triage page always has data.
  const pendingCount = APPROVALS.filter((a) => a.status === 'Pending').length
  if (pendingCount < 3) {
    const toPromote = APPROVALS.filter((a) => a.status !== 'Pending').slice(0, 3 - pendingCount)
    for (const a of toPromote) {
      a.status = 'Pending'
      a.decidedAtIso = undefined
      a.decidedByUserId = undefined
      a.rationale = undefined
    }
  }

  // ---- Plans -------------------------------------------------------------
  // Each approval gets a Plan with 1–3 effects derived from its run's workflow.
  type EffectTemplate = { operation: EffectOperation; sorName: string; portFamily: string; externalType: string; summary: string }
  const PLAN_EFFECT_TEMPLATES: Record<string, EffectTemplate[]> = {
    'wf-order-fulfillment': [
      { operation: 'Update', sorName: 'SAP', portFamily: 'FinanceAccounting', externalType: 'SalesOrder', summary: 'Update sales order status to Released' },
      { operation: 'Create', sorName: 'adapter-ups-freight', portFamily: 'LogisticsShipping', externalType: 'ShipmentLabel', summary: 'Generate cold-chain shipment label' },
    ],
    'wf-qc-approval': [
      { operation: 'Update', sorName: 'LabWare LIMS', portFamily: 'LaboratoryInfo', externalType: 'QCRecord', summary: 'Record QC approval decision' },
      { operation: 'Create', sorName: 'Paperless-ngx', portFamily: 'DocumentManagement', externalType: 'CertificateOfAnalysis', summary: 'Generate certificate of analysis PDF' },
    ],
    'wf-maintenance-window': [
      { operation: 'Update', sorName: 'ServiceNow', portFamily: 'Itsm', externalType: 'ChangeRequest', summary: 'Close maintenance change request' },
      { operation: 'Update', sorName: 'SAP', portFamily: 'FinanceAccounting', externalType: 'MaintenanceOrder', summary: 'Record maintenance labour and parts cost' },
    ],
    'wf-incident-report': [
      { operation: 'Create', sorName: 'ServiceNow', portFamily: 'Itsm', externalType: 'IncidentRecord', summary: 'Create incident record with RCA' },
      { operation: 'Update', sorName: 'FDA Reporting', portFamily: 'RegulatoryCompliance', externalType: 'DeviationReport', summary: 'Submit deviation report to regulatory system' },
    ],
    'wf-supplier-invoice': [
      { operation: 'Create', sorName: 'SAP', portFamily: 'FinanceAccounting', externalType: 'InvoicePayment', summary: 'Schedule supplier invoice payment' },
      { operation: 'Update', sorName: 'SAP', portFamily: 'FinanceAccounting', externalType: 'PurchaseOrder', summary: 'Mark purchase order as invoiced' },
    ],
    'wf-cold-chain-deviation': [
      { operation: 'Create', sorName: 'LabWare LIMS', portFamily: 'LaboratoryInfo', externalType: 'DispositionDecision', summary: 'Record disposition decision for affected shipment' },
      { operation: 'Update', sorName: 'SAP', portFamily: 'FinanceAccounting', externalType: 'DeliveryOrder', summary: 'Flag delivery order as quarantined' },
    ],
    'wf-controlled-substance-audit': [
      { operation: 'Create', sorName: 'DEA ARCOS', portFamily: 'RegulatoryCompliance', externalType: 'AuditReport', summary: 'Submit Schedule II inventory audit to DEA ARCOS' },
      { operation: 'Update', sorName: 'LabWare LIMS', portFamily: 'LaboratoryInfo', externalType: 'ChainOfCustody', summary: 'Update chain-of-custody record' },
    ],
  }
  const DEFAULT_EFFECT_TEMPLATES: EffectTemplate[] = [
    { operation: 'Update', sorName: 'ServiceNow', portFamily: 'Itsm', externalType: 'WorkOrder', summary: 'Complete workflow step and close work order' },
  ]

  const PLANS: Plan[] = APPROVALS.map((approval, i) => {
    const run = RUNS.find((r) => r.runId === approval.runId)
    const templates = (run ? PLAN_EFFECT_TEMPLATES[run.workflowId] : null) ?? DEFAULT_EFFECT_TEMPLATES
    const effectCount = 1 + (i % (Math.min(templates.length, 2)))
    const plannedEffects: PlanEffect[] = templates.slice(0, effectCount).map((t, j) => ({
      effectId: `${approval.planId}-eff-${j + 1}`,
      operation: t.operation,
      target: {
        sorName: t.sorName,
        portFamily: t.portFamily,
        externalId: `ext-${approval.planId}-${j + 1}`,
        externalType: t.externalType,
        displayLabel: `${t.externalType} for ${approval.runId}`,
      },
      summary: t.summary,
    }))
    return {
      schemaVersion: 1,
      planId: approval.planId,
      workspaceId: WS,
      createdAtIso: approval.requestedAtIso,
      createdByUserId: 'system',
      plannedEffects,
    }
  })

  // ---- Evidence ----------------------------------------------------------
  const EVIDENCE: EvidenceEntry[] = []
  const adapterIds = adapterSlice.map((a) => a.id)
  for (let i = 0; i < cfg.evidenceCount; i++) {
    const run = pick(rand, RUNS)
    const category = pick(rand, EVIDENCE_CATEGORIES)
    const wi = WORK_ITEMS.find((w) => w.links?.runIds?.includes(run.runId))
    const siteIdx = i % 3
    const site = SITES[siteIdx]!

    const actor: EvidenceActor = (() => {
      const r = rand()
      if (r < 0.25) return { kind: 'System' as const }
      if (r < 0.50) return { kind: 'User' as const, userId: pick(rand, userIds) }
      if (r < 0.75) return { kind: 'Adapter' as const, adapterId: pick(rand, adapterIds) }
      return { kind: 'System' as const }
    })()

    const evdId = `evd-m${String(i + 1).padStart(5, '0')}`
    const occurred = randomIso(rand, run.createdAtIso, addMinutes(run.createdAtIso, 120))
    const hash = fakeHash(i)
    const prevHash = i > 0 ? fakeHash(i - 1) : undefined

    EVIDENCE.push({
      schemaVersion: 1,
      evidenceId: evdId,
      workspaceId: WS,
      occurredAtIso: occurred,
      category,
      summary: evidenceSummary(rand, category, run.runId, site),
      actor,
      links: {
        runId: run.runId,
        workItemId: wi?.workItemId,
      },
      previousHash: prevHash ?? undefined,
      hashSha256: hash,
    })

    // link evidence to work item
    if (wi) {
      if (!wi.links!.evidenceIds) wi.links!.evidenceIds = []
      if (wi.links!.evidenceIds!.length < 20) {
        wi.links!.evidenceIds!.push(evdId)
      }
    }
  }

  // sort evidence chronologically
  EVIDENCE.sort((a, b) => a.occurredAtIso.localeCompare(b.occurredAtIso))
  // re-chain hashes after sort
  for (let i = 0; i < EVIDENCE.length; i++) {
    EVIDENCE[i]!.hashSha256 = fakeHash(i)
    EVIDENCE[i]!.previousHash = i > 0 ? fakeHash(i - 1) : undefined
  }

  // ---- Missions ----------------------------------------------------------
  const onlineRobots = ROBOTS.filter((r) => r.status === 'Online' || r.status === 'Degraded')
  const MISSIONS: MissionSummary[] = []
  const missionStatuses: MissionStatus[] = ['Pending', 'Executing', 'Completed', 'Failed', 'Cancelled']
  const missionStatusWeights = [0.10, 0.20, 0.45, 0.15, 0.10]
  for (let i = 0; i < cfg.missionCount; i++) {
    const robot = i < onlineRobots.length ? onlineRobots[i]! : pick(rand, ROBOTS)
    const goals = MISSION_GOALS[robot.robotClass]!
    const goalTpl = pick(rand, goals)
    const goal = goalTpl.goal
      .replace('{n}', String(Math.floor(rand() * 9000 + 1000)))
      .replace('{z}', String(Math.floor(rand() * 8 + 1)))
    const status = weightedPick(rand, missionStatuses, missionStatusWeights)
    const dispatched = status !== 'Pending' ? randomIso(rand, cfg.startIso, cfg.endIso) : undefined
    const completed = (status === 'Completed' || status === 'Failed' || status === 'Cancelled') && dispatched
      ? addMinutes(dispatched, Math.floor(rand() * 30 + 3))
      : undefined
    const missionId = `mis-m${String(i + 1).padStart(4, '0')}`

    // assign missionId to robot if executing
    if (status === 'Executing' && robot.status === 'Online') {
      robot.missionId = missionId
    }

    MISSIONS.push({
      missionId,
      robotId: robot.robotId,
      goal,
      actionType: goalTpl.action,
      status,
      priority: pick(rand, ['Low', 'Normal', 'Normal', 'High', 'Safety']),
      dispatchedAtIso: dispatched,
      completedAtIso: completed,
      executionTier: rand() < 0.7 ? 'Auto' : 'HumanApprove',
    })
  }

  // ---- Safety Constraints ------------------------------------------------
  const SAFETY_CONSTRAINTS: SafetyConstraint[] = [
    { constraintId: 'sc-m001', site: 'Chicago — Cold Room A', constraint: 'max_speed ≤ 0.3 m/s', enforcement: 'block', robotCount: Math.min(cfg.robotCount, 8) },
    { constraintId: 'sc-m002', site: 'Chicago — Loading Dock', constraint: 'no_autonomous_lift', enforcement: 'warn', robotCount: Math.min(cfg.robotCount, 4) },
    { constraintId: 'sc-m003', site: 'Dallas — Freezer Zone', constraint: 'max_speed ≤ 0.2 m/s', enforcement: 'block', robotCount: Math.min(cfg.robotCount, 6) },
    { constraintId: 'sc-m004', site: 'Dallas — Controlled Substance Vault', constraint: 'dual_operator_required', enforcement: 'block', robotCount: 2 },
    { constraintId: 'sc-m005', site: 'Atlanta — Warehouse Floor', constraint: 'max_speed ≤ 0.5 m/s', enforcement: 'warn', robotCount: Math.min(cfg.robotCount, 10) },
    { constraintId: 'sc-m006', site: 'All Sites — Outdoor', constraint: 'uav_flight_permit_required', enforcement: 'block', robotCount: Math.min(cfg.robotCount, 3) },
    { constraintId: 'sc-m007', site: 'All Sites', constraint: 'human_in_proximity ≤ 2m → pause', enforcement: 'block', robotCount: cfg.robotCount },
  ]

  // ---- Approval Thresholds -----------------------------------------------
  const APPROVAL_THRESHOLDS: ApprovalThreshold[] = [
    { actionClass: 'navigate_to', tier: 'Auto', notes: 'Standard warehouse navigation' },
    { actionClass: 'pick (>5 kg)', tier: 'HumanApprove', notes: 'Heavy pharma containers require operator sign-off' },
    { actionClass: 'outdoor_flight', tier: 'HumanApprove', notes: 'Requires safety_admin sign-off per FAA Part 107' },
    { actionClass: 'controlled_substance_access', tier: 'ManualOnly', notes: 'DEA requires human-only handling' },
    { actionClass: 'cold_room_entry', tier: 'Assisted', notes: 'Robot may enter with operator monitoring' },
    { actionClass: 'forklift_pallet_lift', tier: 'HumanApprove', notes: 'AGV lift operations need supervisor confirmation' },
    { actionClass: 'temperature_override', tier: 'ManualOnly', notes: 'PLC temperature setpoint changes require dual approval' },
  ]

  // ---- E-Stop Audit Log --------------------------------------------------
  const estoppedRobots = ROBOTS.filter((r) => r.status === 'E-Stopped')
  const ESTOP_AUDIT_LOG: EStopAuditEntry[] = []
  const estopActors = ['safety_admin', 'derek.johnson@meridian.com', 'robert.garcia@meridian.com', 'system-watchdog']
  // Generate a few e-stop events for each e-stopped robot, plus some historical ones
  for (const robot of estoppedRobots) {
    const ts = randomIso(rand, cfg.startIso, cfg.endIso)
    ESTOP_AUDIT_LOG.push({
      timestamp: ts,
      actor: pick(rand, estopActors),
      robotId: robot.robotId,
      event: 'Sent',
      detail: pick(rand, [
        'reason: proximity sensor triggered — human detected in cold room',
        'reason: temperature excursion detected near robot path',
        'reason: battery voltage anomaly',
        'reason: obstacle avoidance failure',
        'reason: operator emergency stop button pressed',
      ]),
    })
  }
  // Add some historical cleared events
  for (let i = 0; i < Math.min(cfg.robotCount, 6); i++) {
    const robot = pick(rand, ROBOTS)
    const ts = randomIso(rand, cfg.startIso, cfg.endIso)
    ESTOP_AUDIT_LOG.push({
      timestamp: ts,
      actor: pick(rand, estopActors),
      robotId: robot.robotId,
      event: pick(rand, ['Sent', 'Cleared']),
      detail: pick(rand, [
        'reason: scheduled safety drill',
        'rationale: inspection passed, cleared to resume',
        'reason: false positive — sensor recalibrated',
        'rationale: maintenance complete, robot verified',
        'reason: cold chain alarm — precautionary stop',
        'rationale: temperature stabilized, cleared by QC',
      ]),
    })
  }
  ESTOP_AUDIT_LOG.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  // ---- Credential Grants -------------------------------------------------
  const SCOPE_BY_SOR_FAMILY: Record<string, string> = {
    Itsm:                  'incident:read incident:write change:read change:write',
    FinanceAccounting:     'invoice:read invoice:write payment:read',
    CrmSales:              'contact:read opportunity:read opportunity:write',
    PaymentsBilling:       'charge:read charge:write refund:write',
    MarketingComms:        'campaign:read email:read email:write',
    IdentityAccess:        'user:read user:write role:read',
    SecretsManagement:     'secret:read secret:write lease:manage',
    CustomerSupport:       'ticket:read ticket:write',
    DocumentManagement:    'document:read document:write',
    RegulatoryCompliance:  'report:read report:write submission:write',
    IoTTelemetry:          'telemetry:read alert:read alert:write',
    LogisticsShipping:     'shipment:read tracking:read',
    LaboratoryInfo:        'sample:read result:read result:write',
  }
  const CREDENTIAL_GRANTS: CredentialGrantV1[] = adapterSlice.map((a, i) => {
    const issuedAt = randomIso(rand, cfg.startIso, cfg.endIso)
    const expiresAt = new Date(new Date(issuedAt).getTime() + 180 * 86_400_000).toISOString()
    const isRevoked = i === 2
    return {
      schemaVersion: 1 as const,
      credentialGrantId: `cg-m${String(i + 1).padStart(3, '0')}`,
      workspaceId: WS,
      adapterId: a.id,
      credentialsRef: `vault://${WS}/${a.sorFamily.toLowerCase()}/${a.id.replace('adapter-', '')}`,
      scope: SCOPE_BY_SOR_FAMILY[a.sorFamily] ?? 'read write',
      issuedAtIso: issuedAt,
      expiresAtIso: expiresAt,
      ...(isRevoked ? { revokedAtIso: addMinutes(issuedAt, Math.floor(rand() * 43200 + 1440)) } : {}),
    }
  })

  // ---- Observability Data ------------------------------------------------
  const runsOverTime: { date: string; succeeded: number; failed: number; waitingForApproval: number }[] = []
  const startDate = new Date(cfg.startIso)
  const endDate = new Date(cfg.endIso)
  const dayMs = 86400_000
  for (let d = startDate.getTime(); d < endDate.getTime(); d += dayMs * 7) {
    // weekly buckets
    const dateStr = new Date(d).toISOString().slice(0, 10)
    const weekRuns = RUNS.filter((r) => {
      const rd = new Date(r.createdAtIso).getTime()
      return rd >= d && rd < d + dayMs * 7
    })
    runsOverTime.push({
      date: dateStr,
      succeeded: weekRuns.filter((r) => r.status === 'Succeeded').length,
      failed: weekRuns.filter((r) => r.status === 'Failed').length,
      waitingForApproval: weekRuns.filter((r) => r.status === 'WaitingForApproval').length,
    })
  }

  const succeededTotal = RUNS.filter((r) => r.status === 'Succeeded').length
  const successRate = cfg.runCount > 0 ? Math.round((succeededTotal / cfg.runCount) * 100) : 0

  const slaDays: number[] = []
  for (const wi of WORK_ITEMS) {
    if (wi.sla?.dueAtIso) {
      const due = new Date(wi.sla.dueAtIso).getTime()
      const created = new Date(wi.createdAtIso).getTime()
      slaDays.push((due - created) / dayMs)
    }
  }
  const avgSlaDays = slaDays.length > 0 ? Math.round((slaDays.reduce((s, v) => s + v, 0) / slaDays.length) * 10) / 10 : 2.0

  return {
    WORK_ITEMS,
    RUNS,
    APPROVALS,
    PLANS,
    CREDENTIAL_GRANTS,
    EVIDENCE,
    WORKFORCE_MEMBERS,
    WORKFORCE_QUEUES,
    AGENTS,
    ADAPTERS,
    ROBOTS,
    MISSIONS,
    SAFETY_CONSTRAINTS,
    APPROVAL_THRESHOLDS,
    ESTOP_AUDIT_LOG,
    OBSERVABILITY_DATA: { runsOverTime, successRate, avgSlaDays },
  }
}
