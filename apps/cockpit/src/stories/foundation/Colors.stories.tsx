import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Foundation/Colors',
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj;

const swatches = [
  { token: '--background', label: 'Background' },
  { token: '--foreground', label: 'Foreground' },
  { token: '--card', label: 'Card' },
  { token: '--primary', label: 'Primary' },
  { token: '--primary-foreground', label: 'Primary FG' },
  { token: '--secondary', label: 'Secondary' },
  { token: '--muted', label: 'Muted' },
  { token: '--muted-foreground', label: 'Muted FG' },
  { token: '--accent', label: 'Accent' },
  { token: '--destructive', label: 'Destructive' },
  { token: '--border', label: 'Border' },
  { token: '--success', label: 'Success' },
  { token: '--warning', label: 'Warning' },
  { token: '--info', label: 'Info' },
];

function ColorPalette() {
  return (
    <div className="bg-background p-6">
      <h2 className="text-foreground text-sm font-semibold mb-4">Color Tokens</h2>
      <div className="grid grid-cols-7 gap-3">
        {swatches.map(({ token, label }) => (
          <div key={token} className="flex flex-col gap-1">
            <div
              className="h-14 w-full rounded-md border border-border"
              style={{ background: `var(${token})` }}
            />
            <span className="text-muted-foreground text-[11px]">{label}</span>
            <span className="text-foreground text-[10px] font-mono opacity-60">{token}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const Palette: Story = { render: () => <ColorPalette /> };
