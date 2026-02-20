import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Hexagon, Navigation, CircleDot } from 'lucide-react'

export interface LayerVisibility {
  geofences: boolean
  trails: boolean
  halos: boolean
}

interface LayerTogglesProps {
  layers: LayerVisibility
  onChange: (layers: LayerVisibility) => void
}

const LAYER_DEFS = [
  { key: 'geofences' as const, label: 'Geofences', icon: Hexagon },
  { key: 'trails' as const, label: 'Trails', icon: Navigation },
  { key: 'halos' as const, label: 'Halos', icon: CircleDot },
]

export function LayerToggles({ layers, onChange }: LayerTogglesProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card/95 p-1.5 shadow-md backdrop-blur-sm">
      {LAYER_DEFS.map(({ key, label, icon: Icon }) => (
        <Button
          key={key}
          variant={layers[key] ? 'default' : 'ghost'}
          size="sm"
          className={cn('h-7 justify-start gap-1.5 text-xs px-2', !layers[key] && 'opacity-60')}
          onClick={() => onChange({ ...layers, [key]: !layers[key] })}
          title={`Toggle ${label}`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Button>
      ))}
    </div>
  )
}
