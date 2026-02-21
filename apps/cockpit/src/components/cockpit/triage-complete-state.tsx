import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface TriageSessionStats {
  total: number;
  approved: number;
  denied: number;
  changesRequested: number;
  skipped: number;
}

interface TriageCompleteStateProps {
  stats: TriageSessionStats;
  skippedCount: number;
  onReviewSkipped: () => void;
}

export function TriageCompleteState({
  stats,
  skippedCount,
  onReviewSkipped,
}: TriageCompleteStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
      <div className="animate-queue-clear-ring rounded-full p-3 bg-green-50 border-2 border-green-200">
        <CheckCircle2 className="h-10 w-10 text-green-600" />
      </div>

      <div>
        <h3 className="text-sm font-semibold">Queue cleared</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          You processed {stats.total} approval{stats.total !== 1 ? 's' : ''}
          {' \u2014 '}
          <span className="text-green-600 font-medium">{stats.approved} approved</span>
          {stats.denied > 0 && (
            <>
              , <span className="text-red-600 font-medium">{stats.denied} denied</span>
            </>
          )}
          {stats.changesRequested > 0 && (
            <>
              ,{' '}
              <span className="text-yellow-600 font-medium">
                {stats.changesRequested} changes requested
              </span>
            </>
          )}
          {stats.skipped > 0 && (
            <>
              , <span className="text-muted-foreground">{stats.skipped} skipped</span>
            </>
          )}
        </p>
      </div>

      {skippedCount > 0 && (
        <Button variant="outline" size="sm" onClick={onReviewSkipped}>
          Review {skippedCount} skipped item{skippedCount !== 1 ? 's' : ''}
        </Button>
      )}
    </div>
  );
}
