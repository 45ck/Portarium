import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Database,
  KeyRound,
  LockKeyhole,
  Route,
  Search,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
} from 'lucide-react';
import type { PolicySummary } from '@portarium/cockpit-types';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';
import type { ExecutionTier } from '@/components/cockpit/policy-live-preview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  buildPolicyControllerDraftPacket,
  buildPolicyControllerProposal,
  type PolicyControllerActionClass,
  type PolicyControllerDecision,
  type PolicyControllerToolRiskCategory,
  type PolicyControllerToolRoute,
} from '@/lib/policy-controller-draft';
import { usePolicyChanges, useProposePolicyChange } from '@/hooks/queries/use-policy-changes';
import { useToolCatalog } from '@/hooks/queries/use-tool-catalog';
import {
  RUNTIME_TOOL_ROUTE_SEEDS,
  mergeCatalogToolRoutes,
  toolCatalogRoutesFromItems,
} from '@/lib/policy-tool-catalog';
import { cn } from '@/lib/utils';

type ControllerMode = 'tools' | 'risk' | 'groups' | 'presets' | 'gateway';
type DecisionKey = PolicyControllerDecision;
type RiskFilter = PolicyControllerToolRiskCategory | 'all';

type PolicyControllerPrototypeProps = {
  workspaceId: string;
  selectedPolicy: PolicySummary;
  currentTier: ExecutionTier;
};

type ActionClass = PolicyControllerActionClass & {
  id: string;
  label: string;
  description: string;
  authority: string;
  source: string;
  defaultDecision: DecisionKey;
};

type ToolRouteState = PolicyControllerToolRoute;

type CustomToolDraft = {
  label: string;
  toolName: string;
  provider: string;
  actionClass: string;
  riskCategory: PolicyControllerToolRiskCategory;
  decision: DecisionKey;
};

type DecisionDefinition = {
  label: string;
  shortLabel: string;
  executionTier: ExecutionTier;
  policyDecision: string;
  tone: string;
  helper: string;
};

const DECISIONS: Record<DecisionKey, DecisionDefinition> = {
  allow: {
    label: 'Allow by default',
    shortLabel: 'Allow',
    executionTier: 'Auto',
    policyDecision: 'allow',
    tone: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200',
    helper: 'Can run without prompting when evidence and workspace scope match.',
  },
  sandbox: {
    label: 'Sandbox only',
    shortLabel: 'Sandbox',
    executionTier: 'Assisted',
    policyDecision: 'allow_sandbox_only',
    tone: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200',
    helper: 'Allowed only as a dry-run, local fixture, or reversible preview.',
  },
  approval: {
    label: 'Seek approval',
    shortLabel: 'Approval',
    executionTier: 'HumanApprove',
    policyDecision: 'require_approval',
    tone: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200',
    helper: 'Stops for approval with evidence and rollback fields.',
  },
  deny: {
    label: 'Deny',
    shortLabel: 'Deny',
    executionTier: 'ManualOnly',
    policyDecision: 'deny',
    tone: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200',
    helper: 'Blocked by policy.',
  },
};

const RISK_CATEGORIES: readonly PolicyControllerToolRiskCategory[] = [
  'ReadOnly',
  'Mutation',
  'Dangerous',
  'Unknown',
];

const RISK_LABELS: Record<PolicyControllerToolRiskCategory, string> = {
  ReadOnly: 'Read-only',
  Mutation: 'Mutation',
  Dangerous: 'High risk',
  Unknown: 'Unknown risk',
};

const RISK_DESCRIPTIONS: Record<PolicyControllerToolRiskCategory, string> = {
  ReadOnly: 'Status, search, list, lookup, query, report, evidence, metadata, and analysis tools.',
  Mutation:
    'Tools that can send, publish, start, cancel, submit, register, open sessions, or change state.',
  Dangerous:
    'Tools that can run shell or executor actions, expose credentials, destroy data, move money, or perform other high-risk execution.',
  Unknown: 'Unclassified tools that should stay reviewed until the catalog is explicit.',
};

const RISK_BADGE_TONE: Record<PolicyControllerToolRiskCategory, string> = {
  ReadOnly:
    'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200',
  Mutation:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200',
  Dangerous:
    'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200',
  Unknown: 'border-border bg-muted/50 text-muted-foreground',
};

