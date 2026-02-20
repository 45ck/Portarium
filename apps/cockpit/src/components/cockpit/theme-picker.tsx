import { useTheme, type ThemeId } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

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
};

export function ThemePicker() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="grid grid-cols-2 gap-3">
      {themes.map((id) => {
        const info = themeInfo[id];
        const isActive = theme === id;
        return (
          <button
            key={id}
            onClick={() => setTheme(id)}
            aria-pressed={isActive}
            className={cn(
              'rounded-lg border p-3 text-left transition-all',
              isActive
                ? 'ring-2 ring-primary border-primary'
                : 'border-border hover:border-muted-foreground/40',
            )}
          >
            <p className="text-xs font-medium">{info.name}</p>
            <p className="text-[11px] text-muted-foreground">{info.description}</p>
            <div className="flex gap-1.5 mt-2">
              {info.swatches.map((color, i) => (
                <div
                  key={i}
                  className="h-4 w-4 rounded-full border border-border"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
