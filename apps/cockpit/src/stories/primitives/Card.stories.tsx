import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TrendingUp } from 'lucide-react';

const meta: Meta = {
  title: 'Primitives/Card',
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj;

export const KpiCard: Story = {
  render: () => (
    <div className="bg-background p-4 grid grid-cols-3 gap-4 max-w-2xl">
      {[
        { label: 'Active Runs', value: '24', trend: '+3', up: true },
        { label: 'Pending Approvals', value: '7', trend: '+2', up: false },
        { label: 'Completed Today', value: '142', trend: '+18', up: true },
      ].map(({ label, value, trend, up }) => (
        <Card key={label}>
          <CardHeader className="pb-1">
            <CardDescription>{label}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-foreground">{value}</span>
              <span
                className={`text-xs font-medium flex items-center gap-0.5 mb-0.5 ${up ? 'text-success' : 'text-destructive'}`}
              >
                <TrendingUp className="size-3" />
                {trend}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};

export const RunCard: Story = {
  render: () => (
    <div className="bg-background p-4 max-w-sm">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm">Invoice Remediation — ACME</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                RUN-2041 · Started 14 min ago
              </CardDescription>
            </div>
            <Badge variant="warning">Waiting</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={68} className="h-1.5" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Step 8 / 14</span>
            <span>SLA: 2h 14m</span>
          </div>
          <Button size="sm" className="w-full">
            Review &amp; Approve
          </Button>
        </CardContent>
      </Card>
    </div>
  ),
};
