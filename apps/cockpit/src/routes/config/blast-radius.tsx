import { Fragment } from 'react';
import { createRoute } from '@tanstack/react-router';
import {
  Eye,
  Pencil,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
  PenLine,
} from 'lucide-react';
import { Route as rootRoute } from '../__root';
import { PageHeader } from '@/components/cockpit/page-header';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TOOL_CLASSIFICATIONS } from '@/mocks/fixtures/openclaw-demo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToolCategory = 'ReadOnly' | 'Mutation' | 'Dangerous' | 'Unknown';
type ExecutionTier = 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';

interface ToolClassification {
  schemaVersion: number;
  toolName: string;
  category: ToolCategory;
  minimumTier: ExecutionTier;
  rationale: string;
  overridden: boolean;
}

// ---------------------------------------------------------------------------
// Category badge config
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<
  ToolCategory,
  { icon: typeof Eye; label: string; className: string }
> = {
  ReadOnly: {
    icon: Eye,
    label: 'Read Only',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
  Mutation: {
    icon: Pencil,
    label: 'Mutation',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  },
  Dangerous: {
    icon: AlertTriangle,
    label: 'Dangerous',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  },
  Unknown: {
    icon: HelpCircle,
    label: 'Unknown',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSystemPrefix(toolName: string): string {
  const colonIndex = toolName.indexOf(':');
  if (colonIndex === -1) return toolName;
  const prefix = toolName.slice(0, colonIndex);
  // Capitalize first letter of each word
  return prefix
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function groupToolsBySystem(
  tools: ToolClassification[],
): { system: string; tools: ToolClassification[] }[] {
  const groups = new Map<string, ToolClassification[]>();
  for (const tool of tools) {
    const system = getSystemPrefix(tool.toolName);
    const existing = groups.get(system) ?? [];
    existing.push(tool);
    groups.set(system, existing);
  }
  return Array.from(groups.entries()).map(([system, tools]) => ({ system, tools }));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CategoryBadge({ category }: { category: ToolCategory }) {
  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.Unknown;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

function StatCard({
  label,
  count,
  icon: Icon,
  className,
}: {
  label: string;
  count: number;
  icon: typeof Eye;
  className: string;
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${className}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none">{count}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DistributionBar({ tools }: { tools: ToolClassification[] }) {
  const total = tools.length;
  if (total === 0) return null;

  const counts: Record<ToolCategory, number> = { ReadOnly: 0, Mutation: 0, Dangerous: 0, Unknown: 0 };
  for (const t of tools) {
    counts[t.category] = (counts[t.category] ?? 0) + 1;
  }

  const segments: { category: ToolCategory; pct: number; count: number }[] = (
    ['ReadOnly', 'Mutation', 'Dangerous', 'Unknown'] as ToolCategory[]
  )
    .filter((c) => counts[c] > 0)
    .map((c) => ({ category: c, pct: (counts[c] / total) * 100, count: counts[c] }));

  const colors: Record<ToolCategory, string> = {
    ReadOnly: 'bg-green-500',
    Mutation: 'bg-orange-500',
    Dangerous: 'bg-red-500',
    Unknown: 'bg-gray-400',
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Category Distribution</p>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        {segments.map((seg) => (
          <Tooltip key={seg.category}>
            <TooltipTrigger asChild>
              <div
                className={`${colors[seg.category]} transition-all`}
                style={{ width: `${seg.pct}%` }}
              />
            </TooltipTrigger>
            <TooltipContent>
              {CATEGORY_CONFIG[seg.category].label}: {seg.count} tool{seg.count !== 1 ? 's' : ''} (
              {Math.round(seg.pct)}%)
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="flex gap-3">
        {segments.map((seg) => (
          <span key={seg.category} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={`inline-block h-2 w-2 rounded-full ${colors[seg.category]}`} />
            {CATEGORY_CONFIG[seg.category].label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function BlastRadiusPage() {
  const tools = TOOL_CLASSIFICATIONS as ToolClassification[];
  const grouped = groupToolsBySystem(tools);

  const readOnlyCount = tools.filter((t) => t.category === 'ReadOnly').length;
  const mutationCount = tools.filter((t) => t.category === 'Mutation').length;
  const dangerousCount = tools.filter((t) => t.category === 'Dangerous').length;
  const overriddenCount = tools.filter((t) => t.overridden).length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Tool Blast Radius"
        description="Classification matrix for all registered tools"
        icon={<ShieldAlert className="h-6 w-6 text-primary" />}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Read Only"
          count={readOnlyCount}
          icon={Eye}
          className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
        />
        <StatCard
          label="Mutation"
          count={mutationCount}
          icon={Pencil}
          className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
        />
        <StatCard
          label="Dangerous"
          count={dangerousCount}
          icon={AlertTriangle}
          className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
        />
        <StatCard
          label="Overridden"
          count={overriddenCount}
          icon={PenLine}
          className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        />
      </div>

      {/* Distribution bar */}
      <DistributionBar tools={tools} />

      {/* Classification matrix grouped by system */}
      <Card className="py-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">Tool Name</TableHead>
              <TableHead className="w-[120px]">Category</TableHead>
              <TableHead className="w-[150px]">Minimum Tier</TableHead>
              <TableHead>Rationale</TableHead>
              <TableHead className="w-[90px] text-center">Override</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.map((group) => (
              <Fragment key={group.system}>
                {/* Group header row */}
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={5} className="py-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.system}
                    </span>
                  </TableCell>
                </TableRow>
                {/* Tool rows */}
                {group.tools.map((tool) => (
                  <TableRow key={tool.toolName}>
                    <TableCell>
                      <span className="font-mono text-[12px]">{tool.toolName}</span>
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={tool.category} />
                    </TableCell>
                    <TableCell>
                      <ExecutionTierBadge tier={tool.minimumTier} />
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground line-clamp-1 cursor-default">
                            {tool.rationale}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {tool.rationale}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-center">
                      {tool.overridden ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-300"
                        >
                          <PenLine className="h-3 w-3" aria-hidden="true" />
                          Override
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/blast-radius',
  component: BlastRadiusPage,
});
