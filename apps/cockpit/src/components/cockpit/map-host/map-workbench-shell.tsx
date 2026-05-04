import { DesktopMapWorkbenchLayout } from './desktop-map-workbench-layout';
import { MobileMapWorkbenchLayout } from './mobile-map-workbench-layout';
import { ReadOnlyMapHostPanel } from './read-only-map-host-panel';
import { cn } from '@/lib/utils';
import type { MapHostPanelTab, MapHostWorkbenchProps } from './types';

function PanelTabs<TTabId extends string>({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: readonly MapHostPanelTab<TTabId>[];
  activeTab: TTabId;
  onTabChange: (tabId: TTabId) => void;
}) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex border-b border-border" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          disabled={tab.disabled}
          className={cn(
            'flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
            activeTab === tab.id
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            tab.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
          )}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="truncate">{tab.label}</span>
          {tab.count !== undefined ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function MapWorkbenchShell<TTabId extends string>({
  title,
  subtitle,
  dataState,
  map,
  tabs,
  activeTab,
  onTabChange,
  panel,
  toolbar,
  status,
  selectionLabel,
  className,
  layers,
  entities,
  selection,
  panels,
  commands,
  readOnlyItems,
  readOnlyItemGroups,
}: MapHostWorkbenchProps<TTabId>) {
  const panelNode = panel ?? (
    <ReadOnlyMapHostPanel
      dataState={dataState}
      layers={layers}
      entities={entities}
      selection={selection}
      panels={panels}
      commands={commands}
      readOnlyItems={readOnlyItems}
      readOnlyItemGroups={readOnlyItemGroups}
    />
  );
  const panelContent = (
    <>
      <div className="shrink-0 border-b border-border bg-muted/20 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          {status ? <div className="shrink-0">{status}</div> : null}
        </div>
        {selectionLabel ? (
          <p className="mt-2 truncate text-[11px] text-muted-foreground">{selectionLabel}</p>
        ) : null}
      </div>
      <PanelTabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
      <div className="min-h-0 flex-1 overflow-y-auto">{panelNode}</div>
    </>
  );

  return (
    <section className={cn('h-full min-h-0 overflow-hidden', className)} data-state={dataState}>
      <DesktopMapWorkbenchLayout
        dataState={dataState}
        map={map}
        panel={panelContent}
        toolbar={toolbar}
      />
      <MobileMapWorkbenchLayout
        dataState={dataState}
        map={map}
        panel={panelContent}
        toolbar={toolbar}
      />
    </section>
  );
}
