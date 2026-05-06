export const COCKPIT_NATIVE_ROUTE_SURFACE_KINDS = [
  'portarium.native.dataExplorer.v1',
  'portarium.native.ticketInbox.v1',
  'portarium.native.mapWorkbench.v1',
] as const;

export type CockpitNativeRouteSurfaceKind = (typeof COCKPIT_NATIVE_ROUTE_SURFACE_KINDS)[number];

export interface CockpitNativeRouteSurfaceData<
  TSurface extends CockpitNativeRouteSurface = CockpitNativeRouteSurface,
> {
  nativeSurface?: TSurface;
}

export interface CockpitNativeStatusBadge {
  label: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'critical';
}

export interface CockpitNativeAreaNavItem {
  id: string;
  label: string;
  href: string;
  detail?: string;
  active?: boolean;
}

export interface CockpitNativeRouteSurfaceBase {
  kind: CockpitNativeRouteSurfaceKind;
  title: string;
  description?: string;
  badges?: readonly CockpitNativeStatusBadge[];
  automationProposals?: readonly CockpitNativeAutomationProposal[];
  area?: {
    label: string;
    title: string;
    navItems: readonly CockpitNativeAreaNavItem[];
    boundary?: readonly string[];
  };
}

export interface CockpitNativeAutomationProposal {
  id: string;
  label: string;
  summary: string;
  confidence?: string;
  risk?: CockpitNativeStatusBadge['tone'];
  sourceRefs?: readonly string[];
  safety?: readonly string[];
  proposal: {
    agentId: string;
    actionKind: string;
    toolName: string;
    executionTier: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
    policyIds: readonly string[];
    rationale: string;
    parameters?: Record<string, unknown>;
    machineId?: string;
    idempotencyKey?: string;
  };
}

export interface CockpitNativeTicketView {
  id: string;
  label: string;
  count: number;
  href: string;
  active?: boolean;
}

export interface CockpitNativeTicketFilterOption {
  label: string;
  href: string;
  active?: boolean;
}

export interface CockpitNativeTicketFilterGroup {
  label: string;
  options: readonly CockpitNativeTicketFilterOption[];
}

export interface CockpitNativeTicketRecord {
  id: string;
  label: string;
  summary: string;
  href: string;
  selected?: boolean;
  statusLabel: string;
  lifecycle?: string;
  priorityLabel: string;
  typeLabel?: string;
  category?: string;
  requesterLabel?: string;
  ownerLabel?: string;
  updatedAtLabel: string;
  dueLabel?: string;
  roomLabel?: string;
  sourceRef: string;
}

export interface CockpitNativeTicketConversationItem {
  id: string;
  authorLabel?: string;
  timestampLabel?: string;
  bodyPreview?: string;
  bodyFormat?: 'plain' | 'html-derived' | 'markdown-like';
  body: string;
  bodyBlocks?: readonly CockpitNativeTicketConversationBlock[];
  direction?: 'incoming' | 'outgoing' | 'unknown';
  private?: boolean;
  metadata?: string;
}

export type CockpitNativeTicketConversationBlock =
  | {
      kind: 'paragraph' | 'quote';
      text: string;
    }
  | {
      kind: 'list';
      items: readonly string[];
    };

export interface CockpitNativeTicketDetail {
  label: string;
  sourceRef: string;
  summary: string;
  activeSection?: string;
  sections?: readonly CockpitNativeTicketDetailSection[];
  badges: readonly CockpitNativeStatusBadge[];
  conversation: {
    title: string;
    message: string;
    summary?: string;
    items?: readonly CockpitNativeTicketConversationItem[];
    totalCount?: number;
    omittedCount?: number;
  };
  sectionContent?: CockpitNativeTicketSectionContent;
  properties: readonly CockpitNativeKeyValue[];
  relatedContext: {
    roomLinks?: readonly { label: string; href: string }[];
    items: readonly CockpitNativeRelatedItem[];
  };
  diagnostics: readonly CockpitNativeKeyValue[];
}

export interface CockpitNativeTicketDetailSection {
  id: string;
  label: string;
  href: string;
  active?: boolean;
}

export type CockpitNativeTicketSectionContent =
  | {
      kind: 'conversation';
      title?: string;
      message?: string;
      summary?: string;
      items?: readonly CockpitNativeTicketConversationItem[];
      totalCount?: number;
    }
  | {
      kind: 'evidence';
      title?: string;
      items?: readonly CockpitNativeRelatedItem[];
      emptyText?: string;
    }
  | {
      kind: 'room';
      title?: string;
      roomLinks?: readonly { label: string; href: string }[];
      evidenceCount?: number;
      emptyText?: string;
    }
  | {
      kind: 'source';
      title?: string;
      properties?: readonly CockpitNativeKeyValue[];
    };

export interface CockpitNativeTicketInboxSurface extends CockpitNativeRouteSurfaceBase {
  kind: 'portarium.native.ticketInbox.v1';
  queue: {
    views: readonly CockpitNativeTicketView[];
    filters: readonly CockpitNativeTicketFilterGroup[];
    search: {
      action: string;
      query?: string;
      sort: string;
      pageSize: number;
      sortOptions: readonly CockpitNativeSelectOption[];
      pageSizeOptions: readonly number[];
    };
    statusText: string;
    pageText: string;
    tickets: readonly CockpitNativeTicketRecord[];
    pagination: readonly CockpitNativeLinkAction[];
    auditTableHref?: string;
  };
  selectedTicket?: CockpitNativeTicketDetail;
}