const ACTION_CLASSES: ActionClass[] = [
  {
    id: 'local-status',
    label: 'Status and safe reads',
    description: 'Health checks, lists, and records that do not change state.',
    authority: 'Auto',
    source: 'Portarium registry',
    defaultDecision: 'allow',
  },
  {
    id: 'context-pack',
    label: 'Context summaries',
    description: 'Assemble approved evidence into a summary or brief.',
    authority: 'Assisted',
    source: 'Evidence workspace',
    defaultDecision: 'sandbox',
  },
  {
    id: 'standing-read',
    label: 'Approved source reads',
    description: 'One-at-a-time reads already allowed for the workspace.',
    authority: 'Auto',
    source: 'Scoped source',
    defaultDecision: 'allow',
  },
  {
    id: 'approval-draft',
    label: 'Drafts and review requests',
    description: 'Create an approval card, plan, or review packet without executing it.',
    authority: 'Auto',
    source: 'Approval flow',
    defaultDecision: 'allow',
  },
  {
    id: 'browser-query',
    label: 'Browser reads',
    description: 'Narrow browser automation against a live app.',
    authority: 'Approval',
    source: 'Gateway',
    defaultDecision: 'approval',
  },
  {
    id: 'external-executor',
    label: 'Live changes',
    description: 'Send, submit, delete, spend, publish, or change external/live systems.',
    authority: 'Manual-only',
    source: 'Executor gate',
    defaultDecision: 'deny',
  },
];

const PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  icon: typeof ShieldCheck;
  decisions: Record<string, DecisionKey>;
}> = [
  {
    id: 'calibrated',
    label: 'Calibrated internal',
    description: 'Low-friction local work, approval for sensitive reads, deny external effects.',
    icon: SlidersHorizontal,
    decisions: {
      'local-status': 'allow',
      'context-pack': 'sandbox',
      'standing-read': 'allow',
      'approval-draft': 'allow',
      'browser-query': 'approval',
      'external-executor': 'deny',
    },
  },
  {
    id: 'evidence-first',
    label: 'Evidence-first',
    description: 'Most work becomes reviewable before it can affect live state.',
    icon: ClipboardCheck,
    decisions: {
      'local-status': 'allow',
      'context-pack': 'approval',
      'standing-read': 'approval',
      'approval-draft': 'approval',
      'browser-query': 'approval',
      'external-executor': 'deny',
    },
  },
  {
    id: 'operator-lockdown',
    label: 'Operator lockdown',
    description: 'Only status views stay automatic; all other paths stop or require review.',
    icon: LockKeyhole,
    decisions: {
      'local-status': 'allow',
      'context-pack': 'approval',
      'standing-read': 'approval',
      'approval-draft': 'approval',
      'browser-query': 'deny',
      'external-executor': 'deny',
    },
  },
];

function buildDefaultRoutes(): Record<string, DecisionKey> {
  return ACTION_CLASSES.reduce<Record<string, DecisionKey>>((routes, action) => {
    routes[action.id] = action.defaultDecision;
    return routes;
  }, {});
}

function emptyCustomToolDraft(): CustomToolDraft {
  return {
    label: '',
    toolName: '',
    provider: 'Custom',
    actionClass: 'external-executor',
    riskCategory: 'Unknown',
    decision: 'approval',
  };
}

function customToolId(toolName: string, existing: readonly ToolRouteState[]): string {
  const base =
    toolName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'custom-tool';
  let candidate = `custom-${base}`;
  let index = 2;
  while (existing.some((tool) => tool.id === candidate)) {
    candidate = `custom-${base}-${index}`;
    index += 1;
  }
  return candidate;
}

function decisionIcon(decision: DecisionKey, className = 'h-4 w-4') {
  switch (decision) {
    case 'allow':
      return <CheckCircle2 className={className} aria-hidden="true" />;
    case 'sandbox':
      return <Server className={className} aria-hidden="true" />;
    case 'approval':
      return <ShieldAlert className={className} aria-hidden="true" />;
    case 'deny':
      return <Ban className={className} aria-hidden="true" />;
  }
}

function DecisionBadge({ decision }: { decision: DecisionKey }) {
  const config = DECISIONS[decision];
  return (
    <Badge variant="outline" className={cn('gap-1.5 border text-[11px]', config.tone)}>
      {decisionIcon(decision, 'h-3.5 w-3.5')}
      {config.shortLabel}
    </Badge>
  );
}

function RiskBadge({ riskCategory }: { riskCategory: PolicyControllerToolRiskCategory }) {
  return (
    <Badge variant="outline" className={cn('border text-[11px]', RISK_BADGE_TONE[riskCategory])}>
      {RISK_LABELS[riskCategory]}
    </Badge>
  );
}

function countRoutes(routes: Record<string, DecisionKey>) {
  return ACTION_CLASSES.reduce<Record<DecisionKey, number>>(
    (counts, action) => {
      counts[routes[action.id] ?? action.defaultDecision] += 1;
      return counts;
    },
    { allow: 0, sandbox: 0, approval: 0, deny: 0 },
  );
}

