import { useState, useEffect } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { PageHeader } from '@/components/cockpit/page-header';
import { ThemePicker } from '@/components/cockpit/theme-picker';
import { PackTemplateRenderer } from '@/components/cockpit/pack-template-renderer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useUIStore } from '@/stores/ui-store';
import { usePackUiRuntime } from '@/hooks/queries/use-pack-ui-runtime';
import { applyThemeTokens, resolveTemplate } from '@/lib/packs/pack-runtime';
import type { DatasetId } from '@/mocks/fixtures/index';

const DATASET_OPTIONS: { id: DatasetId; label: string; description: string }[] = [
  {
    id: 'demo',
    label: 'Portarium Demo',
    description: 'Small generic dataset (6 work items, 7 runs)',
  },
  {
    id: 'openclaw-demo',
    label: 'OpenClaw Approval Demo',
    description: 'OpenClaw machine approvals with triage-ready pending queue',
  },
  {
    id: 'meridian-demo',
    label: 'Meridian Cold Chain \u2014 Demo',
    description: '3 months pharma cold-chain (20 work items, 50 runs, 15 robots)',
  },
  {
    id: 'meridian-full',
    label: 'Meridian Cold Chain \u2014 Full',
    description: '6 months enterprise scale (80 work items, 300 runs, 1 200+ evidence, 28 robots)',
  },
];

function SettingsPage() {
  const wsId = useUIStore((s) => s.activeWorkspaceId);
  const activeDataset = useUIStore((s) => s.activeDataset);
  const setActiveDataset = useUIStore((s) => s.setActiveDataset);
  const { data: packRuntime } = usePackUiRuntime(wsId);

  const [relativeDates, setRelativeDates] = useState(() => {
    return localStorage.getItem('cockpit-date-format') !== 'absolute';
  });

  useEffect(() => {
    localStorage.setItem('cockpit-date-format', relativeDates ? 'relative' : 'absolute');
  }, [relativeDates]);

  useEffect(() => {
    if (!packRuntime) return;
    applyThemeTokens(packRuntime);
  }, [packRuntime]);

  const resolvedPackTemplate = packRuntime
    ? resolveTemplate(packRuntime, 'ui-scm-change-request-form')
    : null;

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Settings" />

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-sm">Appearance</CardTitle>
          <CardDescription>Choose your cockpit theme</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePicker />
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-sm">Workspace</CardTitle>
          <CardDescription>Current workspace information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-y-2 text-xs">
            <span className="text-muted-foreground">Workspace ID</span>
            <span className="font-mono">{wsId}</span>
            <span className="text-muted-foreground">Workspace Name</span>
            <span>
              {wsId === 'ws-meridian'
                ? 'Meridian Workspace'
                : activeDataset === 'openclaw-demo'
                  ? 'OpenClaw Demo Workspace'
                  : 'Demo Workspace'}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-sm">Preferences</CardTitle>
          <CardDescription>Customize display options</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="date-format" className="text-xs">
                Relative dates
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {relativeDates
                  ? 'Showing dates as "2 hours ago"'
                  : 'Showing dates as "2026-02-20 09:00"'}
              </p>
            </div>
            <Switch id="date-format" checked={relativeDates} onCheckedChange={setRelativeDates} />
          </div>
        </CardContent>
      </Card>

      {import.meta.env.VITE_DEMO_MODE === 'true' && (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-sm">Demo Dataset</CardTitle>
            <CardDescription>
              Choose which fixture dataset the mock API serves. Changing dataset reloads the page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={activeDataset}
              onValueChange={(v) => setActiveDataset(v as DatasetId)}
              className="gap-3"
            >
              {DATASET_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  htmlFor={`ds-${opt.id}`}
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                    activeDataset === opt.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/40'
                  }`}
                >
                  <RadioGroupItem value={opt.id} id={`ds-${opt.id}`} className="mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium">{opt.label}</span>
                    <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-sm">Vertical Pack UI Runtime</CardTitle>
          <CardDescription>
            Template source:{' '}
            <span className="font-mono">{resolvedPackTemplate?.source ?? 'none'}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resolvedPackTemplate ? (
            <PackTemplateRenderer template={resolvedPackTemplate.template} />
          ) : (
            <p className="text-xs text-muted-foreground">
              No matching template found for this workspace.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/settings',
  component: SettingsPage,
});
