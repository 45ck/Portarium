import { Monitor, Radar } from 'lucide-react';
import { useTheme, type ThemeId } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

export const STANDARD_THEME_ID: ThemeId = 'theme-arctic';
export const MISSION_CONTROL_THEME_ID: ThemeId = 'theme-mission-control';

const themeInfo: Record<
  ThemeId,
  {
    name: string;
    description: string;
    swatches: string[];
  }
> = {
  'theme-arctic': {
    name: 'Arctic',
    description: 'Clean, minimal blue-white',
    swatches: [
      'oklch(0.15 0.01 240)',
      'oklch(0.6 0.12 220)',
      'oklch(0.98 0.01 240)',
      'oklch(0.9 0.02 240)',
    ],
  },
  'theme-mission-control': {
    name: 'Mission Control',
    description: 'Dense operator console',
    swatches: [
      'oklch(0.12 0.02 255)',
      'oklch(0.74 0.14 195)',
      'oklch(0.76 0.18 142)',
      'oklch(0.79 0.16 72)',
    ],
  },
  'theme-midnight': {
    name: 'Midnight',
    description: 'Dark, high-contrast',
    swatches: [
      'oklch(0.08 0.02 260)',
      'oklch(0.5 0.15 260)',
      'oklch(0.15 0.02 260)',
      'oklch(0.9 0.02 260)',
    ],
  },
  'theme-warm': {
    name: 'Warm',
    description: 'Warm amber tones',
    swatches: [
      'oklch(0.12 0.02 60)',
      'oklch(0.65 0.15 60)',
      'oklch(0.97 0.02 60)',
      'oklch(0.88 0.03 60)',
    ],
  },
  'theme-quantum': {
    name: 'Quantum',
    description: 'Vibrant purple accents',
    swatches: [
      'oklch(0.1 0.02 300)',
      'oklch(0.55 0.2 300)',
      'oklch(0.15 0.02 300)',
      'oklch(0.88 0.02 300)',
    ],
  },
  'theme-tactical': {
    name: 'Tactical',
    description: 'Paper briefing, terracotta accent',
    swatches: [
      'oklch(0.96 0.01 200)',
      'oklch(0.58 0.12 20)',
      'oklch(0.90 0.01 180)',
      'oklch(0.42 0.02 200)',
    ],
  },
};

export function ThemePicker() {
  const { theme, setTheme, themes } = useTheme();
  const isMissionControl = theme === MISSION_CONTROL_THEME_ID;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Cockpit appearance mode">
        <button
          type="button"
          onClick={() => setTheme(STANDARD_THEME_ID)}
          aria-pressed={!isMissionControl}
          className={cn(
            'flex min-h-16 items-center gap-3 rounded-md border p-3 text-left transition-all',
            !isMissionControl
              ? 'border-primary ring-2 ring-primary'
              : 'border-border hover:border-muted-foreground/40',
          )}
        >
          <Monitor className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-xs font-medium">Standard</span>
            <span className="block text-[11px] text-muted-foreground">Cockpit default</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTheme(MISSION_CONTROL_THEME_ID)}
          aria-pressed={isMissionControl}
          className={cn(
            'flex min-h-16 items-center gap-3 rounded-md border p-3 text-left transition-all',
            isMissionControl
              ? 'border-primary ring-2 ring-primary'
              : 'border-border hover:border-muted-foreground/40',
          )}
        >
          <Radar className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-xs font-medium">Mission Control</span>
            <span className="block text-[11px] text-muted-foreground">Operator density</span>
          </span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {themes.map((id) => {
          const info = themeInfo[id];
          const isActive = theme === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              aria-pressed={isActive}
              className={cn(
                'rounded-md border p-3 text-left transition-all',
                isActive
                  ? 'border-primary ring-2 ring-primary'
                  : 'border-border hover:border-muted-foreground/40',
              )}
            >
              <p className="text-xs font-medium">{info.name}</p>
              <p className="text-[11px] text-muted-foreground">{info.description}</p>
              <div className="mt-2 flex gap-1.5">
                {info.swatches.map((color, i) => (
                  <span
                    key={i}
                    className="h-4 w-4 rounded-full border border-border"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
