import { useEffect, useMemo } from 'react';
import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { PageHeader } from '@/components/cockpit/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { usePackUiRuntime } from '@/hooks/queries/use-pack-ui-runtime';
import { applyThemeTokens, resolveTemplate } from '@/lib/packs/pack-runtime';
import { useUIStore } from '@/stores/ui-store';
import type { RuntimeSchemaProperty } from '@/lib/packs/types';

const CHANGE_REQUEST_TEMPLATE_ID = 'ui-scm-change-request-form';

function PackRuntimePage() {
  const { activeWorkspaceId: wsId } = useUIStore();
  const { data, isLoading } = usePackUiRuntime(wsId);

  const resolved = useMemo(() => {
    if (!data) return null;
    return resolveTemplate(data, CHANGE_REQUEST_TEMPLATE_ID);
  }, [data]);

  useEffect(() => {
    if (!data) return;
    applyThemeTokens(data);
  }, [data]);

  const schema = resolved ? data?.schemas[resolved.template.schemaRef] : null;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Pack Runtime"
        description="Resolved pack templates and safe theme token application for this workspace"
      />

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Template Resolution</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          {isLoading ? (
            <Skeleton className="h-4 w-40" />
          ) : !resolved ? (
            <p role="alert" className="text-destructive">
              No template is available for {CHANGE_REQUEST_TEMPLATE_ID}.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {resolved.source === 'pack' ? 'Pack template' : 'Core fallback'}
              </Badge>
              <span className="font-mono">{resolved.template.templateId}</span>
              <span className="text-muted-foreground">{resolved.template.packId}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Schema-driven Form</CardTitle>
        </CardHeader>
        <CardContent>
          {!resolved || !schema ? (
            <p className="text-xs text-muted-foreground">No renderable schema available.</p>
          ) : (
            <form aria-label="Pack template form" className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {resolved.template.fields.map((field) => (
                <SchemaField
                  key={field.fieldName}
                  fieldName={field.fieldName}
                  label={field.label}
                  widget={field.widget}
                  property={schema.properties[field.fieldName]}
                />
              ))}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SchemaField({
  fieldName,
  label,
  widget,
  property,
}: {
  fieldName: string;
  label?: string;
  widget: 'text' | 'select' | 'textarea';
  property?: RuntimeSchemaProperty;
}) {
  const id = `pack-field-${fieldName}`;
  const fieldLabel = label ?? property?.title ?? fieldName;

  if (widget === 'select') {
    const options = property?.enum ?? [];
    return (
      <div className="space-y-1 md:col-span-1">
        <label htmlFor={id} className="text-xs font-medium">
          {fieldLabel}
        </label>
        <select
          id={id}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            Select...
          </option>
          {options.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (widget === 'textarea') {
    return (
      <div className="space-y-1 md:col-span-2">
        <label htmlFor={id} className="text-xs font-medium">
          {fieldLabel}
        </label>
        <Textarea id={id} rows={4} placeholder={fieldLabel} />
      </div>
    );
  }

  return (
    <div className="space-y-1 md:col-span-1">
      <label htmlFor={id} className="text-xs font-medium">
        {fieldLabel}
      </label>
      <Input id={id} placeholder={fieldLabel} />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore/pack-runtime',
  component: PackRuntimePage,
});
