import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  CheckCircle, AlertTriangle, Info, XCircle, Search, Bell,
  LayoutDashboard, ListChecks, Play, ShieldCheck, Settings,
  TrendingUp, TrendingDown, ChevronRight, MoreHorizontal,
  User, Zap, Clock, Filter,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'

// ─── Theme config ────────────────────────────────────────────────────────────

const THEMES = [
  { id: 'theme-arctic',   label: 'Arctic Ops',  description: 'Cool white · electric blue · clean' },
  { id: 'theme-midnight', label: 'Midnight',     description: 'Dark navy · cyan accent · focused' },
  { id: 'theme-warm',     label: 'Warm Slate',   description: 'Cream · violet · approachable' },
] as const

type ThemeId = (typeof THEMES)[number]['id']

// ─── Sample data ─────────────────────────────────────────────────────────────

const RUNS = [
  { id: 'RUN-2041', title: 'Invoice remediation — ACME Repairs',  status: 'Running',            progress: 68, sla: '2h 14m' },
  { id: 'RUN-2040', title: 'New supplier onboarding — Bolt Ltd',  status: 'WaitingForApproval', progress: 45, sla: '4h 02m' },
  { id: 'RUN-2039', title: 'PO variance audit Q1',                status: 'Completed',          progress: 100, sla: '—' },
  { id: 'RUN-2038', title: 'Payment reconciliation — Mar',        status: 'Failed',             progress: 30, sla: 'overdue' },
  { id: 'RUN-2037', title: 'Contract renewal — TechSource',       status: 'Paused',             progress: 55, sla: '1d 6h' },
]

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'outline' }> = {
  Running:            { label: 'Running',             variant: 'info' },
  WaitingForApproval: { label: 'Awaiting approval',   variant: 'warning' },
  Completed:          { label: 'Completed',           variant: 'success' },
  Failed:             { label: 'Failed',              variant: 'destructive' },
  Paused:             { label: 'Paused',              variant: 'secondary' },
}

// ─── Sample dashboard ─────────────────────────────────────────────────────────

