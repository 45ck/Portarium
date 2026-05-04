import type { ReactNode } from 'react';

export type MapHostDataState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error'
  | 'stale'
  | 'degraded'
  | 'denied';

export type MapHostPrivacyClass =
  | 'public'
  | 'internal'
  | 'restricted'
  | 'sensitive'
  | 'highly_restricted';

export type MapHostFreshnessState =
  | 'live'
  | 'cached'
  | 'stale'
  | 'offline'
  | 'degraded'
  | 'unknown';

export type MapHostEntityStatus = 'normal' | 'warning' | 'critical' | 'unknown';

export type MapHostCommandScope = 'workbench' | 'selection';

export interface MapHostFreshnessSummary {
  state: MapHostFreshnessState;
  label: string;
  updatedAtIso?: string;
  expiresAtIso?: string;
  sourceLabel?: string;
  detail?: string;
}

export interface MapHostContributionMetadata {
  privacyClass: MapHostPrivacyClass;
  freshness: MapHostFreshnessSummary;
}

export interface MapHostPanelTab<TTabId extends string = string> {
  id: TTabId;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface MapHostSelection<TKind extends string = string, TId extends string = string> {
  kind: TKind;
  id: TId;
}

export interface MapHostSelectionState<TKind extends string = string, TId extends string = string> {
  selected: MapHostSelection<TKind, TId> | null;
}

export interface MapHostEntity<
  TEntityPayload = unknown,
  TKind extends string = string,
  TEntityId extends string = string,
  TLayerId extends string = string,
> extends MapHostContributionMetadata {
  id: TEntityId;
  kind: TKind;
  label: string;
  layerId?: TLayerId;
  geometryRef?: string;
  locationRef?: string;
  status?: MapHostEntityStatus;
  payload: TEntityPayload;
}

export interface MapHostLayer<TLayerId extends string = string> {
  id: TLayerId;
  label: string;
  enabled: boolean;
  disabled?: boolean;
  kind?: string;
  defaultEnabled?: boolean;
  privacyClass?: MapHostPrivacyClass;
  freshness?: MapHostFreshnessSummary;
}

export interface MapHostLayerContribution<TLayerPayload = unknown, TLayerId extends string = string>
  extends
    Omit<MapHostLayer<TLayerId>, 'freshness' | 'kind' | 'privacyClass'>,
    MapHostContributionMetadata {
  kind: string;
  payload: TLayerPayload;
}

export interface MapHostPanelRenderContext<
  TEntityPayload = unknown,
  TCommandPayload = unknown,
  TKind extends string = string,
  TEntityId extends string = string,
  TLayerId extends string = string,
> {
  entities: readonly MapHostEntity<TEntityPayload, TKind, TEntityId, TLayerId>[];
  selection: MapHostSelection<TKind, TEntityId> | null;
  selectedEntity?: MapHostEntity<TEntityPayload, TKind, TEntityId, TLayerId>;
  dataState: MapHostDataState;
  commands?: readonly MapHostCommandContribution<TCommandPayload, TKind, TEntityId>[];
}

export interface MapHostPanelContribution<
  TEntityPayload = unknown,
  TCommandPayload = unknown,
  TPanelId extends string = string,
  TKind extends string = string,
  TEntityId extends string = string,
  TLayerId extends string = string,
> extends MapHostContributionMetadata {
  id: TPanelId;
  label: string;
  tabId?: string;
  disabled?: boolean;
  render: (
    context: MapHostPanelRenderContext<TEntityPayload, TCommandPayload, TKind, TEntityId, TLayerId>,
  ) => ReactNode;
}

export interface MapHostCommandContext<
  TKind extends string = string,
  TEntityId extends string = string,
> {
  selection: MapHostSelection<TKind, TEntityId> | null;
}

export interface MapHostGovernedActionProposal<TCommandPayload = unknown> {
  kind: string;
  title: string;
  payload: TCommandPayload;
}

export interface MapHostCommandContribution<
  TCommandPayload = unknown,
  TKind extends string = string,
  TEntityId extends string = string,
> extends MapHostContributionMetadata {
  id: string;
  label: string;
  scope: MapHostCommandScope;
  description?: string;
  disabled?: boolean;
  requiredSelectionKinds?: readonly TKind[];
  createProposal: (
    context: MapHostCommandContext<TKind, TEntityId>,
  ) => MapHostGovernedActionProposal<TCommandPayload>;
}

export interface MapHostWorkbenchProps<
  TTabId extends string = string,
  TEntityPayload = unknown,
  TLayerPayload = unknown,
  TCommandPayload = unknown,
> {
  title: string;
  subtitle?: string;
  dataState: MapHostDataState;
  map: ReactNode;
  tabs: readonly MapHostPanelTab<TTabId>[];
  activeTab: TTabId;
  onTabChange: (tabId: TTabId) => void;
  panel: ReactNode;
  toolbar?: ReactNode;
  status?: ReactNode;
  selectionLabel?: string;
  className?: string;
  layers?: readonly MapHostLayerContribution<TLayerPayload>[];
  entities?: readonly MapHostEntity<TEntityPayload>[];
  selection?: MapHostSelectionState;
  panels?: readonly MapHostPanelContribution<TEntityPayload, TCommandPayload>[];
  commands?: readonly MapHostCommandContribution<TCommandPayload>[];
}
