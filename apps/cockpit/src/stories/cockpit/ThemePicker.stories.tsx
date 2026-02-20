import type { Meta, StoryObj } from '@storybook/react'
import { ThemePicker } from '@/components/cockpit/theme-picker'

const meta: Meta<typeof ThemePicker> = {
  title: 'Cockpit/ThemePicker',
  component: ThemePicker,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof ThemePicker>

export const Default: Story = {}
