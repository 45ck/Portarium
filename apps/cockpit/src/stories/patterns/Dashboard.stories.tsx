import type { Meta, StoryObj } from '@storybook/react'
import {
  CheckCircle, AlertTriangle, XCircle, Search, Bell,
  LayoutDashboard, ListChecks, Play, ShieldCheck, Settings,
  ChevronRight, MoreHorizontal, User, Zap, Clock,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const meta: Meta = {
  title: 'Patterns/Dashboard',
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj

const NAV = [
  { icon: LayoutDashboard, label: 'Overview',  active: true },
  { icon: Play,           label: 'Runs',       badge: '24' },
  { icon: ListChecks,     label: 'Work Items',  badge: '7' },
  { icon: ShieldCheck,    label: 'Approvals',   badge: '3' },
  { icon: Settings,       label: 'Settings' },
]

const RUNS = [
  { id: 'RUN-2041', title: 'Invoice remediation',  status: 'Running',  variant: 'default',     progress: 68, sla: '2h 14m' },
  { id: 'RUN-2040', title: 'Supplier onboarding',  status: 'Waiting',  variant: 'warning',     progress: 57, sla: '45m' },
  { id: 'RUN-2039', title: 'GL reconciliation',    status: 'Complete', variant: 'success',     progress: 100, sla: '—' },
  { id: 'RUN-2038', title: 'AP batch processing',  status: 'Failed',   variant: 'destructive', progress: 33, sla: 'Overdue' },
]

const KPIS = [
  { label: 'Active Runs',        value: '24', sub: '+3 since midnight' },
  { label: 'Pending Approvals',  value: '7',  sub: '2 approaching SLA' },
  { label: 'Completed Today',    value: '142',sub: '↑18 vs yesterday' },
  { label: 'Chain Integrity',    value: '100%', sub: 'All hashes verified' },
]

function DashboardLayout() {
  return (
    <div className="bg-background flex h-screen text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[240px] flex-none flex flex-col border-r border-border bg-sidebar">
        <div className="flex items-center gap-2 px-4 h-[52px] border-b border-sidebar-border">
          <div className="size-6 rounded bg-primary flex items-center justify-center">
            <Zap className="size-3.5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sidebar-foreground text-sm">Portarium</span>
          <Badge variant="secondary" className="ml-auto text-[10px]">DEMO</Badge>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map(({ icon: Icon, label, badge, active }) => (
            <button
              key={label}
              className={[
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              ].join(' ')}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {badge && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{badge}</Badge>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">AO</AvatarFallback>
            </Avatar>
            <span className="flex-1 text-left">Alex Ops</span>
            <User className="size-3.5 opacity-50" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-[52px] flex-none flex items-center gap-3 px-4 border-b border-border">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input className="pl-8 h-8 text-xs" placeholder="Search runs, work items..." />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" className="size-8 relative">
              <Bell className="size-4" />
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive" />
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <Badge variant="outline" className="text-xs gap-1">
              <Clock className="size-3" /> 14:32 UTC
            </Badge>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-5 space-y-5">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-4">
            {KPIS.map(({ label, value, sub }) => (
              <Card key={label}>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardDescription className="text-xs">{label}</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Alert */}
          <Alert variant="warning">
            <AlertTriangle className="size-4" />
            <AlertTitle>Approval Required</AlertTitle>
            <AlertDescription>
              RUN-2040 (Supplier Onboarding) is waiting for your decision. SLA expires in 45 minutes.
              <Button size="sm" className="mt-2">Review Now <ChevronRight className="size-3.5" /></Button>
            </AlertDescription>
          </Alert>

          {/* Tabs */}
          <Tabs defaultValue="runs">
            <TabsList>
              <TabsTrigger value="runs">Active Runs</TabsTrigger>
              <TabsTrigger value="approvals">Approvals</TabsTrigger>
            </TabsList>
            <TabsContent value="runs" className="mt-3">
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Run ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="w-36">Progress</TableHead>
                      <TableHead className="w-20">SLA</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {RUNS.map(({ id, title, status, variant, progress, sla }) => (
                      <TableRow key={id}>
                        <TableCell className="font-mono text-xs">{id}</TableCell>
                        <TableCell className="text-sm">{title}</TableCell>
                        <TableCell><Badge variant={variant as any}>{status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={progress} className="h-1.5 flex-1" />
                            <span className="text-xs text-muted-foreground w-8">{progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{sla}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
            <TabsContent value="approvals" className="mt-3">
              <Card>
                <CardContent className="p-6">
                  <div className="text-center text-muted-foreground text-sm">
                    <ShieldCheck className="size-8 mx-auto mb-2 opacity-30" />
                    <p>3 approvals pending</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        {/* Status bar */}
        <div className="h-8 flex-none flex items-center px-4 border-t border-border bg-muted/40 text-muted-foreground gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="size-3 text-success" />
            Chain integrity: verified
          </div>
          <Separator orientation="vertical" className="h-3.5" />
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-success inline-block" />
            24 runs active
          </div>
          <Separator orientation="vertical" className="h-3.5" />
          <span className="ml-auto font-mono">ws-portarium-demo</span>
        </div>
      </div>
    </div>
  )
}

export const Overview: Story = {
  render: () => <DashboardLayout />,
}
