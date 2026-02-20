import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ObservabilityChartProps {
  runsOverTime: {
    date: string;
    succeeded: number;
    failed: number;
    waitingForApproval: number;
  }[];
}

export function ObservabilityChart({ runsOverTime }: ObservabilityChartProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Runs Over Time (Last 7 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={runsOverTime}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="succeeded"
              stackId="1"
              stroke="var(--color-chart-1)"
              fill="var(--color-chart-1)"
              fillOpacity={0.6}
              name="Succeeded"
            />
            <Area
              type="monotone"
              dataKey="failed"
              stackId="1"
              stroke="var(--color-chart-2)"
              fill="var(--color-chart-2)"
              fillOpacity={0.6}
              name="Failed"
            />
            <Area
              type="monotone"
              dataKey="waitingForApproval"
              stackId="1"
              stroke="var(--color-chart-3)"
              fill="var(--color-chart-3)"
              fillOpacity={0.6}
              name="Waiting"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
