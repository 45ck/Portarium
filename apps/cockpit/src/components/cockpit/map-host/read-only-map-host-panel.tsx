import type {
  MapHostCommandContribution,
  MapHostDataState,
  MapHostEntity,
  MapHostLayerContribution,
  MapHostPanelContribution,
  MapHostReadOnlyItem,
  MapHostReadOnlyItemGroup,
  MapHostSelectionState,
} from './types';

export interface ReadOnlyMapHostPanelProps {
  dataState: MapHostDataState;
  entities?: readonly MapHostEntity[];
  layers?: readonly MapHostLayerContribution[];
  selection?: MapHostSelectionState;
  panels?: readonly MapHostPanelContribution[];
  commands?: readonly MapHostCommandContribution[];
  readOnlyItems?: readonly MapHostReadOnlyItem[];
  readOnlyItemGroups?: readonly MapHostReadOnlyItemGroup[];
}

export function ReadOnlyMapHostPanel({
  dataState,
  entities = [],
  layers = [],
  selection,
  panels = [],
  commands = [],
  readOnlyItems = [],
  readOnlyItemGroups = [],
}: ReadOnlyMapHostPanelProps) {
  const selectedEntity = entities.find(
    (entity) => selection?.selected?.kind === entity.kind && selection.selected.id === entity.id,
  );
  const groupedItems =
    readOnlyItemGroups.length > 0
      ? readOnlyItemGroups
      : readOnlyItems.length > 0
        ? [
            {
              id: 'read-only-items',
              label: 'Read-only items',
              privacyClass: 'internal' as const,
              freshness: { state: 'cached' as const, label: 'Local read model' },
              items: readOnlyItems,
            },
          ]
        : [];

  return (
    <div className="space-y-4 p-4">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Read-only context</h3>
          <MetadataPill label={dataState} />
        </div>
        <p className="text-xs text-muted-foreground">
          Host-rendered references only. Source systems, credentials, and raw payloads stay outside
          Cockpit.
        </p>
        {selectedEntity ? (
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold">{selectedEntity.label}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {selectedEntity.kind} · {selectedEntity.privacyClass} ·{' '}
              {selectedEntity.freshness.label}
            </p>
          </div>
        ) : null}
      </section>

      {layers.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Layers</h4>
          <div className="flex flex-wrap gap-1.5">
            {layers.map((layer) => (
              <MetadataPill
                key={layer.id}
                label={`${layer.label}${layer.enabled ? '' : ' off'}`}
                muted={!layer.enabled}
              />
            ))}
          </div>
        </section>
      ) : null}

      {groupedItems.map((group) => (
        <section key={group.id} className="space-y-2">
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">{group.label}</h4>
            {group.description ? (
              <p className="mt-1 text-[11px] text-muted-foreground">{group.description}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            {group.items.map((item) => (
              <ReadOnlyItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}

      {panels.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Custom panels</h4>
          {panels.map((panel) => (
            <div key={panel.id} className="rounded-md border border-border p-3">
              <p className="text-xs font-semibold">{panel.label}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {panel.privacyClass} · {panel.freshness.label}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {commands.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Governed proposals
          </h4>
          {commands.map((command) => (
            <button
              key={command.id}
              type="button"
              disabled
              className="w-full rounded-md border border-border bg-muted/20 px-3 py-2 text-left text-xs text-muted-foreground"
            >
              {command.label}
            </button>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function ReadOnlyItemCard({ item }: { item: MapHostReadOnlyItem }) {
  return (
    <article className="rounded-md border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.label}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {item.kind}
            {item.sourceSystem ? ` · ${item.sourceSystem}` : ''}
            {item.sourceMode ? ` · ${item.sourceMode}` : ''}
          </p>
        </div>
        <MetadataPill label={item.status ?? item.freshness.state} />
      </div>
      {item.summary ? <p className="mt-2 text-xs text-muted-foreground">{item.summary}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <MetadataPill label={item.privacyClass} />
        <MetadataPill label={item.freshness.label} />
        {item.observedAtIso ? <MetadataPill label={item.observedAtIso} muted /> : null}
      </div>
      {item.attributes && item.attributes.length > 0 ? (
        <dl className="mt-3 grid grid-cols-2 gap-2">
          {item.attributes.map((attribute) => (
            <div key={attribute.label} className="min-w-0">
              <dt className="truncate text-[10px] uppercase text-muted-foreground">
                {attribute.label}
              </dt>
              <dd className="truncate text-xs font-medium">{attribute.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}

function MetadataPill({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span
      className={
        muted
          ? 'rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground'
          : 'rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground'
      }
    >
      {label}
    </span>
  );
}
