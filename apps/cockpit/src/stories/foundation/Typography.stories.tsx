import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Foundation/Typography',
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj;

const scale = [
  {
    label: 'Display',
    className: 'text-3xl font-bold tracking-tight',
    sample: 'Dashboard Overview',
  },
  { label: 'Heading 1', className: 'text-2xl font-semibold tracking-tight', sample: 'Active Runs' },
  { label: 'Heading 2', className: 'text-xl font-semibold', sample: 'Work Items Pending' },
  { label: 'Heading 3', className: 'text-base font-semibold', sample: 'Invoice Remediation' },
  {
    label: 'Body',
    className: 'text-sm',
    sample: 'The workflow completed all 14 steps without intervention.',
  },
  {
    label: 'Body Small',
    className: 'text-xs',
    sample: 'Last updated 3 minutes ago by system agent.',
  },
  { label: 'Label', className: 'text-xs font-medium uppercase tracking-wide', sample: 'STATUS' },
  { label: 'Mono', className: 'font-mono text-sm', sample: 'RUN-2041 · EVD-00a3b2c1' },
  { label: 'Mono Small', className: 'font-mono text-xs', sample: 'sha256:4a3b...9f2e' },
];

function TypeScale() {
  return (
    <div className="bg-background p-6 space-y-6">
      {scale.map(({ label, className, sample }) => (
        <div
          key={label}
          className="flex items-baseline gap-4 border-b border-border pb-4 last:border-0"
        >
          <span className="text-muted-foreground text-[11px] w-20 shrink-0">{label}</span>
          <span className={`text-foreground ${className}`}>{sample}</span>
        </div>
      ))}
    </div>
  );
}

export const Scale: Story = { render: () => <TypeScale /> };
