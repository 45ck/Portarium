import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Radio, History } from 'lucide-react';

type PlaybackMode = 'live' | 'replay';
type PlaybackSpeed = '0.5x' | '1x' | '2x' | '5x';

const SPEEDS: PlaybackSpeed[] = ['0.5x', '1x', '2x', '5x'];

export function PlaybackControls() {
  const [mode, setMode] = useState<PlaybackMode>('live');
  const [speed, setSpeed] = useState<PlaybackSpeed>('1x');
  const [position, setPosition] = useState(100);

  return (
    <div className="absolute bottom-3 left-1/2 z-[1001] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-md backdrop-blur-sm">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
        <Button
          variant={mode === 'live' ? 'default' : 'ghost'}
          size="sm"
          className="h-6 gap-1 px-2 text-[11px]"
          onClick={() => {
            setMode('live');
            setPosition(100);
          }}
        >
          <Radio className="h-3 w-3" />
          Live
        </Button>
        <Button
          variant={mode === 'replay' ? 'default' : 'ghost'}
          size="sm"
          className="h-6 gap-1 px-2 text-[11px]"
          onClick={() => toast.info('Replay mode coming soon — requires telemetry backend')}
        >
          <History className="h-3 w-3" />
          Replay
        </Button>
      </div>

      {/* Timeline scrubber */}
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        disabled={mode === 'live'}
        className={cn('h-1.5 w-32 accent-primary', mode === 'live' && 'opacity-40')}
        title={mode === 'live' ? 'Switch to Replay mode to scrub' : `Position: ${position}%`}
      />

      {/* Speed selector */}
      <div className="flex items-center gap-0.5">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            disabled={mode === 'live'}
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
              speed === s && mode === 'replay'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
              mode === 'live' && 'opacity-40 cursor-default',
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
