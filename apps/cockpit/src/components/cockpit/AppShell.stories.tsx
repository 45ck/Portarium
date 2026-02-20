import type { Meta, StoryObj } from '@storybook/react'
import { AppShell } from './AppShell'

const meta: Meta<typeof AppShell> = {
  title: 'Cockpit/AppShell',
  component: AppShell,
  decorators: [(Story) => <div style={{ height: '100vh' }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof AppShell>

const Placeholder = ({ label, color }: { label: string; color: string }) => (
  <div
    className="flex h-full w-full items-center justify-center font-bold text-white"
    style={{ background: color }}
  >
    {label}
  </div>
)

export const Default: Story = {
  args: {
    topbar: <Placeholder label="TopBar" color="#1b1b1b" />,
    sidebar: <Placeholder label="Sidebar" color="#6b6b6b" />,
    statusbar: <Placeholder label="StatusBar" color="#2557a7" />,
    children: <Placeholder label="Main Content" color="#f6f6f3" />,
  },
}

export const WithContent: Story = {
  args: {
    topbar: (
      <div className="flex h-full items-center px-4 text-sm font-bold">Portarium</div>
    ),
    sidebar: (
      <div className="space-y-2 p-3">
        <div className="rounded-[var(--radius-sm)] border-2 border-[rgb(var(--border))] bg-white p-2 text-sm font-bold shadow-[var(--shadow-card)]">Inbox</div>
        <div className="rounded-[var(--radius-sm)] border-2 border-[rgb(var(--border))] bg-white p-2 text-sm font-bold shadow-[var(--shadow-card)]">Work Items</div>
        <div className="rounded-[var(--radius-sm)] border-2 border-[rgb(var(--border))] bg-white p-2 text-sm font-bold shadow-[var(--shadow-card)]">Runs</div>
      </div>
    ),
    statusbar: (
      <div className="flex h-full items-center px-3 text-xs text-[rgb(var(--muted))]">
        3 runs active
      </div>
    ),
    children: (
      <div className="space-y-4">
        <h1 className="text-lg font-black">Dashboard</h1>
        <p className="text-sm text-[rgb(var(--muted))]">Welcome to Portarium cockpit.</p>
      </div>
    ),
  },
}