export interface CockpitNativeBaseMap {
  id: string;
  label: string;
  kind: 'provider' | 'custom';
  provider?: string;
  description?: string;
  imageHref?: string;
  imageAlt?: string;
  active?: boolean;
}

export interface CockpitNativeMapLayer {
  id: string;
  label: string;
  enabled: boolean;
  kind: string;
  privacyClass?: string;
  freshnessLabel?: string;
}

export interface CockpitNativeMapEntity {
  id: string;
  label: string;
  kind: string;
  status?: string;
  locationLabel?: string;
  sourceRef?: string;
}

export interface CockpitNativeMapWorkbenchSurface extends CockpitNativeRouteSurfaceBase {
  kind: 'portarium.native.mapWorkbench.v1';
  map: {
    mode: 'provider' | 'custom' | 'hybrid';
    activeBaseMapId: string;
    baseMaps: readonly CockpitNativeBaseMap[];
    layers: readonly CockpitNativeMapLayer[];
    entities: readonly CockpitNativeMapEntity[];
    selectionLabel?: string;
    tabs: readonly { id: string; label: string; count?: number }[];
    activeTab: string;
    readOnlyGroups: readonly CockpitNativeReadOnlyGroup[];
  };
}

export interface CockpitNativeDataExplorerMetric {
  id: string;
  label: string;
  value: string;
  detail?: string;
  tone?: CockpitNativeStatusBadge['tone'];
}

export interface CockpitNativeDataExplorerSource {
  id: string;
  label: string;
  sourceSystem: string;
  sourceMode: string;
  category?: string;
  readiness?: string;
  freshness?: string;
  privacyClass?: string;
  itemCount?: number;
  recordCount?: number;
  summary: string;
  href?: string;
  sourceRefs?: readonly string[];
  capabilityIds?: readonly string[];
  connectorIds?: readonly string[];
  visualisations?: readonly string[];
  answerableQuestions?: readonly string[];
  portariumSurfaces?: readonly string[];
}

export interface CockpitNativeDataExplorerInsight {
  id: string;
  title: string;
  summary: string;
  tone?: CockpitNativeStatusBadge['tone'];
  sourceIds?: readonly string[];
  href?: string;
}

export interface CockpitNativeSnapshotPort {
  id: string;
  label: string;
  sourceSystem: string;
  state: string;
  sourceSystemAccess?: string;
  writebackEnabled?: boolean;
  rawPayloadsIncluded?: boolean;
  credentialsIncluded?: boolean;
  capabilityIds?: readonly string[];
  mockDataPlane?: string;
  livePromotionGate?: string;
}

export interface CockpitNativeSourcePostureSummary {
  generatedAt?: string;
  sourceSystemAccess?: string;
  dataOrigin?: string;
  sourceCount?: number;
  readOnlySourceCount?: number;
  localSnapshotCount?: number;
  restrictedOrSensitiveCount?: number;
  staleOrUnknownCount?: number;
}

export interface CockpitNativeDataExplorerSurface extends CockpitNativeRouteSurfaceBase {
  kind: 'portarium.native.dataExplorer.v1';
  explorer: {
    metrics: readonly CockpitNativeDataExplorerMetric[];
    sourcePosture?: CockpitNativeSourcePostureSummary;
    sources: readonly CockpitNativeDataExplorerSource[];
    snapshotPorts?: readonly CockpitNativeSnapshotPort[];
    insights: readonly CockpitNativeDataExplorerInsight[];
    integrationNotes?: readonly string[];
  };
}

export interface CockpitNativeReadOnlyGroup {
  id: string;
  label: string;
  description?: string;
  items: readonly CockpitNativeRelatedItem[];
}

export interface CockpitNativeRelatedItem {
  id: string;
  label: string;
  summary?: string;
  metadata?: string;
}

export interface CockpitNativeKeyValue {
  label: string;
  value: string;
}

export interface CockpitNativeLinkAction {
  label: string;
  href: string;
  active?: boolean;
  disabled?: boolean;
}

export interface CockpitNativeSelectOption {
  value: string;
  label: string;
}

export type CockpitNativeRouteSurface =
  | CockpitNativeDataExplorerSurface
  | CockpitNativeTicketInboxSurface
  | CockpitNativeMapWorkbenchSurface;

export function defineCockpitNativeRouteSurface<const TSurface extends CockpitNativeRouteSurface>(
  surface: TSurface,
): TSurface {
  return surface;
}

export function defineCockpitNativeRouteSurfaceData<
  const TSurface extends CockpitNativeRouteSurface,
>(nativeSurface: TSurface): CockpitNativeRouteSurfaceData<TSurface> {
  return { nativeSurface };
}

export function hasCockpitNativeRouteSurface(
  value: unknown,
): value is CockpitNativeRouteSurfaceData {
  const nativeSurface = readRecord(value)?.['nativeSurface'];
  return isCockpitNativeRouteSurface(nativeSurface);
}

export function isCockpitNativeRouteSurface(value: unknown): value is CockpitNativeRouteSurface {
  const record = readRecord(value);
  const kind = record?.['kind'];
  return COCKPIT_NATIVE_ROUTE_SURFACE_KINDS.some((surfaceKind) => surfaceKind === kind);
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
