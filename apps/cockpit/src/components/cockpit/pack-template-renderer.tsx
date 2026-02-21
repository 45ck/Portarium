import { useMemo, useState } from 'react';
import type { RuntimeUiTemplate } from '@/lib/packs/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface PackTemplateRendererProps {
  template: RuntimeUiTemplate;
}

export function PackTemplateRenderer({ template }: PackTemplateRendererProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const fieldIds = useMemo(
    () =>
      Object.fromEntries(
        template.fields.map((field) => [
          field.fieldName,
          `pack-field-${template.templateId}-${field.fieldName}`,
        ]),
      ),
    [template.fields, template.templateId],
  );

  return (
    <form
      className="grid grid-cols-1 md:grid-cols-2 gap-3"
      aria-label={`${template.templateId} form`}
    >
      {template.fields.map((field) => {
        const id = fieldIds[field.fieldName]!;
        const label = field.label ?? field.fieldName;
        const value = values[field.fieldName] ?? '';

        if (field.widget === 'select') {
          return (
            <div key={field.fieldName} className="space-y-1 md:col-span-1">
              <Label htmlFor={id} className="text-xs">
                {label}
              </Label>
              <Select
                value={value || 'unset'}
                onValueChange={(next) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.fieldName]: next === 'unset' ? '' : next,
                  }))
                }
              >
                <SelectTrigger id={id} className="h-8 text-xs">
                  <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Not set</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        }

        if (field.widget === 'textarea') {
          return (
            <div key={field.fieldName} className="space-y-1 md:col-span-2">
              <Label htmlFor={id} className="text-xs">
                {label}
              </Label>
              <Textarea
                id={id}
                className="text-xs min-h-[84px]"
                value={value}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [field.fieldName]: event.target.value }))
                }
                placeholder={label}
              />
            </div>
          );
        }

        return (
          <div key={field.fieldName} className="space-y-1 md:col-span-1">
            <Label htmlFor={id} className="text-xs">
              {label}
            </Label>
            <Input
              id={id}
              className="h-8 text-xs"
              value={value}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, [field.fieldName]: event.target.value }))
              }
              placeholder={label}
            />
          </div>
        );
      })}
      <div className="md:col-span-2 pt-1">
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs">
          Save Draft
        </Button>
      </div>
    </form>
  );
}