function countToolDecisions(toolRoutes: readonly ToolRouteState[]) {
  return toolRoutes.reduce<Record<DecisionKey, number>>(
    (counts, tool) => {
      counts[tool.decision] += 1;
      return counts;
    },
    { allow: 0, sandbox: 0, approval: 0, deny: 0 },
  );
}

function riskCategoryForTool(tool: ToolRouteState): PolicyControllerToolRiskCategory {
  return tool.riskCategory ?? 'Unknown';
}

function isToolMatch(tool: ToolRouteState, search: string, riskFilter: RiskFilter): boolean {
  const riskCategory = riskCategoryForTool(tool);
  if (riskFilter !== 'all' && riskCategory !== riskFilter) return false;

  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return true;

  return [
    tool.label,
    tool.toolName,
    tool.provider,
    tool.actionClass,
    tool.description ?? '',
    tool.source ?? '',
    riskCategory,
    RISK_LABELS[riskCategory],
  ].some((value) => value.toLowerCase().includes(normalizedSearch));
}

function highRiskToolCount(toolRoutes: readonly ToolRouteState[]): number {
  return toolRoutes.filter((tool) => riskCategoryForTool(tool) === 'Dangerous').length;
}

function minimumExecutionTierForRisk(
  riskCategory: PolicyControllerToolRiskCategory,
): ExecutionTier {
  switch (riskCategory) {
    case 'ReadOnly':
      return 'Auto';
    case 'Mutation':
    case 'Unknown':
      return 'HumanApprove';
    case 'Dangerous':
      return 'ManualOnly';
  }
}

function currentPresetLabel(routes: Record<string, DecisionKey>): string {
  const match = PRESETS.find((preset) =>
    ACTION_CLASSES.every((action) => preset.decisions[action.id] === routes[action.id]),
  );
  return match?.label ?? 'Custom controller';
}

function DecisionButton({
  decision,
  selected,
  onSelect,
}: {
  decision: DecisionKey;
  selected: boolean;
  onSelect: () => void;
}) {
  const config = DECISIONS[decision];
  const label = decision === 'approval' ? 'Approval' : config.shortLabel;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={config.label}
      className={cn(
        'flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors',
        selected ? config.tone : 'border-border bg-background hover:bg-muted/50',
      )}
      aria-pressed={selected}
    >
      {decisionIcon(decision, 'h-3.5 w-3.5')}
      <span>{label}</span>
    </button>
  );
}

