import { useState, useCallback } from 'react';
import { createRoute, Link } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Zap,
  Users,
  UserCheck,
  Hand,
  Plus,
  X,
  Save,
  Undo2,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { Route as rootRoute } from '../__root';
import { PageHeader } from '@/components/cockpit/page-header';
import { EntityIcon } from '@/components/domain/entity-icon';
import { EmptyState } from '@/components/cockpit/empty-state';
import { SorBadge } from '@/components/cockpit/triage-card/sor-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { emitPolicyUpdate } from '@/lib/policy-event-bridge';
import { PolicyLivePreview } from '@/components/cockpit/policy-live-preview';
import { POLICIES, TOOL_CLASSIFICATIONS, AGENTS, APPROVALS } from '@/mocks/fixtures/openclaw-demo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExecutionTier = 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
type Irreversibility = 'full' | 'partial' | 'none';
type SodType = 'none' | 'simple' | 'n-of-m' | 'blocked-role';

interface BlastRadiusEntry {
  system: string;
  scope: string;
}

interface PolicyFormState {
  name: string;
  status: 'active' | 'paused';
  triggerAction: string;
  triggerCondition: string;
  tier: ExecutionTier;
  blastRadius: BlastRadiusEntry[];
  irreversibility: Irreversibility;
  sodType: SodType;
  sodRoles: string[];
  sodNRequired: number;
  sodNTotal: number;
  scopeAgents: string[];
  scopeTools: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_OPTIONS: {
  value: ExecutionTier;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgTint: string;
  borderColor: string;
}[] = [
  {
    value: 'Auto',
    label: 'Auto',
    description: 'No approval needed',
    icon: Zap,
    color: 'text-green-600 dark:text-green-400',
    bgTint: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-500',
  },
  {
    value: 'Assisted',
    label: 'Assisted',
    description: 'AI-assisted review',
    icon: Users,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgTint: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-yellow-500',
  },
  {
    value: 'HumanApprove',
    label: 'Human Approve',
    description: 'Human must approve',
    icon: UserCheck,
    color: 'text-orange-600 dark:text-orange-400',
    bgTint: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-500',
  },
  {
    value: 'ManualOnly',
    label: 'Manual Only',
    description: 'Locked \u2014 manual execution only',
    icon: Hand,
    color: 'text-red-600 dark:text-red-400',
    bgTint: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-500',
  },
];

const IRREVERSIBILITY_OPTIONS: {
  value: Irreversibility;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgTint: string;
  borderColor: string;
}[] = [
  {
    value: 'none',
    label: 'Reversible',
    description: 'Action can be fully reversed',
    icon: CheckCircle,
    color: 'text-green-600 dark:text-green-400',
    bgTint: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-500',
  },
  {
    value: 'partial',
    label: 'Partially reversible',
    description: 'Some effects may persist',
    icon: AlertTriangle,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgTint: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-yellow-500',
  },
  {
    value: 'full',
    label: 'Irreversible',
    description: 'Cannot be undone once executed',
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bgTint: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-500',
  },
];

const TRIGGER_ACTIONS = [
  'send:email',
  'calendar:create_event',
  'cron:create',
  'cron:output',
  'email:bulk-delete',
  'subagent:output',
  'notes:update_internal_only',
];

const TRIGGER_CONDITIONS = [
  'external_recipient',
  'external_attendees',
  'scope=all-mailboxes',
  'persistent_automation',
  'external_delivery',
  'inbox:update_tags',
];

const AVAILABLE_SYSTEMS = [
  'Gmail',
  'Slack',
  'Google Calendar',
  'OpenClaw Gateway',
  'Internal notes',
  'Gmail labels',
  'Email',
  'Notion',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTrigger(trigger: string): { action: string; condition: string } {
  const parts = trigger.split(' AND ');
  return {
    action: parts[0]?.trim() ?? '',
    condition: parts[1]?.trim() ?? '',
  };
}

function deriveSodType(sodRule?: { type: string; nRequired?: number; nTotal?: number }): SodType {
  if (!sodRule) return 'none';
  return sodRule.type as SodType;
}

function policyToFormState(policy: (typeof POLICIES)[number]): PolicyFormState {
  const { action, condition } = parseTrigger(policy.trigger);
  const sodRule =
    'sodRule' in policy
      ? ((policy as Record<string, unknown>).sodRule as
          | { type: string; rolesRequired?: string[]; nRequired?: number; nTotal?: number }
          | undefined)
      : undefined;
  return {
    name: policy.name,
    status: policy.status,
    triggerAction: action,
    triggerCondition: condition,
    tier: policy.tier as ExecutionTier,
    blastRadius: policy.blastRadius as BlastRadiusEntry[],
    irreversibility: policy.irreversibility as Irreversibility,
    sodType: deriveSodType(sodRule),
    sodRoles: sodRule?.rolesRequired ?? [],
    sodNRequired: sodRule?.nRequired ?? 2,
    sodNTotal: sodRule?.nTotal ?? 3,
    scopeAgents: (policy.scope?.agents ?? []) as string[],
    scopeTools: (policy.scope?.tools ?? []) as string[],
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h3>
  );
}

function TierSelector({
  value,
  onChange,
}: {
  value: ExecutionTier;
  onChange: (tier: ExecutionTier) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {TIER_OPTIONS.map((opt) => {
        const active = value === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all',
              'hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? `${opt.borderColor} ${opt.bgTint}` : 'border-border bg-background',
            )}
          >
            <AnimatePresence mode="wait">
              {active && (
                <motion.div
                  layoutId="tier-indicator"
                  className={cn('absolute inset-0 rounded-lg', opt.bgTint)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </AnimatePresence>
            <div className="relative z-10 flex flex-col items-center gap-2">
              <Icon className={cn('h-5 w-5', active ? opt.color : 'text-muted-foreground')} />
              <span className={cn('text-sm font-medium', active && opt.color)}>{opt.label}</span>
              <span className="text-[11px] text-muted-foreground">{opt.description}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function IrreversibilitySelector({
  value,
  onChange,
}: {
  value: Irreversibility;
  onChange: (v: Irreversibility) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {IRREVERSIBILITY_OPTIONS.map((opt) => {
        const active = value === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all',
              'hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? `${opt.borderColor} ${opt.bgTint}` : 'border-border bg-background',
            )}
          >
            <Icon
              className={cn('h-5 w-5 shrink-0', active ? opt.color : 'text-muted-foreground')}
            />
            <div>
              <span className={cn('text-sm font-medium', active && opt.color)}>{opt.label}</span>
              <p className="text-[11px] text-muted-foreground">{opt.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function BlastRadiusEditor({
  entries,
  onChange,
}: {
  entries: BlastRadiusEntry[];
  onChange: (entries: BlastRadiusEntry[]) => void;
}) {
  const addEntry = useCallback(() => {
    onChange([...entries, { system: AVAILABLE_SYSTEMS[0] ?? 'Gmail', scope: '' }]);
  }, [entries, onChange]);

  const removeEntry = useCallback(
    (index: number) => {
      onChange(entries.filter((_, i) => i !== index));
    },
    [entries, onChange],
  );

  const updateEntry = useCallback(
    (index: number, field: keyof BlastRadiusEntry, value: string) => {
      const updated = entries.map((e, i) => (i === index ? { ...e, [field]: value } : e));
      onChange(updated);
    },
    [entries, onChange],
  );

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {entries.map((entry, i) => (
          <motion.div
            key={`${i}-${entry.system}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <span className="inline-flex items-center gap-1 text-xs border border-border rounded-full px-2 py-1 bg-background shrink-0">
              <SorBadge name={entry.system} />
              <Select value={entry.system} onValueChange={(v) => updateEntry(i, 'system', v)}>
                <SelectTrigger className="h-6 border-0 shadow-none text-xs w-auto min-w-[100px] px-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_SYSTEMS.map((sys) => (
                    <SelectItem key={sys} value={sys}>
                      {sys}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </span>
            <Input
              value={entry.scope}
              onChange={(e) => updateEntry(i, 'scope', e.target.value)}
              placeholder="Scope (e.g. 1 message)"
              className="h-8 text-xs max-w-[200px]"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeEntry(i)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
      <Button variant="outline" size="sm" onClick={addEntry} className="text-xs">
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add system
      </Button>
    </div>
  );
}

function RoleChips({ roles, onChange }: { roles: string[]; onChange: (roles: string[]) => void }) {
  const [inputValue, setInputValue] = useState('');

  const addRole = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && !roles.includes(trimmed)) {
      onChange([...roles, trimmed]);
    }
    setInputValue('');
  }, [inputValue, roles, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {roles.map((role) => (
          <Badge key={role} variant="secondary" className="text-[11px] gap-1">
            {role}
            <button
              type="button"
              onClick={() => onChange(roles.filter((r) => r !== role))}
              className="ml-0.5 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addRole();
            }
          }}
          placeholder="Add role..."
          className="h-8 text-xs max-w-[200px]"
        />
        <Button variant="outline" size="sm" onClick={addRole} className="text-xs h-8">
          Add
        </Button>
      </div>
    </div>
  );
}

function SodSection({
  sodType,
  onTypeChange,
  roles,
  onRolesChange,
  nRequired,
  onNRequiredChange,
  nTotal,
  onNTotalChange,
}: {
  sodType: SodType;
  onTypeChange: (t: SodType) => void;
  roles: string[];
  onRolesChange: (r: string[]) => void;
  nRequired: number;
  onNRequiredChange: (n: number) => void;
  nTotal: number;
  onNTotalChange: (n: number) => void;
}) {
  const sodOptions: { value: SodType; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'simple', label: 'Simple (maker \u2260 checker)' },
    { value: 'n-of-m', label: 'N-of-M' },
    { value: 'blocked-role', label: 'Blocked Role' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {sodOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onTypeChange(opt.value)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs font-medium transition-all',
              'hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              sodType === opt.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {sodType === 'simple' && (
          <motion.p
            key="simple"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs text-muted-foreground"
          >
            Requester cannot approve their own actions
          </motion.p>
        )}

        {sodType === 'n-of-m' && (
          <motion.div
            key="n-of-m"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label className="text-xs">N required</Label>
                <Input
                  type="number"
                  min={1}
                  value={nRequired}
                  onChange={(e) => onNRequiredChange(Number(e.target.value))}
                  className="h-8 w-20 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">M total</Label>
                <Input
                  type="number"
                  min={1}
                  value={nTotal}
                  onChange={(e) => onNTotalChange(Number(e.target.value))}
                  className="h-8 w-20 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Required roles</Label>
              <RoleChips roles={roles} onChange={onRolesChange} />
            </div>
          </motion.div>
        )}

        {sodType === 'blocked-role' && (
          <motion.div
            key="blocked-role"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-1"
          >
            <Label className="text-xs">Blocked roles</Label>
            <RoleChips roles={roles} onChange={onRolesChange} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function PolicyDetailPage() {
  const { policyId } = Route.useParams();
  const policy = POLICIES.find((p) => p.policyId === policyId);

  const [form, setForm] = useState<PolicyFormState | null>(() =>
    policy ? policyToFormState(policy) : null,
  );

  const [dirty, setDirty] = useState(false);

  const update = useCallback(
    <K extends keyof PolicyFormState>(key: K, value: PolicyFormState[K]) => {
      setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
      setDirty(true);
    },
    [],
  );

  if (!policy || !form) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Policy Not Found"
          icon={<EntityIcon entityType="policy" size="md" decorative />}
          breadcrumb={[{ label: 'Policies', to: '/config/policies' }, { label: policyId }]}
        />
        <EmptyState
          title="Policy not found"
          description="The governance policy you are looking for does not exist."
        />
      </div>
    );
  }

  const triggerExpression = [form.triggerAction, form.triggerCondition]
    .filter(Boolean)
    .join(' AND ');

  const previewFormState = {
    triggerAction: form.triggerAction,
    triggerCondition: form.triggerCondition,
    tier: form.tier,
  };

  return (
    <div className="p-6">
      <div className="flex gap-6 max-w-6xl">
        {/* Main editor column */}
        <div className="flex-1 min-w-0 space-y-6 max-w-4xl">
          {/* Header */}
          <div className="space-y-4">
            <Link
              to="/config/policies"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Policies
            </Link>

            <PageHeader
              title={form.name}
              icon={<ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />}
              breadcrumb={[{ label: 'Policies', to: '/config/policies' }, { label: form.name }]}
              action={
                <div className="flex items-center gap-2">
                  {dirty && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setForm(policyToFormState(policy));
                        setDirty(false);
                      }}
                    >
                      <Undo2 className="h-4 w-4 mr-1" />
                      Discard
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={!dirty}
                    onClick={() => {
                      setDirty(false);
                      toast.success('Policy saved', {
                        description: `${form.name} has been updated.`,
                      });

                      // Emit policy update for live triage deck reaction
                      const originalTier = policy.tier;
                      const newTier = form.tier;
                      const tierWeight = {
                        Auto: 0,
                        Assisted: 1,
                        HumanApprove: 2,
                        ManualOnly: 3,
                      } as const;
                      const tightened =
                        tierWeight[newTier] > tierWeight[originalTier as keyof typeof tierWeight];
                      const affected = APPROVALS.filter(
                        (a) => a.policyRule?.ruleId === policy.policyId,
                      ).map((a) => a.approvalId);

                      emitPolicyUpdate({
                        policyId: policy.policyId,
                        policyName: form.name,
                        changeDescription: `Tier changed from ${originalTier} to ${newTier}`,
                        effect: tightened ? 'tighten' : 'relax',
                        affectedApprovalIds: affected,
                      });
                    }}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save Changes
                  </Button>
                </div>
              }
            />

            <div className="flex items-center gap-4">
              <span className="font-mono text-[11px] text-muted-foreground">{policy.policyId}</span>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2">
                <Label htmlFor="policy-status" className="text-xs text-muted-foreground">
                  {form.status === 'active' ? 'Active' : 'Paused'}
                </Label>
                <Switch
                  id="policy-status"
                  size="sm"
                  checked={form.status === 'active'}
                  onCheckedChange={(checked) => update('status', checked ? 'active' : 'paused')}
                />
              </div>
            </div>

            {policy.description && (
              <p className="text-xs text-muted-foreground max-w-prose">{policy.description}</p>
            )}
          </div>

          {/* Trigger Builder */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                <SectionLabel>When this happens...</SectionLabel>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Action</Label>
                  <Select
                    value={form.triggerAction}
                    onValueChange={(v) => update('triggerAction', v)}
                  >
                    <SelectTrigger size="sm" className="min-w-[200px]">
                      <SelectValue placeholder="Select action..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_ACTIONS.map((a) => (
                        <SelectItem key={a} value={a}>
                          <span className="font-mono text-xs">{a}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-xs font-semibold text-muted-foreground mt-5">AND</span>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Condition</Label>
                  <Select
                    value={form.triggerCondition}
                    onValueChange={(v) => update('triggerCondition', v)}
                  >
                    <SelectTrigger size="sm" className="min-w-[200px]">
                      <SelectValue placeholder="Select condition..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_CONDITIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          <span className="font-mono text-xs">{c}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {triggerExpression && (
                <div className="inline-flex items-center rounded-md bg-muted px-3 py-1.5">
                  <code className="text-xs font-mono">{triggerExpression}</code>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Execution Tier */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                <SectionLabel>Required approval level</SectionLabel>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TierSelector value={form.tier} onChange={(t) => update('tier', t)} />
            </CardContent>
          </Card>

          {/* Blast Radius */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                <SectionLabel>Impact scope</SectionLabel>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BlastRadiusEditor
                entries={form.blastRadius}
                onChange={(entries) => update('blastRadius', entries)}
              />
            </CardContent>
          </Card>

          {/* Irreversibility */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                <SectionLabel>Can this be undone?</SectionLabel>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IrreversibilitySelector
                value={form.irreversibility}
                onChange={(v) => update('irreversibility', v)}
              />
            </CardContent>
          </Card>

          {/* Separation of Duties */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                <SectionLabel>Who can approve?</SectionLabel>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SodSection
                sodType={form.sodType}
                onTypeChange={(t) => update('sodType', t)}
                roles={form.sodRoles}
                onRolesChange={(r) => update('sodRoles', r)}
                nRequired={form.sodNRequired}
                onNRequiredChange={(n) => update('sodNRequired', n)}
                nTotal={form.sodNTotal}
                onNTotalChange={(n) => update('sodNTotal', n)}
              />
            </CardContent>
          </Card>

          {/* Scope */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                <SectionLabel>Applies to</SectionLabel>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Agents</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {AGENTS.map((agent) => {
                    const checked =
                      form.scopeAgents.includes('*') || form.scopeAgents.includes(agent.agentId);
                    return (
                      <label
                        key={agent.agentId}
                        className="flex items-center gap-2 text-xs cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            if (c) {
                              update('scopeAgents', [...form.scopeAgents, agent.agentId]);
                            } else {
                              update(
                                'scopeAgents',
                                form.scopeAgents.filter((a) => a !== agent.agentId && a !== '*'),
                              );
                            }
                          }}
                        />
                        <span className="font-medium">{agent.name}</span>
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {agent.agentId}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs font-medium">Tools</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {TOOL_CLASSIFICATIONS.map((tool) => {
                    const checked = form.scopeTools.includes(tool.toolName);
                    return (
                      <label
                        key={tool.toolName}
                        className="flex items-center gap-2 text-xs cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            if (c) {
                              update('scopeTools', [...form.scopeTools, tool.toolName]);
                            } else {
                              update(
                                'scopeTools',
                                form.scopeTools.filter((t) => t !== tool.toolName),
                              );
                            }
                          }}
                        />
                        <span className="font-mono font-medium">{tool.toolName}</span>
                        <Badge
                          variant={
                            tool.category === 'Dangerous'
                              ? 'destructive'
                              : tool.category === 'ReadOnly'
                                ? 'secondary'
                                : 'default'
                          }
                          className="text-[10px] h-4 px-1"
                        >
                          {tool.category}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mobile: Preview Impact button + Sheet */}
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Impact
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="sr-only">Live Impact Preview</SheetTitle>
                </SheetHeader>
                <PolicyLivePreview form={previewFormState} />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Desktop: Sticky sidebar preview */}
        <div className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-6">
            <PolicyLivePreview form={previewFormState} />
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/policies/$policyId',
  component: PolicyDetailPage,
});
