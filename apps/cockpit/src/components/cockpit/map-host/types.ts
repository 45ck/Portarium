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

export interface MapHostLayer<TLayerId extends string = string> {
  id: TLayerId;
  label: string;
  enabled: boolean;
  disabled?: boolean;
}

export interface MapHostWorkbenchProps<TTabId extends string = string> {
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
}