function MetricTile({
  label,
  value,
  decision,
}: {
  label: string;
  value: number;
  decision: DecisionKey;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {decisionIcon(decision, 'h-3.5 w-3.5 text-muted-foreground')}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function RouteSummary({ routes }: { routes: Record<string, DecisionKey> }) {
  const counts = countRoutes(routes);
  const total = ACTION_CLASSES.length;
  const gatedPercent = Math.round(((counts.approval + counts.deny) / total) * 100);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Allow" value={counts.allow} decision="allow" />
        <MetricTile label="Sandbox" value={counts.sandbox} decision="sandbox" />
        <MetricTile label="Approval" value={counts.approval} decision="approval" />
        <MetricTile label="Deny" value={counts.deny} decision="deny" />
      </div>
      <div className="rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Guarded routes</span>
          <span className="font-medium">{gatedPercent}%</span>
        </div>
        <Progress value={gatedPercent} className="mt-2 h-2" />
      </div>
    </div>
  );
}

function ToolRouteSummary({ toolRoutes }: { toolRoutes: readonly ToolRouteState[] }) {
  const counts = countToolDecisions(toolRoutes);
  const total = Math.max(toolRoutes.length, 1);
  const gatedPercent = Math.round(((counts.approval + counts.deny) / total) * 100);
  const highRiskCount = highRiskToolCount(toolRoutes);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.42fr)]">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Allow" value={counts.allow} decision="allow" />
        <MetricTile label="Sandbox" value={counts.sandbox} decision="sandbox" />
        <MetricTile label="Approval" value={counts.approval} decision="approval" />
        <MetricTile label="Deny" value={counts.deny} decision="deny" />
      </div>
      <div className="rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Guarded tool routes</span>
          <span className="font-medium">{gatedPercent}%</span>
        </div>
        <Progress value={gatedPercent} className="mt-2 h-2" />
        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">High risk</span>
          <Badge variant="outline" className={RISK_BADGE_TONE.Dangerous}>
            {highRiskCount}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function GroupsOption({
  routes,
  setDecision,
}: {
  routes: Record<string, DecisionKey>;
  setDecision: (actionId: string, decision: DecisionKey) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md border border-border">
        <div className="hidden grid-cols-[minmax(220px,1fr)_92px_120px_minmax(360px,0.9fr)] border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground lg:grid">
          <span>Group</span>
          <span>Default</span>
          <span>Source</span>
          <span>Decision</span>
        </div>
        {ACTION_CLASSES.map((action) => (
          <div
            key={action.id}
            className="grid gap-3 border-b border-border px-3 py-3 last:border-b-0 lg:grid-cols-[minmax(220px,1fr)_92px_120px_minmax(360px,0.9fr)]"
          >
            <div className="min-w-0">
              <div className="font-medium">{action.label}</div>
              <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
            </div>
            <Badge variant="outline" className="w-fit self-start font-mono text-[11px]">
              {action.authority}
            </Badge>
            <span className="text-xs text-muted-foreground">{action.source}</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(DECISIONS) as DecisionKey[]).map((decision) => (
                <DecisionButton
                  key={decision}
                  decision={decision}
                  selected={routes[action.id] === decision}
                  onSelect={() => setDecision(action.id, decision)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.45fr)_minmax(0,1fr)]">
        <RouteSummary routes={routes} />
        <div className="rounded-md border border-border p-4">
          <div className="flex items-center gap-2 font-medium">
            <Route className="h-4 w-4 text-primary" aria-hidden="true" />
            Decision vocabulary
          </div>
          <div className="mt-3 space-y-3">
            {(Object.keys(DECISIONS) as DecisionKey[]).map((decision) => {
              const config = DECISIONS[decision];
              return (
                <div key={decision} className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <DecisionBadge decision={decision} />
                    <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                      {config.policyDecision}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground">{config.helper}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function PresetOption({
  routes,
  applyPreset,
}: {
  routes: Record<string, DecisionKey>;
  applyPreset: (decisions: Record<string, DecisionKey>) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(320px,1fr)]">
      <div className="grid gap-3">
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          const active = ACTION_CLASSES.every(
            (action) => preset.decisions[action.id] === routes[action.id],
          );
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.decisions)}
              className={cn(
                'rounded-md border p-4 text-left transition-colors',
                active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
              )}
            >
              <div className="flex items-start gap-3">
                <span className="rounded-md border border-border bg-background p-2">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{preset.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {preset.description}
                  </span>
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ACTION_CLASSES.map((action) => (
                  <DecisionBadge key={action.id} decision={preset.decisions[action.id]!} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-md border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-medium">{currentPresetLabel(routes)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Resulting queue shape for future Portarium and OpenClaw requests.
            </p>
          </div>
          <Badge variant="outline">Preview</Badge>
        </div>
        <Separator className="my-4" />
        <div className="space-y-3">
          {ACTION_CLASSES.map((action) => {
            const decision = routes[action.id] ?? action.defaultDecision;
            return (
              <div
                key={action.id}
                className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <div className="font-medium">{action.label}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{action.source}</p>
                </div>
                <DecisionBadge decision={decision} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function toolSourceLabel(tool: ToolRouteState): string {
  if (tool.custom) return 'Custom';
  if (tool.source === 'catalog') return 'Catalog';
  if (tool.source === 'runtime-seed') return 'Seed';
  return tool.source || 'Local';
}

function ToolRoutesOption({
  toolRoutes,
  customTool,
  toolSearch,
  riskFilter,
  catalogCount,
  catalogStatus,
  setToolDecision,
  setManyToolDecisions,
  setCustomTool,
  setToolSearch,
  setRiskFilter,
  addCustomTool,
}: {
  toolRoutes: readonly ToolRouteState[];
  customTool: CustomToolDraft;
  toolSearch: string;
  riskFilter: RiskFilter;
  catalogCount: number;
  catalogStatus: 'loading' | 'loaded' | 'unavailable';
  setToolDecision: (toolId: string, decision: DecisionKey) => void;
  setManyToolDecisions: (toolIds: readonly string[], decision: DecisionKey) => void;
  setCustomTool: (draft: CustomToolDraft) => void;
  setToolSearch: (search: string) => void;
  setRiskFilter: (risk: RiskFilter) => void;
  addCustomTool: () => void;
}) {
  const canAddCustomTool = customTool.toolName.trim().length > 0;
  const visibleToolRoutes = toolRoutes.filter((tool) => isToolMatch(tool, toolSearch, riskFilter));
  const visibleToolIds = visibleToolRoutes.map((tool) => tool.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
        <div>
          <div className="font-medium">Tool routes</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Set the draft decision for every registered, contributed, or custom runtime tool.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {catalogStatus === 'loaded'
              ? `Catalog ${catalogCount}`
              : catalogStatus === 'loading'
                ? 'Catalog loading'
                : 'Catalog unavailable'}
          </Badge>
          <Badge variant="outline">{toolRoutes.length} tool routes</Badge>
        </div>
      </div>

      <ToolRouteSummary toolRoutes={toolRoutes} />

      <div className="grid gap-3 rounded-md border border-border p-3 lg:grid-cols-[minmax(220px,0.9fr)_180px_minmax(300px,1fr)]">
        <div className="space-y-1.5">
          <Label htmlFor="tool-route-search">Search tools</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="tool-route-search"
              value={toolSearch}
              onChange={(event) => setToolSearch(event.target.value)}
              className="pl-8"
              placeholder="portarium, browser, approval, github..."
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tool-route-risk-filter">Risk</Label>
          <select
            id="tool-route-risk-filter"
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}
            className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">All risk tiers</option>
            {RISK_CATEGORIES.map((riskCategory) => (
              <option key={riskCategory} value={riskCategory}>
                {RISK_LABELS[riskCategory]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Apply to visible tools</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(DECISIONS) as DecisionKey[]).map((decision) => (
              <Button
                key={decision}
                type="button"
                size="sm"
                variant="outline"
                disabled={visibleToolIds.length === 0}
                onClick={() => setManyToolDecisions(visibleToolIds, decision)}
              >
                {DECISIONS[decision].shortLabel}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {visibleToolRoutes.length} of {toolRoutes.length}.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <div className="hidden grid-cols-[minmax(240px,1fr)_minmax(150px,0.45fr)_96px_112px_minmax(360px,0.95fr)] border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground lg:grid">
          <span>Tool</span>
          <span>Provider</span>
          <span>Source</span>
          <span>Current</span>
          <span>Draft route</span>
        </div>
        {visibleToolRoutes.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            No tools match the current filter.
          </div>
        ) : null}
        {visibleToolRoutes.map((tool) => (
          <div
            key={tool.id}
            className="grid gap-3 border-b border-border px-3 py-3 last:border-b-0 lg:grid-cols-[minmax(240px,1fr)_minmax(150px,0.45fr)_96px_112px_minmax(360px,0.95fr)]"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{tool.label}</span>
                <RiskBadge riskCategory={riskCategoryForTool(tool)} />
                {tool.minimumExecutionTier ? (
                  <ExecutionTierBadge tier={tool.minimumExecutionTier} />
                ) : null}
              </div>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {tool.toolName}
              </p>
              {tool.description ? (
                <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                Group:{' '}
                {ACTION_CLASSES.find((action) => action.id === tool.actionClass)?.label ??
                  tool.actionClass}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{tool.provider}</span>
            <Badge variant="outline" className="h-fit w-fit text-[11px]">
              {toolSourceLabel(tool)}
            </Badge>
            <div className="self-start">
              <DecisionBadge decision={tool.currentDecision} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(DECISIONS) as DecisionKey[]).map((decision) => (
                <DecisionButton
                  key={decision}
                  decision={decision}
                  selected={tool.decision === decision}
                  onSelect={() => setToolDecision(tool.id, decision)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-border p-4">
        <div className="flex items-center gap-2 font-medium">
          <Wrench className="h-4 w-4 text-primary" aria-hidden="true" />
          Custom tool route
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(160px,0.7fr)_minmax(220px,1fr)_minmax(140px,0.55fr)_minmax(150px,0.55fr)_minmax(160px,0.6fr)_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="custom-tool-label">Display name</Label>
            <Input
              id="custom-tool-label"
              value={customTool.label}
              onChange={(event) => setCustomTool({ ...customTool, label: event.target.value })}
              placeholder="Gmail send"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-tool-name">Tool name</Label>
            <Input
              id="custom-tool-name"
              value={customTool.toolName}
              onChange={(event) => setCustomTool({ ...customTool, toolName: event.target.value })}
              placeholder="gmail.message.send"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-tool-provider">Provider</Label>
            <Input
              id="custom-tool-provider"
              value={customTool.provider}
              onChange={(event) => setCustomTool({ ...customTool, provider: event.target.value })}
              placeholder="Custom"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-tool-risk">Risk</Label>
            <select
              id="custom-tool-risk"
              value={customTool.riskCategory}
              onChange={(event) =>
                setCustomTool({
                  ...customTool,
                  riskCategory: event.target.value as PolicyControllerToolRiskCategory,
                })
              }
              className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {RISK_CATEGORIES.map((riskCategory) => (
                <option key={riskCategory} value={riskCategory}>
                  {RISK_LABELS[riskCategory]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-tool-action-class">Default group</Label>
            <select
              id="custom-tool-action-class"
              value={customTool.actionClass}
              onChange={(event) =>
                setCustomTool({ ...customTool, actionClass: event.target.value })
              }
              className="border-input h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {ACTION_CLASSES.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              disabled={!canAddCustomTool}
              onClick={addCustomTool}
            >
              Add tool
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskPostureOption({
  toolRoutes,
  setManyToolDecisions,
  focusRiskTools,
}: {
  toolRoutes: readonly ToolRouteState[];
  setManyToolDecisions: (toolIds: readonly string[], decision: DecisionKey) => void;
  focusRiskTools: (riskCategory: PolicyControllerToolRiskCategory) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-4">
        {RISK_CATEGORIES.map((riskCategory) => {
          const tools = toolRoutes.filter((tool) => riskCategoryForTool(tool) === riskCategory);
          const counts = countToolDecisions(tools);
          return (
            <div key={riskCategory} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <RiskBadge riskCategory={riskCategory} />
                  <div className="mt-3 text-2xl font-semibold">{tools.length}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={tools.length === 0}
                  onClick={() => focusRiskTools(riskCategory)}
                >
                  View
                </Button>
              </div>
              <p className="mt-3 min-h-12 text-xs text-muted-foreground">
                {RISK_DESCRIPTIONS[riskCategory]}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                <span>{counts.allow} allow</span>
                <span>{counts.sandbox} sandbox</span>
                <span>{counts.approval} approval</span>
                <span>{counts.deny} deny</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(Object.keys(DECISIONS) as DecisionKey[]).map((decision) => (
                  <Button
                    key={decision}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={tools.length === 0}
                    onClick={() =>
                      setManyToolDecisions(
                        tools.map((tool) => tool.id),
                        decision,
                      )
                    }
                  >
                    {DECISIONS[decision].shortLabel}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-md border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-medium">High risk posture</div>
            <p className="mt-1 text-xs text-muted-foreground">
              High-risk tools can be denied entirely, held for approval, limited to sandbox, or
              explicitly allowed when the workspace owner chooses that posture.
            </p>
          </div>
          <RiskBadge riskCategory="Dangerous" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {toolRoutes
            .filter((tool) => riskCategoryForTool(tool) === 'Dangerous')
            .map((tool) => (
              <div
                key={tool.id}
                className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <div className="font-medium">{tool.label}</div>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                    {tool.toolName}
                  </p>
                </div>
                <DecisionBadge decision={tool.decision} />
              </div>
            ))}
          {highRiskToolCount(toolRoutes) === 0 ? (
            <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
              No high-risk tools are currently in the catalog.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-primary">{icon}</span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{label}</span>
          <span className="mt-1 block break-words text-xs text-muted-foreground">{value}</span>
        </span>
      </div>
      <Badge variant="outline" className={tone}>
        Live
      </Badge>
    </div>
  );
}

function GatewayOption({
  workspaceId,
  strictEvidence,
  setStrictEvidence,
  dryRunExecutors,
  setDryRunExecutors,
}: {
  workspaceId: string;
  strictEvidence: boolean;
  setStrictEvidence: (enabled: boolean) => void;
  dryRunExecutors: boolean;
  setDryRunExecutors: (enabled: boolean) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
      <div className="grid gap-3 md:grid-cols-2">
        <SettingRow
          icon={<Database className="h-4 w-4" aria-hidden="true" />}
          label="Data source status"
          value="Sanitized source map, freshness, acquisition mode, and redaction posture."
        />
        <SettingRow
          icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
          label="Connector capability status"
          value="Which reads, review requests, and live changes are exposed without secrets."
        />
        <SettingRow
          icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
          label="Standing read policy"
          value="Approved one-at-a-time read scopes and approval triggers for broader collection."
        />
        <SettingRow
          icon={<Settings2 className="h-4 w-4" aria-hidden="true" />}
          label="Approval registry"
          value="Pending cards, stale cards, decision rationale, expiry, and executor readiness."
        />
      </div>

      <div className="space-y-4">
        <div className="rounded-md border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-medium">Gateway guardrails</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Workspace {workspaceId} policy settings projected into Cockpit.
              </p>
            </div>
            <Badge variant="outline">Gateway</Badge>
          </div>

          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <span>
                <span className="block text-sm font-medium">Require evidence before approval</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Approval cards need source IDs, freshness, risk, and rollback.
                </span>
              </span>
              <Switch checked={strictEvidence} onCheckedChange={setStrictEvidence} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <span>
                <span className="block text-sm font-medium">Dry-run executors by default</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Approved executor paths still stage a reversible preview first.
                </span>
              </span>
              <Switch checked={dryRunExecutors} onCheckedChange={setDryRunExecutors} />
            </label>
          </div>
        </div>

        <div className="rounded-md border border-border p-4">
          <div className="font-medium">Chat exposure</div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Read/status aliases</span>
              <Badge variant="outline" className={DECISIONS.allow.tone}>
                exposed
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Approval card draft</span>
              <Badge variant="outline" className={DECISIONS.approval.tone}>
                exposed
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Executor gate</span>
              <Badge variant="outline" className={DECISIONS.deny.tone}>
                not chat-exposed
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PolicyControllerPrototype({
  workspaceId,
  selectedPolicy,
  currentTier,
}: PolicyControllerPrototypeProps) {
  const [mode, setMode] = useState<ControllerMode>('tools');
  const [routes, setRoutes] = useState<Record<string, DecisionKey>>(() => buildDefaultRoutes());
  const [toolRoutes, setToolRoutes] = useState<ToolRouteState[]>(() => [
    ...RUNTIME_TOOL_ROUTE_SEEDS,
  ]);
  const [customTool, setCustomTool] = useState<CustomToolDraft>(() => emptyCustomToolDraft());
  const [toolSearch, setToolSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [strictEvidence, setStrictEvidence] = useState(true);
  const [dryRunExecutors, setDryRunExecutors] = useState(true);
  const [rationale, setRationale] = useState(
    'Align Cockpit policy defaults with the current internal OpenClaw gateway posture.',
  );
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const selectedPolicyId = selectedPolicy.policyId;
  const selectedPolicyName = selectedPolicy.name;
  const summary = useMemo(() => countToolDecisions(toolRoutes), [toolRoutes]);
  const toolCatalogQuery = useToolCatalog(workspaceId);
  const catalogToolRoutes = useMemo(
    () => toolCatalogRoutesFromItems(toolCatalogQuery.data?.items ?? []),
    [toolCatalogQuery.data?.items],
  );
  const draftPacket = useMemo(
    () =>
      buildPolicyControllerDraftPacket({
        actionClasses: ACTION_CLASSES,
        routes,
        toolRoutes,
        strictEvidence,
        dryRunExecutors,
      }),
    [dryRunExecutors, routes, strictEvidence, toolRoutes],
  );
  const proposal = useMemo(
    () =>
      buildPolicyControllerProposal({
        workspaceId,
        selectedPolicy,
        currentTier,
        routes,
        toolRoutes,
        actionClasses: ACTION_CLASSES,
        strictEvidence,
        dryRunExecutors,
        rationale,
      }),
    [
      currentTier,
      dryRunExecutors,
      rationale,
      routes,
      selectedPolicy,
      strictEvidence,
      toolRoutes,
      workspaceId,
    ],
  );
  const policyChangesQuery = usePolicyChanges(workspaceId, selectedPolicyId);
  const proposePolicyChange = useProposePolicyChange(workspaceId, selectedPolicyId);
  const hasRationale = rationale.trim().length > 0;

  useEffect(() => {
    if (catalogToolRoutes.length === 0) return;
    setToolRoutes((current) => mergeCatalogToolRoutes(catalogToolRoutes, current));
  }, [catalogToolRoutes]);

  const setDecision = (actionId: string, decision: DecisionKey) => {
    setRoutes((current) => ({ ...current, [actionId]: decision }));
  };

  const setToolDecision = (toolId: string, decision: DecisionKey) => {
    setToolRoutes((current) =>
      current.map((tool) => (tool.id === toolId ? { ...tool, decision } : tool)),
    );
  };

  const setManyToolDecisions = (toolIds: readonly string[], decision: DecisionKey) => {
    const toolIdSet = new Set(toolIds);
    setToolRoutes((current) =>
      current.map((tool) => (toolIdSet.has(tool.id) ? { ...tool, decision } : tool)),
    );
  };

  const applyPreset = (decisions: Record<string, DecisionKey>) => {
    setRoutes({ ...decisions });
    setToolRoutes((current) =>
      current.map((tool) => ({
        ...tool,
        decision: decisions[tool.actionClass] ?? tool.decision,
      })),
    );
  };

  const addCustomTool = () => {
    const toolName = customTool.toolName.trim();
    if (!toolName) {
      return;
    }
    setToolRoutes((current) => [
      ...current,
      {
        id: customToolId(toolName, current),
        label: customTool.label.trim() || toolName,
        toolName,
        provider: customTool.provider.trim() || 'Custom',
        actionClass: customTool.actionClass,
        riskCategory: customTool.riskCategory,
        minimumExecutionTier: minimumExecutionTierForRisk(customTool.riskCategory),
        currentDecision: 'deny',
        decision: customTool.decision,
        source: 'custom',
        custom: true,
      },
    ]);
    setCustomTool(emptyCustomToolDraft());
  };

  const focusRiskTools = (riskCategory: PolicyControllerToolRiskCategory) => {
    setToolSearch('');
    setRiskFilter(riskCategory);
    setMode('tools');
  };

  const handleCopyDraft = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ proposal, draftPacket }, null, 2));
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const handleProposePolicyChange = () => {
    proposePolicyChange.mutate(proposal);
  };

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
              Policy Controller Lab
            </CardTitle>
            <CardDescription>
              Controller for tool-level allow, sandbox, approval, and deny defaults.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Live proposal path</Badge>
            <Badge variant="outline" className="font-mono">
              {selectedPolicyId}
            </Badge>
            <ExecutionTierBadge tier={currentTier} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)]">
          <div className="rounded-md border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{selectedPolicyName}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Current draft profile: {currentPresetLabel(routes)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <DecisionBadge decision="allow" />
                <DecisionBadge decision="sandbox" />
                <DecisionBadge decision="approval" />
                <DecisionBadge decision="deny" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 rounded-md border border-border p-3">
            <div className="text-center">
              <div className="text-lg font-semibold">{summary.allow}</div>
              <div className="text-[11px] text-muted-foreground">allow</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">{summary.sandbox}</div>
              <div className="text-[11px] text-muted-foreground">sandbox</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">{summary.approval}</div>
              <div className="text-[11px] text-muted-foreground">approval</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">{summary.deny}</div>
              <div className="text-[11px] text-muted-foreground">deny</div>
            </div>
          </div>
        </div>

        <Tabs value={mode} onValueChange={(value) => setMode(value as ControllerMode)}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="tools">
              <Wrench className="h-4 w-4" aria-hidden="true" />
              Tools
            </TabsTrigger>
            <TabsTrigger value="risk">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              Risk
            </TabsTrigger>
            <TabsTrigger value="groups">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Groups
            </TabsTrigger>
            <TabsTrigger value="presets">
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              Presets
            </TabsTrigger>
            <TabsTrigger value="gateway">
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Gateway
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tools" className="mt-4">
            <ToolRoutesOption
              toolRoutes={toolRoutes}
              customTool={customTool}
              toolSearch={toolSearch}
              riskFilter={riskFilter}
              catalogCount={toolCatalogQuery.data?.items.length ?? 0}
              catalogStatus={
                toolCatalogQuery.isError
                  ? 'unavailable'
                  : toolCatalogQuery.isLoading
                    ? 'loading'
                    : 'loaded'
              }
              setToolDecision={setToolDecision}
              setManyToolDecisions={setManyToolDecisions}
              setCustomTool={setCustomTool}
              setToolSearch={setToolSearch}
              setRiskFilter={setRiskFilter}
              addCustomTool={addCustomTool}
            />
          </TabsContent>

          <TabsContent value="risk" className="mt-4">
            <RiskPostureOption
              toolRoutes={toolRoutes}
              setManyToolDecisions={setManyToolDecisions}
              focusRiskTools={focusRiskTools}
            />
          </TabsContent>

          <TabsContent value="groups" className="mt-4">
            <GroupsOption routes={routes} setDecision={setDecision} />
          </TabsContent>

          <TabsContent value="presets" className="mt-4">
            <PresetOption routes={routes} applyPreset={applyPreset} />
          </TabsContent>

          <TabsContent value="gateway" className="mt-4">
            <GatewayOption
              workspaceId={workspaceId}
              strictEvidence={strictEvidence}
              setStrictEvidence={setStrictEvidence}
              dryRunExecutors={dryRunExecutors}
              setDryRunExecutors={setDryRunExecutors}
            />
          </TabsContent>
        </Tabs>

        <div className="rounded-md border border-border bg-muted/30 p-3">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.45fr)]">
            <div className="space-y-2">
              <Label htmlFor="policy-controller-rationale">Proposal rationale</Label>
              <Textarea
                id="policy-controller-rationale"
                value={rationale}
                onChange={(event) => setRationale(event.target.value)}
                className="min-h-20 bg-background"
                placeholder="Explain why this routing policy should change."
              />
              <p className="text-xs text-muted-foreground">
                Applies standard policy-controller changes directly; routes that open broad browser
                or executor authority remain approval-gated.
              </p>
            </div>
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-background p-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Recent submissions</span>
                  <Badge variant="outline">{policyChangesQuery.data?.items.length ?? 0}</Badge>
                </div>
                <div className="mt-2 flex items-center gap-2 text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  {policyChangesQuery.isError
                    ? 'Policy-change list unavailable.'
                    : 'Pending changes remain approval-gated.'}
                </div>
              </div>

              {proposePolicyChange.isError ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{proposePolicyChange.error.message}</span>
                </div>
              ) : null}

              {proposePolicyChange.data ? (
                <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Proposed {proposePolicyChange.data.policyChangeId} ·{' '}
                    {proposePolicyChange.data.status}
                  </span>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={handleCopyDraft}>
                  {copyState === 'copied'
                    ? 'Copied draft'
                    : copyState === 'failed'
                      ? 'Copy failed'
                      : 'Copy draft packet'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!hasRationale || proposePolicyChange.isPending}
                  onClick={handleProposePolicyChange}
                >
                  {proposePolicyChange.isPending ? 'Proposing...' : 'Propose policy change'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
