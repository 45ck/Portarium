import { useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Search, Network, Layers } from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { useUIStore } from '@/stores/ui-store';
import { useRetrievalSearch } from '@/hooks/queries/use-retrieval-search';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type {
  RetrievalStrategy,
  RetrievalHitSummary,
  GraphNodeSummary,
  GraphEdgeSummary,
} from '@portarium/cockpit-types';

// ---------------------------------------------------------------------------
// Strategy selector
// ---------------------------------------------------------------------------

const STRATEGIES: { value: RetrievalStrategy; label: string; description: string }[] = [
  { value: 'semantic', label: 'Semantic', description: 'Dense vector similarity search' },
  { value: 'graph', label: 'Graph', description: 'Graph traversal from a root node' },
  { value: 'hybrid', label: 'Hybrid', description: 'Semantic search with graph enrichment' },
];

function StrategyPicker({
  value,
  onChange,
}: {
  value: RetrievalStrategy;
  onChange: (s: RetrievalStrategy) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {STRATEGIES.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => onChange(s.value)}
          className={[
            'flex flex-col items-start rounded-lg border px-4 py-3 text-left text-sm transition-colors',
            value === s.value
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border bg-background text-muted-foreground hover:border-primary/50',
          ].join(' ')}
        >
          <span className="font-medium">{s.label}</span>
          <span className="text-xs mt-0.5 opacity-75">{s.description}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hit card
// ---------------------------------------------------------------------------

function HitCard({ hit, index }: { hit: RetrievalHitSummary; index: number }) {
  const score = hit.score !== undefined ? Math.round(hit.score * 100) : null;
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 text-xs font-mono text-muted-foreground">#{index + 1}</span>
          <span className="text-sm font-medium truncate">{hit.artifactId}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {score !== null && (
            <Badge variant={score >= 90 ? 'default' : score >= 70 ? 'secondary' : 'outline'}>
              {score}%
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {hit.provenance.runId}
          </Badge>
        </div>
      </div>

      {hit.text && (
        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{hit.text}</p>
      )}

      {Object.keys(hit.metadata).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(hit.metadata).map(([k, v]) => (
            <span key={k} className="text-xs rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
              {k}: {String(v)}
            </span>
          ))}
        </div>
      )}

      {hit.provenance.evidenceId && (
        <p className="text-xs text-muted-foreground">
          Evidence:{' '}
          <span className="font-mono text-foreground/70">{hit.provenance.evidenceId}</span>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Graph neighbourhood panel
// ---------------------------------------------------------------------------

const NODE_KIND_COLORS: Record<GraphNodeSummary['kind'], string> = {
  run: 'bg-blue-500/10 text-blue-700 border-blue-200',
  'work-item': 'bg-amber-500/10 text-amber-700 border-amber-200',
  approval: 'bg-purple-500/10 text-purple-700 border-purple-200',
  'evidence-entry': 'bg-green-500/10 text-green-700 border-green-200',
  'agent-machine': 'bg-slate-500/10 text-slate-700 border-slate-200',
};

function NodeCard({ node }: { node: GraphNodeSummary }) {
  const colorClass = NODE_KIND_COLORS[node.kind] ?? 'bg-muted text-muted-foreground border-border';
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${colorClass}`}>
      <div className="font-medium truncate">{node.label}</div>
      <div className="text-xs opacity-75 mt-0.5 flex items-center gap-1">
        <span className="font-mono">{node.nodeId}</span>
        <span>·</span>
        <span>{node.kind}</span>
      </div>
    </div>
  );
}

function EdgeRow({ edge, nodes }: { edge: GraphEdgeSummary; nodes: GraphNodeSummary[] }) {
  const from = nodes.find((n) => n.nodeId === edge.fromNodeId);
  const to = nodes.find((n) => n.nodeId === edge.toNodeId);
  return (
    <div className="flex items-center gap-2 text-xs py-1.5 border-b last:border-0">
      <span className="font-mono text-muted-foreground truncate max-w-[120px]">
        {from?.label ?? edge.fromNodeId}
      </span>
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-foreground/70">
        {edge.relation}
      </span>
      <span className="font-mono text-muted-foreground truncate max-w-[120px]">
        {to?.label ?? edge.toNodeId}
      </span>
    </div>
  );
}

function GraphPanel({ nodes, edges }: { nodes: GraphNodeSummary[]; edges: GraphEdgeSummary[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Network className="h-4 w-4" />
          Nodes ({nodes.length})
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {nodes.map((n) => (
            <NodeCard key={n.nodeId} node={n} />
          ))}
        </div>
      </div>

      {edges.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Edges ({edges.length})
          </h3>
          <div className="rounded-lg border divide-y bg-card">
            {edges.map((e) => (
              <EdgeRow key={e.edgeId} edge={e} nodes={nodes} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search page
// ---------------------------------------------------------------------------

function SearchPage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const [strategy, setStrategy] = useState<RetrievalStrategy>('semantic');
  const [query, setQuery] = useState('');
  const [rootNodeId, setRootNodeId] = useState('');

  const { mutate, data, isPending, isError, error, reset } = useRetrievalSearch(wsId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    reset();
    mutate({
      strategy,
      ...(strategy !== 'graph' && query ? { semantic: { query, topK: 10 } } : {}),
      ...(strategy !== 'semantic' && rootNodeId
        ? { graph: { rootNodeId, direction: 'outbound', maxDepth: 3 } }
        : {}),
    });
  }

  const hits = data?.hits ?? [];
  const graph = data?.graph;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <PageHeader
        title="Search"
        description="Semantic, graph, and hybrid search over workspace derived artefacts"
        icon={<EntityIcon entityType="artifact" size="md" decorative />}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <StrategyPicker value={strategy} onChange={setStrategy} />

        {strategy !== 'graph' && (
          <div className="flex gap-2">
            <Input
              placeholder="Natural language query…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
              maxLength={2048}
            />
          </div>
        )}

        {strategy !== 'semantic' && (
          <div className="flex gap-2">
            <Input
              placeholder="Root node ID (e.g. run-abc123)"
              value={rootNodeId}
              onChange={(e) => setRootNodeId(e.target.value)}
              className="flex-1"
            />
          </div>
        )}

        <Button
          type="submit"
          disabled={
            isPending ||
            (strategy !== 'graph' && !query) ||
            (strategy !== 'semantic' && !rootNodeId)
          }
          className="flex items-center gap-2"
        >
          <Search className="h-4 w-4" />
          {isPending ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          {error?.message ?? 'Search failed. Please try again.'}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {hits.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Search className="h-4 w-4" />
                Results ({hits.length})
                <Badge variant="outline" className="font-mono text-xs">
                  {data.strategy}
                </Badge>
              </h2>
              {hits.map((hit, i) => (
                <HitCard key={hit.artifactId} hit={hit} index={i} />
              ))}
            </div>
          )}

          {graph && (graph.nodes.length > 0 || graph.edges.length > 0) && (
            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Network className="h-4 w-4" />
                Graph Neighbourhood
              </h2>
              <GraphPanel nodes={graph.nodes} edges={graph.edges} />
            </div>
          )}

          {hits.length === 0 &&
            (!graph || (graph.nodes.length === 0 && graph.edges.length === 0)) && (
              <p className="text-sm text-muted-foreground">No results found.</p>
            )}
        </div>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: SearchPage,
});
