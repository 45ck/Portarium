import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SpatialAlert } from '@/mocks/fixtures/robot-locations';
import { AlertTriangle, OctagonX, MapPin } from 'lucide-react';

const ALERT_ICONS: Record<SpatialAlert['type'], React.ReactNode> = {
  'geofence-violation': <MapPin className="h-3.5 w-3.5" />,
  'localization-drop': <AlertTriangle className="h-3.5 w-3.5" />,
  'e-stop': <OctagonX className="h-3.5 w-3.5" />,
};

interface AlertTriagePanelProps {
  alerts: SpatialAlert[];
  onJumpToRobot: (robotId: string) => void;
}

export function AlertTriagePanel({ alerts, onJumpToRobot }: AlertTriagePanelProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="absolute bottom-3 left-3 z-[1000] w-80 max-w-[320px] max-h-[180px] overflow-y-auto rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur-sm">
      <div className="sticky top-0 border-b border-border bg-card/95 px-3 py-2 backdrop-blur-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Spatial Alerts ({alerts.length})
        </h3>
      </div>
      <div className="divide-y divide-border">
        {alerts.map((alert) => (
          <button
            key={alert.alertId}
            onClick={() => onJumpToRobot(alert.robotId)}
            className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-accent/50 transition-colors"
          >
            <span
              className={cn(
                'mt-0.5 shrink-0',
                alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500',
              )}
            >
              {ALERT_ICONS[alert.type]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{alert.message}</p>
              <p className="text-[10px] text-muted-foreground">
                {alert.robotId} &middot; {new Date(alert.timestampIso).toLocaleTimeString()}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'shrink-0 text-[10px]',
                alert.severity === 'critical'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-yellow-200 bg-yellow-50 text-yellow-700',
              )}
            >
              {alert.severity}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}
