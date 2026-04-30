import { lazy, Suspense } from 'react';
import { Activity } from 'lucide-react';
import { resolveCockpitRuntime } from '@/lib/cockpit-runtime';

type ExecutionTier = 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';

export interface PolicyPreviewFormState {
  triggerAction: string;
  triggerCondition: string;
  tier: ExecutionTier;
}

const DemoPolicyLivePreview = lazy(() =>
  import('@/mocks/components/demo-policy-live-preview').then((module) => ({
    default: module.PolicyLivePreview,
  })),
);

export function PolicyLivePreview({ form }: { form: PolicyPreviewFormState }) {
  const runtime = resolveCockpitRuntime();

  if (!runtime.allowDemoControls) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Impact Preview
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Fixture-backed impact replay is disabled while Cockpit is connected to live tenant data.
        </p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="h-28 animate-pulse rounded-md bg-background/70" />
        </div>
      }
    >
      <DemoPolicyLivePreview form={form} />
    </Suspense>
  );
}
