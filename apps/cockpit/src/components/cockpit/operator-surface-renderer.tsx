import { useMemo, useState } from 'react';
import type {
  OperatorSurface,
  OperatorSurfaceAction,
  OperatorSurfaceBlock,
  OperatorSurfaceField,
  OperatorSurfaceInteraction,
  OperatorSurfaceTextTone,
} from '@portarium/cockpit-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface OperatorSurfaceRendererProps {
  surface: OperatorSurface;
  operatorUserId: string;
  nowIso?: () => string;
  onInteraction?: (interaction: OperatorSurfaceInteraction) => Promise<void> | void;
}

type FieldValue = string | number | boolean;

const TONE_CLASSES: Record<OperatorSurfaceTextTone, string> = {
  neutral: 'border-border bg-muted/30 text-foreground',
  info: 'border-blue-200 bg-blue-50 text-blue-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  critical: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export function OperatorSurfaceRenderer({
  surface,
  operatorUserId,
  nowIso = () => new Date().toISOString(),
  onInteraction,
}: OperatorSurfaceRendererProps) {
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const fieldIds = useMemo(() => buildFieldIds(surface), [surface]);

  if (!canRender(surface)) {
    return (
      <section
        aria-label={`${surface.title} generated operator surface`}
        className="rounded-md border border-dashed p-3 text-sm text-muted-foreground"
      >
        Generated operator surface awaiting approval.
      </section>
    );
  }

  async function submit(action: OperatorSurfaceAction) {
    const runId = surface.context.runId;
    const approvalId = surface.context.kind === 'Approval' ? surface.context.approvalId : undefined;
    await onInteraction?.({
      schemaVersion: 1,
      surfaceId: surface.surfaceId,
      workspaceId: surface.workspaceId,
      runId,
      ...(approvalId !== undefined ? { approvalId } : {}),
      actionId: action.actionId,
      intentKind: action.intentKind,
      submittedByUserId: operatorUserId,
      submittedAtIso: nowIso(),
      values,
    });
  }

  return (
    <section
      aria-label={`${surface.title} generated operator surface`}
      className="space-y-4 rounded-md border bg-background p-4"
      data-surface-id={surface.surfaceId}
    >
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">{surface.title}</h2>
          <Badge variant="outline">{surface.surfaceKind}</Badge>
          <Badge variant="secondary">{surface.lifecycle.status}</Badge>
        </div>
        {surface.description ? (
          <p className="text-xs text-muted-foreground">{surface.description}</p>
        ) : null}
      </header>

      {surface.blocks.map((block, index) => (
        <SurfaceBlock
          key={`${block.blockType}-${String(index)}`}
          block={block}
          fieldIds={fieldIds}
          values={values}
          setValue={(fieldId, value) => setValues((prev) => ({ ...prev, [fieldId]: value }))}
          submit={(action) => void submit(action)}
        />
      ))}
    </section>
  );
}

function SurfaceBlock({
  block,
  fieldIds,
  values,
  setValue,
  submit,
}: {
  block: OperatorSurfaceBlock;
  fieldIds: Record<string, string>;
  values: Record<string, FieldValue>;
  setValue: (fieldId: string, value: FieldValue) => void;
  submit: (action: OperatorSurfaceAction) => void;
}) {
  if (block.blockType === 'text') {
    const tone = block.tone ?? 'neutral';
    return (
      <p className={`rounded-md border px-3 py-2 text-sm ${TONE_CLASSES[tone]}`}>{block.text}</p>
    );
  }

  if (block.blockType === 'keyValueList') {
    return (
      <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        {block.items.map((item) => (
          <div key={item.label} className="rounded-md border px-3 py-2">
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className="font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  if (block.blockType === 'metric') {
    const tone = block.tone ?? 'neutral';
    return (
      <div className={`rounded-md border px-3 py-2 ${TONE_CLASSES[tone]}`}>
        <p className="text-xs">{block.label}</p>
        <p className="text-lg font-semibold">
          {block.value}
          {block.unit ? <span className="ml-1 text-xs font-normal">{block.unit}</span> : null}
        </p>
      </div>
    );
  }

  if (block.blockType === 'form') {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {block.fields.map((field) => (
          <OperatorSurfaceFieldControl
            key={field.fieldId}
            field={field}
            inputId={fieldIds[field.fieldId] ?? field.fieldId}
            value={values[field.fieldId]}
            setValue={(value) => setValue(field.fieldId, value)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {block.actions.map((action) => (
        <Button key={action.actionId} type="button" size="sm" onClick={() => submit(action)}>
          {action.label}
        </Button>
      ))}
    </div>
  );
}

function OperatorSurfaceFieldControl({
  field,
  inputId,
  value,
  setValue,
}: {
  field: OperatorSurfaceField;
  inputId: string;
  value: FieldValue | undefined;
  setValue: (value: FieldValue) => void;
}) {
  const label = `${field.label}${field.required ? ' *' : ''}`;
  const common = (
    <Label htmlFor={inputId} className="text-xs">
      {label}
    </Label>
  );

  if (field.widget === 'textarea') {
    return (
      <div className="space-y-1 sm:col-span-2">
        {common}
        <Textarea
          id={inputId}
          value={String(value ?? '')}
          onChange={(event) => setValue(event.target.value)}
          placeholder={field.placeholder}
        />
        {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
      </div>
    );
  }

  if (field.widget === 'select') {
    return (
      <div className="space-y-1">
        {common}
        <Select value={String(value ?? '')} onValueChange={setValue}>
          <SelectTrigger id={inputId}>
            <SelectValue placeholder={field.placeholder ?? `Select ${field.label}`} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
      </div>
    );
  }

  if (field.widget === 'checkbox') {
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
        <Checkbox
          id={inputId}
          checked={Boolean(value)}
          onCheckedChange={(next) => setValue(next === true)}
        />
        {common}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {common}
      <Input
        id={inputId}
        type={field.widget === 'number' ? 'number' : 'text'}
        value={String(value ?? '')}
        onChange={(event) => {
          const next = field.widget === 'number' ? Number(event.target.value) : event.target.value;
          setValue(next);
        }}
        placeholder={field.placeholder}
      />
      {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
    </div>
  );
}

function canRender(surface: OperatorSurface): boolean {
  return ['Approved', 'Rendered', 'Used'].includes(surface.lifecycle.status);
}

function buildFieldIds(surface: OperatorSurface): Record<string, string> {
  const pairs: [string, string][] = [];
  for (const block of surface.blocks) {
    if (block.blockType === 'form') {
      for (const field of block.fields) {
        pairs.push([field.fieldId, `operator-surface-${surface.surfaceId}-${field.fieldId}`]);
      }
    }
  }
  return Object.fromEntries(pairs);
}
