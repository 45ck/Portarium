import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { STATUS_COLORS } from './map-view';
import type { RobotStatus, RobotClass } from '@/types/robotics';

const STATUS_ENTRIES: Array<{ status: RobotStatus; label: string }> = [
  { status: 'Online', label: 'Online' },
  { status: 'Degraded', label: 'Degraded' },
  { status: 'E-Stopped', label: 'E-Stopped' },
  { status: 'Offline', label: 'Offline' },
];

const CLASS_ENTRIES: Array<{ robotClass: RobotClass; glyph: string }> = [
  { robotClass: 'AMR', glyph: 'R' },
  { robotClass: 'AGV', glyph: 'A' },
  { robotClass: 'Manipulator', glyph: 'M' },
  { robotClass: 'UAV', glyph: 'U' },
  { robotClass: 'PLC', glyph: 'P' },
];

export function MapLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-3 right-3 z-[1000]">
      <div className="rounded-lg border border-border bg-card/95 shadow-md backdrop-blur-sm overflow-hidden">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-between gap-1.5 px-2.5 text-xs font-medium"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          Legend
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </Button>

        {/* CSS grid row transition for smooth expand/collapse */}
        <div
          className="transition-[grid-template-rows] duration-150 ease-out"
          style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="border-t border-border px-2.5 py-2 space-y-2.5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Status
                </p>
                <div className="space-y-1">
                  {STATUS_ENTRIES.map(({ status, label }) => (
                    <div key={status} className="flex items-center gap-2 text-xs">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: STATUS_COLORS[status] }}
                      />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Robot class
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {CLASS_ENTRIES.map(({ robotClass, glyph }) => (
                    <div key={robotClass} className="flex items-center gap-1.5 text-xs">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-border text-[9px] font-bold text-muted-foreground">
                        {glyph}
                      </span>
                      {robotClass}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Layers
                </p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-0 w-4 border-t-2 border-dashed border-blue-400" />
                    Geofences
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-0 w-4 border-t-2 border-dashed border-muted-foreground opacity-50" />
                    Trails
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-4 rounded-full bg-yellow-300/20 border border-yellow-400/40" />
                    Uncertainty zones
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
