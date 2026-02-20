import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

const meta: Meta = {
  title: 'Primitives/Inputs',
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj;

export const FormControls: Story = {
  render: () => (
    <div className="bg-background p-6 max-w-sm space-y-5">
      <div className="space-y-1.5">
        <Label>Workspace</Label>
        <Input placeholder="Enter workspace name..." />
      </div>
      <div className="space-y-1.5">
        <Label>Execution Tier</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select tier..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dryrun">Dry Run</SelectItem>
            <SelectItem value="supervised">Supervised</SelectItem>
            <SelectItem value="autonomous">Autonomous</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Rationale</Label>
        <Textarea placeholder="Provide approval rationale..." rows={3} />
      </div>
      <div className="flex items-center gap-2">
        <Switch id="notify" />
        <Label htmlFor="notify">Notify on completion</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="sod" />
        <Label htmlFor="sod">I confirm SoD compliance</Label>
      </div>
    </div>
  ),
};
