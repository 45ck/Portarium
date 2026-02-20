import type { Meta, StoryObj } from '@storybook/react'
import { StepList } from './StepList'

const meta: Meta<typeof StepList> = {
  title: 'Cockpit/StepList',
  component: StepList,
}
export default meta
type Story = StoryObj<typeof StepList>

const steps = [
  { id: 's1', label: 'Fetch invoice', portFamily: 'erp' },
  { id: 's2', label: 'Classify mismatch' },
  { id: 's3', label: 'Propose correction', portFamily: 'erp' },
  { id: 's4', label: 'Await approval' },
  { id: 's5', label: 'Apply fix', portFamily: 'erp' },
]

export const FirstStep: Story = {
  args: { steps, currentStepIndex: 0 },
}

export const MidStep: Story = {
  args: { steps, currentStepIndex: 2 },
}

export const LastStep: Story = {
  args: { steps, currentStepIndex: 4 },
}

export const AllDone: Story = {
  args: { steps, currentStepIndex: steps.length },
}
