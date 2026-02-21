import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RobotLocation } from '@/mocks/fixtures/robot-locations';
import type { RobotStatus } from '@/types/robotics';
import { Input } from '@/components/ui/input';
import { Wifi, WifiOff, AlertTriangle, OctagonX, Battery, MapPin, Search } from 'lucide-react';

const STATUS_FILTERS: Array<{ label: string; value: RobotStatus | 'All' }> = [
  { label: 'All', value: 'All' },
  { label: 'Online', value: 'Online' },
  { label: 'Degraded', value: 'Degraded' },
  { label: 'E-Stopped', value: 'E-Stopped' },
  { label: 'Offline', value: 'Offline' },
];

const STATUS_ICON: Record<RobotStatus, React.ReactNode> = {
  Online: <Wifi className="h-3 w-3" />,
  Degraded: <AlertTriangle className="h-3 w-3" />,
  'E-Stopped': <OctagonX className="h-3 w-3" />,
  Offline: <WifiOff className="h-3 w-3" />,
};

const STATUS_BADGE_CLASS: Record<RobotStatus, string> = {
  Online: 'bg-green-100 text-green-800 border-green-200',
  Degraded: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'E-Stopped': 'bg-red-100 text-red-800 border-red-200',
  Offline: 'bg-muted text-muted-foreground border-border',
};

interface RobotListPanelProps {
  locations: RobotLocation[];
  selectedRobotId: string | null;
  onSelectRobot: (robotId: string | null) => void;
}

export function RobotListPanel({ locations, selectedRobotId, onSelectRobot }: RobotListPanelProps) {
  const [statusFilter, setStatusFilter] = useState<RobotStatus | 'All'>('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'battery'>('name');

  const statusCounts: Record<RobotStatus, number> = {
    Online: locations.filter((l) => l.status === 'Online').length,
    Degraded: locations.filter((l) => l.status === 'Degraded').length,
    'E-Stopped': locations.filter((l) => l.status === 'E-Stopped').length,
    Offline: locations.filter((l) => l.status === 'Offline').length,
  };

  let filtered =
    statusFilter === 'All' ? locations : locations.filter((l) => l.status === statusFilter);

  if (search.trim()) {
    const term = search.toLowerCase();
    filtered = filtered.filter(
      (l) => l.name.toLowerCase().includes(term) || l.robotId.toLowerCase().includes(term),
    );
  }

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'battery') return a.batteryPct - b.batteryPct;
    if (sortBy === 'status') return a.status.localeCompare(b.status);
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 space-y-2">
        <h2 className="text-sm font-semibold">Fleet ({locations.length})</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search robots..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => {
            const count = f.value === 'All' ? locations.length : statusCounts[f.value];
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-medium border transition-colors',
                  statusFilter === f.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/40',
                )}
              >
                {f.label} ({count})
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>Sort:</span>
          {(['name', 'status', 'battery'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] capitalize transition-colors',
                sortBy === s ? 'bg-primary/10 text-primary font-medium' : 'hover:text-foreground',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filtered.map((loc) => (
          <button
            key={loc.robotId}
            onClick={() => onSelectRobot(loc.robotId === selectedRobotId ? null : loc.robotId)}
            className={cn(
              'w-full rounded-lg border p-3 text-left transition-colors',
              loc.robotId === selectedRobotId
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border bg-card hover:border-primary/40',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{loc.name}</p>
                <p className="text-xs text-muted-foreground">{loc.robotId}</p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'flex shrink-0 items-center gap-1 text-[10px]',
                  STATUS_BADGE_CLASS[loc.status],
                )}
              >
                {STATUS_ICON[loc.status]}
                {loc.status}
              </Badge>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Battery className="h-3 w-3" />
                <span className={cn(loc.batteryPct < 20 && 'text-red-600 font-medium')}>
                  {loc.batteryPct}%
                </span>
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
              </span>
              {loc.speedMps > 0 && <span>{loc.speedMps.toFixed(1)} m/s</span>}
            </div>
            {loc.missionId && (
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                Mission: {loc.missionId}
              </p>
            )}
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MapPin className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-xs">No robots match filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
