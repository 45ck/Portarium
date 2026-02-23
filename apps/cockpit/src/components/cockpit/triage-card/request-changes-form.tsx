import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RotateCcw } from 'lucide-react';
import type { TriageAction } from './types';

export interface RequestChangesFormProps {
  message: string;
  onMessageChange: (value: string) => void;
  onSubmit: (action: TriageAction) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function RequestChangesForm({
  message,
  onMessageChange,
  onSubmit,
  onCancel,
  loading,
}: RequestChangesFormProps) {
  return (
    <div className="shrink-0 space-y-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
      <label className="text-xs font-semibold text-warning-foreground">
        What needs to change?{' '}
        <span className="text-red-500" aria-hidden>
          *
        </span>
      </label>
      <Textarea
        autoFocus
        className="text-xs min-h-[80px] resize-none bg-background"
        placeholder="Describe what the requestor needs to update before you can approve…"
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 h-9"
          disabled={!message.trim() || Boolean(loading)}
          onClick={() => onSubmit('RequestChanges')}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Submit request for changes
        </Button>
        <Button variant="outline" size="sm" className="h-9" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