function SampleDashboard() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground" style={{ fontFamily: 'var(--font-sans)' }}>

      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="flex h-12 items-center gap-2 border-b border-border px-4">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
            <Zap className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Portarium</span>
        </div>

        <nav className="flex-1 space-y-0.5 p-2">
          {[
            { icon: LayoutDashboard, label: 'Dashboard', active: true },
            { icon: ListChecks,      label: 'Work Items' },
            { icon: Play,            label: 'Runs' },
            { icon: ShieldCheck,     label: 'Approvals', badge: '3' },
            { icon: Settings,        label: 'Settings' },
          ].map(({ icon: Icon, label, active, badge }) => (
            <button
              key={label}
              className={[
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              ].join(' ')}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {badge && (
                <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">{badge}</Badge>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-border p-2">
          <button className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[10px]">DA</AvatarFallback>
            </Avatar>
            <span className="flex-1 text-left truncate">Dana Approver</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Topbar */}
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-7 pl-8 text-xs" placeholder="Search runs, work items…" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
            </Button>
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">DA</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Page heading */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">Dashboard</h1>
              <p className="text-xs text-muted-foreground">Workspace: ws-demo · 20 Feb 2026</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                <Filter className="h-3 w-3" /> Filter
              </Button>
              <Button size="sm" className="h-7 text-xs">New run</Button>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Active runs',      value: '12',  delta: '+2',  up: true,  sub: 'vs yesterday' },
              { label: 'Pending approval', value: '3',   delta: '+1',  up: false, sub: 'needs action' },
              { label: 'Completed today',  value: '28',  delta: '+14', up: true,  sub: 'vs yesterday' },
              { label: 'SLA at risk',      value: '2',   delta: '—',   up: null,  sub: 'monitor' },
            ].map(({ label, value, delta, up, sub }) => (
              <Card key={label} className="shadow-none">
                <CardContent className="pt-3 pb-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <div className="mt-0.5 flex items-end gap-1.5">
                    <span className="text-2xl font-bold tabular-nums">{value}</span>
                    {up !== null && (
                      <span className={['flex items-center gap-0.5 text-xs mb-0.5', up ? 'text-success' : 'text-destructive'].join(' ')}>
                        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {delta}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Alerts */}
          <div className="grid grid-cols-2 gap-3">
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>SLA warning</AlertTitle>
              <AlertDescription>RUN-2038 is overdue — payment reconciliation needs attention.</AlertDescription>
            </Alert>
            <Alert variant="success">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Chain integrity verified</AlertTitle>
              <AlertDescription>All 48 evidence entries pass SHA-256 hash verification.</AlertDescription>
            </Alert>
          </div>

          {/* Tabs: Runs table + Form panel */}
          <Tabs defaultValue="runs">
            <TabsList className="h-7">
              <TabsTrigger value="runs" className="text-xs h-5">Active runs</TabsTrigger>
              <TabsTrigger value="approval" className="text-xs h-5">Approval gate</TabsTrigger>
              <TabsTrigger value="tokens" className="text-xs h-5">Design tokens</TabsTrigger>
            </TabsList>

            {/* Runs table */}
            <TabsContent value="runs">
              <Card className="shadow-none">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28 text-xs">Run ID</TableHead>
                        <TableHead className="text-xs">Title</TableHead>
                        <TableHead className="w-36 text-xs">Status</TableHead>
                        <TableHead className="w-32 text-xs">Progress</TableHead>
                        <TableHead className="w-24 text-xs">SLA</TableHead>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {RUNS.map((run) => {
                        const s = STATUS_CONFIG[run.status]!
                        return (
                          <TableRow key={run.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{run.id}</TableCell>
                            <TableCell className="text-xs font-medium">{run.title}</TableCell>
                            <TableCell>
                              <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={run.progress} className="h-1.5 flex-1" />
                                <span className="text-[11px] tabular-nums text-muted-foreground w-7 text-right">{run.progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={['text-xs flex items-center gap-1', run.sla === 'overdue' ? 'text-destructive font-medium' : 'text-muted-foreground'].join(' ')}>
                                <Clock className="h-3 w-3" />{run.sla}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Approval gate panel */}
            <TabsContent value="approval">
              <div className="grid grid-cols-2 gap-4">
                <Card className="shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Approval gate — RUN-2040</CardTitle>
                    <CardDescription className="text-xs">New supplier onboarding — Bolt Ltd requires sign-off before proceeding.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-md border border-border bg-muted/40 p-3 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Work item</span>
                        <span className="font-mono">WI-1041</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Requested by</span>
                        <span>Alex Operator</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">SoR reference</span>
                        <span className="font-mono text-primary">Odoo:res.partner:89</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Rationale <span className="text-muted-foreground">(min 20 chars)</span></Label>
                      <Textarea className="text-xs min-h-16 resize-none" placeholder="Provide your decision rationale…" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs flex-1">Approve</Button>
                      <Button variant="destructive" size="sm" className="h-7 text-xs flex-1">Deny</Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs">Request changes</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Controls</CardTitle>
                    <CardDescription className="text-xs">Form primitive examples</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Assignee</Label>
                      <Select>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Select approver…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dana" className="text-xs">Dana Approver</SelectItem>
                          <SelectItem value="alex" className="text-xs">Alex Operator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium">Require dual approval</p>
                        <p className="text-[11px] text-muted-foreground">SoD constraint active</p>
                      </div>
                      <Switch />
                    </div>
                    <div className="flex items-start gap-2">
                      <Checkbox id="notify" className="mt-0.5" />
                      <Label htmlFor="notify" className="text-xs leading-relaxed cursor-pointer">
                        Notify requester by email on decision
                      </Label>
                    </div>
                    <Alert variant="info">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Policy note</AlertTitle>
                      <AlertDescription>Supplier spend &gt;$50k requires second approver per AP-07.</AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Token showcase */}
            <TabsContent value="tokens">
              <div className="space-y-4">

                {/* Color palette */}
                <Card className="shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Color palette</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Surfaces</p>
                        {[
                          ['bg-background',  'background'],
                          ['bg-card',        'card'],
                          ['bg-muted',       'muted'],
                          ['bg-accent',      'accent'],
                          ['bg-secondary',   'secondary'],
                        ].map(([cls, name]) => (
                          <div key={name} className="flex items-center gap-2">
                            <div className={`h-5 w-8 rounded border border-border ${cls}`} />
                            <span className="font-mono text-xs text-muted-foreground">{name}</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Brand + Status</p>
                        {[
                          ['bg-primary',     'primary'],
                          ['bg-success',     'success'],
                          ['bg-warning',     'warning'],
                          ['bg-info',        'info'],
                          ['bg-destructive', 'destructive'],
                        ].map(([cls, name]) => (
                          <div key={name} className="flex items-center gap-2">
                            <div className={`h-5 w-8 rounded ${cls}`} />
                            <span className="font-mono text-xs text-muted-foreground">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Typography */}
                <Card className="shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Typography — Geist Sans + Mono</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-2xl font-bold">Display 24 / bold — work item titles</div>
                    <div className="text-lg font-semibold">Heading 18 / semibold — card titles</div>
                    <div className="text-sm">Body 14 / regular — default cockpit text, table cells</div>
                    <div className="text-xs text-muted-foreground">Caption 12 / muted — metadata, timestamps, labels</div>
                    <div className="font-mono text-xs text-muted-foreground">Mono 12 — RUN-2041 · corr:8f3a2b · 2026-02-20T00:00:00Z</div>
                    <Separator />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge>default</Badge>
                      <Badge variant="secondary">secondary</Badge>
                      <Badge variant="outline">outline</Badge>
                      <Badge variant="success">success</Badge>
                      <Badge variant="warning">warning</Badge>
                      <Badge variant="info">info</Badge>
                      <Badge variant="destructive">destructive</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm">Primary</Button>
                      <Button variant="secondary" size="sm">Secondary</Button>
                      <Button variant="outline" size="sm">Outline</Button>
                      <Button variant="ghost" size="sm">Ghost</Button>
                      <Button variant="destructive" size="sm">Destructive</Button>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </TabsContent>
          </Tabs>

        </main>
      </div>
    </div>
  )
}

// ─── Theme switcher shell ─────────────────────────────────────────────────────

type ViewMode = 'single' | 'compare'

function App() {
  const [activeTheme, setActiveTheme] = useState<ThemeId>('theme-arctic')
  const [mode, setMode] = useState<ViewMode>('single')

  return (
    <TooltipProvider>
      {/* Theme control bar — sits outside any theme so always visible */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 border-b border-gray-200 bg-white/90 px-4 py-2 backdrop-blur text-sm shadow-sm">
        <span className="font-semibold text-gray-700 text-xs">Theme</span>
        <div className="flex gap-1">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActiveTheme(t.id); setMode('single') }}
              className={[
                'rounded px-3 py-1 text-xs transition-colors border',
                activeTheme === t.id && mode === 'single'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-2 h-4 w-px bg-gray-200" />
        <button
          onClick={() => setMode(mode === 'compare' ? 'single' : 'compare')}
          className={[
            'rounded px-3 py-1 text-xs transition-colors border',
            mode === 'compare'
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
          ].join(' ')}
        >
          {mode === 'compare' ? '← Single view' : 'Compare all ↔'}
        </button>
        <div className="ml-auto text-[11px] text-gray-400">
          {mode === 'single' ? THEMES.find(t => t.id === activeTheme)?.description : '3-up comparison'}
        </div>
      </div>

      <div className="pt-[41px] h-screen">
        {mode === 'single' ? (
          <div className={`h-full ${activeTheme}`}>
            <SampleDashboard />
          </div>
        ) : (
          <div className="flex h-full divide-x divide-gray-300">
            {THEMES.map((t) => (
              <div key={t.id} className={`flex-1 min-w-0 overflow-hidden ${t.id}`}>
                <div className="px-2 py-1 text-[10px] font-semibold text-gray-500 bg-gray-100 border-b border-gray-200 uppercase tracking-wide">
                  {t.label}
                </div>
                <div className="h-[calc(100%-24px)] overflow-hidden" style={{ transform: 'scale(0.6)', transformOrigin: 'top left', width: '166.67%', height: '166.67%' }}>
                  <SampleDashboard />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
